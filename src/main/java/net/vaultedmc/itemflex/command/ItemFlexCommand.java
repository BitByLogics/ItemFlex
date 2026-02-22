package net.vaultedmc.itemflex.command;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import net.bitbylogic.utils.Placeholder;
import net.bitbylogic.utils.TimeConverter;
import net.bitbylogic.utils.cooldown.CooldownUtil;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.animation.FlexAnimation;
import net.vaultedmc.itemflex.condition.ConditionContext;
import net.vaultedmc.itemflex.condition.FlexCondition;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@RequiredArgsConstructor
public class ItemFlexCommand implements CommandExecutor {

    private final ItemFlex plugin;

    @Override
    public boolean onCommand(@NonNull CommandSender sender, @NonNull Command command, @NonNull String label, @NonNull String[] args) {
        if(args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            if(!sender.hasPermission(plugin.getConfig().getString("Settings.Permissions.Reload", "itemflex.reload"))) {
                sender.sendMessage(plugin.getMessageProvider().getMessage("No-Permission"));
                return true;
            }

            plugin.reloadConfig();
            plugin.loadSettings();

            plugin.getMessageProvider().reload(plugin.getConfig().getConfigurationSection("Messages"));

            sender.sendMessage(plugin.getMessageProvider().getMessage("Config-Reloaded"));
            return true;
        }

        if(!(sender instanceof Player player)) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Player-Only"));
            return true;
        }

        if(plugin.getConfig().getBoolean("Settings.Permissions.Enabled") && !player.hasPermission(plugin.getConfig().getString("Settings.Permissions.Use", "itemflex.use"))) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("No-Permission"));
            return true;
        }

        if(player.getInventory().getItemInMainHand().getType().isAir()) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Must-Hold-Item"));
            return true;
        }

        for (Map.Entry<String, String> conditionEntry : plugin.getAnimationSettings().getFlexConditions().entrySet()) {
            FlexCondition condition = plugin.getConditionManager().getCondition(conditionEntry.getKey()).orElse(null);

            if (condition == null) {
                continue;
            }

            if(!condition.getCondition().apply(new ConditionContext(player, player.getInventory().getItemInMainHand(), conditionEntry.getValue()))) {
                sender.sendMessage(plugin.getMessageProvider().getMessage("Cannot-Flex"));
                return true;
            }
        }

        if(CooldownUtil.hasCooldown("itemflex", player.getUniqueId())) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Cooldown-Active", new Placeholder("%time%",
                    TimeConverter.convertToReadableTime((long) (CooldownUtil.getRemainingTime("itemflex", player.getUniqueId()) * 1000)))));
            return true;
        }

        if(player.hasMetadata("flex_active")) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Flex-Active"));
            return true;
        }

        if(!player.hasPermission(plugin.getConfig().getString("Settings.Permissions.Bypass-Cooldown", "itemflex.bypasscooldown"))) {
            CooldownUtil.startCooldown(plugin, "itemflex", player.getUniqueId(),
                    TimeConverter.convert(plugin.getConfig().getString("Settings.Use-Cooldown", "1m")),
                    TimeUnit.MILLISECONDS);
        }

        player.setMetadata("flex_active", new FixedMetadataValue(plugin, "true"));

        new FlexAnimation(player, plugin);
        return true;
    }

}
