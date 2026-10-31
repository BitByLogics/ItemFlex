package net.vaultedmc.itemflex.animation;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import lombok.NonNull;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.animation.definition.AnimationDefinition;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public class AnimationManager {

    public static final String DEFAULT_ANIMATION = "default";

    private static final List<String> BUNDLED_EXTRAS = List.of("inferno", "arcane");
    private static final String BUNDLED_MARKER = ".bundled-extras";

    private static final Set<String> RESERVED_NAMES = Set.of("reload", "editor");

    private static final Pattern NAME_PATTERN = Pattern.compile("[a-z0-9_-]{1,32}");

    private final ItemFlex plugin;
    private final File folder;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    private final Map<String, AnimationDefinition> animations = new ConcurrentHashMap<>();

    public AnimationManager(@NonNull ItemFlex plugin) {
        this.plugin = plugin;
        this.folder = new File(plugin.getDataFolder(), "animations");
    }

    public static boolean isValidName(String name) {
        return name != null && NAME_PATTERN.matcher(name).matches() && !RESERVED_NAMES.contains(name);
    }

    public void load() {
        animations.clear();

        if (!folder.exists() && !folder.mkdirs()) {
            plugin.getLogger().severe("Unable to create the animations folder.");
            return;
        }

        createDefaultIfMissing();
        installBundledExtras();

        File[] files = folder.listFiles((dir, fileName) -> fileName.endsWith(".json"));

        if (files == null) {
            return;
        }

        for (File file : files) {
            String name = file.getName().substring(0, file.getName().length() - 5).toLowerCase(Locale.ROOT);

            if (!isValidName(name)) {
                plugin.getLogger().warning("Skipping animation file with invalid name: " + file.getName());
                continue;
            }

            try (Reader reader = Files.newBufferedReader(file.toPath(), StandardCharsets.UTF_8)) {
                AnimationDefinition definition = gson.fromJson(reader, AnimationDefinition.class);

                if (definition == null) {
                    plugin.getLogger().warning("Animation file is empty: " + file.getName());
                    continue;
                }

                definition.setName(name);
                definition.sanitize().forEach(warning -> plugin.getLogger().warning("[" + name + "] " + warning));

                animations.put(name, definition);
            } catch (IOException | JsonParseException e) {
                plugin.getLogger().warning("Failed to load animation '" + file.getName() + "': " + e.getMessage());
            }
        }

        plugin.getLogger().info("Loaded " + animations.size() + " animation(s).");
    }

    private void createDefaultIfMissing() {
        File defaultFile = new File(folder, DEFAULT_ANIMATION + ".json");

        if (defaultFile.exists()) {
            return;
        }

        ConfigurationSection settings = plugin.getConfig().getConfigurationSection("Settings");

        try {
            if (settings != null && LegacyAnimationConverter.hasLegacySettings(settings)) {
                JsonObject converted = LegacyAnimationConverter.convert(settings);
                Files.writeString(defaultFile.toPath(), gson.toJson(converted), StandardCharsets.UTF_8);

                plugin.getLogger().info("Converted the animation settings in config.yml to animations/default.json. "
                        + "The old animation keys in config.yml are no longer used and can be removed.");
                return;
            }

            try (InputStream stream = plugin.getResource("animations/default.json")) {
                if (stream == null) {
                    plugin.getLogger().severe("Bundled default animation is missing.");
                    return;
                }

                Files.copy(stream, defaultFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            plugin.getLogger().severe("Failed to create the default animation: " + e.getMessage());
        }
    }

    private void installBundledExtras() {
        File marker = new File(folder, BUNDLED_MARKER);

        if (marker.exists()) {
            return;
        }

        try {
            for (String extra : BUNDLED_EXTRAS) {
                File target = new File(folder, extra + ".json");

                if (target.exists()) {
                    continue;
                }

                try (InputStream stream = plugin.getResource("animations/" + extra + ".json")) {
                    if (stream == null) {
                        plugin.getLogger().warning("Bundled animation is missing: " + extra);
                        continue;
                    }

                    Files.copy(stream, target.toPath());
                }
            }

            Files.writeString(marker.toPath(), "", StandardCharsets.UTF_8);
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to install the bundled animations: " + e.getMessage());
        }
    }

    public Optional<AnimationDefinition> getAnimation(String name) {
        if (name == null) {
            return Optional.empty();
        }

        return Optional.ofNullable(animations.get(name.toLowerCase(Locale.ROOT)));
    }

    public List<AnimationDefinition> getAnimations() {
        return animations.values().stream()
                .sorted(Comparator.comparing(AnimationDefinition::getName))
                .toList();
    }

    public boolean canUse(@NonNull Player player, @NonNull AnimationDefinition definition) {
        return definition.getPermission().isEmpty() || player.hasPermission(definition.getPermission());
    }

    public Optional<AnimationDefinition> select(@NonNull Player player) {
        List<AnimationDefinition> usable = new ArrayList<>();

        for (AnimationDefinition definition : animations.values()) {
            if (canUse(player, definition)) {
                usable.add(definition);
            }
        }

        usable.sort(Comparator.comparingInt(AnimationDefinition::getPriority).reversed()
                .thenComparing(definition -> !definition.getName().equals(DEFAULT_ANIMATION))
                .thenComparing(AnimationDefinition::getName));

        if (usable.isEmpty()) {
            return getAnimation(DEFAULT_ANIMATION);
        }

        return Optional.of(usable.getFirst());
    }

    public AnimationDefinition parse(@NonNull String json) throws JsonParseException {
        AnimationDefinition definition = gson.fromJson(json, AnimationDefinition.class);

        if (definition == null) {
            throw new JsonParseException("Empty animation.");
        }

        return definition;
    }

    public String toJson(@NonNull AnimationDefinition definition) {
        return gson.toJson(definition);
    }

    public void save(@NonNull String name, @NonNull AnimationDefinition definition) throws IOException {
        definition.setName(name);

        if (!folder.exists() && !folder.mkdirs()) {
            throw new IOException("Unable to create the animations folder.");
        }

        File target = new File(folder, name + ".json");
        File temp = new File(folder, name + ".json.tmp");

        Files.writeString(temp.toPath(), gson.toJson(definition), StandardCharsets.UTF_8);
        Files.move(temp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);

        animations.put(name, definition);
    }

    public boolean delete(@NonNull String name) throws IOException {
        if (name.equals(DEFAULT_ANIMATION)) {
            return false;
        }

        boolean deleted = Files.deleteIfExists(new File(folder, name + ".json").toPath());
        animations.remove(name);
        return deleted;
    }

}
