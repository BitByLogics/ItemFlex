package net.vaultedmc.itemflex.provider;

import lombok.NonNull;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.List;

public interface PlaceholderLineProvider {

    /**
     * Retrieves the string representation of the placeholder associated with this provider.
     *
     * @return The placeholder string, which is non-null and identifies the placeholder.
     */
    @NonNull String getPlaceholder();

    /**
     * Retrieves the type of action to be performed when processing a placeholder line.
     *
     * @return The type of action as a {@code Type} enum value. The possible values are:
     *         {@code REPLACE}, indicating that the provided value should replace the placeholder in the line(s),
     *         or {@code INSERT}, indicating that lines containing the placeholder should be replaced and additional lines appended.
     */
    @NonNull Type getType();

    /**
     * Provides a list of strings to replace or add in place of a placeholder
     * based on the context of the specified player and item stack.
     * <p>
     * Note: If the type is {@code REPLACE}, only the first element of the returned list will be used.
     * For {@code ADD} type, all elements in the list will be processed.
     *
     * @param player the player associated with the placeholder processing
     * @param itemStack the item stack related to the placeholder processing
     * @return a non-null list of strings to be used in placeholder replacement or addition
     */
    @NonNull List<String> provide(@NonNull Player player, @NonNull ItemStack itemStack);

    /**
     * Represents the type of action to be performed when processing a placeholder line.
     * <p>
     * The Type enum is used to define how a placeholder line is handled in the context
     * of a {@link PlaceholderLineProvider}.
     * <p>
     * - REPLACE: Indicates that the provided value should just replace the placeholder in the line(s).
     * - INSERT: Indicates that any line containing the placeholder should be dropped and new lines will be appended after.
     */
    enum Type {
        REPLACE,
        INSERT;
    }

}
