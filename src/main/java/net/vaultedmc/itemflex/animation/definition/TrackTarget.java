package net.vaultedmc.itemflex.animation.definition;

public enum TrackTarget {

    ITEM,
    TEXT,
    ROOT;

    public boolean supports(TrackProperty property) {
        switch (this) {
            case ITEM:
                return property != TrackProperty.OPACITY && property != TrackProperty.FORWARD;
            case TEXT:
                return property != TrackProperty.FORWARD;
            default:
                return property == TrackProperty.OFFSET_X || property == TrackProperty.OFFSET_Y
                        || property == TrackProperty.OFFSET_Z || property == TrackProperty.FORWARD;
        }
    }

}
