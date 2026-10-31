package net.vaultedmc.itemflex.web;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import lombok.Getter;
import lombok.NonNull;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.animation.AnimationManager;
import net.vaultedmc.itemflex.animation.definition.AnimationDefinition;
import net.vaultedmc.itemflex.animation.definition.CommandSource;
import net.vaultedmc.itemflex.animation.definition.Easing;
import net.vaultedmc.itemflex.animation.definition.EventType;
import net.vaultedmc.itemflex.animation.definition.TimelineEvent;
import net.vaultedmc.itemflex.animation.definition.TrackProperty;
import net.vaultedmc.itemflex.animation.definition.TrackTarget;
import org.bukkit.Bukkit;
import org.bukkit.Particle;
import org.bukkit.Registry;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

public class EditorServer {

    private static final int MAX_BODY_BYTES = 1024 * 1024;
    private static final String SESSION_COOKIE = "itemflex_session";
    private static final Pattern MC_ASSET = Pattern.compile(
            "(textures/(item|block|particle|font)/[a-z0-9_/.-]+\\.png|models/(item|block)/[a-z0-9_/.-]+\\.json|items/[a-z0-9_.-]+\\.json|particles/[a-z0-9_.-]+\\.json|font/[a-z0-9_/.-]+\\.json|textures/entity/player/(wide|slim)/[a-z0-9_]+\\.png)");
    private static final Pattern SOUND_ASSET = Pattern.compile("[a-z0-9_/-]+\\.ogg");
    private static final Pattern STATIC_FILE = Pattern.compile("[a-zA-Z0-9_-]+\\.(html|js|css|svg)");

    private final ItemFlex plugin;
    private final Gson gson = new Gson();

    @Getter
    private EditorSessionManager sessionManager;

    private HttpServer server;
    private ExecutorService executor;
    private JsonObject metaCache;
    private AssetManager assetManager;

    private int port;
    private String publicUrl;
    private volatile String detectedHost;

    public EditorServer(@NonNull ItemFlex plugin) {
        this.plugin = plugin;
    }

    public boolean isRunning() {
        return server != null;
    }

