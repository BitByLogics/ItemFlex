package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;
import org.bukkit.util.Vector;

@Getter
public class Offset {

    private double x;
    private double y;
    private double z;

    public Offset() {
    }

    public Offset(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public Vector toVector() {
        return new Vector(x, y, z);
    }

}
