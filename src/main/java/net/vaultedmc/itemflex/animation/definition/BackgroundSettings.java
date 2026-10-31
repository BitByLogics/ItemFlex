package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import org.bukkit.Color;

@Getter
public class BackgroundSettings {

    private int opacity;
    private int red;
    private int green;
    private int blue;

    public void normalize() {
        opacity = Math.clamp(opacity, 0, 255);
        red = Math.clamp(red, 0, 255);
        green = Math.clamp(green, 0, 255);
        blue = Math.clamp(blue, 0, 255);
    }

    public Color toColor() {
        return Color.fromARGB(opacity, red, green, blue);
    }

}
