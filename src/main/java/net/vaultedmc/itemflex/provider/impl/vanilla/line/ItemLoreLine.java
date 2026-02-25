package net.vaultedmc.itemflex.provider.impl.vanilla.line;

import lombok.NonNull;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.ArrayList;
import java.util.List;

public class ItemLoreLine implements PlaceholderLineProvider {

    @Override
    public @NonNull String getPlaceholder() {
        return "%item_lore%";
    }

    @Override
    public @NonNull Type getType() {
        return Type.INSERT;
    }

    @Override
    public @NonNull List<String> provide(@NonNull Player player, @NonNull ItemStack itemStack) {
        ItemFlex plugin = ItemFlex.getInstance();
        List<String> lore = new ArrayList<>();

        int loreLineLimits = plugin.getAnimationSettings().getLoreLineLimit();
        int lines = 0;

        for (String loreLine : itemStack.getItemMeta().getLore().reversed()) {
            if(plugin.getAnimationSettings().isIgnoreEmptyLoreLines() && ChatColor.stripColor(loreLine).isEmpty()) {
                continue;
            }

            lines++;

            if(lines > loreLineLimits) {
                break;
            }

            lore.add(loreLine);
        }

        return lore;
    }

}
