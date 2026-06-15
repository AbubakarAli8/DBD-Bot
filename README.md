<div align="center">

# 🩸 DBD-Bot

**A fully-featured Dead by Daylight Discord bot — built for the community, by the community.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![License](https://img.shields.io/badge/License-MIT-FF6600?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-57F287?style=for-the-badge)]()

> *Into the fog. Into the game.*

</div>

---

## 🪝 What is DBD-Bot?

DBD-Bot is an all-in-one Discord bot built specifically for Dead by Daylight communities. It brings DBD knowledge, server management, music, leveling, and community tools together in one place — themed around the fog, the Entity, and the trials.

52 slash commands. Prefix commands. Auto-mod. Twitch alerts. Music. Tickets. Leveling. Birthdays. All in one bot.

---

## ⚡ Features at a Glance

| Category | Features |
|---|---|
| 🩸 **DBD** | Perk info, killer stats, meta builds, shrine, player tracker, random killer |
| 🛡️ **Moderation** | Ban, kick, timeout, warn, purge, lock, slowmode, auto-mod |
| ⭐ **Leveling** | XP from messages & voice, rank cards, leaderboard |
| 🎵 **Music** | Play, queue, skip, shuffle, volume controls |
| 🎫 **Tickets** | Private support ticket channels with claim & close |
| 🎂 **Birthdays** | Set birthdays, automatic daily announcements |
| 📺 **Twitch Alerts** | Live notifications when tracked streamers go online |
| ✅ **Verification** | Button-based verification panel |
| 🎭 **Role Selection** | Dropdown self-role menus |
| 📋 **Logging** | Audit logs, mod logs, VC activity, message edits & deletes |
| 📊 **Stats Channels** | Auto-updating member count voice channels |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

### 1 — Clone the repo

```bash
git clone https://github.com/AbubakarAli8/DBD-Bot.git
cd DBD-Bot
```

### 2 — Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3 — Configure the bot

Create a `config.json` file in the root directory:

```json
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "clientId": "YOUR_CLIENT_ID_HERE",
  "guildId": "YOUR_SERVER_ID_HERE",

  "channels": {
    "auditLogs": "CHANNEL_ID",
    "modLogs": "CHANNEL_ID",
    "welcome": "CHANNEL_ID",
    "verify": "CHANNEL_ID",
    "roles": "CHANNEL_ID",
    "streamAlerts": "CHANNEL_ID"
  },

  "roles": {
    "verified": "ROLE_ID",
    "autoRole": "ROLE_ID",
    "mod": "ROLE_ID"
  },

  "twitch": {
    "clientId": "TWITCH_CLIENT_ID",
    "clientSecret": "TWITCH_CLIENT_SECRET",
    "streamers": []
  },

  "automod": {
    "bannedWords": [],
    "antiInvite": true,
    "antiSpam": true,
    "antiCaps": true,
    "capsThreshold": 70
  },

  "leveling": {
    "xpPerMessage": 15,
    "xpCooldown": 60
  }
}
```

> ⚠️ Never commit your `config.json` — it contains your bot token.

### 4 — Register slash commands

```bash
node deploy-commands.js
```

> Global slash commands can take up to **1 hour** to appear in Discord.

### 5 — Start the bot

```bash
npm start
```

---

## 🩸 DBD Commands

| Command | Description |
|---|---|
| `/perk <name>` | Perk info, tier rating, and pro tips |
| `/killer <name>` | Killer overview, power, speed, and 2026 meta tier |
| `/randomkiller` | Spin the wheel — get a random killer to play |
| `/build <side>` | Top meta builds for survivor or killer |
| `/shrine` | Link to the current weekly Shrine of Secrets |
| `/tracker <username>` | Player stats via Nightlight.gg |
| `/dbd-rules` | Post the community DBD rules *(mod only)* |

---

## 🛡️ Moderation

| Command | Description |
|---|---|
| `/ban` \| `,ban` | Ban a member |
| `/kick` \| `,kick` | Kick a member |
| `/timeout` \| `,timeout` | Timeout (e.g. `10m`, `1h`, `1d`) |
| `/warn` \| `,warn` | Warn — auto-timeout at 3, auto-ban at 5 |
| `/warnings` | View a user's warnings |
| `/clearwarnings` | Clear all warnings for a user |
| `/purge` \| `,purge` | Bulk delete up to 100 messages |
| `/lock` \| `/unlock` | Lock or unlock a channel |
| `/slowmode` | Set channel slowmode |
| `/giverole` \| `/removerole` | Manage member roles |
| `/nick` | Change a member's nickname |
| `/unban` | Unban a user by ID |

### Auto-Mod
Automatically handles: banned words, Discord invite links, spam (5+ messages in 5s → timeout), and excessive caps.

---

## 🎵 Music

| Command | Description |
|---|---|
| `/play <query>` | Play by name or URL |
| `/skip` | Skip current track |
| `/stop` | Stop and clear queue |
| `/queue` | View the queue |
| `/pause` \| `/resume` | Pause or resume |
| `/nowplaying` | Currently playing track |
| `/volume <1-100>` | Set volume |
| `/shuffle` | Shuffle the queue |

---

## ⚙️ Setup Commands *(Admin only)*

| Command | Description |
|---|---|
| `/setup-verify` | Post the verification panel |
| `/setup-roles` | Post the role selection menu |
| `/setup-ticket` | Post the support ticket panel |
| `/setup-perms` | Auto-configure all channel permissions |
| `/add-role-option` | Add a role to the selection menu |
| `/add-streamer` | Track a Twitch streamer |
| `/remove-streamer` | Stop tracking a streamer |

---

## 📁 Project Structure

```
DBD-Bot/
├── index.js              # Core bot — all commands, events, and logic
├── deploy-commands.js    # Slash command registration script
├── package.json
└── data/                 # Auto-created on first run (gitignored)
    ├── warnings.json
    ├── levels.json
    ├── tickets.json
    ├── birthdays.json
    ├── afk.json
    ├── role-menus.json
    └── twitch-live.json
```

---

## 🔒 Bot Permissions Required

The bot needs the following permissions when invited to your server:

- Administrator *(recommended)*
- Or: Manage Roles, Manage Channels, Kick/Ban Members, Moderate Members, Manage Messages, Send Messages, Embed Links, Connect, Speak

> The bot's role must be **above** any roles it needs to assign (e.g. Verified).

---

## 🛠️ Built With

- [discord.js v14](https://discord.js.org/) — Discord API wrapper
- [discord-player](https://discord-player.js.org/) — Music playback engine
- [@discord-player/extractor](https://github.com/Androz2091/discord-player) — Audio source extraction
- [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) — Audio encoding
- [node-fetch](https://github.com/node-fetch/node-fetch) — HTTP requests (Twitch API)

---

<div align="center">

**🩸 Don't get hooked.**

*Made for Dead by Daylight communities*

</div>
