package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;

@Getter
public enum TrackProperty {

    SCALE(1, true),
    ROTATION_X(0, false),
    ROTATION_Y(0, false),
    ROTATION_Z(0, false),
    OFFSET_X(0, false),
    OFFSET_Y(0, false),
    OFFSET_Z(0, false),
    FORWARD(0, false),
    OPACITY(1, true);

    private final double identity;
    private final boolean multiplicative;

    TrackProperty(double identity, boolean multiplicative) {
        this.identity = identity;
        this.multiplicative = multiplicative;
    }

}
