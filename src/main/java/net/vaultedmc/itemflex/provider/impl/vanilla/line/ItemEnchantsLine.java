package net.vaultedmc.itemflex.provider.impl.vanilla.line;

import lombok.NonNull;
import net.bitbylogic.utils.Placeholder;
import net.bitbylogic.utils.message.format.Formatter;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import net.vaultedmc.itemflex.util.EnchantUtil;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;

public class ItemEnchantsLine implements PlaceholderLineProvider {

    @Override
    public @NonNull String getPlaceholder() {
        return "%item_enchants%";
    }

    @Override
    public @NonNull Type getType() {
        return Type.INSERT;
    }

    @Override
    public @NonNull List<String> provide(@NonNull Player player, @NonNull ItemStack itemStack) {
        ItemMeta meta = itemStack.getItemMeta();

        if (meta == null || meta.getEnchants().isEmpty()) {
            return List.of();
        }

        String enchantFormat = ItemFlex.getInstance().getConfig().getString("Settings.Enchant-Format", "&6%enchantment_name% &f%enchantment_level%");

        List<String> lines = new ArrayList<>();

        meta.getEnchants().forEach((enchantment, integer) -> {
            lines.add(Formatter.format(enchantFormat,
                    new Placeholder("%enchantment_name%", EnchantUtil.getFormattedEnchant(enchantment)),
                    new Placeholder("%enchantment_level%", EnchantUtil.levelToRoman(integer))
            ));
        });

        return lines;
    }

}
