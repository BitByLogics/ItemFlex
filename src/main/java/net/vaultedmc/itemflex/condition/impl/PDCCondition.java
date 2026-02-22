package net.vaultedmc.itemflex.condition.impl;

import lombok.NonNull;
import net.bitbylogic.utils.StringProcessor;
import net.vaultedmc.itemflex.condition.ConditionContext;
import net.vaultedmc.itemflex.condition.FlexCondition;
import org.bukkit.NamespacedKey;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;

import java.util.Locale;
import java.util.function.Function;

public class PDCCondition implements FlexCondition {

    @Override
    public @NonNull String getId() {
        return "pdc";
    }

    @Override
    public @NonNull Function<ConditionContext, Boolean> getCondition() {
        return conditionContext -> {
            String[] splitData = conditionContext.data().split(",");

            ItemMeta meta = conditionContext.itemStack().getItemMeta();

            if (meta == null) {
                return false;
            }

            NamespacedKey key = NamespacedKey.fromString(splitData[0]);

            if (key == null) {
                return false;
            }

            PersistentDataContainer dataContainer = meta.getPersistentDataContainer();

            if (splitData.length <= 2) {
                return dataContainer.has(key);
            }

            PersistentDataType<?, ?> dataType = getType(splitData[1]);

            if (dataType == null) {
                return false;
            }

            String value = splitData[2];

            try {
                return dataContainer.get(key, dataType) == StringProcessor.findAndProcess(dataType.getPrimitiveType(), value);
            } catch (ClassCastException exception) {
                return false;
            }
        };
    }

    private PersistentDataType<?, ?> getType(String type) {
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "BYTE" -> PersistentDataType.BYTE;
            case "INTEGER" -> PersistentDataType.INTEGER;
            case "LONG" -> PersistentDataType.LONG;
            case "FLOAT" -> PersistentDataType.FLOAT;
            case "DOUBLE" -> PersistentDataType.DOUBLE;
            case "STRING" -> PersistentDataType.STRING;
            case "BOOLEAN" -> PersistentDataType.BOOLEAN;
            default -> null;
        };
    }

}
