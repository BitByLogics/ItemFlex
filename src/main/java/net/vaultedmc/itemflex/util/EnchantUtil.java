package net.vaultedmc.itemflex.util;

import net.bitbylogic.utils.StringUtil;
import org.bukkit.enchantments.Enchantment;

import java.util.Arrays;
import java.util.TreeMap;
import java.util.stream.Collectors;

public class EnchantUtil {

    private static final TreeMap<Integer, String> ROMAN_MAP = new TreeMap<>();

    static {
        ROMAN_MAP.put(1000, "M");
        ROMAN_MAP.put(900, "CM");
        ROMAN_MAP.put(500, "D");
        ROMAN_MAP.put(400, "CD");
        ROMAN_MAP.put(100, "C");
        ROMAN_MAP.put(90, "XC");
        ROMAN_MAP.put(50, "L");
        ROMAN_MAP.put(40, "XL");
        ROMAN_MAP.put(10, "X");
        ROMAN_MAP.put(9, "IX");
        ROMAN_MAP.put(5, "V");
        ROMAN_MAP.put(4, "IV");
        ROMAN_MAP.put(1, "I");
    }

    public static String levelToRoman(int level) {
        if (level <= 0) {
            return String.valueOf(level);
        }

        int l = ROMAN_MAP.floorKey(level);

        if (level == l) {
            return ROMAN_MAP.get(level);
        }

        return ROMAN_MAP.get(l) + levelToRoman(level - l);
    }

    public static String getFormattedEnchant(Enchantment enchant) {
        String key = enchant.getKey().getKey();

        return Arrays.stream(key.split("_"))
                .map(StringUtil::capitalize)
                .collect(Collectors.joining(" "));
    }

}
