package net.vaultedmc.itemflex.provider.impl;

import lombok.NonNull;
import net.advancedplugins.ae.api.AEAPI;
import net.bitbylogic.utils.Placeholder;
import net.bitbylogic.utils.message.format.Formatter;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import net.vaultedmc.itemflex.provider.PlaceholderProviderHook;
import net.vaultedmc.itemflex.util.EnchantUtil;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.*;

public class AEProviderHook implements PlaceholderProviderHook {

    @Override
    public @NonNull String getId() {
        return "AdvancedEnchantments";
    }

    @Override
    public @NonNull String[] getRequiredPlugins() {
        return new String[]{"AdvancedEnchantments"};
    }

    @Override
    public @NonNull Map<String, PlaceholderLineProvider> getLineProviders() {
        return Map.of(
                "ae_enchants", new PlaceholderLineProvider() {
                    @Override
                    public @NonNull String getPlaceholder() {
                        return "%ae_enchants%";
                    }

                    @Override
                    public @NonNull Type getType() {
                        return Type.INSERT;
                    }

                    @Override
                    public @NonNull List<String> provide(@NonNull Player player, @NonNull ItemStack itemStack) {
                        ItemFlex plugin = ItemFlex.getInstance();

                        Map<String, Integer> enchants = AEAPI.getEnchantmentsOnItem(itemStack);
                        String enchantFormat = plugin.getConfig().getString("Settings.Enchant-Format", "&6%enchantment_name% &f%enchantment_level%");

                        List<String> lines = new ArrayList<>();

                        enchants.forEach((enchantment, level) -> {
                            lines.add(Formatter.format(enchantFormat,
                                    new Placeholder("%enchantment_name%", enchantment),
                                    new Placeholder("%enchantment_level%", EnchantUtil.levelToRoman(level))
                            ));
                        });

                        return lines;
                    }
                }
        );
    }

}
