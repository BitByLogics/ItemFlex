package net.vaultedmc.itemflex.provider.impl.vanilla;

import lombok.NonNull;
import net.vaultedmc.itemflex.provider.PlaceholderLineProvider;
import net.vaultedmc.itemflex.provider.PlaceholderProviderHook;
import net.vaultedmc.itemflex.provider.impl.vanilla.line.ItemEnchantsLine;
import net.vaultedmc.itemflex.provider.impl.vanilla.line.ItemLoreLine;
import net.vaultedmc.itemflex.provider.impl.vanilla.line.ItemNameLine;

import java.util.Map;

public class VanillaProviderHook implements PlaceholderProviderHook {

    @Override
    public @NonNull String getId() {
        return "vanilla";
    }

    @Override
    public @NonNull String[] getRequiredPlugins() {
        return new String[0];
    }

    @Override
    public @NonNull Map<String, PlaceholderLineProvider> getLineProviders() {
        return Map.of(
                "%item_name%", new ItemNameLine(),
                "%item_lore%", new ItemLoreLine(),
                "%item_enchants%", new ItemEnchantsLine()
        );
    }

}
