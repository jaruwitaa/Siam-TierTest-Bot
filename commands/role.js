import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('แสดง role ทั้งหมดในระบบ');

export async function execute(interaction) {
  if (!interaction.member.roles.cache.has(config.testerRoleId)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
  }

  const embeds = [];

  for (const [gamemode, tiers] of Object.entries(config.gamemodeTierRoles)) {
    const htFields = [];
    const ltFields = [];

    for (const [tier, roleId] of Object.entries(tiers)) {
      const line = `${tier}: <@&${roleId}>`;
      if (tier.startsWith('HT')) htFields.push(line);
      else ltFields.push(line);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${gamemode}`)
      .setColor(0x00ff99)
      .addFields(
        { name: '🔴 High Tier', value: htFields.join('\n') || 'ไม่มี', inline: true },
        { name: '🔵 Low Tier',  value: ltFields.join('\n') || 'ไม่มี', inline: true }
      );

    embeds.push(embed);
  }

  // Discord allows max 10 embeds per message, chunk if needed
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    if (i === 0) {
      await interaction.reply({ embeds: chunk, ephemeral: true });
    } else {
      await interaction.followUp({ embeds: chunk, ephemeral: true });
    }
  }
}