package net.vaultedmc.itemflex.settings;

import lombok.NonNull;
import net.bitbylogic.utils.config.ConfigParser;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;

import java.util.List;
import java.util.Optional;

public class AnimationSettingsConfigParser implements ConfigParser<AnimationSettings> {

    @Override
    public Optional<AnimationSettings> parseFrom(@NonNull ConfigurationSection section) {
        ConfigurationSection spawnLoc = section.getConfigurationSection("Spawn-Location");
        ConfigurationSection offset = spawnLoc != null ? spawnLoc.getConfigurationSection("Offset") : null;
        ConfigurationSection itemOffset = spawnLoc != null ? spawnLoc.getConfigurationSection("Item-Offset") : null;

        ConfigurationSection background = section.getConfigurationSection("Background-Color");
        ConfigurationSection brightness = section.getConfigurationSection("Brightness");

        ConfigurationSection spawnParticle = section.getConfigurationSection("Spawn-Particle");
        ConfigurationSection disappearParticle = section.getConfigurationSection("Disappear-Particle");
        ConfigurationSection ambientParticle = section.getConfigurationSection("Ambient-Particle");

        ConfigurationSection spawnSound = section.getConfigurationSection("Spawn-Sound");
        ConfigurationSection disappearSound = section.getConfigurationSection("Disappear-Sound");
        ConfigurationSection ambientSound = section.getConfigurationSection("Ambient-Sound");

        ConfigurationSection scaleSettings = section.getConfigurationSection("Scale-Settings");

        if (spawnLoc == null || offset == null || itemOffset == null || background == null || brightness == null
                || spawnParticle == null || disappearParticle == null || ambientParticle == null
                || spawnSound == null || disappearSound == null || ambientSound == null || scaleSettings == null) {
            return Optional.empty();
        }

        List<String> lines = section.getStringList("Lines");

        int loreLineLimit = section.getInt("Lore-Line-Limit");
        boolean ignoreEmptyLoreLines = section.getBoolean("Ignore-Empty-Lore-Lines");
        double lineSpacing = section.getDouble("Line-Spacing");

        double spawnDistance = section.getDouble("Spawn-Location.Distance");
        double spawnXOffset = offset.getDouble("X");
        double spawnYOffset = offset.getDouble("Y");
        double spawnZOffset = offset.getDouble("Z");

        ItemDisplay.ItemDisplayTransform displayTransform = ItemDisplay.ItemDisplayTransform.valueOf(section.getString("Display-Transform"));
        double itemDisplayScale = section.getDouble("Item-Display-Scale");
        double blockDisplayScale = section.getDouble("Block-Display-Scale");

        double itemSpawnXOffset = itemOffset.getDouble("X");
        double itemSpawnYOffset = itemOffset.getDouble("Y");
        double itemSpawnZOffset = itemOffset.getDouble("Z");

        Display.Billboard billboard = Display.Billboard.valueOf(section.getString("Billboard-Type"));

        int backgroundOpacity = background.getInt("Opacity");
        int backgroundRed = background.getInt("Red");
        int backgroundGreen = background.getInt("Green");
        int backgroundBlue = background.getInt("Blue");

        int blockLight = brightness.getInt("Block");
        int skyLight = brightness.getInt("Sky");

        boolean textShadow = section.getBoolean("Text-Shadow");

        Particle spawnParticleType = Particle.valueOf(spawnParticle.getString("Particle"));
        int spawnParticleCount = spawnParticle.getInt("Count");
        double spawnOffsetX = spawnParticle.getDouble("Offset.X");
        double spawnOffsetY = spawnParticle.getDouble("Offset.Y");
        double spawnOffsetZ = spawnParticle.getDouble("Offset.Z");
        double spawnSpeed = spawnParticle.getDouble("Speed");

        Sound spawnSoundType = Sound.valueOf(spawnSound.getString("Sound"));
        double spawnVolume = spawnSound.getDouble("Volume");
        double spawnPitch = spawnSound.getDouble("Pitch");

        Particle disappearParticleType = Particle.valueOf(disappearParticle.getString("Particle"));
        int disappearParticleCount = disappearParticle.getInt("Count");
        double disappearOffsetX = disappearParticle.getDouble("Offset.X");
        double disappearOffsetY = disappearParticle.getDouble("Offset.Y");
        double disappearOffsetZ = disappearParticle.getDouble("Offset.Z");
        double disappearSpeed = disappearParticle.getDouble("Speed");

        Sound disappearSoundType = Sound.valueOf(disappearSound.getString("Sound"));
        double disappearVolume = disappearSound.getDouble("Volume");
        double disappearPitch = disappearSound.getDouble("Pitch");

        int ambientParticleFrequency = ambientParticle.getInt("Frequency");
        Particle ambientParticleType = Particle.valueOf(ambientParticle.getString("Particle"));
        int ambientParticleCount = ambientParticle.getInt("Count");
        double ambientOffsetX = ambientParticle.getDouble("Offset.X");
        double ambientOffsetY = ambientParticle.getDouble("Offset.Y");
        double ambientOffsetZ = ambientParticle.getDouble("Offset.Z");
        double ambientSpeed = ambientParticle.getDouble("Speed");

        int ambientSoundFrequency = ambientSound.getInt("Frequency");
        Sound ambientSoundType = Sound.valueOf(ambientSound.getString("Sound"));
        double ambientVolume = ambientSound.getDouble("Volume");
        double ambientPitch = ambientSound.getDouble("Pitch");

        double startingScale = scaleSettings.getDouble("Starting-Scale");
        double scaleIncrement = scaleSettings.getDouble("Scale-Increment");

        double rotateIncrement = section.getDouble("Rotate-Speed");
        int animationDuration = section.getInt("Animation-Duration");

        return Optional.of(new AnimationSettings(
                lines,
                loreLineLimit, ignoreEmptyLoreLines,
                lineSpacing,
                spawnDistance,
                spawnXOffset, spawnYOffset, spawnZOffset,
                displayTransform,
                itemDisplayScale, blockDisplayScale,
                itemSpawnXOffset, itemSpawnYOffset, itemSpawnZOffset,
                billboard,
                backgroundOpacity, backgroundRed, backgroundGreen, backgroundBlue,
                blockLight, skyLight, textShadow,
                spawnParticleType, spawnParticleCount, spawnOffsetX, spawnOffsetY, spawnOffsetZ, spawnSpeed,
                spawnSoundType, spawnVolume, spawnPitch,
                disappearParticleType, disappearParticleCount, disappearOffsetX, disappearOffsetY, disappearOffsetZ, disappearSpeed,
                disappearSoundType, disappearVolume, disappearPitch,
                ambientParticleFrequency, ambientParticleType, ambientParticleCount,
                ambientOffsetX, ambientOffsetY, ambientOffsetZ, ambientSpeed,
                ambientSoundFrequency, ambientSoundType, ambientVolume, ambientPitch,
                startingScale, scaleIncrement, rotateIncrement, animationDuration
        ));
    }

    @Override
    public ConfigurationSection parseTo(@NonNull ConfigurationSection configurationSection, @NonNull AnimationSettings o) {
        throw new UnsupportedOperationException();
    }

}
