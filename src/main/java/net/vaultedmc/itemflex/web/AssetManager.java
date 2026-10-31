package net.vaultedmc.itemflex.web;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lombok.Getter;
import lombok.NonNull;
import net.vaultedmc.itemflex.ItemFlex;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class AssetManager {

    public enum State {
        DISABLED,
        STARTING,
        DOWNLOADING,
        READY,
        FAILED
    }

    private static final String VERSION_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    private static final String RESOURCES_URL = "https://resources.download.minecraft.net/";
    private static final String SOUND_PREFIX = "minecraft/sounds/";

    private final ItemFlex plugin;
    private final File folder;
    private final File soundFolder;
    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final Set<String> downloading = ConcurrentHashMap.newKeySet();

    @Getter
    private volatile State state = State.STARTING;
    @Getter
    private volatile String message = "";
    @Getter
    private volatile String version = "";

    private volatile ZipFile clientJar;
    private volatile JsonObject assetObjects = new JsonObject();

    public AssetManager(@NonNull ItemFlex plugin) {
        this.plugin = plugin;
        this.folder = new File(plugin.getDataFolder(), "assets");
        this.soundFolder = new File(folder, "objects");
    }

    public boolean isReady() {
        return state == State.READY;
    }

    public void start() {
        if (!plugin.getConfig().getBoolean("Editor.Assets.Enabled", true)) {
            state = State.DISABLED;
            message = "Asset downloads are disabled in config.yml.";
            tryLoadCache();
            return;
        }

        plugin.getFoliaLib().getScheduler().runAsync(task -> prepare());
    }

    public void stop() {
        ZipFile jar = clientJar;
        clientJar = null;

        if (jar == null) {
            return;
        }

        try {
            jar.close();
        } catch (IOException ignored) {
        }
    }

    private void tryLoadCache() {
        File jar = new File(folder, "client.jar");
        File index = new File(folder, "index.json");

        if (!jar.exists() || !index.exists()) {
            return;
        }

        try {
            load(jar, index, Files.readString(new File(folder, "version.txt").toPath()).trim());
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to read cached assets: " + e.getMessage());
        }
    }

    private void prepare() {
        try {
            state = State.DOWNLOADING;
            message = "Checking Minecraft version...";

            Files.createDirectories(soundFolder.toPath());

            File jar = new File(folder, "client.jar");
            File index = new File(folder, "index.json");
            File versionFile = new File(folder, "version.txt");

            String wanted = plugin.getConfig().getString("Editor.Assets.Version", "latest");
            JsonObject versionJson;

            try {
                versionJson = resolveVersion(wanted);
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }

                if (jar.exists() && index.exists() && versionFile.exists()) {
                    plugin.getLogger().warning("Could not reach Mojang (" + e.getMessage() + "), using cached assets.");
                    load(jar, index, Files.readString(versionFile.toPath()).trim());
                    return;
                }

                throw e;
            }

            String id = versionJson.get("id").getAsString();
            boolean cached = jar.exists() && index.exists() && versionFile.exists()
                    && Files.readString(versionFile.toPath()).trim().equals(id);

            if (!cached) {
                JsonObject clientDownload = versionJson.getAsJsonObject("downloads").getAsJsonObject("client");
                JsonObject assetIndex = versionJson.getAsJsonObject("assetIndex");

                message = "Downloading Minecraft " + id + " client assets...";
                plugin.getLogger().info("Downloading Minecraft " + id + " assets from Mojang for the web editor...");

                download(clientDownload.get("url").getAsString(), jar, clientDownload.get("sha1").getAsString());
                download(assetIndex.get("url").getAsString(), index, assetIndex.get("sha1").getAsString());
                Files.writeString(versionFile.toPath(), id);
            }

            load(jar, index, id);
        } catch (Exception e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }

            state = State.FAILED;
            message = "Asset download failed: " + e.getMessage();
            plugin.getLogger().warning(message);
        }
    }

    private void load(File jar, File index, String id) throws IOException {
        stop();

        clientJar = new ZipFile(jar);
        assetObjects = JsonParser.parseString(Files.readString(index.toPath(), StandardCharsets.UTF_8))
                .getAsJsonObject().getAsJsonObject("objects");

        version = id;
        message = "";
        state = State.READY;

        plugin.getLogger().info("Editor assets ready (Minecraft " + id + ").");
    }

    private JsonObject resolveVersion(String wanted) throws IOException, InterruptedException {
        JsonObject manifest = JsonParser.parseString(fetchString(VERSION_MANIFEST)).getAsJsonObject();
        String id = wanted;

        if (wanted.equalsIgnoreCase("latest")) {
            id = manifest.getAsJsonObject("latest").get("release").getAsString();
        }

        for (JsonElement element : manifest.getAsJsonArray("versions")) {
            JsonObject entry = element.getAsJsonObject();

            if (entry.get("id").getAsString().equals(id)) {
                return JsonParser.parseString(fetchString(entry.get("url").getAsString())).getAsJsonObject();
            }
        }

        throw new IOException("Unknown Minecraft version '" + id + "'.");
    }

    private String fetchString(String url) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30)).build(), HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + " for " + url);
        }

        return response.body();
    }

    private void download(String url, File target, String sha1) throws IOException, InterruptedException {
        File temp = new File(target.getParentFile(), target.getName() + ".part");

        HttpResponse<InputStream> response = client.send(HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMinutes(5)).build(), HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + " for " + url);
        }

        try (InputStream stream = response.body()) {
            Files.copy(stream, temp.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }

        if (sha1 != null && !sha1.equalsIgnoreCase(sha1Of(temp))) {
            Files.deleteIfExists(temp.toPath());
            throw new IOException("Checksum mismatch for " + url);
        }

        Files.move(temp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
    }

    private String sha1Of(File file) throws IOException {
        try (InputStream stream = Files.newInputStream(file.toPath())) {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] buffer = new byte[65536];
            int read;

            while ((read = stream.read(buffer)) > 0) {
                digest.update(buffer, 0, read);
            }

            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
    }

    /**
     * Reads a file from the client jar, relative to assets/minecraft/.
     */
    public Optional<byte[]> readClientFile(@NonNull String path) {
        ZipFile jar = clientJar;

        if (jar == null) {
            return Optional.empty();
        }

        ZipEntry entry = jar.getEntry("assets/minecraft/" + path);

        if (entry == null || entry.isDirectory()) {
            return Optional.empty();
        }

        try (InputStream stream = jar.getInputStream(entry)) {
            return Optional.of(stream.readAllBytes());
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    /**
     * Lists the file names (without extension) in a folder of assets/minecraft/ that end with the extension.
     */
    public List<String> listClientFiles(@NonNull String folderPath, @NonNull String extension) {
        ZipFile jar = clientJar;

        if (jar == null) {
            return List.of();
        }

        String prefix = "assets/minecraft/" + folderPath + "/";
        List<String> names = new ArrayList<>();
        Enumeration<? extends ZipEntry> entries = jar.entries();

        while (entries.hasMoreElements()) {
            String name = entries.nextElement().getName();

            if (!name.startsWith(prefix) || !name.endsWith(extension)) {
                continue;
            }

            String relative = name.substring(prefix.length(), name.length() - extension.length());

            if (!relative.contains("/")) {
                names.add(relative);
            }
        }

        Collections.sort(names);
        return names;
    }

    /**
     * Reads an object from the asset index (sounds, sounds.json, language files), downloading it on first use.
     *
     * @param key the key in the asset index, e.g. "minecraft/sounds.json"
     */
    public Optional<byte[]> readAsset(@NonNull String key) {
        JsonObject objects = assetObjects;

        if (!objects.has(key)) {
            return Optional.empty();
        }

        String hash = objects.getAsJsonObject(key).get("hash").getAsString();
        File file = new File(soundFolder, hash);

        try {
            if (!file.exists()) {
                if (!downloading.add(hash)) {
                    waitFor(file);
                } else {
                    try {
                        download(RESOURCES_URL + hash.substring(0, 2) + "/" + hash, file, hash);
                    } finally {
                        downloading.remove(hash);
                    }
                }
            }

            return file.exists() ? Optional.of(Files.readAllBytes(file.toPath())) : Optional.empty();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }

            plugin.getLogger().warning("Failed to fetch asset '" + key + "': " + e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<byte[]> readSound(@NonNull String path) {
        return readAsset(SOUND_PREFIX + path + ".ogg");
    }

    private void waitFor(File file) throws InterruptedException {
        for (int i = 0; i < 100 && !file.exists(); i++) {
            Thread.sleep(100);
        }
    }

}
