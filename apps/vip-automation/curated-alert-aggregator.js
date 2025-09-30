#!/usr/bin/env node
/**
 * VIP Curated Alert Aggregator Bot
 * Monitors upstream alert channels and forwards qualifying alerts to #alerts-feed
 * Implements: Tier filtering, VIP ping capping, idempotency, freshness checks
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const MAX_DAILY_PINGS = parseInt(process.env.MAX_DAILY_PINGS || '3');

// Channel configuration
const UPSTREAM_CHANNELS = [
  process.env.CHANNEL_STEAM_ID,
  process.env.CHANNEL_INJURY_ID,
  process.env.CHANNEL_HEDGE_ID
];

const CURATED_CHANNEL = process.env.CHANNEL_CURATED_ID;
const VIP_ROLE_ID = process.env.VIP_ROLE_IDS?.split(',')[0];

// State management
const stateFile = path.join(__dirname, 'aggregator-state.json');
let state = {
  processedIdemKeys: new Set(),
  dailyVipPings: 0,
  lastResetDate: new Date().toDateString()
};

// Load existing state
try {
  if (fs.existsSync(stateFile)) {
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.processedIdemKeys = new Set(savedState.processedIdemKeys || []);
    state.dailyVipPings = savedState.dailyVipPings || 0;
    state.lastResetDate = savedState.lastResetDate || new Date().toDateString();
  }
} catch (error) {
  console.error('Failed to load state:', error);
}

// Save state to disk
function saveState() {
  try {
    const stateToSave = {
      processedIdemKeys: Array.from(state.processedIdemKeys),
      dailyVipPings: state.dailyVipPings,
      lastResetDate: state.lastResetDate
    };
    fs.writeFileSync(stateFile, JSON.stringify(stateToSave, null, 2));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// Reset daily counters
function checkDailyReset() {
  const today = new Date().toDateString();
  if (state.lastResetDate !== today) {
    console.log('🔄 Daily reset: clearing VIP ping counter');
    state.dailyVipPings = 0;
    state.lastResetDate = today;
    saveState();
  }
}

// Extract alert data from embed
function parseAlertEmbed(embed) {
  const footer = embed.footer?.text || '';
  const idemMatch = footer.match(/Idem:\s*(.+)/);
  const idem = idemMatch ? idemMatch[1].trim() : null;

  // Extract tier, edge, confidence from fields
  let tier = null, edge = null, confidence = null, freshness = null;

  if (embed.fields) {
    for (const field of embed.fields) {
      const name = field.name.toLowerCase();
      const value = field.value;

      if (name.includes('tier')) {
        tier = value.trim();
      } else if (name.includes('edge')) {
        const edgeMatch = value.match(/(\d+)%?/);
        edge = edgeMatch ? parseInt(edgeMatch[1]) : null;
      } else if (name.includes('confidence')) {
        const confMatch = value.match(/(\d+)%?/);
        confidence = confMatch ? parseInt(confMatch[1]) : null;
      } else if (name.includes('freshness')) {
        freshness = value.trim();
      }
    }
  }

  // Try to extract from title or description if not in fields
  if (embed.title && !tier) {
    if (embed.title.includes('Tier S') || embed.title.includes('S-tier')) tier = 'S';
    else if (embed.title.includes('Tier A') || embed.title.includes('A-tier')) tier = 'A';
  }

  return { idem, tier, edge, confidence, freshness };
}

// Check if alert qualifies for curation
function qualifiesForCuration(alertData) {
  const { tier, edge, confidence, freshness } = alertData;

  // Tier S always qualifies
  if (tier === 'S') {
    return { qualifies: true, reason: 'Tier S' };
  }

  // Tier A with edge >= 12 and confidence >= 88
  if (tier === 'A' && edge >= 12 && confidence >= 88) {
    return { qualifies: true, reason: `Tier A (edge: ${edge}%, conf: ${confidence}%)` };
  }

  // Check freshness (should be <= 300s)
  if (freshness) {
    const freshMatch = freshness.match(/(\d+)s/);
    if (freshMatch && parseInt(freshMatch[1]) > 300) {
      return { qualifies: false, reason: `Stale (${freshness})` };
    }
  }

  return { qualifies: false, reason: `Low quality (tier: ${tier}, edge: ${edge}%, conf: ${confidence}%)` };
}

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 Curated Alert Aggregator Bot ready: ${client.user.tag}`);
  console.log(`📊 Daily VIP pings: ${state.dailyVipPings}/${MAX_DAILY_PINGS}`);
  checkDailyReset();
});

client.on('messageCreate', async (message) => {
  try {
    // Only process messages from upstream channels
    if (!UPSTREAM_CHANNELS.includes(message.channelId)) return;

    // Only process embeds
    if (!message.embeds || message.embeds.length === 0) return;

    // Only process bot messages (avoid user spam)
    if (!message.author.bot) return;

    checkDailyReset();

    for (const embed of message.embeds) {
      const alertData = parseAlertEmbed(embed.data);

      if (!alertData.idem) {
        console.log('⚠️ Skipping embed without Idem key');
        continue;
      }

      // Check idempotency
      if (state.processedIdemKeys.has(alertData.idem)) {
        console.log(`🔁 Skipping duplicate Idem: ${alertData.idem}`);
        continue;
      }

      // Check if it qualifies for curation
      const qualification = qualifiesForCuration(alertData);

      console.log(`📊 Alert analysis - Idem: ${alertData.idem}`);
      console.log(`   Tier: ${alertData.tier}, Edge: ${alertData.edge}%, Conf: ${alertData.confidence}%`);
      console.log(`   Qualification: ${qualification.qualifies} (${qualification.reason})`);

      if (qualification.qualifies) {
        // Mark as processed to ensure idempotency
        state.processedIdemKeys.add(alertData.idem);

        // Forward to curated channel
        const curatedChannel = await client.channels.fetch(CURATED_CHANNEL);

        // Prepare content with VIP ping if under cap
        let content = '';
        if (state.dailyVipPings < MAX_DAILY_PINGS && VIP_ROLE_ID) {
          content = `<@&${VIP_ROLE_ID}>`;
          state.dailyVipPings++;
          console.log(`📢 VIP ping added (${state.dailyVipPings}/${MAX_DAILY_PINGS})`);
        } else {
          console.log(`🔕 VIP ping skipped (${state.dailyVipPings}/${MAX_DAILY_PINGS})`);
        }

        // Create curated embed (copy original with qualification info)
        const curatedEmbed = new EmbedBuilder(embed.data)
          .setDescription(`**${qualification.reason}** - ${embed.data.description || ''}`)
          .setFooter({ text: `${embed.data.footer?.text || ''} | Curated` });

        await curatedChannel.send({ content, embeds: [curatedEmbed] });

        console.log(`✅ Forwarded to #alerts-feed - ${qualification.reason}`);
        saveState();
      } else {
        console.log(`❌ Blocked - ${qualification.reason}`);
      }
    }
  } catch (error) {
    console.error('❌ Error processing message:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down aggregator bot...');
  saveState();
  client.destroy();
  process.exit(0);
});

// Start the bot
console.log('🚀 Starting Curated Alert Aggregator Bot...');
client.login(process.env.DISCORD_TOKEN);