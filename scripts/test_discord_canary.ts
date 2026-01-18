#!/usr/bin/env npx tsx
/**
 * Discord Canary Channel Smoke Test
 *
 * Tests that the Discord bot can successfully post to the CANARY channel
 * This is a critical safety check before running live-fire tests
 *
 * SAFETY: Only posts to CANARY channel (1296531122234327100)
 * NEVER posts to production channels
 *
 * Exit codes:
 * - 0: Success, canary channel test passed
 * - 1: Failure, canary channel test failed
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

// === SAFETY CONFIGURATION ===
const CANARY_CHANNEL_ID = process.env.DISCORD_CANARY_CHANNEL_ID || '1296531122234327100';
const PRODUCTION_CHANNELS = [
  process.env.VIP_PICKS_CHANNEL_ID,
  process.env.DISCORD_ALERT_CHANNEL_ID,
  process.env.DISCORD_RECAP_CHANNEL_ID,
];

// Safety check: Ensure CANARY channel is NOT a production channel
if (PRODUCTION_CHANNELS.includes(CANARY_CHANNEL_ID)) {
  console.error('🚨 SAFETY VIOLATION: CANARY channel ID matches a production channel!');
  console.error(`   CANARY: ${CANARY_CHANNEL_ID}`);
  console.error(`   PRODUCTION: ${PRODUCTION_CHANNELS.join(', ')}`);
  process.exit(1);
}

async function runSmokeTest(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔥 DISCORD CANARY CHANNEL SMOKE TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Verify environment configuration
  console.log('📋 Configuration Check:');
  console.log(`   ✅ CANARY Channel ID: ${CANARY_CHANNEL_ID}`);
  console.log(`   ✅ Discord Token: ${process.env.DISCORD_TOKEN ? '***configured***' : '❌ MISSING'}`);
  console.log('');

  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not set in environment');
    process.exit(1);
  }

  // Initialize Discord client
  console.log('🤖 Initializing Discord client...');
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    // Connect to Discord
    console.log('🔌 Connecting to Discord API...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Discord client connected');
    console.log('');

    // Wait for client to be ready
    await new Promise<void>((resolve) => {
      client.once('ready', () => {
        console.log(`✅ Discord bot ready: ${client.user?.tag}`);
        console.log('');
        resolve();
      });
    });

    // Fetch canary channel
    console.log(`📡 Fetching CANARY channel (${CANARY_CHANNEL_ID})...`);
    const channel = await client.channels.fetch(CANARY_CHANNEL_ID);

    if (!channel) {
      console.error(`❌ CANARY channel not found: ${CANARY_CHANNEL_ID}`);
      await client.destroy();
      process.exit(1);
    }

    if (!channel.isTextBased()) {
      console.error(`❌ CANARY channel is not a text channel: ${CANARY_CHANNEL_ID}`);
      await client.destroy();
      process.exit(1);
    }

    console.log('✅ CANARY channel fetched successfully');
    console.log(`   Channel Name: ${(channel as any).name}`);
    console.log(`   Channel Type: ${channel.type}`);
    console.log('');

    // Create test embed
    const timestamp = new Date().toISOString();
    const embed = new EmbedBuilder()
      .setTitle('🧪 CANARY SMOKE TEST')
      .setDescription('**Discord Publishing Test - CANARY Channel Only**')
      .setColor(0xFFD700) // Gold color for testing
      .addFields([
        {
          name: '🎯 Test Purpose',
          value: 'Verify Discord bot can post to CANARY channel before live-fire test',
          inline: false,
        },
        {
          name: '📊 Test Details',
          value: `**Timestamp:** ${timestamp}\n**Channel ID:** ${CANARY_CHANNEL_ID}\n**Bot:** ${client.user?.tag}`,
          inline: false,
        },
        {
          name: '✅ Safety Checks',
          value: '• CANARY channel verified\n• Production channels protected\n• Test mode active',
          inline: false,
        },
      ])
      .setFooter({ text: 'Unit Talk CANARY Testing • This is a test message' })
      .setTimestamp();

    // Send test message
    console.log('📤 Sending test message to CANARY channel...');
    const message = await (channel as any).send({ embeds: [embed] });
    console.log('✅ Test message sent successfully!');
    console.log(`   Message ID: ${message.id}`);
    console.log(`   Message URL: ${message.url}`);
    console.log('');

    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CANARY SMOKE TEST PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify the test message appears in your CANARY Discord channel');
    console.log('2. Confirm the message formatting is correct');
    console.log('3. Proceed with live-fire test execution');
    console.log('');

    // Clean up
    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ CANARY SMOKE TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Verify DISCORD_TOKEN is correct in .env');
    console.error('2. Verify DISCORD_CANARY_CHANNEL_ID is correct (1296531122234327100)');
    console.error('3. Verify Discord bot has permissions in CANARY channel');
    console.error('4. Check Discord API status: https://discordstatus.com');
    console.error('');

    if (client) {
      await client.destroy();
    }
    process.exit(1);
  }
}

// Run smoke test
runSmokeTest().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
