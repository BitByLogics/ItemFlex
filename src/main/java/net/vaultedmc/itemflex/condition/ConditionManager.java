package net.vaultedmc.itemflex.condition;

import lombok.NonNull;
import net.vaultedmc.itemflex.condition.impl.PDCCondition;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class ConditionManager {

    private final Map<String, FlexCondition> conditions = new HashMap<>();

    public ConditionManager() {
        registerCondition(new PDCCondition());
    }

    public void registerCondition(@NonNull FlexCondition condition) {
        if (conditions.containsKey(condition.getId())) {
            return;
        }

        conditions.put(condition.getId(), condition);
    }

    public Optional<FlexCondition> getCondition(@NonNull String id) {
        return Optional.ofNullable(conditions.get(id));
    }

}
