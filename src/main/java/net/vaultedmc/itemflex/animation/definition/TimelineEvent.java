package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import lombok.Setter;
import org.bukkit.Particle;

@Getter
public class TimelineEvent {

    private EventType type = EventType.PARTICLE;

    private int tick;
    private int every;
    @Setter
    private int until;

    private String particle = "GLOW";
    private int count = 1;
    private double offsetX;
    private double offsetY;
    private double offsetZ;
    private double speed;
    private double height;

    @Setter
    private String sound = "";
    private double volume = 1;
    private double pitch = 1;

    private String command = "";
    private CommandSource source = CommandSource.CONSOLE;

    private String message = "";

    private int line;
    private String text = "";

    @Setter
    private transient Particle resolvedParticle;

    public void normalize() {
        if (source == null) {
            source = CommandSource.CONSOLE;
        }

        every = Math.max(0, every);
        count = Math.clamp(count, 0, 500);
        volume = Math.clamp(volume, 0, 10);
        pitch = Math.clamp(pitch, 0.5, 2);
    }

    public boolean shouldFire(int currentTick) {
        if (currentTick < tick) {
            return false;
        }

        if (every <= 0) {
            return currentTick == tick;
        }

        if (until > 0 && currentTick > until) {
            return false;
        }

        return (currentTick - tick) % every == 0;
    }

}
