package net.vaultedmc.itemflex.settings;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.bukkit.Color;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.util.Vector;

import java.util.List;

@Getter
@RequiredArgsConstructor
public class AnimationSettings {

    private static final AnimationSettingsConfigParser CONFIG_PARSER = new AnimationSettingsConfigParser();

    private final List<String> lines;

    private final int loreLineLimit;
    private final boolean ignoreEmptyLoreLines;
    private final double lineSpacing;

    private final double spawnDistance;

    private final double spawnXOffset;
    private final double spawnYOffset;
    private final double spawnZOffset;

    private final ItemDisplay.ItemDisplayTransform displayTransform;
    private final double itemDisplayScale;
    private final double blockDisplayScale;

    private final double itemSpawnXOffset;
    private final double itemSpawnYOffset;
    private final double itemSpawnZOffset;

    private final Display.Billboard billboard;

    private final int backgroundOpacity;
    private final int backgroundRed;
    private final int backgroundGreen;
    private final int backgroundBlue;

    private final int blockLight;
    private final int skyLight;

    private final boolean textShadow;

    private final Particle spawnParticle;
    private final int spawnParticleCount;
    private final double spawnParticleOffsetX;
    private final double spawnParticleOffsetY;
    private final double spawnParticleOffsetZ;
    private final double spawnParticleSpeed;

    private final Sound spawnSound;
    private final double spawnSoundVolume;
    private final double spawnSoundPitch;

    private final Particle disappearParticle;
    private final int disappearParticleCount;
    private final double disappearParticleOffsetX;
    private final double disappearParticleOffsetY;
    private final double disappearParticleOffsetZ;
    private final double disappearParticleSpeed;

    private final Sound disappearSound;
    private final double disappearSoundVolume;
    private final double disappearSoundPitch;

    private final int ambientParticleFrequency;
    private final Particle ambientParticle;
    private final int ambientParticleCount;
    private final double ambientParticleOffsetX;
    private final double ambientParticleOffsetY;
    private final double ambientParticleOffsetZ;
    private final double ambientParticleSpeed;

    private final int ambientSoundFrequency;
    private final Sound ambientSound;
    private final double ambientSoundVolume;
    private final double ambientSoundPitch;

    private final double startingScale;
    private final double scaleIncrement;
    private final double rotateIncrement;

    private final int animationDuration;

    public Vector getSpawnOffset() {
        return new Vector(spawnXOffset, spawnYOffset, spawnZOffset);
    }

    public Vector getItemSpawnOffset() {
        return new Vector(itemSpawnXOffset, itemSpawnYOffset, itemSpawnZOffset);
    }

    public Color getBackgroundColor() {
        return Color.fromARGB(backgroundOpacity, backgroundRed, backgroundGreen, backgroundBlue);
    }

    public static AnimationSettingsConfigParser getConfigParser() {
        return CONFIG_PARSER;
    }

}
