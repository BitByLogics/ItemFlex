package net.vaultedmc.itemflex.condition;

import lombok.NonNull;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

public record ConditionContext(@NonNull Player player, @NonNull ItemStack itemStack, @NonNull String data) {

}
