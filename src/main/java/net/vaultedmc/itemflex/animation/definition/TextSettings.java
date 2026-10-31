package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import org.bukkit.entity.Display;

import java.util.ArrayList;
import java.util.List;

@Getter
public class TextSettings {

    private List<String> lines = new ArrayList<>(List.of("&6&lFLEXING", "%item_name%"));
    private double lineSpacing = 0.17;
    private Display.Billboard billboard = Display.Billboard.VERTICAL;
    private BackgroundSettings background = new BackgroundSettings();
    private int blockLight = 15;
    private int skyLight = 15;
    private boolean shadow = true;

    public void normalize() {
        if (lines == null) {
            lines = new ArrayList<>();
        }

        lines.removeIf(line -> line == null);

        if (billboard == null) {
            billboard = Display.Billboard.VERTICAL;
        }

        if (background == null) {
            background = new BackgroundSettings();
        }

        background.normalize();

        lineSpacing = Math.clamp(lineSpacing, 0, 5);
        blockLight = Math.clamp(blockLight, 0, 15);
        skyLight = Math.clamp(skyLight, 0, 15);
    }

}
