import { Client, GatewayIntentBits, Collection, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import config from './config.js';
import handleInteraction from './interaction.js';
import { getPending, deletePending } from './interaction.js';
import { Username, Player, Queue, Testing, Cooldown } from './db.js';
import syncUsernames from './sync_usernames.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ========================
// 🚀 CREATE CLIENT
// ========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

// ========================
// 📂 LOAD COMMANDS
// ========================
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = await import(`./commands/${file}`);
  if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
}

// ========================
// 🔥 INTERACTION SYSTEM
// ========================
handleInteraction(client);

// ========================
// ✅ READY
// ========================
client.once('clientReady', async () => {
  console.log(`✅ บอทออนไลน์: ${client.user.tag}`);

  // 🧹 Clear all waitlist channels on startup (bot messages only)
  for (const [gamemode, channelId] of Object.entries(config.waitlistChannelId)) {
    try {
      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (!ch) continue;
      const messages    = await ch.messages.fetch({ limit: 100 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      for (const msg of botMessages.values()) await msg.delete().catch(() => {});
    } catch (err) {
      console.log(`clear error ${gamemode}:`, err);
    }
  }
  client.waitlistMessages = {};
  client.waitlistCache    = {};

  // Register commands
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, config.guildId),
    { body: client.commands.map(c => c.data.toJSON()) }
  );
  console.log('✅ โหลดคำสั่งเรียบร้อย');
});

// ========================
// 📥 SLASH COMMAND
// ========================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction, client);
  } catch (err) {
    console.error(err);
    interaction.reply({ content: '❌ เกิดข้อผิดพลาด', flags: 64 }).catch(() => {});
  }
});

// ========================
// 🌐 EXPRESS API
// ========================

const app = express();

app.use(express.json());

