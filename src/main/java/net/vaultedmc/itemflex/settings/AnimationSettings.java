package net.vaultedmc.itemflex.settings;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Map;

@Getter
@RequiredArgsConstructor
public class AnimationSettings {

    private static final AnimationSettingsConfigParser CONFIG_PARSER = new AnimationSettingsConfigParser();

    private final Map<String, String> flexConditions;

    private final int loreLineLimit;
    private final boolean ignoreEmptyLoreLines;

    public static AnimationSettingsConfigParser getConfigParser() {
        return CONFIG_PARSER;
    }

}
