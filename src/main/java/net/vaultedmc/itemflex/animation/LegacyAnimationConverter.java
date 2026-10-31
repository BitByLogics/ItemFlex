package net.vaultedmc.itemflex.animation;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import lombok.NonNull;
import net.vaultedmc.itemflex.animation.definition.AnimationDefinition;
import org.bukkit.configuration.ConfigurationSection;

public class LegacyAnimationConverter {

    public static boolean hasLegacySettings(@NonNull ConfigurationSection settings) {
        return settings.contains("Animation-Duration") && settings.contains("Rotate-Speed");
    }

    public static JsonObject convert(@NonNull ConfigurationSection settings) {
        double itemScale = settings.getDouble("Item-Display-Scale", 0.75);
        double startingScale = settings.getDouble("Scale-Settings.Starting-Scale", 0.01);
        double scaleIncrement = Math.max(0.001, settings.getDouble("Scale-Settings.Scale-Increment", 0.06));
        double rotateSpeed = settings.getDouble("Rotate-Speed", 7);
        int animationDuration = settings.getInt("Animation-Duration", 80);

        int scaleInTicks = (int) Math.ceil(Math.max(0, itemScale - startingScale) / scaleIncrement);
        int scaleOutTicks = (int) Math.ceil(itemScale / scaleIncrement);
        int totalDuration = Math.min(AnimationDefinition.MAX_DURATION, animationDuration + scaleOutTicks);

        JsonObject root = new JsonObject();
        root.addProperty("permission", "");
        root.addProperty("priority", 0);
        root.addProperty("duration", totalDuration);

        JsonObject spawn = new JsonObject();
        spawn.addProperty("distance", settings.getDouble("Spawn-Location.Distance", 1.5));
        spawn.add("offset", offset(settings, "Spawn-Location.Offset"));
        spawn.add("itemOffset", offset(settings, "Spawn-Location.Item-Offset"));
        root.add("spawn", spawn);

        JsonObject item = new JsonObject();
        item.addProperty("displayTransform", settings.getString("Display-Transform", "GUI"));
        item.addProperty("itemScale", itemScale);
        item.addProperty("blockScale", settings.getDouble("Block-Display-Scale", 0.5));
        root.add("item", item);

        JsonObject text = new JsonObject();
        JsonArray lines = new JsonArray();
        settings.getStringList("Lines").forEach(lines::add);
        text.add("lines", lines);
        text.addProperty("lineSpacing", settings.getDouble("Line-Spacing", 0.17));
        text.addProperty("billboard", settings.getString("Billboard-Type", "VERTICAL"));

        JsonObject background = new JsonObject();
        background.addProperty("opacity", settings.getInt("Background-Color.Opacity", 0));
        background.addProperty("red", settings.getInt("Background-Color.Red", 0));
        background.addProperty("green", settings.getInt("Background-Color.Green", 0));
        background.addProperty("blue", settings.getInt("Background-Color.Blue", 0));
        text.add("background", background);

        text.addProperty("blockLight", settings.getInt("Brightness.Block", 15));
        text.addProperty("skyLight", settings.getInt("Brightness.Sky", 15));
        text.addProperty("shadow", settings.getBoolean("Text-Shadow", true));
        root.add("text", text);

        JsonArray tracks = new JsonArray();

        JsonArray scaleFrames = new JsonArray();
        scaleFrames.add(keyframe(0, startingScale / itemScale, "LINEAR"));
        scaleFrames.add(keyframe(scaleInTicks, 1, "LINEAR"));
        scaleFrames.add(keyframe(animationDuration, 1, "LINEAR"));
        scaleFrames.add(keyframe(totalDuration, 0, "LINEAR"));
        tracks.add(track("ITEM", "SCALE", scaleFrames));

        JsonArray spinFrames = new JsonArray();
        spinFrames.add(keyframe(0, 0, "LINEAR"));
        spinFrames.add(keyframe(totalDuration, rotateSpeed * totalDuration, "LINEAR"));
        tracks.add(track("ITEM", "ROTATION_Y", spinFrames));

        root.add("tracks", tracks);

        JsonArray events = new JsonArray();

        events.add(particleEvent(settings, "Spawn-Particle", 0, 0, 0));
        events.add(soundEvent(settings, "Spawn-Sound", 0, 0));
        events.add(particleEvent(settings, "Ambient-Particle", 0, Math.max(1, settings.getInt("Ambient-Particle.Frequency", 10)), 0.5));
        events.add(soundEvent(settings, "Ambient-Sound", 0, Math.max(1, settings.getInt("Ambient-Sound.Frequency", 20))));
        events.add(particleEvent(settings, "Disappear-Particle", totalDuration, 0, 0));
        events.add(soundEvent(settings, "Disappear-Sound", totalDuration, 0));

        root.add("events", events);
        return root;
    }

    private static JsonObject offset(ConfigurationSection settings, String path) {
        JsonObject offset = new JsonObject();
        offset.addProperty("x", settings.getDouble(path + ".X", 0));
        offset.addProperty("y", settings.getDouble(path + ".Y", 0));
        offset.addProperty("z", settings.getDouble(path + ".Z", 0));
        return offset;
    }

    private static JsonObject keyframe(int tick, double value, String easing) {
        JsonObject keyframe = new JsonObject();
        keyframe.addProperty("tick", tick);
        keyframe.addProperty("value", value);
        keyframe.addProperty("easing", easing);
        return keyframe;
    }

    private static JsonObject track(String target, String property, JsonArray keyframes) {
        JsonObject track = new JsonObject();
        track.addProperty("target", target);
        track.addProperty("line", -1);
        track.addProperty("property", property);
        track.add("keyframes", keyframes);
        return track;
    }

    private static JsonObject particleEvent(ConfigurationSection settings, String path, int tick, int every, double height) {
        JsonObject event = new JsonObject();
        event.addProperty("type", "PARTICLE");
        event.addProperty("tick", tick);
        event.addProperty("every", every);
        event.addProperty("particle", settings.getString(path + ".Particle", "GLOW"));
        event.addProperty("count", settings.getInt(path + ".Count", 1));
        event.addProperty("offsetX", settings.getDouble(path + ".Offset.X", 0));
        event.addProperty("offsetY", settings.getDouble(path + ".Offset.Y", 0));
        event.addProperty("offsetZ", settings.getDouble(path + ".Offset.Z", 0));
        event.addProperty("speed", settings.getDouble(path + ".Speed", 0));
        event.addProperty("height", height);
        return event;
    }

    private static JsonObject soundEvent(ConfigurationSection settings, String path, int tick, int every) {
        JsonObject event = new JsonObject();
        event.addProperty("type", "SOUND");
        event.addProperty("tick", tick);
        event.addProperty("every", every);
        event.addProperty("sound", settings.getString(path + ".Sound", ""));
        event.addProperty("volume", settings.getDouble(path + ".Volume", 1));
        event.addProperty("pitch", settings.getDouble(path + ".Pitch", 1));
        return event;
    }

}
