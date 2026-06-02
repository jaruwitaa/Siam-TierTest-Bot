import { SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { Username, Player } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('retire')
  .setDescription('ตั้งสถานะ retired ให้ผู้เล่น')

  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('ผู้เล่น Discord')
      .setRequired(true)
  )

  .addStringOption(option =>
    option
      .setName('gamemode')
      .setDescription('เลือก Gamemode')
      .setRequired(true)
      .addChoices(
        ...config.gamemodes.map(g => ({
          name: g,
          value: g
        }))
      )
  );

export async function execute(interaction) {

  const member = interaction.member;

  // permission check
  if (!member.roles.cache.has(config.ProtesterRoleId)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
      flags: 64
    });
  }

  const target =
    interaction.options.getUser('user');

  const gamemode =
    interaction.options.getString('gamemode');

  // linked account
  const targetUser =
    await Username.findOne({
      discordId: target.id
    });

  if (!targetUser?.mcname) {
    return interaction.reply({
      content:
        '❌ ผู้เล่นนี้ยังไม่ได้เชื่อมบัญชี Minecraft',
      flags: 64
    });
  }

  const mcname =
    targetUser.mcname;

  // player
  const player =
    await Player.findOne({ mcname });

  if (!player) {
    return interaction.reply({
      content:
        '❌ ไม่พบข้อมูลผู้เล่น',
      flags: 64
    });
  }

  // rank exists?
  const rankData =
    player.ranks?.[gamemode];

  if (!rankData) {
    return interaction.reply({
      content:
        `❌ ผู้เล่นนี้ไม่มีแรงค์ ${gamemode}`,
      flags: 64
    });
  }

  // retire-able check
  const RETIRABLE = [
    'HT3',
    'LT2',
    'HT2',
    'LT1',
    'HT1'
  ];

  if (
    !RETIRABLE.includes(
      rankData.rank?.toUpperCase()
    )
  ) {
    return interaction.reply({
      content:
        `❌ แรงค์ ${rankData.rank} ไม่สามารถ retire ได้`,
      flags: 64
    });
  }

  // already retired
  if (rankData.retired === true) {
    return interaction.reply({
      content:
        `❌ ${mcname} ถูก retire อยู่แล้วใน ${gamemode}`,
      flags: 64
    });
  }

  // set retired
  await Player.findOneAndUpdate(
    { mcname },

    {
      $set: {
        [`ranks.${gamemode}.retired`]: true,
        [`ranks.${gamemode}.retiredBy`]:
          interaction.user.id,
        [`ranks.${gamemode}.retiredAt`]:
          new Date().toISOString()
      }
    }
  );

  return interaction.reply({
    content:
      `✅ ตั้ง ${gamemode} ของ \`${mcname}\` เป็น retired แล้ว\n` +
      `👤 โดย <@${interaction.user.id}>`
  });
}