import { SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { Username, Player } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('addtier')
  .setDescription('เพิ่ม/แก้ไขเทียร์ผู้เล่นโดยตรง')
  .addUserOption(option =>
    option.setName('user').setDescription('ผู้เล่น Discord').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('gamemode')
      .setDescription('เลือก Gamemode')
      .setRequired(true)
      .addChoices(...config.gamemodes.map(g => ({ name: g, value: g })))
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
        { name: 'UNRANKED', value: 'UNRANKED' }
      )
  );

export async function execute(interaction) {
  const member = interaction.member;

  // Permission check
  if (!member.roles.cache.has(config.ProtesterRoleId)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
      flags: 64
    });
  }

  const target   = interaction.options.getUser('user');
  const gamemode = interaction.options.getString('gamemode');
  const tier     = interaction.options.getString('tier');

  // Fetch username data
  const targetUser = await Username.findOne({ discordId: target.id });

  if (!targetUser?.mcname) {
    return interaction.reply({
      content: '❌ ผู้เล่นนี้ยังไม่ได้เชื่อมบัญชี Minecraft',
      flags: 64
    });
  }

  const mcname = targetUser.mcname;

  // Remove tier
  if (tier === 'UNRANKED') {
    await Player.findOneAndUpdate(
      { mcname },
      {
        $unset: {
          [`ranks.${gamemode}`]: ''
        }
      }
    );

    return interaction.reply({
      content: `✅ ลบเทียร์ **${gamemode}** ของ \`${mcname}\` แล้ว`,
      flags: 64
    });
  }

  // Add / update tier
  await Player.findOneAndUpdate(
    { mcname },
    {
      $set: {
        mcname,
        uuid: targetUser.uuid || null,
        discordId: target.id,

        [`ranks.${gamemode}`]: {
          rank: tier,
          tester: null,
          testerId: null,
          date: new Date().toISOString(),
          transferred: true,
          transferedBy: interaction.user.id
        }
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  // Give role
  const guildMember = await interaction.guild.members
    .fetch(target.id)
    .catch(() => null);

  if (guildMember) {
    const roleId = config.gamemodeTierRoles?.[gamemode]?.[tier];

    if (roleId) {
      await guildMember.roles.add(roleId).catch(() => null);
    }
  }

  return interaction.reply({
    content:
      `✅ ตั้งเทียร์ **${gamemode}** ของ \`${mcname}\` เป็น **${tier}** แล้ว\n` +
      `🔀 Transferred by <@${interaction.user.id}>`
  });
}