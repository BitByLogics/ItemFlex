package net.vaultedmc.itemflex.animation.definition;

import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class Track {

    private TrackTarget target = TrackTarget.ITEM;
    private int line = -1;
    private TrackProperty property = TrackProperty.SCALE;
    private List<Keyframe> keyframes = new ArrayList<>();

    public void sortKeyframes() {
        keyframes.sort(Comparator.comparingInt(Keyframe::getTick));
    }

    public boolean appliesToLine(int lineIndex) {
        return line < 0 || line == lineIndex;
    }

    public double evaluate(double tick) {
        if (keyframes.isEmpty()) {
            return property.getIdentity();
        }

        Keyframe first = keyframes.getFirst();

        if (tick <= first.getTick()) {
            return first.getValue();
        }

        for (int i = 0; i < keyframes.size() - 1; i++) {
            Keyframe previous = keyframes.get(i);
            Keyframe next = keyframes.get(i + 1);

            if (tick >= next.getTick()) {
                continue;
            }

            double progress = (tick - previous.getTick()) / (next.getTick() - previous.getTick());
            Easing easing = previous.getEasing() == null ? Easing.LINEAR : previous.getEasing();

            return previous.getValue() + (next.getValue() - previous.getValue()) * easing.apply(progress);
        }

        return keyframes.getLast().getValue();
    }

}
