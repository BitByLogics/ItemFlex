<div align="center">

  <img src="https://i.imgur.com/vvjjwNW.gif" alt="ItemFlex Showcase" width="200"/>
  
## Vaulted Item Flex

**VaultedItemFlex** is a lightweight, configurable Spigot plugin that lets players "flex" the item they’re holding through a smooth in-world animation. Featuring holograms, particles, sounds, and PlaceholderAPI support, it’s perfect for RPG, PvP, and cosmetic-heavy servers.

## VaultedItemFlex

![Issues](https://img.shields.io/github/issues-raw/VaultedMC/VaultedItemFlex)
[![Stars](https://img.shields.io/github/stars/VaultedMC/VaultedItemFlex)](https://github.com/VaultedMC/VaultedItemFlex/stargazers)
[![Chat](https://img.shields.io/discord/1364023569247506583?logo=discord&logoColor=white)](https://discord.gg/syngw2UQUd)

<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/spigot_46h.png" height="35"></a>
<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/paper_46h.png" height="35"></a>
<a href="#"><img src="https://raw.githubusercontent.com/intergrav/devins-badges/v2/assets/compact/supported/purpur_46h.png" height="35"></a>


</div>

## ✨ Features

- Display the held item with floating holograms and spinning animations
- Fully configurable: lines, positioning, particles, sounds, durations, and more
- Supports PlaceholderAPI placeholders
- Cooldown and permission system
- Clean hologram rendering with shadows, backgrounds, and spacing
- Toggle line limits and empty-line behavior for clean formatting

---

## 🔧 Commands & Permissions

### `/itemflex`
Triggers the flex animation for the item in your main hand.

**Permissions:**

| Node                    | Description                                 |
|-------------------------|---------------------------------------------|
| `itemflex.use`          | Allows use of the `/itemflex` command       |
| `itemflex.cooldownbypass` | Bypass the cooldown requirement            |
| `itemflex.reload`       | Allows `/itemflex reload` to refresh config |

---

## 🛠 Configuration

All plugin behavior can be tuned via `config.yml`.

### Default Config

<details>
<summary>Click to expand</summary>

```yaml
Settings:
  Permissions:
    Enabled: true
    Use: "itemflex.use"
    Bypass-Cooldown: "itemflex.cooldownbypass"
    Reload: "itemflex.reload"

  Use-Cooldown: "1m"
  Lore-Line-Limit: 3
  Ignore-Empty-Lore-Lines: true
  Line-Spacing: 0.17

  Lines:
    - "&6&lFLEXING"
    - "%item_name%"

  Spawn-Location:
    Distance: 1.5
    Offset:
      X: 0
      Y: 1.5
      Z: 0
    Item-Offset:
      X: 0
      Y: -0.17
      Z: 0

  Display-Transform: GUI
  Item-Display-Scale: 0.75
  Block-Display-Scale: 0.5
  Billboard-Type: "VERTICAL"

  Background-Color:
    Opacity: 0
    Red: 0
    Green: 0
    Blue: 0

  Brightness:
    Block: 15
    Sky: 15

  Text-Shadow: true

  Spawn-Particle:
    Particle: "GLOW"
    Count: 20
    Offset:
      X: 0.1
      Y: 0.2
      Z: 0.1
    Speed: 0.01

  Spawn-Sound:
    Sound: "ENTITY_EVOKER_CAST_SPELL"
    Volume: 1.2
    Pitch: 1.5

  Scale-Settings:
    Starting-Scale: 0.01
    Scale-Increment: 0.06

  Rotate-Speed: 7
  Animation-Duration: 80

  Disappear-Particle:
    Particle: "FIREWORK"
    Count: 15
    Offset:
      X: 0.2
      Y: 0.2
      Z: 0.2
    Speed: 0.05

  Disappear-Sound:
    Sound: "BLOCK_AMETHYST_BLOCK_BREAK"
    Volume: 0.8
    Pitch: 1.7

  Ambient-Particle:
    Frequency: 10
    Particle: "ENCHANT"
    Count: 3
    Offset:
      X: 0.1
      Y: 0.1
      Z: 0.1
    Speed: 0

  Ambient-Sound:
    Frequency: 20
    Sound: "BLOCK_BEACON_AMBIENT"
    Volume: 0.3
    Pitch: 1.2

Messages:
  No-Permission: "#FF5555You do not have permission to use this."
  Must-Hold-Item: "#FFA500You must be holding an item to flex it!"
  Flex-Active: "#FFA500You already have an item flex active!"
  Cooldown-Active: "#FFD700You're still on cooldown! Please wait #FF5555%time%#FFD700 before flexing again."
  Player-Only: "#FF4444This command can only be used by players."
  Config-Reloaded: "#55FF55✔ Configuration reloaded successfully."
```

</details>

---

## 📦 Installation

1. 📦 Download the plugin: [Modrinth](https://modrinth.com/plugin/vaulted-item-flex)
2. Place it in your server's `/plugins` folder
3. Restart the server
4. (Optional) Install [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) for placeholder support

---

## 🧩 Compatibility

- Minecraft: **1.20+**
- Server: **Paper / Purpur** recommended
- Dependencies: [PlaceholderAPI (optional)](https://www.spigotmc.org/resources/placeholderapi.6245/)

---

## 📜 License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.

---

## ❤️ Support & Feedback

Need help? Found a bug?  
Feel free to [open an issue](https://github.com/VaultedMC/VaultedItemFlex/issues) or join our Discord!

---
