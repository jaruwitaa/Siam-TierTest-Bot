import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('โพสต์ข้อความเข้าคิว');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📋 ระบบคิวทดสอบ (Evaluation Waitlist)')
    .setDescription(
      'กดปุ่มด้านล่างเพื่อเชื่อมรหัส MC\n\n' +
      '⚠️ คุณต้องเชื่อมบัญชี Minecraft ก่อนเข้าคิว\nกดปุ่ม "เชื่อม MC" เพื่อเชื่อมบัญชี\n\n' +
      'เมื่อเข้าคิวแล้ว คุณจะถูกเรียกเมื่อมี Tester ว่าง\n' +
      '**ห้ามใส่ข้อมูลมั่ว ไม่งั้นโดนปฏิเสธทันที**'
    )
    .setColor('#ff0000');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('link_account')
        .setLabel('🔗 เชื่อม MC')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Setup เรียบร้อย', flags: 64 });
}