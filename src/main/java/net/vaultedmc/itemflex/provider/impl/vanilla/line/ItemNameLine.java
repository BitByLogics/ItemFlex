package net.vaultedmc.itemflex.provider.impl.vanilla.line;

import lombok.NonNull;
import net.bitbylogic.utils.item.ItemStackUtil;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.List;

public class ItemNameLine implements PlaceholderLineProvider {

    @Override
    public @NonNull String getPlaceholder() {
        return "%item_name%";
    }

    @Override
    public @NonNull Type getType() {
        return Type.REPLACE;
    }

    @Override
    public @NonNull List<String> provide(@NonNull Player player, @NonNull ItemStack itemStack) {
        ItemMeta meta = itemStack.getItemMeta();
        String itemName = meta.hasDisplayName() ? meta.getDisplayName() : ItemStackUtil.getVanillaName(itemStack);

        return List.of(itemName);
    }

}
