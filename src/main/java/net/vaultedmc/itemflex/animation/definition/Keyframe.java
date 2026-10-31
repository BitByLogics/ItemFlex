package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;

@Getter
public class Keyframe {

    private int tick;
    private double value;
    private Easing easing = Easing.LINEAR;

}
