package net.vaultedmc.itemflex.util;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class CooldownTracker {

    private final Map<UUID, Long> expiries = new ConcurrentHashMap<>();

    public void start(UUID id, long millis) {
        expiries.put(id, System.currentTimeMillis() + millis);
    }

    public long remaining(UUID id) {
        Long expiry = expiries.get(id);

        if (expiry == null) {
            return 0;
        }

        long left = expiry - System.currentTimeMillis();

        if (left <= 0) {
            expiries.remove(id, expiry);
            return 0;
        }

        return left;
    }

}
