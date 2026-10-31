package net.vaultedmc.itemflex.animation;

import lombok.NonNull;
import me.clip.placeholderapi.PlaceholderAPI;
import net.bitbylogic.utils.hologram.Hologram;
import net.bitbylogic.utils.hologram.HologramLine;
import net.bitbylogic.utils.message.format.Formatter;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.animation.definition.AnimationDefinition;
import net.vaultedmc.itemflex.animation.definition.CommandSource;
import net.vaultedmc.itemflex.animation.definition.TimelineEvent;
import net.vaultedmc.itemflex.animation.definition.Track;
import net.vaultedmc.itemflex.animation.definition.TrackProperty;
import net.vaultedmc.itemflex.animation.definition.TrackTarget;
import net.vaultedmc.itemflex.provider.LineProviderManager;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.SoundCategory;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class FlexAnimation {

    private static final int MAX_CHUNK_TICKS = 4;
    private static final double MAX_CHUNK_ANGLE = 100;

    private final ItemFlex plugin;
    private final AnimationDefinition definition;

    private final Player player;
    private final ItemStack item;

    private final List<Display> textDisplays = new ArrayList<>();
    private final List<Transformation> textBaseTransformations = new ArrayList<>();

    private Transformation itemBaseTransformation;
    private int chunkEnd = 0;

    public FlexAnimation(@NonNull Player player, @NonNull ItemFlex plugin, @NonNull AnimationDefinition definition) {
        this.player = player;
        this.item = player.getInventory().getItemInMainHand();

        this.plugin = plugin;
        this.definition = definition;

        spawnFlexItem();
    }

    private void spawnFlexItem() {
        float baseScale = (float) getBaseScale();

        Hologram hologram = new Hologram(HologramLine
                .of(item.clone())
                .displayTransform(definition.getItem().getDisplayTransform())
                .scale(baseScale)
                .translation(definition.getSpawn().getItemOffset().toVector().toVector3f())
        );

        LineProviderManager lineProviderManager = plugin.getLineProviderManager();

        for (String flexLine : definition.getText().getLines().reversed()) {
            boolean addLine = true;

            for (PlaceholderLineProvider lineProvider : lineProviderManager.getLineProviders()) {
                if (!flexLine.contains(lineProvider.getPlaceholder())) {
                    continue;
                }

                List<String> lines = lineProvider.provide(player, item);

                if (lineProvider.getType() == PlaceholderLineProvider.Type.REPLACE) {
                    flexLine = flexLine.replace(lineProvider.getPlaceholder(), lines.isEmpty() ? "" : lines.getFirst());
                    continue;
                }

                addLine = false;

                for (String line : lines) {
                    hologram.addLine(createTextLine(applyPlaceholderApi(line), baseScale));
                }
            }

            if (!addLine) {
                continue;
            }

            hologram.addLine(createTextLine(applyPlaceholderApi(flexLine), baseScale));
        }

        hologram.lineSpacing((float) definition.getText().getLineSpacing());
        hologram.spawn(getAnchorLocation(0, 0, 0, 0));

        collectDisplays(hologram);
        startTimeline(hologram);
    }

    private HologramLine createTextLine(String text, float baseScale) {
        return HologramLine
                .of(text)
                .billboard(definition.getText().getBillboard())
                .backgroundColor(definition.getText().getBackground().toColor())
                .brightness(new Display.Brightness(definition.getText().getBlockLight(), definition.getText().getSkyLight()))
                .rotation(0, 0)
                .textShadow(definition.getText().isShadow())
                .scale(baseScale);
    }

    private double getBaseScale() {
        if (item.getType().isBlock()) {
            return definition.getItem().getBlockScale();
        }

        return definition.getItem().getItemScale();
    }

    private String applyPlaceholderApi(String line) {
        if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
            return PlaceholderAPI.setPlaceholders(player, line);
        }

        return line;
    }

    private String applyReplacements(String line) {
        for (PlaceholderLineProvider lineProvider : plugin.getLineProviderManager().getLineProviders()) {
            if (lineProvider.getType() != PlaceholderLineProvider.Type.REPLACE || !line.contains(lineProvider.getPlaceholder())) {
                continue;
            }

            List<String> provided = lineProvider.provide(player, item);
            line = line.replace(lineProvider.getPlaceholder(), provided.isEmpty() ? "" : provided.getFirst());
        }

        return applyPlaceholderApi(line);
    }

    private void collectDisplays(Hologram hologram) {
        List<HologramLine> lines = hologram.getLines();

        for (int i = lines.size() - 1; i >= 1; i--) {
            Display display = lines.get(i).getDisplay();

            if (display == null) {
                continue;
            }

            display.setInterpolationDelay(0);
            display.setInterpolationDuration(1);
            display.setTeleportDuration(1);

            textDisplays.add(display);
            textBaseTransformations.add(display.getTransformation());
        }

        hologram.getBase().ifPresent(base -> {
            base.setInterpolationDelay(0);
            base.setInterpolationDuration(1);
            base.setTeleportDuration(1);
            itemBaseTransformation = base.getTransformation();
        });
    }

    private Location getAnchorLocation(double offsetX, double offsetY, double offsetZ, double forward) {
        float yaw = player.getEyeLocation().getYaw();

        Vector direction = new Vector(-Math.sin(Math.toRadians(yaw)), 0, Math.cos(Math.toRadians(yaw))).normalize();

        Location location = player.getLocation().clone()
                .add(direction.multiply(definition.getSpawn().getDistance() + forward))
                .add(definition.getSpawn().getOffset().toVector())
                .add(offsetX, offsetY, offsetZ);

        location.setYaw(0);
        location.setPitch(0);

        return location;
    }

    private double evaluate(TrackTarget target, TrackProperty property, int line, double tick) {
        double result = property.getIdentity();

        for (Track track : definition.getTracks()) {
            if (track.getTarget() != target || track.getProperty() != property) {
                continue;
            }

            if (target == TrackTarget.TEXT && !track.appliesToLine(line)) {
                continue;
            }

            double value = track.evaluate(tick);

            if (property.isMultiplicative()) {
                result *= value;
                continue;
            }

            result += value;
        }

        return result;
    }

    private Transformation buildTransformation(TrackTarget target, int line, double tick, Transformation base, double extraScale) {
        Vector3f translation = new Vector3f(base.getTranslation()).add(
                (float) evaluate(target, TrackProperty.OFFSET_X, line, tick),
                (float) evaluate(target, TrackProperty.OFFSET_Y, line, tick),
                (float) evaluate(target, TrackProperty.OFFSET_Z, line, tick)
        );

        Quaternionf rotation = new Quaternionf().rotateYXZ(
                (float) Math.toRadians(evaluate(target, TrackProperty.ROTATION_Y, line, tick)),
                (float) Math.toRadians(evaluate(target, TrackProperty.ROTATION_X, line, tick)),
                (float) Math.toRadians(evaluate(target, TrackProperty.ROTATION_Z, line, tick))
        );

        float scaleMultiplier = (float) (evaluate(target, TrackProperty.SCALE, line, tick) * extraScale);
        Vector3f scale = new Vector3f(base.getScale()).mul(Math.max(0, scaleMultiplier));

        return new Transformation(translation, rotation, scale, new Quaternionf());
    }

    private int chunkLength(int tick) {
        int length = MAX_CHUNK_TICKS;

        while (length > 1 && !isChunkSmooth(tick, length)) {
            length--;
        }

        return length;
    }

    private boolean isChunkSmooth(int tick, int length) {
        for (TrackProperty property : List.of(TrackProperty.ROTATION_X, TrackProperty.ROTATION_Y, TrackProperty.ROTATION_Z)) {
            double start = evaluate(TrackTarget.ITEM, property, 0, tick);

            for (int i = 1; i <= length; i++) {
                if (Math.abs(evaluate(TrackTarget.ITEM, property, 0, tick + i) - start) > MAX_CHUNK_ANGLE) {
                    return false;
                }
            }
        }

        return true;
    }

    private void applyTracks(Display itemDisplay, int tick) {
        if (tick >= chunkEnd) {
            int length = tick == 0 ? 0 : chunkLength(tick);
            int target = tick + length;

            chunkEnd = tick == 0 ? 1 : target;
            transformDisplay(itemDisplay, length, buildTransformationIfPresent(itemDisplay, target));

            for (int i = 0; i < textDisplays.size(); i++) {
                Display display = textDisplays.get(i);

                if (!display.isValid()) {
                    continue;
                }

                double opacity = Math.clamp(evaluate(TrackTarget.TEXT, TrackProperty.OPACITY, i, target), 0, 1);
                double hidden = opacity <= 0.02 ? 0 : 1;

                transformDisplay(display, length, buildTransformation(TrackTarget.TEXT, i, target, textBaseTransformations.get(i), hidden));
            }
        }

        for (int i = 0; i < textDisplays.size(); i++) {
            Display display = textDisplays.get(i);

            if (!display.isValid()) {
                continue;
            }

            if (display instanceof TextDisplay textDisplay && hasOpacityTrack()) {
                double opacity = Math.clamp(evaluate(TrackTarget.TEXT, TrackProperty.OPACITY, i, tick), 0, 1);
                textDisplay.setTextOpacity((byte) Math.max(4, Math.round(opacity * 255)));
            }
        }
    }

    private Transformation buildTransformationIfPresent(Display itemDisplay, int tick) {
        if (itemBaseTransformation == null) {
            return itemDisplay.getTransformation();
        }

        return buildTransformation(TrackTarget.ITEM, 0, tick, itemBaseTransformation, 1);
    }

    private void transformDisplay(Display display, int length, Transformation transformation) {
        display.setInterpolationDelay(0);
        display.setInterpolationDuration(length);
        display.setTransformation(transformation);
    }

    private boolean hasOpacityTrack() {
        return definition.getTracks().stream().anyMatch(track -> track.getProperty() == TrackProperty.OPACITY);
    }

    private void fireEvent(TimelineEvent event, Display itemDisplay) {
        Location location = itemDisplay.getLocation();
        World world = location.getWorld();

        switch (event.getType()) {
            case PARTICLE:
                if (event.getResolvedParticle() == null) {
                    return;
                }

                world.spawnParticle(event.getResolvedParticle(), location.clone().add(0, event.getHeight(), 0),
                        event.getCount(), event.getOffsetX(), event.getOffsetY(), event.getOffsetZ(), event.getSpeed());
                return;
            case SOUND:
                world.playSound(location, event.getSound(), SoundCategory.MASTER, (float) event.getVolume(), (float) event.getPitch());
                return;
            case COMMAND:
                runCommand(event);
                return;
            case MESSAGE:
                player.sendMessage(Formatter.format(applyReplacements(event.getMessage().replace("%player%", player.getName()))));
                return;
            default:
                if (event.getLine() >= textDisplays.size()) {
                    return;
                }

                if (textDisplays.get(event.getLine()) instanceof TextDisplay textDisplay && textDisplay.isValid()) {
                    textDisplay.setText(Formatter.format(applyReplacements(event.getText())));
                }
        }
    }

    private void runCommand(TimelineEvent event) {
        String command = applyPlaceholderApi(event.getCommand().replace("%player%", player.getName()));

        if (command.startsWith("/")) {
            command = command.substring(1);
        }

        if (event.getSource() == CommandSource.PLAYER) {
            Bukkit.dispatchCommand(player, command);
            return;
        }

        String consoleCommand = command;
        plugin.getFoliaLib().getScheduler().runNextTick(task -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), consoleCommand));
    }

    private void startTimeline(@NonNull Hologram hologram) {
        Optional<Display> optionalBase = hologram.getBase();

        if (optionalBase.isEmpty()) {
            hologram.cleanup();
            player.removeMetadata("flex_active", plugin);
            return;
        }

        Display hologramBase = optionalBase.get();
        int duration = definition.getDuration();

        int[] tick = {0};

        plugin.getFoliaLib().getScheduler().runAtEntityTimer(player, task -> {
            if (!hologramBase.isValid() || !player.isOnline() || tick[0] > duration) {
                player.removeMetadata("flex_active", plugin);

                hologram.cleanup();
                task.cancel();
                return;
            }

            hologram.teleport(getAnchorLocation(
                    evaluate(TrackTarget.ROOT, TrackProperty.OFFSET_X, 0, tick[0]),
                    evaluate(TrackTarget.ROOT, TrackProperty.OFFSET_Y, 0, tick[0]),
                    evaluate(TrackTarget.ROOT, TrackProperty.OFFSET_Z, 0, tick[0]),
                    evaluate(TrackTarget.ROOT, TrackProperty.FORWARD, 0, tick[0])
            ));

            applyTracks(hologramBase, tick[0]);

            for (TimelineEvent event : definition.getEvents()) {
                if (event.shouldFire(tick[0])) {
                    fireEvent(event, hologramBase);
                }
            }

            tick[0]++;
        }, () -> {
            player.removeMetadata("flex_active", plugin);
            hologram.cleanup();
        }, 1, 1);
    }

}
