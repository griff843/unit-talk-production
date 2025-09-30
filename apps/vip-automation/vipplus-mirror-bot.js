#!/usr/bin/env node
/**
 * VIP+ Insight Mirror Bot
 * Monitors #vipplus-insights and posts lite versions to #trader-insights after delay
 * Implements: Time delay, content stripping, mirror tracking
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const VIP_PLUS_CHANNEL = process.env.CHANNEL_VIPPLUS_INSIGHTS_ID || process.env.VIP_PLUS_EXCLUSIVE_INSIGHTS_CHANNEL_ID;
const TRADER_CHANNEL = process.env.CHANNEL_TRADER_INSIGHTS_ID || process.env.VIP_PLUS_TRADER_INSIGHTS_CHANNEL_ID;

// Mirror delay (15 minutes in production, 1 minute for testing)
const MIRROR_DELAY_MINUTES = parseInt(process.env.TEST_DELAY_MINUTES || '15');
const MIRROR_DELAY_MS = MIRROR_DELAY_MINUTES * 60 * 1000;

// State management
const stateFile = path.join(__dirname, 'mirror-state.json');
let state = {
  pendingMirrors: []
};

// Load existing state
try {
  if (fs.existsSync(stateFile)) {
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.pendingMirrors = savedState.pendingMirrors || [];
  }
} catch (error) {
  console.error('Failed to load mirror state:', error);
}

// Save state to disk
function saveState() {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save mirror state:', error);
  }
}

// Convert VIP+ insight to trader insight (lite version)
function createTraderInsight(originalEmbed) {
  const embed = new EmbedBuilder()
    .setTitle('📊 Trader Insights')
    .setColor(0x3498db)
    .setDescription('**Market Summary** *(Delayed from VIP+)*')
    .setTimestamp();

  // Extract key points from VIP+ content
  const keyPoints = [];

  // Check fields for actionable items
  if (originalEmbed.fields) {
    for (const field of originalEmbed.fields) {
      const name = field.name.toLowerCase();
      const value = field.value;

      if (name.includes('market') || name.includes('dynamics')) {
        keyPoints.push('• Sharp action detected');
      } else if (name.includes('factor') || name.includes('key')) {
        keyPoints.push('• Line movement favorable');
      } else if (name.includes('tip') || name.includes('pro')) {
        keyPoints.push('• Consider position');
      }
    }
  }

  // Default key points if none extracted
  if (keyPoints.length === 0) {
    keyPoints.push(
      '• Market analysis available',
      '• Timing considerations noted',
      '• Position sizing guidance provided'
    );
  }

  embed.addFields(
    { name: 'Key Points', value: keyPoints.join('\n'), inline: false },
    { name: 'Confidence', value: 'High', inline: true },
    { name: 'Timing', value: 'Act within 5 mins', inline: true }
  );

  // Add delay notice
  embed.setFooter({ text: `Mirrored from VIP+ • ${MIRROR_DELAY_MINUTES}m delay` });

  return embed;
}

// Schedule a mirror
function scheduleMirror(originalMessage, vipPlusEmbed) {
  const mirrorJob = {
    id: `${originalMessage.id}-${Date.now()}`,
    originalMessageId: originalMessage.id,
    originalChannelId: originalMessage.channelId,
    embedData: vipPlusEmbed.data,
    scheduledTime: Date.now() + MIRROR_DELAY_MS,
    createdAt: Date.now()
  };

  state.pendingMirrors.push(mirrorJob);
  saveState();

  console.log(`⏰ Scheduled mirror for ${new Date(mirrorJob.scheduledTime).toLocaleTimeString()}`);
  console.log(`   Job ID: ${mirrorJob.id}`);

  // Set timeout for this specific mirror
  setTimeout(async () => {
    await executeMirror(mirrorJob);
  }, MIRROR_DELAY_MS);
}

// Execute a mirror job
async function executeMirror(mirrorJob) {
  try {
    console.log(`🚀 Executing mirror job: ${mirrorJob.id}`);

    const traderChannel = await client.channels.fetch(TRADER_CHANNEL);
    const traderEmbed = createTraderInsight({ data: mirrorJob.embedData });

    await traderChannel.send({ embeds: [traderEmbed] });

    console.log(`✅ Mirror posted to #trader-insights`);

    // Remove from pending mirrors
    state.pendingMirrors = state.pendingMirrors.filter(job => job.id !== mirrorJob.id);
    saveState();

  } catch (error) {
    console.error(`❌ Failed to execute mirror ${mirrorJob.id}:`, error);
  }
}

// Process any pending mirrors from previous session
async function processPendingMirrors() {
  const now = Date.now();
  const dueMirrors = state.pendingMirrors.filter(job => job.scheduledTime <= now);
  const futureMirrors = state.pendingMirrors.filter(job => job.scheduledTime > now);

  console.log(`📋 Found ${dueMirrors.length} due mirrors, ${futureMirrors.length} future mirrors`);

  // Execute overdue mirrors immediately
  for (const mirror of dueMirrors) {
    await executeMirror(mirror);
  }

  // Reschedule future mirrors
  for (const mirror of futureMirrors) {
    const delay = mirror.scheduledTime - now;
    console.log(`⏰ Rescheduling mirror ${mirror.id} in ${Math.round(delay / 1000)}s`);
    setTimeout(async () => {
      await executeMirror(mirror);
    }, delay);
  }
}

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`🤖 VIP+ Mirror Bot ready: ${client.user.tag}`);
  console.log(`📊 Mirror delay: ${MIRROR_DELAY_MINUTES} minutes`);
  console.log(`📍 VIP+ Channel: ${VIP_PLUS_CHANNEL}`);
  console.log(`📍 Trader Channel: ${TRADER_CHANNEL}`);

  // Process any pending mirrors from previous session
  await processPendingMirrors();
});

client.on('messageCreate', async (message) => {
  try {
    // Only process messages from VIP+ insights channel
    if (message.channelId !== VIP_PLUS_CHANNEL) return;

    // Only process embeds
    if (!message.embeds || message.embeds.length === 0) return;

    // Only process bot messages (avoid user spam)
    if (!message.author.bot) return;

    console.log(`📥 New VIP+ insight detected: ${message.id}`);

    // Schedule mirror for each embed
    for (const embed of message.embeds) {
      if (embed.data.title?.includes('VIP+') || embed.data.title?.includes('Extended')) {
        scheduleMirror(message, embed);
      }
    }

  } catch (error) {
    console.error('❌ Error processing VIP+ message:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down mirror bot...');
  saveState();
  client.destroy();
  process.exit(0);
});

// Start the bot
console.log('🚀 Starting VIP+ Mirror Bot...');
client.login(process.env.DISCORD_TOKEN);