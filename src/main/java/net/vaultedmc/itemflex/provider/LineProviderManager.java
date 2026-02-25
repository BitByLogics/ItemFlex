package net.vaultedmc.itemflex.provider;

import lombok.NonNull;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.provider.impl.AEProviderHook;
import net.vaultedmc.itemflex.provider.impl.vanilla.VanillaProviderHook;
import org.bukkit.Bukkit;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class LineProviderManager {

    private final Map<String, PlaceholderProviderHook> registeredHooks = new HashMap<>();

    public LineProviderManager() {
        registerHook(new VanillaProviderHook(), new AEProviderHook());
    }

    public void registerHook(@NonNull PlaceholderProviderHook... hooks) {
        for (PlaceholderProviderHook hook : hooks) {
            if (registeredHooks.containsKey(hook.getId().toLowerCase(Locale.ROOT))) {
                continue;
            }

            boolean canRegister = true;

            for (String requiredPlugin : hook.getRequiredPlugins()) {
                if (Bukkit.getPluginManager().isPluginEnabled(requiredPlugin)) {
                    continue;
                }

                canRegister = false;
                break;
            }

            if (!canRegister) {
                continue;
            }

            registeredHooks.put(hook.getId().toLowerCase(Locale.ROOT), hook);

            ItemFlex.getInstance().getLogger().info("Successfully registered line hook for '" + hook.getId() + "'!");
        }
    }

    public List<PlaceholderLineProvider> getLineProviders() {
        return registeredHooks.values().stream()
                .flatMap(hook -> hook.getLineProviders().values().stream())
                .toList();
    }

}
