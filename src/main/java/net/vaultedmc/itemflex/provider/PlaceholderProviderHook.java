package net.vaultedmc.itemflex.provider;

import lombok.NonNull;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public interface PlaceholderProviderHook {

    @NonNull String getId();

    @NonNull String[] getRequiredPlugins();

    @NonNull Map<String, PlaceholderLineProvider> getLineProviders();

    default @NonNull Optional<PlaceholderLineProvider> getLineProvider(@NonNull String placeholder) {
        return Optional.ofNullable(getLineProviders().get(placeholder.toLowerCase(Locale.ROOT)));
    }

}
