package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import lombok.Setter;
import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.Registry;
import org.bukkit.Sound;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Getter
public class AnimationDefinition {

    public static final int MAX_DURATION = 1200;
    public static final int MAX_EVENTS = 500;
    public static final int MAX_TRACKS = 100;

    @Setter
    private transient String name;

    private String permission = "";
    private int priority = 0;
    private int duration = 93;

    private SpawnSettings spawn = new SpawnSettings();
    private ItemSettings item = new ItemSettings();
    private TextSettings text = new TextSettings();

    private List<Track> tracks = new ArrayList<>();
    private List<TimelineEvent> events = new ArrayList<>();

    public static String resolveSoundKey(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }

        String trimmed = input.trim();
        NamespacedKey key = NamespacedKey.fromString(trimmed.toLowerCase(Locale.ROOT));

        if (key != null && Registry.SOUNDS.get(key) != null) {
            return key.toString();
        }

        try {
            return Sound.valueOf(trimmed.toUpperCase(Locale.ROOT)).getKey().toString();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static Particle resolveParticle(String input) {
        if (input == null) {
            return null;
        }

        try {
            Particle particle = Particle.valueOf(input.trim().toUpperCase(Locale.ROOT));
            return particle.getDataType() == Void.class ? particle : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public List<String> sanitize() {
        List<String> warnings = new ArrayList<>();

        if (permission == null) {
            permission = "";
        }

        if (spawn == null) {
            spawn = new SpawnSettings();
        }

        if (item == null) {
            item = new ItemSettings();
        }

        if (text == null) {
            text = new TextSettings();
        }

        if (tracks == null) {
            tracks = new ArrayList<>();
        }

        if (events == null) {
            events = new ArrayList<>();
        }

        spawn.normalize();
        item.normalize();
        text.normalize();

        permission = permission.trim();

        if (duration < 1 || duration > MAX_DURATION) {
            warnings.add("Duration clamped to 1-" + MAX_DURATION + " ticks.");
            duration = Math.clamp(duration, 1, MAX_DURATION);
        }

        sanitizeTracks(warnings);
        sanitizeEvents(warnings);

        return warnings;
    }

    private void sanitizeTracks(List<String> warnings) {
        if (tracks.size() > MAX_TRACKS) {
            warnings.add("Only the first " + MAX_TRACKS + " tracks were kept.");
            tracks = new ArrayList<>(tracks.subList(0, MAX_TRACKS));
        }

        tracks.removeIf(track -> {
            if (track == null || track.getTarget() == null || track.getProperty() == null || track.getKeyframes() == null) {
                warnings.add("Removed a malformed track.");
                return true;
            }

            if (!track.getTarget().supports(track.getProperty())) {
                warnings.add("Removed track " + track.getTarget() + "/" + track.getProperty() + ": unsupported combination.");
                return true;
            }

            track.getKeyframes().removeIf(keyframe -> keyframe == null || keyframe.getTick() < 0);
            track.sortKeyframes();

            return track.getKeyframes().isEmpty();
        });
    }

    private void sanitizeEvents(List<String> warnings) {
        if (events.size() > MAX_EVENTS) {
            warnings.add("Only the first " + MAX_EVENTS + " events were kept.");
            events = new ArrayList<>(events.subList(0, MAX_EVENTS));
        }

        events.removeIf(event -> {
            if (event == null || event.getType() == null || event.getTick() < 0) {
                warnings.add("Removed a malformed event.");
                return true;
            }

            event.normalize();

            if (event.getUntil() > duration) {
                event.setUntil(duration);
            }

            switch (event.getType()) {
                case PARTICLE:
                    Particle particle = resolveParticle(event.getParticle());

                    if (particle == null) {
                        warnings.add("Removed particle event at tick " + event.getTick() + ": unknown or unsupported particle '" + event.getParticle() + "'.");
                        return true;
                    }

                    event.setResolvedParticle(particle);
                    return false;
                case SOUND:
                    String key = resolveSoundKey(event.getSound());

                    if (key == null) {
                        warnings.add("Removed sound event at tick " + event.getTick() + ": unknown sound '" + event.getSound() + "'.");
                        return true;
                    }

                    event.setSound(key);
                    return false;
                case COMMAND:
                    if (event.getCommand() == null || event.getCommand().isBlank()) {
                        warnings.add("Removed command event at tick " + event.getTick() + ": empty command.");
                        return true;
                    }

                    return false;
                case MESSAGE:
                    if (event.getMessage() == null || event.getMessage().isBlank()) {
                        warnings.add("Removed message event at tick " + event.getTick() + ": empty message.");
                        return true;
                    }

                    if (event.getMessage().toLowerCase().contains("<click")) {
                        warnings.add("Removed message event at tick " + event.getTick() + ": click actions are not allowed in messages.");
                        return true;
                    }

                    return false;
                default:
                    return event.getLine() < 0 || event.getText() == null;
            }
        });
    }

}
