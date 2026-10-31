package net.vaultedmc.itemflex.command;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import net.bitbylogic.utils.Placeholder;
import net.bitbylogic.utils.TimeConverter;
import net.md_5.bungee.api.chat.BaseComponent;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.chat.hover.content.Text;
import net.vaultedmc.itemflex.ItemFlex;
import net.vaultedmc.itemflex.animation.FlexAnimation;
import net.vaultedmc.itemflex.animation.definition.AnimationDefinition;
import net.vaultedmc.itemflex.condition.ConditionContext;
import net.vaultedmc.itemflex.condition.FlexCondition;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@RequiredArgsConstructor
public class ItemFlexCommand implements TabExecutor {

    private final ItemFlex plugin;

    @Override
    public boolean onCommand(@NonNull CommandSender sender, @NonNull Command command, @NonNull String label, @NonNull String[] args) {
        if(args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            if(!sender.hasPermission(plugin.getConfig().getString("Settings.Permissions.Reload", "itemflex.reload"))) {
                sender.sendMessage(plugin.getMessageProvider().getMessage("No-Permission"));
                return true;
            }

            plugin.reload();

            sender.sendMessage(plugin.getMessageProvider().getMessage("Config-Reloaded"));
            return true;
        }

        if(!(sender instanceof Player player)) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Player-Only"));
            return true;
        }

        if(args.length == 1 && args[0].equalsIgnoreCase("editor")) {
            openEditor(player);
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

        Optional<AnimationDefinition> optionalAnimation;

        if(args.length >= 1) {
            optionalAnimation = plugin.getAnimationManager().getAnimation(args[0]);

            if(optionalAnimation.isPresent() && !plugin.getAnimationManager().canUse(player, optionalAnimation.get())) {
                sender.sendMessage(plugin.getMessageProvider().getMessage("No-Permission"));
                return true;
            }
        } else {
            optionalAnimation = plugin.getAnimationManager().select(player);
        }

        if(optionalAnimation.isEmpty()) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Unknown-Animation"));
            return true;
        }

        long cooldownLeft = plugin.getCooldowns().remaining(player.getUniqueId());

        if(cooldownLeft > 0) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Cooldown-Active", new Placeholder("%time%",
                    TimeConverter.convertToReadableTime(cooldownLeft))));
            return true;
        }

        if(player.hasMetadata("flex_active")) {
            sender.sendMessage(plugin.getMessageProvider().getMessage("Flex-Active"));
            return true;
        }

        if(!player.hasPermission(plugin.getConfig().getString("Settings.Permissions.Bypass-Cooldown", "itemflex.bypasscooldown"))) {
            plugin.getCooldowns().start(player.getUniqueId(),
                    TimeConverter.convert(plugin.getConfig().getString("Settings.Use-Cooldown", "1m")));
        }

        player.setMetadata("flex_active", new FixedMetadataValue(plugin, "true"));

        new FlexAnimation(player, plugin, optionalAnimation.get());
        return true;
    }

    private void openEditor(Player player) {
        if(!player.hasPermission(plugin.getConfig().getString("Editor.Permission", "itemflex.editor"))) {
            player.sendMessage(plugin.getMessageProvider().getMessage("No-Permission"));
            return;
        }

        if(!plugin.getEditorServer().isRunning()) {
            player.sendMessage(plugin.getMessageProvider().getMessage("Editor-Disabled"));
            return;
        }

        boolean canEditCommands = player.hasPermission(plugin.getConfig().getString("Editor.Commands-Permission", "itemflex.editor.commands"));
        String url = plugin.getEditorServer().createLoginUrl(player.getUniqueId(), player.getName(), canEditCommands);

        player.spigot().sendMessage(createLink(plugin.getMessageProvider().getMessage("Editor-Link"), url));
        player.spigot().sendMessage(createLink(plugin.getMessageProvider().getMessage("Editor-Link-Raw", new Placeholder("%url%", url)), url));

        if(plugin.getEditorServer().isLocalLink()) {
            player.sendMessage(ChatColor.YELLOW + "This link points to a local address, so it only works from the server machine. Set Editor.Public-URL in the ItemFlex config.yml to the server's public address (http://<public-ip>:<port>).");
        }
    }

    private TextComponent createLink(String message, String url) {
        TextComponent link = new TextComponent();

        for (BaseComponent part : TextComponent.fromLegacyText(message)) {
            part.setClickEvent(new ClickEvent(ClickEvent.Action.OPEN_URL, url));
            part.setHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new Text("Open the editor")));
            link.addExtra(part);
        }

        link.setClickEvent(new ClickEvent(ClickEvent.Action.OPEN_URL, url));
        return link;
    }

    @Override
    public List<String> onTabComplete(@NonNull CommandSender sender, @NonNull Command command, @NonNull String alias, @NonNull String[] args) {
        List<String> completions = new ArrayList<>();

        if(args.length != 1 || !(sender instanceof Player player)) {
            return completions;
        }

        String input = args[0].toLowerCase(Locale.ROOT);

        if(sender.hasPermission(plugin.getConfig().getString("Settings.Permissions.Reload", "itemflex.reload")) && "reload".startsWith(input)) {
            completions.add("reload");
        }

        if(sender.hasPermission(plugin.getConfig().getString("Editor.Permission", "itemflex.editor")) && "editor".startsWith(input)) {
            completions.add("editor");
        }

        for (AnimationDefinition definition : plugin.getAnimationManager().getAnimations()) {
            if(definition.getName().startsWith(input) && plugin.getAnimationManager().canUse(player, definition)) {
                completions.add(definition.getName());
            }
        }

        return completions;
    }

}
