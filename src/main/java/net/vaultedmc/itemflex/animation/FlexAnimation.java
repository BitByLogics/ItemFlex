package net.vaultedmc.itemflex.animation;

import lombok.NonNull;
import me.clip.placeholderapi.PlaceholderAPI;
import net.bitbylogic.utils.hologram.Hologram;
import net.bitbylogic.utils.hologram.HologramLine;
import net.bitbylogic.utils.item.ItemStackUtil;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.settings.AnimationSettings;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.Optional;

public class FlexAnimation {

    private final ItemFlex plugin;
    private final AnimationSettings animationSettings;

    private final Player player;
    private final ItemStack item;

    public FlexAnimation(@NonNull Player player, @NonNull ItemFlex plugin) {
        this.player = player;
        this.item = player.getInventory().getItemInMainHand();

        this.plugin = plugin;
        this.animationSettings = plugin.getAnimationSettings();

        spawnFlexItem();
    }

    private void spawnFlexItem() {
        World world = player.getWorld();

        Location baseLoc = player.getLocation().clone();
        Location eyeLoc = player.getEyeLocation().clone();

        float yaw = eyeLoc.getYaw();

        Vector direction = new Vector(-Math.sin(Math.toRadians(yaw)), 0, Math.cos(Math.toRadians(yaw))).normalize();

        Location spawnLoc = baseLoc.clone().add(direction.multiply(animationSettings.getSpawnDistance())).add(animationSettings.getSpawnOffset());

        spawnLoc.setYaw(0);
        spawnLoc.setPitch(0);

        Hologram hologram = new Hologram(HologramLine
                .of(item.clone())
                .displayTransform(animationSettings.getDisplayTransform())
                .scale((float) (item.getType().isBlock() ?
                        animationSettings.getBlockDisplayScale() :
                        animationSettings.getItemDisplayScale()))
                .translation(animationSettings.getItemSpawnOffset().toVector3f())
        );

        int loreLineLimits = animationSettings.getLoreLineLimit();
        ItemMeta meta = item.getItemMeta();

        String itemName = meta.hasDisplayName() ? meta.getDisplayName() : ItemStackUtil.getVanillaName(item);

        for (String flexLine : animationSettings.getLines().reversed()) {
            String parsedLine = flexLine.replace("%item_name%", itemName);

            if(parsedLine.equalsIgnoreCase("%item_lore%")) {
                if(meta.getLore() == null) {
                    continue;
                }

                int lines = 0;

                for (String loreLine : meta.getLore().reversed()) {
                    if(animationSettings.isIgnoreEmptyLoreLines() && ChatColor.stripColor(loreLine).isEmpty()) {
                        continue;
                    }

                    lines++;

                    if(lines > loreLineLimits) {
                        break;
                    }

                    hologram.addLine(HologramLine
                            .of(loreLine)
                            .billboard(animationSettings.getBillboard())
                            .backgroundColor(animationSettings.getBackgroundColor())
                            .brightness(new Display.Brightness(animationSettings.getBlockLight(), animationSettings.getSkyLight()))
                            .rotation(0, 0)
                            .textShadow(animationSettings.isTextShadow())
                            .scale((float) (item.getType().isBlock() ? animationSettings.getBlockDisplayScale() : animationSettings.getItemDisplayScale()))
                    );
                }

                continue;
            }

            if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
                parsedLine = PlaceholderAPI.setPlaceholders(player, parsedLine);
            }

            hologram.addLine(HologramLine
                    .of(parsedLine)
                    .billboard(animationSettings.getBillboard())
                    .backgroundColor(animationSettings.getBackgroundColor())
                    .brightness(new Display.Brightness(animationSettings.getBlockLight(), animationSettings.getSkyLight()))
                    .rotation(0, 0)
                    .textShadow(animationSettings.isTextShadow())
                    .scale((float) (item.getType().isBlock() ? animationSettings.getBlockDisplayScale() : animationSettings.getItemDisplayScale()))
            );
        }

        hologram.lineSpacing((float) animationSettings.getLineSpacing());
        hologram.spawn(spawnLoc);

