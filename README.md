<div align="center">

  <img src="https://myimgs.org/storage/images/72555/itemflex_cover.png" alt="ItemFlex Showcase"/>

## Item Flex

![Issues](https://img.shields.io/github/issues-raw/BitByLogics/ItemFlex)
[![Stars](https://img.shields.io/github/stars/BitByLogics/ItemFlex)](https://github.com/VaultedMC/VaultedItemFlex/stargazers)
[![Chat](https://img.shields.io/discord/1364023569247506583?logo=discord&logoColor=white)](https://discord.gg/syngw2UQUd)

<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/spigot_46h.png" height="35"></a>
<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/paper_46h.png" height="35"></a>
<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/purpur_46h.png" height="35"></a>


</div>

## Features

- Display the held item with floating holograms and spinning animations
- Timeline-based animations: keyframed item/text transforms with easing, plus particle, sound, command and text events
- Built-in web editor with a live preview and timeline, hosted by the server itself, with a first-time tour
- Multiple animations with per-animation permissions and priorities
- Supports PlaceholderAPI placeholders
- Cooldown and permission system
- Clean hologram rendering with shadows, backgrounds, and spacing
- Toggle line limits and empty-line behavior for clean formatting
- Folia support

---

## Commands & Permissions

### `/itemflex [animation]`
Triggers a flex animation for the item in your main hand. Without a name, the highest-priority animation you have permission for is used.

### `/itemflex editor`
Sends you a one-time link (valid for 5 minutes) to the web editor.

### `/itemflex reload`
Reloads `config.yml` and all animations, and restarts the web editor.

**Permissions:**

| Node                        | Description                                       |
|-----------------------------|---------------------------------------------------|
| `itemflex.use`              | Allows use of the `/itemflex` command             |
| `itemflex.cooldownbypass`   | Bypass the cooldown requirement                   |
| `itemflex.reload`           | Allows `/itemflex reload`                         |
| `itemflex.editor`           | Allows `/itemflex editor` and using the editor    |
| `itemflex.editor.commands`  | Allows adding or changing command events         |

Each animation can also require its own permission (set in the editor).

---

## Animations

Animations live in `plugins/ItemFlex/animations/<name>.json`. On first start, the animation settings from an older `config.yml` are converted into `animations/default.json`.

Two extra animations are installed once alongside the default: `inferno` (a meteor-style impact, permission `itemflex.animation.inferno`) and `arcane` (an enchanted ascension, permission `itemflex.animation.arcane`). Both have priority 10, so players with the permission get them instead of the default. Delete or edit them freely; they are not re-created.

An animation has:

- **Tracks** - keyframed values over time for the `ITEM`, the `TEXT` lines, or the `ROOT` (the whole hologram): scale, rotation, offsets, forward distance and text opacity. Each keyframe has an easing (`LINEAR`, `STEP`, `EASE_IN`, `EASE_OUT`, `EASE_IN_OUT`, `BACK_OUT`, `BOUNCE_OUT`).
- **Events** - things that happen at a tick, optionally repeating: `PARTICLE`, `SOUND`, `COMMAND` (console or player, `%player%` supported), `MESSAGE` (a chat message to the player) and `TEXT` (change a line's text).
- **Settings** - spawn position, item display options, text lines, background, brightness and the permission/priority.

## Web editor

The editor is served by the plugin on its own port (default `8765`, see the `Editor` section of `config.yml`). Run `/itemflex editor` in game and open the link. It has a timeline, an inspector and an approximate 3D preview (drag to orbit, right-drag to pan, scroll to zoom). A short tour runs the first time you open it and can be replayed with the `?` button. Press `F8` for performance info.

- The port must be reachable by whoever edits, and cannot be the Minecraft port. On a panel such as Pterodactyl, create an extra allocation and use that port.
- `Editor.Bind-Address` should stay `0.0.0.0` on hosts and panels. Never put your public IP there.
- Links use `Editor.Public-URL` (for example `http://203.0.113.5:8765`). If it is empty, the plugin looks up the server's public IP once at startup (`Editor.Detect-Public-IP: true`, uses api.ipify.org) and logs the address links will use, with a warning if it is local or private.
- The editor uses plain HTTP. If it is reachable from the internet, put a TLS reverse proxy in front of it and set `Editor.Public-URL`, or bind it to `127.0.0.1` and use an SSH tunnel.
- On first start the plugin downloads the official Minecraft client from Mojang (about 41 MB, cached in `plugins/ItemFlex/assets`) so the preview can show real item models, particles, fonts and sounds. The files are only served to logged-in editor sessions. Disable this with `Editor.Assets.Enabled: false` or pin a version with `Editor.Assets.Version`.
- Links are single-use. Sessions expire after `Editor.Session-Minutes` of inactivity.
- Players without `itemflex.editor.commands` cannot add or change command events; the server enforces this on save.

---

## Configuration

Permissions, cooldown, flex conditions, lore limits, messages and the editor server are configured in `config.yml`. Everything about the animation itself is edited in the web editor.

---

## Installation

1. Download the plugin: [Modrinth](https://modrinth.com/plugin/item-flex)
2. Place it in your server's `/plugins` folder
3. Restart the server
4. Make sure the editor port (default `8765`) is reachable, then run `/itemflex editor`
5. (Optional) Install [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) for placeholder support

---
