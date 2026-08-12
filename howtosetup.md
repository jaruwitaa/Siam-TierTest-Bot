# How to Set Up Your Own Tier Test Bot

This guide is for people who fork this repository and want to run the bot in their own Discord server.

## 1. Requirements

- Node.js 18 or newer
- A Discord application and bot
- A MongoDB database
- A Discord server where you have administrator permission

Install the project dependencies:

```bash
npm install
```

## 2. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application and open the **Bot** page.
3. Create the bot and copy its token.
4. Enable the **Server Members Intent** if your server requires it.
5. Invite the bot using the OAuth2 URL generator with these scopes:
   - `bot`
   - `applications.commands`
6. Give the bot permission to view channels, send messages, manage channels, manage messages, manage roles, and use slash commands.

Keep the token private. Never commit it to GitHub.

## 3. Create the MongoDB database

Create a MongoDB database using MongoDB Atlas or your own MongoDB server. Copy the connection URI and keep it private.

The current code reads the MongoDB URI directly from `db.js`. Edit this line:

```js
const MONGO_URI = 'mongodb+srv://username:password@your-cluster.mongodb.net/your-database';
```

The repository currently does not load `.env`, so creating one will have no effect unless you first modify the code to use `dotenv` or another environment-variable loader. Do not commit the MongoDB URI.

## 4. Configure `config.js`

Replace the original server IDs with IDs from your own server. Enable Discord Developer Mode, then right-click a server, channel, role, or category and select **Copy ID**.

The bot currently reads the Discord token directly from `config.js`:

```js
token: 'your-bot-token',
```

The current repository does not load the `dotenv` package, even though it appears in `package.json`. Do not place a real token in a public fork. Before running a public fork, either keep the repository private or update the code to read secrets from environment variables.

At minimum, configure:

- `guildId`: your Discord server ID
- `testerRoleId`: the base tester role
- `ProtesterRoleId`: the pro tester role
- `BanlistRoleId`: the role used to block banned users
- `resultWebhook`: a webhook for test results, or `null` to disable it
- `ticketCategoryId`: the category where test tickets are created
- `waitlistChannelId`: one channel ID for each gamemode
- `pingRoles`: the role to notify for each gamemode
- `TesterRoles`: the tester role for each gamemode
- `gamemodes`: the gamemodes enabled on your server
- `gamemodeTierRoles`: the roles assigned for each gamemode and tier

These old settings are not used by the current code and may remain commented out:

```js
// requestChannelId: 'your-channel-id',
// regions: ['TH'],
// tierChoices: [...],
```

Make sure every gamemode in `gamemodes` has matching entries in `waitlistChannelId`, `pingRoles`, and `TesterRoles`.

## 5. Create the result webhook

For result notifications:

1. Open the target Discord channel.
2. Open **Edit Channel** → **Integrations** → **Webhooks**.
3. Create a webhook and copy its URL.
4. Put the URL in `config.js` or load it from an environment variable.

Treat the webhook URL like a password. If it was exposed, delete it and create a new one.

## 6. Start the bot

Run:

```bash
node index.js
```

When the bot starts, it registers the slash commands for the configured guild and updates the waitlist messages.

## 7. Test the setup

In Discord, check that:

1. `/setup` can post the account-link and waitlist controls.
2. `/online` can enable a tester for a gamemode.
3. A player can join a waitlist.
4. `/pick` creates a private ticket in the configured category.
5. `/close` saves the result and assigns the correct tier role.
6. `/role` displays the configured tier roles.

## 8. HTTP API

The bot starts an Express API on port `50004`:

```text
http://localhost:50004
```

The API is not protected by authentication. Do not expose it directly to the public internet without adding authentication, rate limiting, and stricter CORS rules.

### Get leaderboard data

```http
GET /api/top
```

Optional query parameters:

- `gamemode` — filter by gamemode, for example `SWORD`
- `page` — page number; defaults to `1`
- `all` — any present value returns all matching players instead of a page of 50

