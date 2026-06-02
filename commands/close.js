import { SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import fs from 'fs';
import fetch from 'node-fetch';
import { Username, Player, Testing, Cooldown } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('close')
  .setDescription('ปิดการทดสอบและให้ tier')
  .addUserOption(option =>
    option.setName('user').setDescription('ผู้เล่น').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('tier')
      .setDescription('แรงค์')
      .setRequired(true)
      .addChoices(
        { name: 'HT1', value: 'HT1' },
        { name: 'HT2', value: 'HT2' },
        { name: 'HT3', value: 'HT3' },
        { name: 'HT4', value: 'HT4' },
        { name: 'HT5', value: 'HT5' },
        { name: 'LT1', value: 'LT1' },
        { name: 'LT2', value: 'LT2' },
        { name: 'LT3', value: 'LT3' },
        { name: 'LT4', value: 'LT4' },
        { name: 'LT5', value: 'LT5' },
        { name: 'SKIP', value: 'SKIP' }
      )
  );

export async function execute(interaction, client) {
  const member      = interaction.member;
  const target      = interaction.options.getUser('user');
  const tier        = interaction.options.getString('tier');
  const isProTester = member.roles.cache.has(config.ProtesterRoleId);
  const proTierOnly = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3'];

  if (!member.roles.cache.has(config.testerRoleId)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', flags: 64 });
  }

  if (tier !== 'SKIP' && proTierOnly.includes(tier) && !isProTester) {
    return interaction.reply({ content: `❌ คุณไม่มีสิทธิ์ให้แรงค์ **${tier}** ต้องเป็น Pro Tester เท่านั้น`, flags: 64 });
  }

  const testData = await Testing.findOne({ discordId: target.id });
  if (!testData) {
    return interaction.reply({ content: '❌ ผู้ใช้นี้ไม่ได้อยู่ในการทดสอบ', flags: 64 });
  }

  if (testData.testerId && testData.testerId !== interaction.user.id) {
    return interaction.reply({ content: '❌ คุณไม่ได้เป็น tester ที่ดึงผู้เล่นนี้', flags: 64 });
  }

  const { gamemode, region, ticketChannelId } = testData;
  const targetUser = await Username.findOne({ discordId: target.id });
  const mcname     = targetUser?.mcname || testData.mcname || 'Unknown';

  // ✅ Reply first
  await interaction.reply({
    content: tier === 'SKIP'
      ? `⏭️ ข้ามผู้เล่น <@${target.id}> แล้ว ไม่มีการให้แรงค์`
      : `✅ ปิดการทดสอบ <@${target.id}> เรียบร้อย\n🎮 ${gamemode} • 🌍 ${region}\n🏆 ได้รับแรงค์ **${tier}**`
  });
    
  // 🗑️ Delete ticket channel after reply
  if (ticketChannelId) {
    const ticketChannel = await client.channels.fetch(ticketChannelId).catch(() => null);
    console.log(
      '[DELETE CHANNEL]',
      {
        tester: interaction.user.tag,
        target: target.id,
        channel: ticketChannelId,
        time: new Date().toISOString()
      }
    );
    if (ticketChannel) await ticketChannel.delete().catch(() => {});
  }

  // ❌ Remove from testing
  await Testing.deleteOne({ discordId: target.id });

  if (tier === 'SKIP') return;

  // ⏳ Set cooldown
  await Cooldown.findOneAndUpdate(
    { discordId: target.id, gamemode },
    { discordId: target.id, gamemode, timestamp: Date.now() },
    { upsert: true }
  );

  // 🎭 Give role
  const guildMember = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (guildMember) {
    const roleId = config.gamemodeTierRoles?.[gamemode]?.[tier];
    if (roleId) await guildMember.roles.add(roleId).catch(() => null);
  }

  // 💾 Save to MongoDB
  const testerUser   = await Username.findOne({ discordId: testData.testerId });
  const testerMcname = testerUser?.mcname || 'Unknown';

  await Player.findOneAndUpdate(
    { mcname },
    {
      $set: {
        uuid: targetUser?.uuid || null,
        discordId: target.id,
        [`ranks.${gamemode}`]: {
          rank:     tier,
          tester:   testerMcname,
          testerId: testData.testerId,
          date:     new Date().toISOString(),
  	      transferred: false,
          transferedBy: "67",
          retired: false,
          retiredBy: "67"
        }
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 📡 Webhook
  if (config.resultWebhook) {
    await fetch(config.resultWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'ผลการทดสอบ',
          description: `<@${target.id}> → **${tier}**\n🎮 ${gamemode}\n🆔 ${mcname}\n👤 Tester: <@${testData.testerId}>`,
          color: 0x00ff00,
          thumbnail: { url: `https://render.crafty.gg/3d/bust/${mcname}` }
        }]
      })
    }).catch(() => {});
  }
}