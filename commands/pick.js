import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import config from '../config.js';
import { Username, Queue, Testing } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('pick')
  .setDescription('ดึงผู้เล่นคนแรกในคิวไปทดสอบ')
  .addStringOption(option =>
    option.setName('gamemode')
      .setDescription('เลือก Gamemode')
      .setRequired(true)
      .addChoices(...config.gamemodes.map(g => ({ name: g, value: g })))
  );

export async function execute(interaction, client) {
  const member = interaction.member;

  if (!member.roles.cache.has(config.testerRoleId)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', flags: 64 });
  }

  const gamemode = interaction.options.getString('gamemode');

  // 🔍 Find first person in queue
  const queueDoc = await Queue.findOne({ gamemode, 'entries.0': { $exists: true } });
  if (!queueDoc || queueDoc.entries.length === 0) {
    return interaction.reply({ content: `❌ ไม่มีคนในคิว ${gamemode}`, flags: 64 });
  }

  const user   = queueDoc.entries[0];
  const region = queueDoc.region;
  const target = await interaction.guild.members.fetch(user.discordId).catch(() => null);

  const usernameDoc  = await Username.findOne({ discordId: user.discordId });
  const mcname       = usernameDoc?.mcname || user.mcname || 'Unknown';
  const testerDoc    = await Username.findOne({ discordId: interaction.user.id });
  const testerMcname = testerDoc?.mcname || 'Unknown';

  if (!target) {
    await Queue.updateOne({ gamemode, region }, { $pull: { entries: { discordId: user.discordId } } });
    return interaction.reply({ content: '⚠️ ผู้เล่นคนแรกในคิวออกจากเซิร์ฟเวอร์แล้ว กรุณาลองใหม่', flags: 64 });
  }

  // 🎫 Create ticket channel
  const category = await client.channels.fetch(config.ticketCategoryId).catch(() => null);
  if (!category) return interaction.reply({ content: '❌ ไม่พบ ticket category', flags: 64 });

  const ticketChannel = await interaction.guild.channels.create({
    name: `tiertest-${target.user.username}-${gamemode}`.toLowerCase(),
    parent: category.id,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: user.discordId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ]
  });

  // 📝 Send info + ping
  await ticketChannel.send(
    `<@${user.discordId}> <@${interaction.user.id}>\n\n* Tester: ${testerMcname}\n* Player: ${mcname}`
  );

  // ✅ Move from queue to testing atomically
  await Queue.updateOne({ gamemode, region }, { $pull: { entries: { discordId: user.discordId } } });
  await Testing.findOneAndUpdate(
    { discordId: user.discordId },
    {
      discordId:       user.discordId,
      gamemode,
      region,
      mcname,
      testerId:        interaction.user.id,
      ticketChannelId: ticketChannel.id,
      startedAt:       Date.now()
    },
    { upsert: true }
  );

  await interaction.reply({ content: `✅ สร้าง ticket สำหรับ ${mcname} แล้ว — ${ticketChannel}`, flags: 64 });
}