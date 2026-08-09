# Siam Tier Test Bot

Discord bot used by **Siam Network** and **Siam PVP** to manage Minecraft tier tests, tester queues, test tickets, player records, and tier roles.

> **Project status: Closed / archived**
>
> Siam Network and Siam PVP have been closed, so this bot is no longer operated as a live service. The repository is kept as a reference for the community and for anyone who wants to study or reuse the workflow.

## What the bot did

- Let players link their Discord account to a Minecraft username.
- Maintain a test waitlist for each supported gamemode.
- Allow testers to turn queue entries into private test ticket channels.
- Track active tests and close them with a tier result.
- Assign gamemode-specific tier roles and record test results.
- Support retired players, cooldowns, tester availability, and username synchronization.
- Provide player and leaderboard data through the built-in HTTP API.

## Supported gamemodes

`NETHPOT`, `DIAPOT`, `SMP`, `DIASMP`, `SWORD`, `AXE`, `MACE`, `CRYSTALS`, `UHC`, and `CART`.

## Discord commands

### Player and setup commands

| Command | Purpose |
| --- | --- |
| `/setup` | Posts the evaluation waitlist message and Minecraft-link button in the current channel. |
| `/ign user:<member>` | Shows the Minecraft username linked to a Discord member. |

Players normally use the buttons posted by `/setup` to link their Minecraft account and join a waitlist. The bot enforces a seven-day cooldown per player and gamemode.

### Tester commands

| Command | Purpose |
| --- | --- |
| `/online gamemode:<mode>` | Toggle tester availability for a gamemode. |
| `/pick gamemode:<mode>` | Take the first player in that gamemode’s queue and create a private test ticket. |
| `/close user:<member> tier:<tier>` | Finish an active test, save the result, and assign the matching tier role. Use `SKIP` when no tier is awarded. |
| `/role` | Display the configured tier roles for all gamemodes. |

### Pro Tester commands

| Command | Purpose |
| --- | --- |
| `/addtier user:<member> gamemode:<mode> tier:<tier>` | Directly add or update a player’s tier. `UNRANKED` removes the tier for that gamemode. |
| `/retire user:<member> gamemode:<mode>` | Mark a player as retired for a gamemode. |

The exact Discord role IDs and channel IDs are configured in `config.js`. Testers need the base tester role plus the role for the selected gamemode. Higher tiers have additional Pro Tester restrictions.

## Running the bot

This is an archived reference. Running it again requires recreating the original Discord server structure, roles, channels, webhook, database, and permissions.

Requirements:

- Node.js with ES module support
- A Discord bot application with the required server permissions and intents
- MongoDB
- A server or process manager to keep the bot online

Install dependencies:

```bash
npm install
```

Before starting, configure the bot with new credentials and IDs for your own Discord server. The current code stores configuration in `config.js` and the MongoDB connection in `db.js`; these should be moved to environment variables before any production reuse.

Start the bot:

```bash
node index.js
```

The bot registers its slash commands for the configured guild when it logs in. It also starts the HTTP API defined in `index.js`.

## Data and API

MongoDB stores linked usernames, players, queues, active tests, and cooldowns. The HTTP API includes endpoints for player and leaderboard data, plus the account-verification flow used by the Minecraft-link system. Review `index.js` before exposing the API publicly; the current implementation enables permissive CORS and was written for the original private service.

The `data/` directory contains local pending interaction state. Treat it as service data rather than public documentation.

## Security warning

The archived repository contains credentials and infrastructure identifiers in source files, including a Discord token/webhook and a MongoDB URI. Even if the services are closed, rotate or revoke any credential that was ever valid before publishing or reusing this code. Do not commit replacement secrets; use environment variables and a secret manager instead.

The repository also contains old server-specific Discord IDs and configuration. These values are only useful for reconstructing the original Siam server and should be replaced for a new deployment.

## Closure notice

Siam Network and Siam PVP are permanently closed, and this bot is no longer maintained or supported. Existing commands, roles, queues, tickets, and result systems should be considered inactive. No uptime, data availability, account-linking, or tier-test service is guaranteed.

Thank you to everyone who played, tested, helped moderate, and supported Siam Network and Siam PVP.

## License

You are free to use, modify, and reuse this project. Credit to **Jaruwit / Siam Network** is appreciated, but it is not required.
