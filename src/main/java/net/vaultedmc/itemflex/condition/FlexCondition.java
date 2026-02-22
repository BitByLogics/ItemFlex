package net.vaultedmc.itemflex.condition;

import lombok.NonNull;

import java.util.function.Function;

public interface FlexCondition {

    @NonNull String getId();

    @NonNull Function<ConditionContext, Boolean> getCondition();

}
