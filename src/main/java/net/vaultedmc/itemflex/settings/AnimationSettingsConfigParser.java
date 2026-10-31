package net.vaultedmc.itemflex.settings;

import lombok.NonNull;
import net.bitbylogic.utils.config.ConfigParser;
import org.bukkit.configuration.ConfigurationSection;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class AnimationSettingsConfigParser implements ConfigParser<AnimationSettings> {

    @Override
    public Optional<AnimationSettings> parseFrom(@NonNull ConfigurationSection section) {
        Map<String, String> flexConditions = new HashMap<>();

        section.getStringList("Flex-Conditions").forEach(flexCondition -> {
            String[] splitCondition = flexCondition.split(",", 2);
            flexConditions.put(splitCondition[0], splitCondition.length > 1 ? splitCondition[1] : "");
        });

        int loreLineLimit = section.getInt("Lore-Line-Limit", 3);
        boolean ignoreEmptyLoreLines = section.getBoolean("Ignore-Empty-Lore-Lines", true);

        return Optional.of(new AnimationSettings(flexConditions, loreLineLimit, ignoreEmptyLoreLines));
    }

    @Override
    public ConfigurationSection parseTo(@NonNull ConfigurationSection configurationSection, @NonNull AnimationSettings o) {
        throw new UnsupportedOperationException();
    }

}
