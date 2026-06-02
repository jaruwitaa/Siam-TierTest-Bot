import { SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { Username, Player } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('ยกเลิกการเชื่อมบัญชี Discord กับ Minecraft (สำหรับแอดมิน หลังตรวจสอบหลักฐาน)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('ผู้เล่น Discord ที่ต้องการยกเลิกการเชื่อมบัญชี')
      .setRequired(true)
  );

export async function execute(interaction) {

  const member = interaction.member;

  if (!member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
      flags: 64
    });
  }

  const target = interaction.options.getUser('user');

  const linked = await Username.findOne({
    discordId: target.id
  }).catch(() => null);

  if (!linked) {
    return interaction.reply({
      content: `❌ <@${target.id}> ยังไม่ได้เชื่อมบัญชี Minecraft`,
      flags: 64
    });
  }

  const { mcname, uuid } = linked;

  // remove the Discord ↔ Minecraft link
  await Username.deleteOne({ discordId: target.id });

  // detach the player record from this Discord user (keep ranks intact)
  await Player.findOneAndUpdate(
    { mcname },
    { $unset: { discordId: '' } }
  );

  return interaction.reply({
    content:
      `✅ ยกเลิกการเชื่อมบัญชีของ <@${target.id}> แล้ว\n` +
      `🎮 Minecraft: \`${mcname}\` (\`${uuid}\`)\n` +
      `👤 โดย <@${interaction.user.id}>`,
    flags: 64
  });
}
