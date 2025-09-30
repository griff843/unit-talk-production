require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const MAP = {
  FOOTBALL: process.env.THREAD_FOOTBALL_ID,
  BOXING: process.env.THREAD_BOXING_ID,
  SOCCER: process.env.THREAD_SOCCER_ID,
  BASKETBALL: process.env.THREAD_BASKETBALL_ID,
  DFS: process.env.THREAD_DFS_ID,
  BASEBALL: process.env.THREAD_BASEBALL_ID,
  TENNIS: process.env.THREAD_TENNIS_ID,
  GOLF: process.env.THREAD_GOLF_ID,
  OTHER: process.env.THREAD_OTHER_ID
};

const DEMO = [
  { sport: 'FOOTBALL',  title: 'ESPN: Star WR ruled OUT (hamstring)', when: '2:34 PM ET' },
  { sport: 'BOXING',    title: 'Report: Title bout targeted for December', when: '10:12 AM ET' },
  { sport: 'SOCCER',    title: 'Breaking: Manager sacked after poor run', when: '9:05 AM ET' },
  { sport: 'BASKETBALL',title: 'Trade: Wing defender to contender', when: '3:47 PM ET' },
  { sport: 'DFS',       title: 'Site update: Salary tweak on RB2 tier', when: '11:31 AM ET' },
  { sport: 'BASEBALL',  title: 'Rotation: Ace scratched; rookie starts', when: '12:18 PM ET' },
  { sport: 'TENNIS',    title: 'Seed upset in straight sets', when: '6:40 PM ET' },
  { sport: 'GOLF',      title: 'Weather delay: Round 2 start pushed', when: '8:20 AM ET' },
  { sport: 'OTHER',     title: 'NHL: Top-line winger day-to-day', when: '1:02 PM ET' },
];

function headlineEmbed(title, when) {
  return {
    content: `📰 **${title}**`,
    embeds: [
      new EmbedBuilder()
        .setDescription(`Headlines-only. No betting advice here.\nTime: ${when}`)
        .setTimestamp(new Date())
    ]
  };
}

async function pinThread(client, threadId, pin = true) {
  if (!threadId) return;
  try {
    const thread = await client.channels.fetch(threadId);
    if (!thread || !thread.isThread()) {
      console.log(`⚠️ Not a thread: ${threadId}`);
      return;
    }
    await thread.setPinned(pin);
    console.log(`${pin ? '📌 Pinned' : '📍 Unpinned'} thread: ${thread.name} (${threadId})`);
  } catch (e) {
    console.log(`❌ Pin/unpin failed for ${threadId}:`, e.message);
  }
}

async function main() {
  const token = process.env.DISCORD_TOKEN, guildId = process.env.GUILD_ID;
  if (!token || !guildId) {
    console.error('❌ Missing DISCORD_TOKEN or GUILD_ID in .env');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  await client.login(token);
  console.log('✅ Connected as', client.user.tag);

  // Route one demo headline to each sport’s Headlines (Auto) thread
  for (const h of DEMO) {
    const threadId = MAP[h.sport];
    if (!threadId) { console.log(`⚠️ No thread ID for sport ${h.sport}`); continue; }
    try {
      const thread = await client.channels.fetch(threadId);
      if (!thread || !thread.isThread()) { console.log(`⚠️ Invalid thread for ${h.sport}`); continue; }
      await thread.send(headlineEmbed(h.title, h.when));
      console.log(`📰 Posted to ${h.sport}: ${h.title}`);
    } catch (e) {
      console.log(`❌ Failed to post to ${h.sport}:`, e.message);
    }
  }

  // Optional: simulate rotating Live Now pin/unpin for a game thread
  if (process.env.TEST_PIN_THREAD_ID) {
    await pinThread(client, process.env.TEST_PIN_THREAD_ID, true);
  }
  if (process.env.TEST_UNPIN_THREAD_ID) {
    await pinThread(client, process.env.TEST_UNPIN_THREAD_ID, false);
  }

  console.log('\n🎉 Router test complete. Verify each sport’s pinned "Headlines (Auto)" post received one reply.');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

