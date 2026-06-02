// migrate.js — run once with: node migrate.js
import fs from 'fs';
import mongoose from 'mongoose';
import { Username, Player } from './db.js';

const usernameData = JSON.parse(fs.readFileSync('data/username.json', 'utf8'));
const playersData  = JSON.parse(fs.readFileSync('data/players.json', 'utf8'));

for (const [discordId, data] of Object.entries(usernameData)) {
  await Username.findOneAndUpdate(
    { discordId },
    { discordId, mcname: data.mcname, uuid: data.uuid, linkedAt: data.linkedAt },
    { upsert: true }
  );
}

for (const [mcname, data] of Object.entries(playersData)) {
  await Player.findOneAndUpdate(
    { mcname },
    { mcname, discordId: data.discordId, uuid: data.uuid, ranks: data.ranks },
    { upsert: true }
  );
}

console.log('✅ Migration done');
await mongoose.disconnect();