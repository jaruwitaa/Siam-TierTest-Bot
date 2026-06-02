import { SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { Queue } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('online')
  .setDescription('เปิด/ปิดรับคิวสำหรับ Gamemode')
  .addStringOption(option =>
    option.setName('gamemode')
      .setDescription('เลือก Gamemode')
      .setRequired(true)
      .addChoices(...config.gamemodes.map(g => ({ name: g, value: g })))
  );

export async function execute(interaction) {
  const member   = interaction.member;
  const gamemode = interaction.options.getString('gamemode');
  const userId   = interaction.user.id;

  // Must have base tester role
  if (!member.roles.cache.has(config.testerRoleId)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
      flags: 64
    });
  }

  // Must have gamemode-specific tester role
  const gmRoleId = config.TesterRoles[gamemode];

  if (!gmRoleId || !member.roles.cache.has(gmRoleId)) {
    return interaction.reply({
      content: `❌ คุณไม่มีสิทธิ์รับคิว ${gamemode}`,
      flags: 64
    });
  }

  // Get queue document
  let queueDoc = await Queue.findOne({ gamemode });

  if (!queueDoc) {
    queueDoc = await Queue.create({
      gamemode,
      region: 'GLOBAL',
      entries: [],
      onlineTesters: []
    });
  }

  // Ensure array exists
  if (!queueDoc.onlineTesters) {
    queueDoc.onlineTesters = [];
  }

  const isOnline = queueDoc.onlineTesters.includes(userId);

  if (isOnline) {
    // 🔴 Go offline
    queueDoc.onlineTesters =
      queueDoc.onlineTesters.filter(id => id !== userId);

    // Clear queue if nobody online
    if (queueDoc.onlineTesters.length === 0) {
      queueDoc.entries = [];
    }

    await queueDoc.save();

    return interaction.reply({
      content: `🔴 คุณออฟไลน์สำหรับ **${gamemode}** แล้ว`,
      flags: 64
    });
  }

  // 🟢 Go online
  queueDoc.onlineTesters.push(userId);

  await queueDoc.save();

  // 📣 Phantom ping
  const channelId  = config.waitlistChannelId[gamemode];
  const pingRoleId = config.pingRoles[gamemode];

  if (channelId && pingRoleId) {
    const ch = await interaction.guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (ch) {
      const pingMsg = await ch.send(`<@&${pingRoleId}>`)
        .catch(() => null);

      if (pingMsg) {
        setTimeout(() => {
          pingMsg.delete().catch(() => {});
        }, 100);
      }
    }
  }

  return interaction.reply({
    content: `🟢 คุณออนไลน์สำหรับ **${gamemode}** แล้ว — รับคิวได้เลย`,
    flags: 64
  });
}