require('dotenv').config();
const Parser = require('rss-parser');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const parser = new Parser();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const MAP = {
  FOOTBALL:   { feed: process.env.FEED_FOOTBALL,   threadId: process.env.THREAD_FOOTBALL_ID },
  BOXING:     { feed: process.env.FEED_BOXING,     threadId: process.env.THREAD_BOXING_ID },
  SOCCER:     { feed: process.env.FEED_SOCCER,     threadId: process.env.THREAD_SOCCER_ID },
  BASKETBALL: { feed: process.env.FEED_BASKETBALL, threadId: process.env.THREAD_BASKETBALL_ID },
  DFS:        { feed: process.env.FEED_DFS,        threadId: process.env.THREAD_DFS_ID },
  BASEBALL:   { feed: process.env.FEED_BASEBALL,   threadId: process.env.THREAD_BASEBALL_ID },
  TENNIS:     { feed: process.env.FEED_TENNIS,     threadId: process.env.THREAD_TENNIS_ID },
  GOLF:       { feed: process.env.FEED_GOLF,       threadId: process.env.THREAD_GOLF_ID },
  OTHER:      { feed: process.env.FEED_OTHER,      threadId: process.env.THREAD_OTHER_ID }
};

// caps & state
const POLL_SEC  = Number(process.env.ROUTER_POLL_SECONDS || 90);
const DAILY_CAP = Number(process.env.ROUTER_DAILY_CAP || 12);
const BURST_CAP = Number(process.env.ROUTER_BURST_CAP_15M || 3);

const seen = new Set();       // GUID/URL/title hashes
const dayCount = {};          // sport -> count today
const burstWin = {};          // sport -> timestamps (ms)
let currentDay = todayKey();

function todayKey(){ return new Date().toISOString().slice(0,10); }
function resetDay(){ for (const k in dayCount) dayCount[k]=0; for (const k in burstWin) burstWin[k]=[]; }

function allowPost(sport){
  const now = Date.now();
  const tk = todayKey();
  if (tk !== currentDay) { currentDay = tk; resetDay(); }
  burstWin[sport] = (burstWin[sport] || []).filter(ts => now - ts < 15*60*1000);
  if ((burstWin[sport] || []).length >= BURST_CAP) return false;
  if ((dayCount[sport] || 0) >= DAILY_CAP) return false;
  return true;
}
function recordPost(sport){
  const now = Date.now();
  dayCount[sport] = (dayCount[sport] || 0) + 1;
  burstWin[sport] = (burstWin[sport] || []);
  burstWin[sport].push(now);
}

function buildEmbed(title, link, pubDate){
  return new EmbedBuilder()
    .setTitle(`📰 ${title?.trim() || 'Headline'}`)
    .setURL(link || null)
    .setDescription("Headlines only. No betting advice here.")
    .setTimestamp(pubDate ? new Date(pubDate) : new Date());
}

async function postToThread(threadId, embed){
  if (!threadId) return;
  try {
    const thread = await client.channels.fetch(threadId);
    if (!thread?.isThread()) throw new Error('Not a thread');
    await thread.send({ embeds: [embed] });
  } catch (e) {
    console.log(`❌ Post failed (${threadId}):`, e.message);
  }
}

async function pollOne(sport, cfg){
  if (!cfg?.feed || !cfg?.threadId) return;
  let feed;
  try { feed = await parser.parseURL(cfg.feed); }
  catch (e){ console.log(`⚠️ Feed fetch failed [${sport}]:`, e.message); return; }

  // Consider only recent items
  for (const item of (feed.items || []).slice(0, 8)) {
    const key = item.guid || item.link || `${sport}:${item.title}`;
    if (!key || seen.has(key)) continue;
    if (!allowPost(sport)) continue;
    seen.add(key);
    recordPost(sport);
    const embed = buildEmbed(item.title, item.link, item.pubDate);
    await postToThread(cfg.threadId, embed);
    await new Promise(r=>setTimeout(r, 800)); // gentle spacing
  }
}

async function pollAll(){
  const entries = Object.entries(MAP).filter(([,v]) => v.feed && v.threadId);
  for (const [sport, cfg] of entries) {
    await pollOne(sport, cfg);
  }
}

async function main(){
  if (!process.env.DISCORD_TOKEN) { console.error('❌ Missing DISCORD_TOKEN'); process.exit(1); }
  await client.login(process.env.DISCORD_TOKEN);
  console.log('✅ ESPN Router online as', client.user.tag, `| polling every ${POLL_SEC}s`);
  await pollAll();
  setInterval(pollAll, POLL_SEC * 1000);
}

main().catch(e=>{ console.error(e); process.exit(1); });