    public void start() {
        if (server != null) {
            return;
        }

        if (!plugin.getConfig().getBoolean("Editor.Enabled", true)) {
            return;
        }

        port = plugin.getConfig().getInt("Editor.Port", 8765);
        String bindAddress = plugin.getConfig().getString("Editor.Bind-Address", "0.0.0.0");
        publicUrl = plugin.getConfig().getString("Editor.Public-URL", "");

        sessionManager = new EditorSessionManager(plugin.getConfig().getInt("Editor.Session-Minutes", 60));
        metaCache = buildMeta();

        assetManager = new AssetManager(plugin);
        assetManager.start();

        try {
            server = HttpServer.create(new InetSocketAddress(bindAddress, port), 0);
        } catch (IOException | IllegalArgumentException e) {
            if (bindAddress.equals("0.0.0.0")) {
                plugin.getLogger().severe("Failed to start the web editor on " + bindAddress + ":" + port + ": " + e.getMessage());
                sessionManager = null;
                return;
            }

            plugin.getLogger().warning("Could not bind the web editor to " + bindAddress + " (" + e.getMessage() + "). Use 0.0.0.0 for Bind-Address and set Public-URL for your public address. Falling back to 0.0.0.0.");
            bindAddress = "0.0.0.0";

            try {
                server = HttpServer.create(new InetSocketAddress(bindAddress, port), 0);
            } catch (IOException | IllegalArgumentException retry) {
                plugin.getLogger().severe("Failed to start the web editor on " + bindAddress + ":" + port + ": " + retry.getMessage());
                sessionManager = null;
                return;
            }
        }

        executor = Executors.newFixedThreadPool(4, runnable -> {
            Thread thread = new Thread(runnable, "ItemFlex-Editor");
            thread.setDaemon(true);
            return thread;
        });

        server.setExecutor(executor);
        server.createContext("/", this::handle);
        server.start();

        plugin.getLogger().info("Web editor listening on " + bindAddress + ":" + port + ".");

        if (publicUrl == null || publicUrl.isBlank()) {
            if (plugin.getConfig().getBoolean("Editor.Detect-Public-IP", true)) {
                detectPublicHost();
                return;
            }
        }

        logLinkInfo();
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }

        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }

        if (assetManager != null) {
            assetManager.stop();
            assetManager = null;
        }

        if (sessionManager != null) {
            sessionManager.clear();
            sessionManager = null;
        }
    }

    public boolean isLocalLink() {
        String host;

        try {
            host = URI.create(resolveBaseUrl()).getHost();
        } catch (IllegalArgumentException e) {
            return true;
        }

        if (host == null || host.equalsIgnoreCase("localhost")) {
            return true;
        }

        try {
            InetAddress address = InetAddress.getByName(host);
            return address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress();
        } catch (IOException e) {
            return false;
        }
    }

    public String resolveBaseUrl() {
        String base = publicUrl == null ? "" : publicUrl.trim();

        if (base.isEmpty()) {
            String host = detectedHost;

            if (host == null) {
                String ip = Bukkit.getIp();
                host = ip == null || ip.isBlank() ? "localhost" : ip;
            }

            base = "http://" + host + ":" + port;
        }

        if (!base.contains("://")) {
            base = "http://" + base;
        }

        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        return base;
    }

    private void detectPublicHost() {
        plugin.getFoliaLib().getScheduler().runAsync(task -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL("https://api.ipify.org").openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);

                try (InputStream stream = connection.getInputStream()) {
                    String ip = new String(stream.readAllBytes(), StandardCharsets.UTF_8).trim();

                    if (ip.matches("[0-9a-fA-F.:]{3,45}")) {
                        detectedHost = ip;
                    }
                }
            } catch (IOException e) {
                plugin.getLogger().warning("Could not detect the server's public IP. Set Editor.Public-URL in config.yml.");
            }

            logLinkInfo();
        });
    }

    private void logLinkInfo() {
        String base = resolveBaseUrl();
        plugin.getLogger().info("Editor links will use " + base + ".");

        if (isLocalLink()) {
            plugin.getLogger().warning("That address is local, so players outside this machine cannot open it. Allocate the port " + port + " in your host panel and set Editor.Public-URL to http://<public-ip>:" + port + " in config.yml.");
        }
    }

    public String createLoginUrl(@NonNull java.util.UUID playerId, @NonNull String playerName, boolean canEditCommands) {
        String token = sessionManager.createLoginToken(playerId, playerName, canEditCommands);

        String base = resolveBaseUrl();

        return base + "/auth?token=" + token;
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if (path.equals("/auth") && method.equals("GET")) {
                handleAuth(exchange);
                return;
            }

            if (path.startsWith("/api/")) {
                handleApi(exchange, path, method);
                return;
            }

            if (path.startsWith("/assets/") && method.equals("GET")) {
                handleAssets(exchange, path);
                return;
            }

            if (method.equals("GET")) {
                handleStatic(exchange, path);
                return;
            }

            sendText(exchange, 405, "Method not allowed");
        } catch (Exception e) {
            plugin.getLogger().warning("Web editor request failed: " + e.getMessage());
            sendJson(exchange, 500, error("Internal error."));
        } finally {
            exchange.close();
        }
    }

    private void handleAuth(HttpExchange exchange) throws IOException {
        String token = getQueryParameter(exchange.getRequestURI(), "token");
        Optional<EditorSession> session = sessionManager.redeem(token);

        if (session.isEmpty()) {
            sendText(exchange, 403, "This link is invalid or has expired. Run /itemflex editor in game for a new one.");
            return;
        }

        exchange.getResponseHeaders().add("Set-Cookie", SESSION_COOKIE + "=" + session.get().getId()
                + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + sessionManager.getSessionLifetimeSeconds());
        exchange.getResponseHeaders().add("Location", "/");
        exchange.getResponseHeaders().add("Cache-Control", "no-store");
        exchange.sendResponseHeaders(302, -1);
    }

    private void handleStatic(HttpExchange exchange, String path) throws IOException {
        String fileName = path.equals("/") ? "index.html" : path.substring(1);

        if (!STATIC_FILE.matcher(fileName).matches()) {
            sendText(exchange, 404, "Not found");
            return;
        }

        byte[] body = readStaticFile(fileName);

        if (body == null) {
            sendText(exchange, 404, "Not found");
            return;
        }

        String extension = fileName.substring(fileName.lastIndexOf('.') + 1);

        exchange.getResponseHeaders().add("Content-Type", contentType(extension));
        exchange.getResponseHeaders().add("Cache-Control", "no-cache");
        addSecurityHeaders(exchange);
        send(exchange, 200, body);
    }

    private byte[] readStaticFile(String fileName) throws IOException {
        String webFolder = plugin.getConfig().getString("Editor.Web-Folder", "");

        if (!webFolder.isBlank()) {
            java.io.File file = new java.io.File(webFolder, fileName);
            return file.isFile() ? java.nio.file.Files.readAllBytes(file.toPath()) : null;
        }

        try (InputStream stream = plugin.getResource("web/" + fileName)) {
            return stream == null ? null : stream.readAllBytes();
        }
    }

    private void handleApi(HttpExchange exchange, String path, String method) throws IOException {
        EditorSession session = getSession(exchange).orElse(null);

        if (session == null) {
            sendJson(exchange, 401, error("Session expired. Run /itemflex editor in game for a new link."));
            return;
        }

        if (!method.equals("GET") && !"1".equals(exchange.getRequestHeaders().getFirst("X-ItemFlex"))) {
            sendJson(exchange, 403, error("Missing request header."));
            return;
        }

        String[] segments = path.substring("/api/".length()).split("/");
        AnimationManager animationManager = plugin.getAnimationManager();

        if (segments.length == 1 && segments[0].equals("session") && method.equals("GET")) {
            JsonObject response = new JsonObject();
            response.addProperty("player", session.getPlayerName());
            response.addProperty("canEditCommands", session.isCanEditCommands());
            sendJson(exchange, 200, response);
            return;
        }

        if (segments.length == 1 && segments[0].equals("meta") && method.equals("GET")) {
            sendJson(exchange, 200, metaCache);
            return;
        }

        if (segments[0].equals("assets") && segments.length == 2 && method.equals("GET")) {
            handleAssetApi(exchange, segments[1]);
            return;
        }

        if (!segments[0].equals("animations")) {
            sendJson(exchange, 404, error("Not found."));
            return;
        }

        if (segments.length == 1 && method.equals("GET")) {
            JsonArray list = new JsonArray();

            for (AnimationDefinition definition : animationManager.getAnimations()) {
                JsonObject entry = new JsonObject();
                entry.addProperty("name", definition.getName());
                entry.addProperty("permission", definition.getPermission());
                entry.addProperty("priority", definition.getPriority());
                entry.addProperty("duration", definition.getDuration());
                list.add(entry);
            }

            sendJson(exchange, 200, list);
            return;
        }

        if (segments.length != 2) {
            sendJson(exchange, 404, error("Not found."));
            return;
        }

        String name = segments[1].toLowerCase(Locale.ROOT);

        if (!AnimationManager.isValidName(name)) {
            sendJson(exchange, 400, error("Names may only contain a-z, 0-9, '_' and '-' (max 32 characters)."));
            return;
        }

        switch (method) {
            case "GET":
                Optional<AnimationDefinition> definition = animationManager.getAnimation(name);

                if (definition.isEmpty()) {
                    sendJson(exchange, 404, error("Unknown animation."));
                    return;
                }

                sendJson(exchange, 200, JsonParser.parseString(animationManager.toJson(definition.get())));
                return;
            case "PUT":
                handleSave(exchange, session, name);
                return;
            case "DELETE":
                handleDelete(exchange, name);
                return;
            default:
                sendJson(exchange, 405, error("Method not allowed."));
        }
    }


    private void handleAssetApi(HttpExchange exchange, String what) throws IOException {
        JsonObject response = new JsonObject();
        AssetManager assets = assetManager;

        if (what.equals("status")) {
            response.addProperty("state", assets.getState().name());
            response.addProperty("message", assets.getMessage());
            response.addProperty("version", assets.getVersion());
            sendJson(exchange, 200, response);
            return;
        }

        if (!assets.isReady()) {
            sendJson(exchange, 503, error(assets.getMessage().isEmpty() ? "Assets are not ready yet." : assets.getMessage()));
            return;
        }

        if (what.equals("items")) {
            sendJson(exchange, 200, toArray(assets.listClientFiles("items", ".json")));
            return;
        }

        if (what.equals("particles")) {
            sendJson(exchange, 200, toArray(assets.listClientFiles("particles", ".json")));
            return;
        }

        sendJson(exchange, 404, error("Not found."));
    }

    private void handleAssets(HttpExchange exchange, String path) throws IOException {
        if (getSession(exchange).isEmpty()) {
            sendText(exchange, 401, "Session expired.");
            return;
        }

        AssetManager assets = assetManager;

        if (assets == null || !assets.isReady()) {
            sendText(exchange, 503, "Assets are not ready yet.");
            return;
        }

        String relative = path.substring("/assets/".length());
        Optional<byte[]> data = Optional.empty();
        String type = "application/octet-stream";

        if (relative.contains("..")) {
            sendText(exchange, 400, "Bad path");
            return;
        }

        if (relative.startsWith("mc/") && MC_ASSET.matcher(relative.substring(3)).matches()) {
            String file = relative.substring(3);
            data = assets.readClientFile(file);
            type = file.endsWith(".png") ? "image/png" : "application/json";
        } else if (relative.startsWith("sound/") && SOUND_ASSET.matcher(relative.substring(6)).matches()) {
            String file = relative.substring(6);
            data = assets.readSound(file.substring(0, file.length() - 4));
            type = "audio/ogg";
        } else if (relative.equals("sounds.json")) {
            data = assets.readAsset("minecraft/sounds.json");
            type = "application/json";
        } else if (relative.equals("lang.json")) {
            data = assets.readClientFile("lang/en_us.json");

            if (data.isEmpty()) {
                data = assets.readAsset("minecraft/lang/en_us.json");
            }

            type = "application/json";
        }

        if (data.isEmpty()) {
            sendText(exchange, 404, "Not found");
            return;
        }

        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.getResponseHeaders().add("Cache-Control", "private, max-age=86400");
        exchange.getResponseHeaders().add("X-Content-Type-Options", "nosniff");
        send(exchange, 200, data.get());
    }

    private void handleSave(HttpExchange exchange, EditorSession session, String name) throws IOException {
        byte[] body = readBody(exchange);

        if (body == null) {
            sendJson(exchange, 413, error("Request too large."));
            return;
        }

        AnimationManager animationManager = plugin.getAnimationManager();
        AnimationDefinition definition;

        try {
            definition = animationManager.parse(new String(body, StandardCharsets.UTF_8));
        } catch (JsonParseException e) {
            sendJson(exchange, 400, error("Invalid animation data: " + e.getMessage()));
            return;
        }

        List<String> warnings = definition.sanitize();

        if (!session.isCanEditCommands()) {
            List<String> previous = animationManager.getAnimation(name)
                    .map(this::commandSignatures)
                    .orElse(List.of());

            if (!previous.equals(commandSignatures(definition))) {
                sendJson(exchange, 403, error("You need the command editor permission to change command events."));
                return;
            }
        }

        try {
            animationManager.save(name, definition);
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to save animation '" + name + "': " + e.getMessage());
            sendJson(exchange, 500, error("Failed to save the animation."));
            return;
        }

        plugin.getLogger().info(session.getPlayerName() + " saved animation '" + name + "' via the web editor.");

        JsonObject response = new JsonObject();
        JsonArray warningArray = new JsonArray();
        warnings.forEach(warningArray::add);

        response.add("warnings", warningArray);
        response.add("animation", JsonParser.parseString(animationManager.toJson(definition)));
        sendJson(exchange, 200, response);
    }

    private void handleDelete(HttpExchange exchange, String name) throws IOException {
        try {
            if (!plugin.getAnimationManager().delete(name)) {
                sendJson(exchange, 400, error("That animation cannot be deleted."));
                return;
            }
        } catch (IOException e) {
            sendJson(exchange, 500, error("Failed to delete the animation."));
            return;
        }

        JsonObject response = new JsonObject();
        response.addProperty("deleted", true);
        sendJson(exchange, 200, response);
    }

    private List<String> commandSignatures(AnimationDefinition definition) {
        List<String> signatures = new ArrayList<>();

        for (TimelineEvent event : definition.getEvents()) {
            if (event.getType() == EventType.COMMAND) {
                signatures.add(gson.toJson(event));
            }
        }

        signatures.sort(Comparator.naturalOrder());
        return signatures;
    }

    private Optional<EditorSession> getSession(HttpExchange exchange) {
        List<String> cookies = exchange.getRequestHeaders().get("Cookie");

        if (cookies == null) {
            return Optional.empty();
        }

        for (String header : cookies) {
            for (String cookie : header.split(";")) {
                String[] parts = cookie.trim().split("=", 2);

                if (parts.length == 2 && parts[0].equals(SESSION_COOKIE)) {
                    return sessionManager.getSession(parts[1]);
                }
            }
        }

        return Optional.empty();
    }

    private JsonObject buildMeta() {
        JsonObject meta = new JsonObject();

        JsonArray particles = new JsonArray();

        Arrays.stream(Particle.values())
                .filter(particle -> particle.getDataType() == Void.class)
                .sorted(Comparator.comparing(Enum::name))
                .forEach(particle -> {
                    JsonObject entry = new JsonObject();
                    entry.addProperty("name", particle.name());
                    entry.addProperty("key", particle.getKey().getKey());
                    particles.add(entry);
                });

        meta.add("particles", particles);

        meta.add("sounds", toArray(Registry.SOUNDS.stream()
                .map(sound -> sound.getKey().toString())
                .sorted()
                .toList()));

        meta.add("easings", toArray(Arrays.stream(Easing.values()).map(Enum::name).toList()));
        meta.add("eventTypes", toArray(Arrays.stream(EventType.values()).map(Enum::name).toList()));
        meta.add("commandSources", toArray(Arrays.stream(CommandSource.values()).map(Enum::name).toList()));
        meta.add("billboards", toArray(Arrays.stream(Display.Billboard.values()).map(Enum::name).toList()));
        meta.add("displayTransforms", toArray(Arrays.stream(ItemDisplay.ItemDisplayTransform.values()).map(Enum::name).toList()));

        JsonObject targets = new JsonObject();

        for (TrackTarget target : TrackTarget.values()) {
            targets.add(target.name(), toArray(Arrays.stream(TrackProperty.values())
                    .filter(target::supports)
                    .map(Enum::name)
                    .toList()));
        }

        meta.add("targets", targets);

        JsonObject properties = new JsonObject();

        for (TrackProperty property : TrackProperty.values()) {
            properties.addProperty(property.name(), property.getIdentity());
        }

        meta.add("identities", properties);

        JsonObject limits = new JsonObject();
        limits.addProperty("maxDuration", AnimationDefinition.MAX_DURATION);
        meta.add("limits", limits);

        return meta;
    }

    private JsonArray toArray(List<String> values) {
        JsonArray array = new JsonArray();
        values.forEach(array::add);
        return array;
    }

    private JsonObject error(String message) {
        JsonObject object = new JsonObject();
        object.addProperty("error", message);
        return object;
    }

    private byte[] readBody(HttpExchange exchange) throws IOException {
        try (InputStream stream = exchange.getRequestBody()) {
            byte[] body = stream.readNBytes(MAX_BODY_BYTES + 1);
            return body.length > MAX_BODY_BYTES ? null : body;
        }
    }

    private String getQueryParameter(URI uri, String key) {
        String query = uri.getRawQuery();

        if (query == null) {
            return null;
        }

        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);

            if (parts.length == 2 && parts[0].equals(key)) {
                return URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
            }
        }

        return null;
    }

    private String contentType(String extension) {
        switch (extension) {
            case "html":
                return "text/html; charset=utf-8";
            case "js":
                return "text/javascript; charset=utf-8";
            case "css":
                return "text/css; charset=utf-8";
            default:
                return "image/svg+xml";
        }
    }

    private void addSecurityHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().add("X-Frame-Options", "DENY");
        exchange.getResponseHeaders().add("Referrer-Policy", "no-referrer");
        exchange.getResponseHeaders().add("Content-Security-Policy",
                "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
    }

    private void sendJson(HttpExchange exchange, int status, JsonElement element) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().add("Cache-Control", "no-store");
        addSecurityHeaders(exchange);
        send(exchange, status, gson.toJson(element).getBytes(StandardCharsets.UTF_8));
    }

    private void sendText(HttpExchange exchange, int status, String text) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "text/plain; charset=utf-8");
        addSecurityHeaders(exchange);
        send(exchange, status, text.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isCompressible(HttpExchange exchange, int length) {
        String type = exchange.getResponseHeaders().getFirst("Content-Type");
        String accepted = exchange.getRequestHeaders().getFirst("Accept-Encoding");

        if (length < 1024 || type == null || accepted == null || !accepted.contains("gzip")) {
            return false;
        }

        return type.startsWith("text/") || type.startsWith("application/json") || type.startsWith("image/svg");
    }

    private byte[] compress(byte[] body) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream(body.length / 3);

        try (GZIPOutputStream gzip = new GZIPOutputStream(buffer)) {
            gzip.write(body);
        }

        return buffer.toByteArray();
    }

    private void send(HttpExchange exchange, int status, byte[] body) throws IOException {
        if (isCompressible(exchange, body.length)) {
            body = compress(body);
            exchange.getResponseHeaders().add("Content-Encoding", "gzip");
            exchange.getResponseHeaders().add("Vary", "Accept-Encoding");
        }

        exchange.sendResponseHeaders(status, body.length);

        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(body);
        }
    }

}