app.use((req, res, next) => {

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// ========================
// CONSTANTS
// ========================

const TIER_ORDER = [
  'HT1', 'LT1',
  'HT2', 'LT2',
  'HT3', 'LT3',
  'HT4', 'LT4',
  'HT5', 'LT5'
];

const GAMEMODE_ORDER = [
  'UHC',
  'MACE',
  'SMP',
  'NETHPOT',
  'DIAPOT',
  'AXE',
  'SWORD',
  'CRYSTALS'
];

const POINTS_MAP = {
  LT5: 1,
  HT5: 2,
  LT4: 3,
  HT4: 4,
  LT3: 6,
  HT3: 10,
  LT2: 20,
  HT2: 30,
  LT1: 45,
  HT1: 60
};

const RETIRABLE = [
  'HT1',
  'LT1',
  'HT2',
  'LT2',
  'HT3'
];

const RETIREPOINT = 0;

// ========================
// HELPERS
// ========================

function gamemodeScore(gm) {

  const idx =
    GAMEMODE_ORDER.indexOf(
      gm?.toUpperCase()
    );

  return idx === -1
    ? 999
    : idx;
}

function canRetire(rank) {

  return RETIRABLE.includes(
    rank?.toUpperCase()
  );
}

function isRetired(data) {

  return data?.retired === true;
}

function getEarliestDate(ranks) {

  const dates = Object.values(ranks)
    .map(d =>
      d?.date
        ? new Date(d.date).getTime()
        : 0
    );

  return dates.length
    ? Math.max(...dates)
    : 0;
}

function calcPoints(ranks) {

  let total = 0;

  for (const [gm, data] of Object.entries(ranks)) {

    const base =
      POINTS_MAP[
        data.rank?.toUpperCase()
      ] || 0;

    const retired =
      canRetire(data.rank) &&
      isRetired(data);

    total += retired
      ? Math.max(
          0,
          base - RETIREPOINT
        )
      : base;
  }

  return total;
}

function sortPlayerRanks(ranks) {

  return Object.fromEntries(

    Object.entries(ranks)
      .sort(([a], [b]) =>
        gamemodeScore(a) -
        gamemodeScore(b)
      )
  );
}

function formatPlayer(name, data) {

  const ranks =
    data.ranks || {};

  const formattedRanks = {};

  for (const [gm, d] of Object.entries(ranks)) {

    const retired =
      canRetire(d.rank) &&
      isRetired(d);

    formattedRanks[gm] = {
      ...d,
      retired
    };
  }

  return {
    discordId:
      data.discordId,

    uuid:
      data.uuid || null,

    points:
      calcPoints(ranks),

    ranks:
      sortPlayerRanks(
        formattedRanks
      )
  };
}

// ========================
// LOAD PLAYERS
// ========================

async function loadPlayers(
  gamemode = null
) {

  const query = gamemode
    ? {
        [`ranks.${gamemode}`]: {
          $exists: true
        }
      }
    : {};

  const projection = gamemode
    ? {
        mcname: 1,
        discordId: 1,
        uuid: 1,
        [`ranks.${gamemode}`]: 1
      }
    : {
        mcname: 1,
        discordId: 1,
        uuid: 1,
        ranks: 1
      };

  const players =
    await Player.find(
      query,
      projection
    ).lean();

  const result = {};

  for (const p of players) {

    result[p.mcname] = {

      discordId:
        p.discordId,

      uuid:
        p.uuid,

      ranks: gamemode
        ? {
            [gamemode]:
              p.ranks?.[gamemode]
          }
        : (p.ranks || {})
    };
  }

  return result;
}

function sortEntries(entries) {

  return entries.sort(
    ([, a], [, b]) => {

      const ptsDiff =

        calcPoints(
          b.ranks || {}
        )

        -

        calcPoints(
          a.ranks || {}
        );

      if (ptsDiff !== 0) {
        return ptsDiff;
      }

      return (

        getEarliestDate(
          b.ranks || {}
        )

        -

        getEarliestDate(
          a.ranks || {}
        )
      );
    }
  );
}

// ========================
// 🏆 TOP PLAYERS
// ========================

app.get(
  '/api/top',

  async (req, res) => {

    const gamemode =
      req.query.gamemode
        ?.toUpperCase();

    const {
      page = 1,
      all
    } = req.query;

    const players =
      await loadPlayers(
        gamemode
      );

    const pageNum =
      Math.max(
        1,
        parseInt(page) || 1
      );

    const limit = 50;

    const skip =
      (pageNum - 1) * limit;

    let entries =
      Object.entries(players);

    // ========================
    // OVERALL RANKS
    // ========================

    const overallSorted =
      sortEntries(
        [...entries]
      );

    const overallRankMap = {};

    overallSorted.forEach(
      ([name], i) => {

        overallRankMap[name] =
          i + 1;
      }
    );

    // ========================
    // GAMEMODE SORT
    // ========================

    if (gamemode) {

      entries = entries

        .filter(([, d]) =>
          d.ranks?.[gamemode]
        )

        .sort(([, a], [, b]) => {

          const rankA =
            a.ranks[gamemode];

          const rankB =
            b.ranks[gamemode];

          const pointsA =
            POINTS_MAP[
              rankA?.rank
                ?.toUpperCase()
            ] || 0;

          const pointsB =
            POINTS_MAP[
              rankB?.rank
                ?.toUpperCase()
            ] || 0;

          const retiredA =

            canRetire(
              rankA?.rank
            )

            &&

            isRetired(rankA);

          const retiredB =

            canRetire(
              rankB?.rank
            )

            &&

            isRetired(rankB);

          const finalA =
            retiredA
              ? Math.max(
                  0,
                  pointsA -
                  RETIREPOINT
                )
              : pointsA;

          const finalB =
            retiredB
              ? Math.max(
                  0,
                  pointsB -
                  RETIREPOINT
                )
              : pointsB;

          // higher first

          if (finalB !== finalA) {
            return finalB - finalA;
          }

          // newer wins

          return (

            new Date(
              rankB?.date || 0
            ).getTime()

            -

            new Date(
              rankA?.date || 0
            ).getTime()
          );
        });

    } else {

      entries =
        sortEntries(entries);
    }

    // ========================
    // PAGINATION
    // ========================

    const total =
      entries.length;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / limit
        )
      );

    const paginated = all
      ? entries
      : entries.slice(
          skip,
          skip + limit
        );

    // ========================
    // FORMAT RESPONSE
    // ========================

    const formatted = {};

    paginated.forEach(

      ([name, data], index) => {

        formatted[name] = {

          ...formatPlayer(
            name,
            data
          ),

          rank:
            skip + index + 1,

          overallRank:
            overallRankMap[name]
        };
      }
    );

    // ========================
    // RESPONSE
    // ========================

    res.json({

      page:
        pageNum,

      totalPages:
        all ? 1 : totalPages,

      total,

      limit:
        all ? total : limit,

      gamemode:
        gamemode || null,

      players:
        formatted
    });
  }
);