        world.spawnParticle(animationSettings.getSpawnParticle(), spawnLoc, animationSettings.getSpawnParticleCount(),
                animationSettings.getSpawnParticleOffsetX(), animationSettings.getSpawnParticleOffsetY(),
                animationSettings.getSpawnParticleOffsetZ(), animationSettings.getSpawnParticleSpeed());
        world.playSound(spawnLoc, animationSettings.getSpawnSound(), (float) animationSettings.getSpawnSoundVolume(),
                (float) animationSettings.getSpawnSoundPitch());

        startFlexAnimation(hologram);
    }

    private void startFlexAnimation(@NonNull Hologram hologram) {
        final int animationDuration = animationSettings.getAnimationDuration();

        final double scaleIncrement = animationSettings.getScaleIncrement();
        final double rotateIncrement = animationSettings.getRotateIncrement();

        Optional<Display> optionalBase = hologram.getBase();

        if (optionalBase.isEmpty()) {
            hologram.cleanup();
            return;
        }

        Display hologramBase = optionalBase.get();

        new BukkitRunnable() {
            long ticks = 0;
            float rotation = 0;

            @Override
            public void run() {
                if (!hologramBase.isValid() || !player.isOnline() || (ticks > animationDuration && hologramBase.getTransformation().getScale().x <= 0.01f)) {
                    Location endLoc = hologramBase.getLocation();

                    player.removeMetadata("flex_active", plugin);

                    endLoc.getWorld().spawnParticle(animationSettings.getDisappearParticle(),
                            endLoc, animationSettings.getDisappearParticleCount(),
                            animationSettings.getDisappearParticleOffsetX(),
                            animationSettings.getDisappearParticleOffsetY(),
                            animationSettings.getDisappearParticleOffsetZ(),
                            animationSettings.getDisappearParticleSpeed());

                    endLoc.getWorld().playSound(endLoc, animationSettings.getDisappearSound(),
                            (float) animationSettings.getDisappearSoundVolume(),
                            (float) animationSettings.getDisappearSoundPitch());

                    hologram.cleanup();
                    cancel();
                    return;
                }

                Location eyeLoc = player.getEyeLocation().clone();
                float yaw = eyeLoc.getYaw();

                Vector dir = new Vector(-Math.sin(Math.toRadians(yaw)), 0, Math.cos(Math.toRadians(yaw))).normalize();

                Location loc = player.getLocation().clone()
                        .add(dir.multiply(animationSettings.getSpawnDistance()))
                        .add(animationSettings.getSpawnOffset());

                loc.setYaw(0);
                loc.setPitch(0);

                hologram.teleport(loc);

                float finalScale = (float) (((ItemDisplay) hologramBase).getItemStack().getType().isBlock() ?
                        animationSettings.getBlockDisplayScale() : animationSettings.getItemDisplayScale());

                double scale = ticks < 20
                        ? animationSettings.getStartingScale() + scaleIncrement * ticks
                        : (ticks > animationDuration
                        ? Math.max(0, finalScale - scaleIncrement * (ticks - 80))
                        : finalScale);

                rotation += (float) rotateIncrement;

                Transformation transformation = hologramBase.getTransformation();

                hologramBase.setTransformation(new Transformation(
                        transformation.getTranslation(),
                        new Quaternionf().rotateY((float) Math.toRadians(rotation)),
                        new Vector3f((float) Math.min(finalScale, scale)),
                        new Quaternionf()
                ));

                if (ticks % animationSettings.getAmbientParticleFrequency() == 0) {
                    hologramBase.getLocation().getWorld().spawnParticle(animationSettings.getAmbientParticle(),
                            hologramBase.getLocation().clone().add(0, 0.5, 0),
                            animationSettings.getAmbientParticleCount(),
                            animationSettings.getAmbientParticleOffsetX(),
                            animationSettings.getAmbientParticleOffsetY(),
                            animationSettings.getAmbientParticleOffsetZ(),
                            animationSettings.getAmbientParticleSpeed());
                }

                if (ticks % animationSettings.getAmbientSoundFrequency() == 0) {
                    hologramBase.getLocation().getWorld().playSound(hologramBase.getLocation(),
                            animationSettings.getAmbientSound(),
                            (float) animationSettings.getAmbientSoundVolume(),
                            (float) animationSettings.getAmbientSoundPitch());
                }

                ticks++;
            }
        }.runTaskTimer(plugin, 0, 1);
    }

}