Example:

```text
GET /api/top?gamemode=SWORD&page=1
```

Response shape:

```json
{
  "page": 1,
  "totalPages": 1,
  "total": 1,
  "limit": 50,
  "gamemode": "SWORD",
  "players": {
    "PlayerName": {
      "discordId": "123456789012345678",
      "uuid": "minecraft-uuid",
      "points": 60,
      "ranks": {},
      "rank": 1,
      "overallRank": 1
    }
  }
}
```

### Get one player

```http
GET /api/players/:mcname
```

Minecraft names are matched case-insensitively.

Example:

```text
GET /api/players/Notch
```

Successful response:

```json
{
  "Notch": {
    "discordId": "123456789012345678",
    "uuid": "minecraft-uuid",
    "points": 60,
    "ranks": {},
    "rank": 1
  }
}
```

If the player does not exist, the API returns HTTP `404`:

```json
{ "error": "Player not found" }
```

### Verify a Minecraft account

This endpoint is used by the companion [SiamVerify](https://github.com/jaruwitaa/SiamVerify) Paper plugin. The Discord bot creates a temporary verification code; the player enters that code in Minecraft with `/verify <code>`; SiamVerify sends the player's Minecraft name, UUID, and code to this endpoint.

### Configure SiamVerify

1. Build or download the SiamVerify plugin for Paper 1.21.11.
2. Copy the plugin JAR into the Minecraft server's `plugins/` directory.
3. Start the server once so it creates `plugins/SiamVerify/config.yml`.
4. Set the API URL to the address where the bot's Express API is reachable:

```yml
api-url: "http://your-bot-host:50004"
block-bedrock: true
```

5. Restart the Minecraft server.

If both services run on the same machine, `http://localhost:50004` can be used. If they run on different machines or containers, use a reachable hostname or IP address; `localhost` would refer to the Minecraft server itself.

The plugin sends a request to `POST /api/verify` with this JSON body:

```json
{
  "mcname": "PlayerName",
  "uuid": "minecraft-uuid-without-hyphens",
  "code": "SIAM-1234"
}
```

The plugin blocks Bedrock players by default. Set `block-bedrock: false` only if your server supports the UUID format and account-linking behavior you expect.

```http
POST /api/verify
Content-Type: application/json
```

Request body:

```json
{
  "mcname": "PlayerName",
  "uuid": "minecraft-uuid",
  "code": "SIAM-1234"
}
```

The `code` is generated by the Discord account-link button and expires after 10 minutes. The player must run `/verify <code>` on the Minecraft server before it expires.

Possible responses:

- `200` — account linked successfully
- `400` — one or more fields are missing
- `404` — invalid or expired code
- `409` — the Minecraft account or tier data is already linked to another Discord account
- `410` — the code has expired

Successful response:

```json
{
  "success": true,
  "mcname": "PlayerName",
  "uuid": "minecraft-uuid",
  "discordId": "123456789012345678"
}
```

### CORS and deployment notes

`index.js` currently allows requests from every origin with `Access-Control-Allow-Origin: *`. The API also has no authentication. This is suitable only for a private or trusted deployment. Change the CORS configuration and add authentication before using it publicly.

## 9. Important security notes

- Rotate any token, webhook, or MongoDB password that was previously committed.
- Replace all original Discord IDs with IDs from your own server.
- Do not publish database credentials, bot tokens, or webhook URLs. `.env` is not supported by the current code unless you add that support yourself.
- Review the bot permissions before inviting it to a production server.
- The HTTP API currently allows permissive CORS. Review `index.js` before exposing it publicly.

## 10. Useful commands

- `/setup` — post the setup controls
- `/online` — toggle tester availability
- `/pick` — create a test ticket
- `/close` — finish a test and assign a tier
- `/addtier` — add or update a player's tier
- `/retire` — retire a player's eligible tier
- `/role` — display configured tier roles
- `/ign` — view a linked Minecraft username
