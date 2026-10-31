package net.vaultedmc.itemflex.animation.definition;

public enum Easing {

    LINEAR,
    STEP,
    EASE_IN,
    EASE_OUT,
    EASE_IN_OUT,
    BACK_OUT,
    BOUNCE_OUT;

    public double apply(double t) {
        switch (this) {
            case STEP:
                return 0;
            case EASE_IN:
                return t * t * t;
            case EASE_OUT:
                return 1 - Math.pow(1 - t, 3);
            case EASE_IN_OUT:
                if (t < 0.5) {
                    return 4 * t * t * t;
                }

                return 1 - Math.pow(-2 * t + 2, 3) / 2;
            case BACK_OUT:
                double c1 = 1.70158;
                double c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            case BOUNCE_OUT:
                return bounceOut(t);
            default:
                return t;
        }
    }

    private static double bounceOut(double t) {
        double n1 = 7.5625;
        double d1 = 2.75;

        if (t < 1 / d1) {
            return n1 * t * t;
        }

        if (t < 2 / d1) {
            t -= 1.5 / d1;
            return n1 * t * t + 0.75;
        }

        if (t < 2.5 / d1) {
            t -= 2.25 / d1;
            return n1 * t * t + 0.9375;
        }

        t -= 2.625 / d1;
        return n1 * t * t + 0.984375;
    }

}
