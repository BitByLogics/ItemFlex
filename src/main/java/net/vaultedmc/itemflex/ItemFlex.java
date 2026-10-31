package net.vaultedmc.itemflex;

import com.tcoded.folialib.FoliaLib;
import lombok.Getter;
import net.bitbylogic.utils.message.config.MessageProvider;
import net.bitbylogic.utils.message.format.Formatter;
import net.vaultedmc.itemflex.animation.AnimationManager;
import net.vaultedmc.itemflex.command.ItemFlexCommand;
import net.vaultedmc.itemflex.condition.ConditionManager;
import net.vaultedmc.itemflex.provider.LineProviderManager;
import net.vaultedmc.itemflex.settings.AnimationSettings;
import net.vaultedmc.itemflex.util.CooldownTracker;
import net.vaultedmc.itemflex.web.EditorServer;
import org.bstats.bukkit.Metrics;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;

@Getter
public class ItemFlex extends JavaPlugin {

    private static final int METRICS_ID = 26440;

    @Getter
    private static ItemFlex instance;

    private FoliaLib foliaLib;
    private MessageProvider messageProvider;
    private ConditionManager conditionManager;
    private LineProviderManager lineProviderManager;
    private AnimationSettings animationSettings;
    private AnimationManager animationManager;
    private EditorServer editorServer;

    private final CooldownTracker cooldowns = new CooldownTracker();

    @Override
    public void onEnable() {
        migrateSettings();
        saveDefaultConfig();
        instance = this;
        foliaLib = new FoliaLib(this);

        new Metrics(this, METRICS_ID);

        Formatter.registerConfig(new File(getDataFolder(), "config.yml"));
        messageProvider = new MessageProvider(getConfig().getConfigurationSection("Messages"));
        conditionManager = new ConditionManager();
        lineProviderManager = new LineProviderManager();

        animationManager = new AnimationManager(this);
        editorServer = new EditorServer(this);

        loadSettings();
        editorServer.start();

        ItemFlexCommand command = new ItemFlexCommand(this);
        getCommand("itemflex").setExecutor(command);
        getCommand("itemflex").setTabCompleter(command);
    }

    @Override
    public void onDisable() {
        foliaLib.getScheduler().cancelAllTasks();

        if (editorServer != null) {
            editorServer.stop();
        }
    }

    public void reload() {
        reloadConfig();
        loadSettings();

        messageProvider.reload(getConfig().getConfigurationSection("Messages"));

        editorServer.stop();
        editorServer.start();
    }

    public void loadSettings() {
        ConfigurationSection settingsSection = getConfig().getConfigurationSection("Settings");

        if (settingsSection == null) {
            return;
        }

        animationSettings = AnimationSettings.getConfigParser().parseFrom(settingsSection).orElse(null);
        animationManager.load();
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
