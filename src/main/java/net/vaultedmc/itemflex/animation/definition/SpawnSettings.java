package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;

@Getter
public class SpawnSettings {

    private double distance = 1.5;
    private Offset offset = new Offset(0, 1.5, 0);
    private Offset itemOffset = new Offset(0, -0.17, 0);

    public void normalize() {
        if (offset == null) {
            offset = new Offset(0, 1.5, 0);
        }

        if (itemOffset == null) {
            itemOffset = new Offset(0, -0.17, 0);
        }
    }

}
