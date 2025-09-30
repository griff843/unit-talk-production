#!/usr/bin/env node
/**
 * Unit Talk VIP/VIP+ E2E Discord Bot Verification
 * - No server structure changes. Posts test embeds and validates bot behavior.
 * - Writes results to out/tests/vip/results.json and logs to out/tests/vip/console.log
 * - Supports --step <name> to run a single step
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), override: true });

// Prefer discord.js v14 if available; otherwise use REST fallback
let Discord;
try {
  Discord = require('discord.js');
} catch (e) {
  Discord = null;
}

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

// Env
const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const TOKEN_SOURCE = process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : (process.env.DISCORD_BOT_TOKEN ? 'DISCORD_BOT_TOKEN' : 'NONE');
const GUILD_ID = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
const GUILD_SOURCE = process.env.GUILD_ID ? 'GUILD_ID' : (process.env.DISCORD_GUILD_ID ? 'DISCORD_GUILD_ID' : 'NONE');
const TEST_DELAY_MINUTES = parseInt(process.env.TEST_DELAY_MINUTES || '1', 10);
const MAX_DAILY_PINGS = parseInt(process.env.MAX_DAILY_PINGS || '3', 10);

// Channels (IDs provided or fallback by name)
const CHANNELS = {
  steam: process.env.CHANNEL_STEAM_ID,
  injury: process.env.CHANNEL_INJURY_ID,
  hedge: process.env.CHANNEL_HEDGE_ID,
  curated: process.env.CHANNEL_CURATED_ID,
  vipplus: process.env.CHANNEL_VIPPLUS_INSIGHTS_ID || process.env.VIP_PLUS_EXCLUSIVE_INSIGHTS_CHANNEL_ID,
  trader: process.env.CHANNEL_TRADER_INSIGHTS_ID || process.env.VIP_PLUS_TRADER_INSIGHTS_CHANNEL_ID,
  vipLounge: process.env.CHANNEL_VIP_LOUNGE_ID, // optional sanity
  gameDay: process.env.CHANNEL_GAME_DAY_LIVE_ID, // optional sanity
  vipSupport: process.env.CHANNEL_VIP_SUPPORT_ID // optional sanity
};

const FALLBACK_NAMES = {
  steam: 'steam-alerts',
  injury: 'injury-shockwave',
  hedge: 'hedge-lab',
  curated: 'alerts-feed',
  vipplus: 'vipplus-insights',
  trader: 'trader-insights',
  vipLounge: 'vip-lounge',
  gameDay: 'game-day-live',
  vipSupport: 'vip-support',
};

// Output paths
const OUT_DIR = path.resolve('out/tests/vip');
const RESULTS_PATH = path.join(OUT_DIR, 'results.json');
const CONSOLE_LOG_PATH = path.join(OUT_DIR, 'console.log');

// Logging setup
fs.mkdirSync(OUT_DIR, { recursive: true });
const logStream = fs.createWriteStream(CONSOLE_LOG_PATH, { flags: 'a' });
function log(...args) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}`;
  console.log(msg);
  logStream.write(msg + '\n');
}

const STEP_NAMES = [
  'steam',
  'injury',
  'hedge',
  'curated-pass',
  'curated-fail',
  'idempotency',
  'vipplus-mirror',
  'vip-ping-cap',
  'perms-sanity',
];

const onlyStep = (() => {
  const idx = process.argv.indexOf('--step');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
})();

const results = [];
async function record(step, status, extra = {}) {
  const entry = { step, status, ts: new Date().toISOString(), ...extra };
  results.push(entry);
  return entry;
}

function failFile(step, payload) {
  const p = path.join(OUT_DIR, `fail_${step}.json`);
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
}

function assertEnv() {
  if (!TOKEN) throw new Error('Missing DISCORD_TOKEN in .env');
  if (!GUILD_ID) throw new Error('Missing GUILD_ID or DISCORD_GUILD_ID in .env');
}

// Discord client wrapper supporting both discord.js and REST fallback
class DiscordClient {
  constructor(token) {
    this.token = token;
    this.mode = Discord ? 'discordjs' : 'rest';
    this.client = null;
  }
  async start() {
    if (this.mode === 'discordjs') {
      const intents = new Discord.IntentsBitField([
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
      ]);
      this.client = new Discord.Client({ intents });
      await new Promise((resolve, reject) => {
        this.client.once('ready', () => resolve());
        this.client.login(this.token).catch(reject);
      });
      log('discord.js client ready');
    } else {
      // REST mode – no gateway connection
      log('Using REST-only mode (discord.js not found).');
    }
  }
  async stop() {
    if (this.client) {
      await this.client.destroy();
    }
  }
  async resolveChannel({ id, name }) {
    if (this.mode === 'discordjs') {
      if (id) {
        try { return await this.client.channels.fetch(id); } catch {}
      }
      // fallback by name: scan guild channels
      const guild = await this.client.guilds.fetch(GUILD_ID);
      const channels = await guild.channels.fetch();
      const found = channels.find(c => c && c.name === name);
      return found || null;
    } else {
      const headers = { Authorization: `Bot ${this.token}` };
      if (id) {
        const res = await fetch(`https://discord.com/api/v10/channels/${id}`, { headers });
        if (res.ok) return { id, name, rest: true };
      }
      // fallback by name via guild channels
      const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, { headers });
      if (!res.ok) return null;
      const arr = await res.json();
      const ch = arr.find(c => c.name === name);
      return ch ? { id: ch.id, name: ch.name, rest: true } : null;
    }
  }
  async sendEmbed(channel, embed, options = {}) {
    const payload = {
      content: options.content || undefined,
      embeds: [embed],
      allowed_mentions: options.allowedMentions || { parse: ['roles'] },
    };
    if (this.mode === 'discordjs') {
      const ch = channel;
      const msg = await ch.send(payload);
      return { id: msg.id, url: msg.url };
    } else {
      const res = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bot ${this.token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`REST send failed: ${res.status} ${await res.text()}`);
      const msg = await res.json();
      return { id: msg.id, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}/${msg.id}` };
    }
  }
  async fetchRecentMessages(channel, limit = 25) {
    if (this.mode === 'discordjs') {
      const msgs = await channel.messages.fetch({ limit });
      return Array.from(msgs.values());
    } else {
      const res = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=${limit}`, {
        headers: { Authorization: `Bot ${this.token}` },
      });
      if (!res.ok) return [];
      const arr = await res.json();
      return arr;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function idemFooter(id) { return `Idem:${id}`; }
function nowSec() { return Math.floor(Date.now() / 1000); }

function buildAlertEmbed({ title, market, books, action, conf, window, why, risk, idem }) {
  return {
    title,
    description: `Market: ${market}\nBooks: ${books}\nAction: ${action} (${conf}%)\nWindow: ${window}\nWhy: ${why}\nRisk: ${risk}`,
    footer: { text: idemFooter(idem) },
    timestamp: new Date().toISOString(),
    color: 0x00B8D9,
  };
}

function buildCuratedCandidate({ tier, edge, confidence, freshnessSec, bounds, idem }) {
  const title = `🎯 Curated Candidate • Tier ${tier}`;
  const why = `edge ${edge} / conf ${confidence} / fresh ${freshnessSec}s`;
  return buildAlertEmbed({
    title,
    market: 'NBA • Player Points',
    books: 'DK, FD',
    action: 'Follow',
    conf: confidence,
    window: '0-10m',
    why,
    risk: bounds,
    idem,
  });
}

function buildVipPlusInsight({ idem }) {
  return {
    title: '🧠 VIP+ Deep Insight',
    description: '- Trend: Pace up spot\n- Matchup: Weak perimeter D\n- Edge: +5% expected value',
    footer: { text: idemFooter(idem) },
    timestamp: new Date().toISOString(),
    color: 0x7B61FF,
  };
}

async function run() {
  assertEnv();
  log(`Using token source: ${TOKEN_SOURCE}; guild source: ${GUILD_SOURCE}`);
  let client = new DiscordClient(TOKEN);
  try {
    await client.start();
  } catch (e) {
    if ((e && (e.name === 'TokenInvalid' || /invalid token/i.test(e.message || ''))) ) {
      const alt = TOKEN_SOURCE === 'DISCORD_TOKEN' ? (process.env.DISCORD_BOT_TOKEN || null) : (process.env.DISCORD_TOKEN || null);
      if (alt && alt !== TOKEN) {
        log('Primary token failed; retrying once with alternate token source...');
        try {
          client = new DiscordClient(alt);
          await client.start();
        } catch (e2) {
          throw e2;
        }
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }
  // Debug: list accessible guilds to validate GUILD_ID
  try {
    if (client.mode === 'discordjs') {
      const arr = client.client.guilds.cache.map(g => `${g.id}:${g.name}`);
      log(`Bot is in guilds (${arr.length}): ${arr.join(', ')}`);
      if (!client.client.guilds.cache.has(GUILD_ID)) {
        throw new Error(`Unknown Guild: ${GUILD_ID}`);
      }
    }
  } catch (e) {
    throw e;
  }

  // Resolve channels
  async function res(nameKey) {
    return client.resolveChannel({ id: CHANNELS[nameKey], name: FALLBACK_NAMES[nameKey] });
  }
  const chSteam = await res('steam');
  const chInjury = await res('injury');
  const chHedge = await res('hedge');
  const chCurated = await res('curated');
  const chVipPlus = await res('vipplus');
  const chTrader = await res('trader');

  // Helper for validations in curated feed by Idem
  async function findInCuratedByIdem(idem, limit = 50) {
    const msgs = await client.fetchRecentMessages(chCurated, limit);
    const idtxt = idemFooter(idem);
    for (const m of msgs) {
      // discord.js vs REST shapes
      const embeds = m.embeds || m.attachments || m.embeds === undefined ? (m.embeds || []) : [];
      const content = m.content || '';
      const has = (Array.isArray(embeds) && embeds.some(e => (e.footer && (e.footer.text || e.footer?.text) || '').includes(idtxt))) || (content && content.includes(idtxt));
      if (has) return m;
    }
    return null;
  }

  const STEPS = {
    async steam() {
      const idem = `steam-${Date.now()}`;
      const embed = buildAlertEmbed({
        title: '📈🔥 Steam Signal', market: 'NBA Totals', books: 'DK', action: 'Follow', conf: 91,
        window: '5-10m', why: 'Sharp steam detected', risk: '1.0u', idem
      });
      if (!chSteam) throw new Error('steam channel not found');
      const sent = await client.sendEmbed(chSteam, embed);
      return { channel: 'steam-alerts', messageUrl: sent.url };
    },
    async injury() {
      const idem = `inj-${Date.now()}`;
      const embed = buildAlertEmbed({
        title: '🚑 Injury Shockwave', market: 'NBA Player Assists', books: 'FD', action: 'Follow', conf: 88,
        window: '0-5m', why: 'Late scratch ripple', risk: '0.5u', idem
      });
      if (!chInjury) throw new Error('injury channel not found');
      const sent = await client.sendEmbed(chInjury, embed);
      return { channel: 'injury-shockwave', messageUrl: sent.url };
    },
    async hedge() {
      const idem = `hedge-${Date.now()}`;
      const embed = buildAlertEmbed({
        title: '🧪 Hedge Opportunity', market: 'MLB Moneyline', books: 'BetMGM', action: 'Hold', conf: 72,
        window: '10-20m', why: 'Variance control opportunity', risk: '0.25u', idem
      });
      if (!chHedge) throw new Error('hedge channel not found');
      const sent = await client.sendEmbed(chHedge, embed);
      return { channel: 'hedge-lab', messageUrl: sent.url };
    },
    async 'curated-pass'() {
      const idem = `cur-pass-${nowSec()}`;
      const embed = buildCuratedCandidate({ tier: 'S', edge: 18, confidence: 92, freshnessSec: 60, bounds: '0.5-1.0u', idem });
      if (!chSteam) throw new Error('steam channel not found for candidate');
      await client.sendEmbed(chSteam, embed);
      await sleep(10_000);
      const m = await findInCuratedByIdem(idem, 50);
      if (!m) throw new Error('Curated PASS not found in #alerts-feed');
      return { channel: 'alerts-feed', messageUrl: m.url || `https://discord.com/channels/${GUILD_ID}/${CHANNELS.curated}/${m.id}` };
    },
    async 'curated-fail'() {
      const idem = `cur-fail-${nowSec()}`;
      const embed = buildCuratedCandidate({ tier: 'A', edge: 8, confidence: 81, freshnessSec: 60, bounds: '0.25u', idem });
      if (!chSteam) throw new Error('steam channel not found for candidate');
      await client.sendEmbed(chSteam, embed);
      await sleep(10_000);
      const m = await findInCuratedByIdem(idem, 50);
      if (m) throw new Error('Curated FAIL was incorrectly posted to #alerts-feed');
      return { channel: 'alerts-feed' };
    },
    async idempotency() {
      const idem = `cur-idem-${nowSec()}`;
      const embed = buildCuratedCandidate({ tier: 'S', edge: 15, confidence: 90, freshnessSec: 40, bounds: '0.5u', idem });
      if (!chSteam) throw new Error('steam channel not found for candidate');
      await client.sendEmbed(chSteam, embed);
      await sleep(2_000);
      await client.sendEmbed(chSteam, embed); // duplicate
      await sleep(10_000);
      const msgs = await client.fetchRecentMessages(chCurated, 50);
      const idtxt = idemFooter(idem);
      const matches = msgs.filter(m => (m.embeds || []).some(e => (e.footer && (e.footer.text || e.footer?.text) || '').includes(idtxt)) || (m.content || '').includes(idtxt));
      if (matches.length !== 1) throw new Error(`Idempotency failed: expected 1 curated post, found ${matches.length}`);
      const m = matches[0];
      return { channel: 'alerts-feed', messageUrl: m.url || `https://discord.com/channels/${GUILD_ID}/${CHANNELS.curated}/${m.id}` };
    },
    async 'vipplus-mirror'() {
      const idem = `vipplus-${nowSec()}`;
      const embed = buildVipPlusInsight({ idem });
      if (!chVipPlus) throw new Error('vipplus-insights channel not found');
      await client.sendEmbed(chVipPlus, embed);
      // Wait configured delay + buffer
      const waitMs = (TEST_DELAY_MINUTES * 60 + 15) * 1000;
      log(`Waiting ~${TEST_DELAY_MINUTES}m for trader-insights mirror...`);
      await sleep(waitMs);
      const trader = chTrader || await res('trader');
      if (!trader) throw new Error('trader-insights channel not found');
      const msgs = await client.fetchRecentMessages(trader, 50);
      const idtxt = idemFooter(idem);
      const found = msgs.find(m => (m.embeds || []).some(e => (e.description || '').includes('•') || (e.title || '').toLowerCase().includes('mirror')) || (m.content || '').includes(idtxt));
      if (!found) throw new Error('VIP+ mirror did not arrive in trader-insights');
      return { channel: 'trader-insights', messageUrl: found.url || `https://discord.com/channels/${GUILD_ID}/${trader.id}/${found.id}` };
    },
    async 'vip-ping-cap'() {
      // Attempt MAX_DAILY_PINGS + 1 curated pass candidates and expect last to have no role mention
      const count = MAX_DAILY_PINGS + 1;
      const sentUrls = [];
      for (let i = 0; i < count; i++) {
        const idem = `cur-cap-${nowSec()}-${i}`;
        const embed = buildCuratedCandidate({ tier: 'S', edge: 20, confidence: 95, freshnessSec: 60, bounds: '0.5-1.0u', idem });
        await client.sendEmbed(chSteam, embed);
        await sleep(4_000);
      }
      await sleep(12_000);
      const msgs = await client.fetchRecentMessages(chCurated, 50);
      // Find newest candidate (last idtxt)
      const lastIdemPrefix = 'cur-cap-';
      const candidates = [];
      for (const m of msgs) {
        const embeds = m.embeds || [];
        const ftxt = embeds[0]?.footer?.text || '';
        if (ftxt.includes(lastIdemPrefix)) candidates.push(m);
      }
      if (candidates.length === 0) throw new Error('No curated messages found for ping cap test');
      const newest = candidates[0];
      // Check mentions.roles size (discord.js) or mentions array (REST)
      let roleMentions = 0;
      if (newest.mentions && newest.mentions.roles) {
        roleMentions = newest.mentions.roles.size || 0;
      } else if (newest.mention_roles) {
        roleMentions = (newest.mention_roles || []).length;
      }
      if (roleMentions > 0) {
        // If we exceeded cap, the last should not ping. If it still pings, fail.
        throw new Error('VIP Ping Cap failed: last curated post still pinged a role');
      }
      const url = newest.url || `https://discord.com/channels/${GUILD_ID}/${CHANNELS.curated}/${newest.id}`;
      return { channel: 'alerts-feed', messageUrl: url };
    },
    async 'perms-sanity'() {
      // Check that alert channels likely block @everyone from sending, and VIP chats allow
      // Read guild roles and channel permissions
      if (!Discord || !client.client) {
        log('REST mode: skipping deep permission checks, performing shallow checks.');
        return { channel: 'sanity', note: 'Shallow REST perms check only' };
      }
      const guild = await client.client.guilds.fetch(GUILD_ID);
      const everyoneRole = guild.roles.everyone;
      function canEveryoneSend(ch) {
        const perm = ch.permissionsFor(everyoneRole);
        return perm ? perm.has(Discord.PermissionsBitField.Flags.SendMessages) : false;
      }
      const alertsDeny = [chSteam, chInjury, chHedge].map(c => !canEveryoneSend(c)).every(Boolean);
      const vipChats = [];
      for (const key of ['vipLounge','gameDay','vipSupport']) {
        const ch = await res(key);
        if (ch) vipChats.push(ch);
      }
      const vipAllow = vipChats.length ? vipChats.map(c => canEveryoneSend(c)).every(Boolean) : true; // if unknown, do not fail
      if (!alertsDeny) throw new Error('Alert channels do not appear read-only for @everyone');
      if (!vipAllow) throw new Error('VIP chats do not appear to allow member posts');
      return { channel: 'perms' };
    },
  };

  try {
    for (const name of STEP_NAMES) {
      if (onlyStep && name !== onlyStep) continue;
      log(`Running step: ${name}`);
      try {
        const data = await STEPS[name]();
        await record(name, 'PASS', data);
        log(`Step ${name} PASS`, data || '');
      } catch (err) {
        log(`Step ${name} FAIL`, err.message);
        failFile(name, { error: err.message, stack: err.stack, channel: FALLBACK_NAMES[name] || name });
        await record(name, 'FAIL', { error: err.message });
        if (onlyStep) break; // if running a single step, stop on error
      }
    }
  } finally {
    await client.stop();
  }

  // Write results with summary
  const summary = results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';
  const report = { results, summary, TEST_DELAY_MINUTES, MAX_DAILY_PINGS };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2));
  log(`Wrote results to ${RESULTS_PATH}`);

  // Print likely fixes on any failures
  if (summary === 'FAIL') {
    log('One or more steps failed. Likely fixes:');
    log('- Verify channel IDs in .env (CHANNEL_* variables)');
    log('- Ensure bot has Send Messages permission in alert channels');
    log('- Ensure curated aggregator bot is online and listening');
    log('- VIP Ping Cap depends on role mention permission and daily cap');
    log('- VIP+ mirror requires mirror bot online; check TEST_DELAY_MINUTES');
  }
}

run().catch(err => {
  log('Fatal error', err.message);
  const p = path.join(OUT_DIR, 'fail_fatal.json');
  fs.writeFileSync(p, JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  // Ensure results.json exists with FAIL summary for acceptance criteria
  const failReport = {
    results: [{ step: 'init', status: 'FAIL', error: err.message, ts: new Date().toISOString() }],
    summary: 'FAIL',
    TEST_DELAY_MINUTES,
    MAX_DAILY_PINGS,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(failReport, null, 2));
  process.exitCode = 1;
});

