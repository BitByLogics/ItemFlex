package net.vaultedmc.itemflex;

import lombok.Getter;
import net.bitbylogic.utils.message.config.MessageProvider;
import net.bitbylogic.utils.message.format.Formatter;
import net.vaultedmc.itemflex.command.ItemFlexCommand;
import net.vaultedmc.itemflex.condition.ConditionManager;
import net.vaultedmc.itemflex.settings.AnimationSettings;
import org.bstats.bukkit.Metrics;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;

@Getter
public class ItemFlex extends JavaPlugin {

    private static final int METRICS_ID = 26440;

    private MessageProvider messageProvider;
    private ConditionManager conditionManager;
    private AnimationSettings animationSettings;

    @Override
    public void onEnable() {
        migrateSettings();
        saveDefaultConfig();

        new Metrics(this, METRICS_ID);

        Formatter.registerConfig(new File(getDataFolder(), "config.yml"));
        messageProvider = new MessageProvider(getConfig().getConfigurationSection("Messages"));
        conditionManager = new ConditionManager();

        loadSettings();

        getCommand("itemflex").setExecutor(new ItemFlexCommand(this));
    }

    public void loadSettings() {
        ConfigurationSection settingsSection = getConfig().getConfigurationSection("Settings");

        if (settingsSection == null) {
            return;
        }

        animationSettings = AnimationSettings.getConfigParser().parseFrom(settingsSection).orElse(null);
    }

    private void migrateSettings() {
        File oldFolder = new File(getDataFolder().getParentFile(), "VaultedItemFlex");
        File newFolder = getDataFolder();

        if (oldFolder.exists() && oldFolder.isDirectory()) {
            if (newFolder.exists()) {
                getLogger().warning("Found old VaultedItemFlex folder, but ItemFlex folder already exists. Migration skipped.");
                return;
            }

            boolean success = oldFolder.renameTo(newFolder);

            if (success) {
                getLogger().info("Successfully migrated VaultedItemFlex data folder to ItemFlex!");
                return;
            }

            getLogger().severe("Failed to rename VaultedItemFlex folder. Check file permissions.");
        }
    }

}
