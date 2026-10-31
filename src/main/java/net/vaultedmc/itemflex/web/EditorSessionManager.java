package net.vaultedmc.itemflex.web;

import lombok.NonNull;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public class EditorSessionManager {

    private static final long LOGIN_TOKEN_LIFETIME = TimeUnit.MINUTES.toMillis(5);

    private record LoginToken(UUID playerId, String playerName, boolean canEditCommands, long expiresAt) {
    }

    private final SecureRandom random = new SecureRandom();
    private final long sessionLifetime;

    private final Map<String, LoginToken> loginTokens = new ConcurrentHashMap<>();
    private final Map<String, EditorSession> sessions = new ConcurrentHashMap<>();

    public EditorSessionManager(int sessionMinutes) {
        this.sessionLifetime = TimeUnit.MINUTES.toMillis(Math.max(1, sessionMinutes));
    }

    public String createLoginToken(@NonNull UUID playerId, @NonNull String playerName, boolean canEditCommands) {
        purgeExpired();

        String token = randomString();
        loginTokens.put(token, new LoginToken(playerId, playerName, canEditCommands, System.currentTimeMillis() + LOGIN_TOKEN_LIFETIME));
        return token;
    }

    public Optional<EditorSession> redeem(String token) {
        if (token == null) {
            return Optional.empty();
        }

        LoginToken loginToken = loginTokens.remove(token);

        if (loginToken == null || loginToken.expiresAt() < System.currentTimeMillis()) {
            return Optional.empty();
        }

        EditorSession session = new EditorSession(randomString(), loginToken.playerId(), loginToken.playerName(), loginToken.canEditCommands());
        session.setExpiresAt(System.currentTimeMillis() + sessionLifetime);

        sessions.put(session.getId(), session);
        return Optional.of(session);
    }

    public Optional<EditorSession> getSession(String id) {
        if (id == null) {
            return Optional.empty();
        }

        EditorSession session = sessions.get(id);

        if (session == null) {
            return Optional.empty();
        }

        long now = System.currentTimeMillis();

        if (session.getExpiresAt() < now) {
            sessions.remove(id);
            return Optional.empty();
        }

        session.setExpiresAt(now + sessionLifetime);
        return Optional.of(session);
    }

    public long getSessionLifetimeSeconds() {
        return TimeUnit.MILLISECONDS.toSeconds(sessionLifetime);
    }

    public void clear() {
        loginTokens.clear();
        sessions.clear();
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();

        loginTokens.values().removeIf(token -> token.expiresAt() < now);
        sessions.values().removeIf(session -> session.getExpiresAt() < now);
    }

    private String randomString() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

}
