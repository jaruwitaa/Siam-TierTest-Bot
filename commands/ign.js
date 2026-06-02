import { SlashCommandBuilder } from 'discord.js';
import { Username } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('ign')
  .setDescription('ดูชื่อ Minecraft ของผู้เล่น')
  .addUserOption(option =>
    option.setName('user').setDescription('ผู้เล่น').setRequired(true)
  );

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const doc    = await Username.findOne({ discordId: target.id }).catch(() => null);

  if (!doc?.mcname) {
    return interaction.reply({ content: `**${target.username}** — ไม่มีข้อมูล`, flags: 64 });
  }

  return interaction.reply({
    content: `**${target.username}** — \`${doc.mcname}\``,
    flags: 64
  });
}