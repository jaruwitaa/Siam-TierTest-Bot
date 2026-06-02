import fs from 'fs';
import config from './config.js';
import { Username, Queue, Testing, Cooldown } from './db.js';
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

const PENDING_FILE = 'data/pending_links.json';

function getPending() {
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    const now = Date.now();
    let changed = false;
    for (const code of Object.keys(data)) {
      if (data[code].expires < now) { delete data[code]; changed = true; }
    }
    if (changed) fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
    return data;
  } catch { return {}; }
}

function setPending(code, discordId) {
  const data = getPending();
  data[code] = { discordId, expires: Date.now() + 10 * 60 * 1000 };
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

function deletePending(code) {
  const data = getPending();
  delete data[code];
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

export { getPending, deletePending };

export default function handleInteraction(client) {

  client.temp = {};

  client.on('interactionCreate', async interaction => {
    const userId = interaction.user.id;

    const userDoc = await Username.findOne({ discordId: userId }).catch(() => null);

    // ========================
    // 🔘 BUTTONS
    // ========================
    if (interaction.isButton()) {
      // 🔗 LINK ACCOUNT
      if (interaction.customId === 'link_account') {
        if (userDoc?.uuid) {
          return interaction.reply({
            content: `❌ คุณเชื่อมบัญชีแล้ว: \`${userDoc.mcname}\`\n⚠️ ไม่สามารถเปลี่ยนบัญชีได้`,
            flags: 64
          });
        }

        const pending = getPending();
        const existingEntry = Object.entries(pending).find(([, d]) => d.discordId === userId);
        if (existingEntry) {
          const remaining = Math.ceil((existingEntry[1].expires - Date.now()) / 1000);
          return interaction.reply({
            content: `⏳ คุณมีโค้ดที่ยังไม่ได้ใช้: \`${existingEntry[0]}\`\nหมดอายุใน ${remaining} วินาที\nพิมพ์ \`/verify ${existingEntry[0]}\` ในเซิร์ฟเวอร์ Minecraft`,
            flags: 64
          });
        }

        const code = `SIAM-${Math.floor(1000 + Math.random() * 9000)}`;
        setPending(code, userId);

        return interaction.reply({
          content: [
            `🔗 โค้ดของคุณคือ: \`${code}\``,
            `วิธีเชื่อม: เข้าเชิร์ฟเวอร์ \`play.siam-net.work\``,
            `เลือก PVP Duels`,
            `พิมพ์ \`/verify ${code}\` ในเซิร์ฟเวอร์`,
            `⏳ หมดอายุใน 10 นาที`,
            ``,
            `⚠️ ผู้เล่นเบดร็อคไม่สามารถเชื่อมได้ ใช้ได้กับ JAVA เท่านั้น!`,
            `⚠️ เมื่อเชื่อมบัญชีแล้ว **ไม่สามารถเปลี่ยนได้** กรุณาตรวจสอบให้แน่ใจ`
          ].join('\n'),
          flags: 64
        });
      }
        
    // 📥 JOIN QUEUE FROM WAITLIST CHANNEL BUTTON
    if (interaction.customId.startsWith('join_queue_')) {
      const gamemode = interaction.customId.replace('join_queue_', '');
      
      if (interaction.member.roles.cache.has(config.BanlistRoleId)) {
          return interaction.reply({ content: '❌ คุณถูกแบนอยู่', flags: 64 });
      }

      if (!userDoc?.uuid) {
        return interaction.reply({
          content: '❌ คุณยังไม่ได้เชื่อมบัญชี Minecraft\nกดปุ่ม **🔗 เชื่อมบัญชี** ในช่องหลักก่อน',
          flags: 64
        });
      }

      const testing = await Testing.findOne({ discordId: userId });

      if (testing) {
        return interaction.reply({
          content: '⚠️ คุณกำลังอยู่ในการทดสอบ',
          flags: 64
        });
      }

      // already in queue
      const inQueue = await Queue.findOne({
        'entries.discordId': userId
      });

      if (inQueue) {
        return interaction.reply({
          content: '⚠️ คุณอยู่ในคิวอยู่แล้ว ต้องการออกจากการทดสอบเพื่อเข้าคิวใหม่หรือไม่?',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_leave_testing_${gamemode}`)
                .setLabel('✅ ออกจากการทดสอบ')
                .setStyle(ButtonStyle.Danger),

              new ButtonBuilder()
                .setCustomId('cancel_leave_testing')
                .setLabel('❌ ยกเลิก')
                .setStyle(ButtonStyle.Secondary)
            )
          ],
          flags: 64
        });
      }

    // get queue doc
    const queueDoc = await Queue.findOne({ gamemode });

    // no testers online
    if (!queueDoc?.onlineTesters?.length) {
      return interaction.reply({
        content: `❌ ไม่มี Tester ออนไลน์สำหรับ **${gamemode}**`,
        flags: 64
      });
    }

    const queueSize = queueDoc?.entries?.length || 0;

    // queue full
    if (queueSize >= 20) {
      return interaction.reply({
        content: `❌ คิว **${gamemode}** เต็มแล้ว (20/20)`,
        flags: 64
      });
    }

      // cooldown
      const now = Date.now();

      const cooldown = await Cooldown.findOne({
        discordId: userId,
        gamemode
      });

      const lastJoin = cooldown?.timestamp || 0;

      if (lastJoin + config.cooldownMs > now) {
        const remaining = Math.ceil(
          (lastJoin + config.cooldownMs - now) / 1000
        );

        return interaction.reply({
          content: `⏳ คุณต้องรออีก ${remaining} วินาทีก่อนเข้าคิว ${gamemode}`,
          flags: 64
        });
      }

      // join queue
      const mcname = userDoc.mcname;

      await Queue.findOneAndUpdate(
        {
          gamemode
        },
        {
          $push: {
            entries: {
              discordId: userId,
              mcname,
              gamemode,
              joined: now
            }
          }
        },
        {
          upsert: true
        }
      );

      return interaction.reply({
        content: `✅ เข้าคิวสำเร็จ\n🎮 ${gamemode}\n👤 ${mcname}`,
        flags: 64
      });
    }

        // ✅ CONFIRM LEAVE TESTING
        if (interaction.customId.startsWith('confirm_leave_testing_')) {

          await Testing.deleteOne({
            discordId: userId
          });

          await Queue.updateMany(
            { 'entries.discordId': userId },
            { $pull: { entries: { discordId: userId } } }
          );

          return interaction.update({
            content: '✅ ออกจากการทดสอบแล้ว',
            components: []
          });
        }

      if (interaction.customId === 'cancel_leave_testing') {
        return interaction.update({ content: '❌ ยกเลิก', components: [] });
      }
    }
  // CLOSE interactionCreate
  });

} // CLOSE handleInteraction