// ========================
// 👤 GET PLAYER
// ========================

app.get(
  '/api/players/:mcname',

  async (req, res) => {

    const player =
      await Player.findOne({

        mcname: new RegExp(
          `^${req.params.mcname}$`,
          'i'
        )
      });

    if (!player) {

      return res.status(404)
        .json({
          error:
            'Player not found'
        });
    }

    const allPlayers =
      await loadPlayers();

    const sorted =
      sortEntries(
        Object.entries(
          allPlayers
        )
      );

    const rank =
      sorted.findIndex(
        ([name]) =>

          name.toLowerCase()

          ===

          player.mcname
            .toLowerCase()
      ) + 1;

    res.json({

      [player.mcname]: {

        ...formatPlayer(
          player.mcname,
          player
        ),
        rank:
          rank || null
      }
    });
  }
);

// ========================
// 🔗 VERIFY
// ========================

app.post(
  '/api/verify',

  async (req, res) => {

    const {
      mcname,
      uuid,
      code
    } = req.body;

    if (
      !mcname ||
      !uuid ||
      !code
    ) {

      return res.status(400)
        .json({
          error:
            'Missing fields'
        });
    }

    const pending =
      getPending();

    const entry =
      pending[code];

    if (!entry) {

      return res.status(404)
        .json({
          error:
            'Invalid or expired code'
        });
    }

    if (
      Date.now() >
      entry.expires
    ) {

      deletePending(code);

      return res.status(410)
        .json({
          error:
            'Code expired'
        });
    }

    const existing =
      await Username.findOne({
        uuid
      });

    if (existing) {

      return res.status(409)
        .json({
          error:
            'Minecraft account already linked'
        });
    }

    await Username
      .findOneAndUpdate(

        {
          discordId:
            entry.discordId
        },

        {
          discordId:
            entry.discordId,

          mcname,
          uuid,

          linkedAt:
            new Date()
              .toISOString()
        },

        {
          upsert: true,
          returnDocument:
            'after'
        }
      );

    deletePending(code);

    return res.json({

      success: true,
      mcname,
      uuid,

      discordId:
        entry.discordId
    });
  }
);

// ========================
// START API
// ========================

app.listen(
  50004,

  () => console.log(
    '✅ API running on port 50004'
  )
);

// ========================
// Waitlist
// ========================
client.waitlistMessages = {};
client.waitlistCache    = {};

