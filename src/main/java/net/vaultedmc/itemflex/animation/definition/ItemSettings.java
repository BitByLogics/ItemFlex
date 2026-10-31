package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import org.bukkit.entity.ItemDisplay;

@Getter
public class ItemSettings {

    private ItemDisplay.ItemDisplayTransform displayTransform = ItemDisplay.ItemDisplayTransform.GUI;
    private double itemScale = 0.75;
    private double blockScale = 0.5;

    public void normalize() {
        if (displayTransform == null) {
            displayTransform = ItemDisplay.ItemDisplayTransform.GUI;
        }

        itemScale = Math.clamp(itemScale, 0.01, 10);
        blockScale = Math.clamp(blockScale, 0.01, 10);
    }

}
