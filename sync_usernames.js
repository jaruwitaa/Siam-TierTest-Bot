import { Username, Player } from './db.js';

const MOJANG_API = 'https://sessionserver.mojang.com/session/minecraft/profile';

async function syncUsernames() {
  console.log('🔄 Syncing usernames...');
  const users = await Username.find({});

  for (const user of users) {
    try {
      const res  = await fetch(`${MOJANG_API}/${user.uuid}`);
      if (!res.ok) continue;
      const data = await res.json();

      if (data.name && data.name !== user.mcname) {
        console.log(`📝 ${user.mcname} → ${data.name}`);

        // Update players collection too
        await Player.updateOne({ mcname: user.mcname }, { mcname: data.name });

        user.mcname = data.name;
        await user.save();
      }
    } catch {
      // Mojang rate limits — skip and try next cycle
    }

    // Mojang rate limit — wait 1s between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('✅ Username sync done');
}

export default syncUsernames;