setInterval(async () => {
  try {
     for (const gamemode of config.gamemodes) {
      const channelId = config.waitlistChannelId[gamemode];
      if (!channelId) continue;

      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      // MongoDB queue
      const queueDoc = await Queue.findOne({ gamemode });

      const onlineTesters = queueDoc?.onlineTesters || [];
      const list          = queueDoc?.entries || [];

      const isOpen = onlineTesters.length > 0;

      // Skip if nothing changed
      const newSnapshot = JSON.stringify({
        onlineTesters,
        queueIds: list.map(u => u.discordId)
      });

      if (
        client.waitlistCache[gamemode] === newSnapshot &&
        client.waitlistMessages[gamemode]?.msg
      ) continue;

      client.waitlistCache[gamemode] = newSnapshot;

      const testerMentions =
        onlineTesters.map(id => `<@${id}>`).join(', ') || 'ไม่มี';

      let queueValue = 'ไม่มีคน';

      if (list.length > 0) {
        const top = list.slice(0, 10);

        const lines = await Promise.all(
          top.map(async (u, i) => {
            const member = await channel.guild.members
              .fetch(u.discordId)
              .catch(() => null);

            const mention = member
              ? `<@${u.discordId}>`
              : u.discordId;

            return `${i + 1}. ${mention} (${u.mcname})`;
          })
        );

        queueValue = lines.join('\n');

        if (list.length > 10) {
          queueValue += `\n+${list.length - 10} more...`;
        }
      }

      const embed = {
        title: `${isOpen ? '🟢' : '🔴'} ${gamemode}`,
        color: isOpen ? 0x00ff99 : 0xff4444,

        fields: [
          {
            name: '👨‍⚖️ Tester ออนไลน์',
            value: testerMentions,
            inline: false
          },
          {
            name: `📋 คิว (${list.length}/20)`,
            value: queueValue,
            inline: false
          }
        ],

        footer: {
          text: isOpen
            ? 'เปิดรับคิว'
            : 'ปิดรับคิว — ไม่มี Tester ออนไลน์'
        }
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`join_queue_${gamemode}`)
          .setLabel('📥 เข้าคิว')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!isOpen || list.length >= 20)
      );

      if (!client.waitlistMessages[gamemode]) {
        client.waitlistMessages[gamemode] = {};
      }

      if (client.waitlistMessages[gamemode].msg) {
        try {
          await client.waitlistMessages[gamemode].msg.edit({
            embeds: [embed],
            components: [row]
          });
        } catch (err) {
          if (err.code === 10008) {
            try {
              const msg = await channel.send({
                embeds: [embed],
                components: [row]
              });

              client.waitlistMessages[gamemode].msg = msg;
            } catch {}
          }
        }
      } else {
        try {
          const msg = await channel.send({
            embeds: [embed],
            components: [row]
          });

          client.waitlistMessages[gamemode].msg = msg;
        } catch {}
      }
    }
  } catch (err) {
    console.log('waitlist error:', err);
  }
}, 15000);

// ========================
// 🗑️ Pending Message Cleanup
// ========================
setInterval(async () => {
  try {
    const PENDING_MSG_FILE = 'data/pending_messages.json';
    let pending = {};
    try { pending = JSON.parse(fs.readFileSync(PENDING_MSG_FILE, 'utf8')); } catch { return; }

    const now     = Date.now();
    let changed   = false;

    for (const [userId, data] of Object.entries(pending)) {
      if (now < data.expiresAt) continue;

      try {
        const ch = await client.channels.fetch(data.channelId).catch(() => null);
        if (ch) {
          if (!data.keepChannel) {
            console.log(
              '[AUTO DELETE]',
              data.channelId,
              userId,
              data
            );
              
            if (
              ch &&
              ch.parentId !== config.ticketCategoryId
            ) {
              await ch.delete().catch(() => {});
            }

          } else {
            const msg = await ch.messages.fetch(data.messageId).catch(() => null);
            if (msg) await msg.delete().catch(() => {});
          }
        }
      } catch {}

      // Remove from queue in MongoDB
      try {
        await Queue.updateMany(
          { 'entries.discordId': userId },
          { $pull: { entries: { discordId: userId } } }
        );
      } catch {}

      delete pending[userId];
      changed = true;
    }

    if (changed) fs.writeFileSync(PENDING_MSG_FILE, JSON.stringify(pending, null, 2));
  } catch (err) {
    console.log('pending message cleanup error:', err);
  }
}, 60 * 1000);

// ========================
// ⏳ Cooldown Cleanup
// ========================
setInterval(async () => {
  const cutoff = Date.now() - config.cooldownMs;
  await Cooldown.deleteMany({ timestamp: { $lt: cutoff } }).catch(() => {});
}, 60 * 60 * 1000);

// ========================
// 🔄 Username Sync
// ========================
setInterval(syncUsernames, 6 * 60 * 60 * 1000);
syncUsernames();

// ========================
client.login(config.token);