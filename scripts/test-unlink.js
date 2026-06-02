// Local logic test for /unlink — no Discord needed.
// Seeds fake data into local MongoDB, runs the command with a mock interaction,
// then asserts the link was removed and the player detached.
//
//   node scripts/test-unlink.js

import config from '../config.js';
import { Username, Player } from '../db.js';
import * as unlink from '../commands/unlink.js';

const TARGET_ID = '999999999999999999';   // fake Discord user being unlinked
const ADMIN_ID  = '111111111111111111';   // fake admin running the command
const MCNAME    = 'TestSteve';
const UUID      = '00000000-0000-0000-0000-000000000001';

// --- tiny mock interaction --------------------------------------------------
function makeInteraction({ hasAdminRole }) {
  const replies = [];
  return {
    user: { id: ADMIN_ID },
    member: {
      roles: {
        cache: {
          has: (id) => hasAdminRole && id === config.adminRoleId,
        },
      },
    },
    options: {
      getUser: (name) => (name === 'user' ? { id: TARGET_ID } : null),
    },
    reply: (payload) => { replies.push(payload); return Promise.resolve(); },
    _replies: replies,
  };
}

function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1; }
  else console.log('✅', msg);
}

async function seed() {
  await Username.deleteMany({ discordId: TARGET_ID });
  await Player.deleteMany({ mcname: MCNAME });

  await Username.create({
    discordId: TARGET_ID,
    mcname: MCNAME,
    uuid: UUID,
    linkedAt: new Date().toISOString(),
  });
  await Player.create({
    mcname: MCNAME,
    discordId: TARGET_ID,
    uuid: UUID,
    ranks: { SWORD: { rank: 'HT3' } },
  });
}

async function cleanup() {
  await Username.deleteMany({ discordId: TARGET_ID });
  await Player.deleteMany({ mcname: MCNAME });
}

async function main() {
  // 1) Non-admin is blocked
  await seed();
  const denied = makeInteraction({ hasAdminRole: false });
  await unlink.execute(denied);
  assert(
    denied._replies[0]?.content?.includes('ไม่มีสิทธิ์'),
    'non-admin is rejected with permission error'
  );
  assert(
    await Username.findOne({ discordId: TARGET_ID }),
    'non-admin attempt left the link intact'
  );

  // 2) Admin successfully unlinks
  const ok = makeInteraction({ hasAdminRole: true });
  await unlink.execute(ok);
  assert(
    ok._replies[0]?.content?.includes(MCNAME),
    'admin gets success message mentioning the mcname'
  );
  assert(
    !(await Username.findOne({ discordId: TARGET_ID })),
    'Username link was deleted'
  );
  const player = await Player.findOne({ mcname: MCNAME });
  assert(player, 'Player record still exists (ranks preserved)');
  assert(player && player.discordId == null, 'Player.discordId was detached');
  assert(player?.ranks?.SWORD?.rank === 'HT3', 'ranks were preserved');

  // 3) Unlinking an already-unlinked user is handled gracefully
  const again = makeInteraction({ hasAdminRole: true });
  await unlink.execute(again);
  assert(
    again._replies[0]?.content?.includes('ยังไม่ได้เชื่อม'),
    'already-unlinked user gets a "not linked" message'
  );

  await cleanup();
  console.log('\nDone.');
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
