/**
 * Discord Auth Health Check
 *
 * Verifies Discord bot token is valid by calling GET /users/@me
 *
 * Usage:
 *   npx tsx apps/api/scripts/verify-discord-auth.ts
 *
 * Exit codes:
 *   0 - Discord auth is valid (HTTP 200)
 *   1 - Discord auth failed (HTTP 401 or other error)
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function verifyDiscordAuth(): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  console.log('🔍 Verifying Discord bot authentication...\n');

  // Check token exists
  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN not found in environment');
    console.error('   Set DISCORD_BOT_TOKEN in .env file');
    process.exit(1);
  }

  console.log('✓ DISCORD_BOT_TOKEN found in environment');
  console.log(`  Token: ${botToken.substring(0, 20)}...${botToken.substring(botToken.length - 4)}\n`);

  try {
    // Test bot token by calling GET /users/@me
    console.log(`📡 Testing Discord API: GET ${DISCORD_API_BASE}/users/@me`);

    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Discord authentication successful!\n');
      console.log('Bot Details:');
      console.log(`   Username: ${data.username}#${data.discriminator}`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Bot: ${data.bot ? 'Yes' : 'No'}`);
      console.log(`   Verified: ${data.verified ? 'Yes' : 'No'}\n`);

      // Test CANARY channel access
      const canaryChannelId = process.env.DISCORD_CANARY_CHANNEL_ID;
      if (canaryChannelId) {
        console.log('📡 Testing CANARY channel access...');
        console.log(`   Channel ID: ${canaryChannelId}`);

        const channelResponse = await fetch(`${DISCORD_API_BASE}/channels/${canaryChannelId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`   Status: ${channelResponse.status} ${channelResponse.statusText}\n`);

        if (channelResponse.ok) {
          const channelData = await channelResponse.json();
          console.log('✅ CANARY channel accessible!');
          console.log(`   Channel: #${channelData.name}`);
          console.log(`   Type: ${channelData.type}`);
          console.log(`   Guild ID: ${channelData.guild_id}\n`);
        } else {
          const errorText = await channelResponse.text();
          console.warn('⚠️  CANARY channel not accessible');
          console.warn(`   Error: ${errorText.substring(0, 200)}\n`);
          console.warn('   This may be a permissions issue. Bot needs:');
          console.warn('   - VIEW_CHANNEL permission');
          console.warn('   - SEND_MESSAGES permission\n');
        }
      }

      console.log('✅ Discord authentication verification complete\n');
      process.exit(0);
    } else {
      const errorText = await response.text();
      console.error('❌ Discord authentication failed!\n');
      console.error('Error Response:');
      console.error(`   ${errorText.substring(0, 500)}\n`);

      if (response.status === 401) {
        console.error('Diagnosis: Invalid bot token');
        console.error('Solutions:');
        console.error('   1. Check DISCORD_BOT_TOKEN in .env file');
        console.error('   2. Regenerate token in Discord Developer Portal');
        console.error('   3. Ensure token starts with your bot\'s client ID');
        console.error('   4. Token format: CLIENT_ID.RANDOM.TOKEN_HASH\n');
      } else if (response.status === 429) {
        console.error('Diagnosis: Rate limited by Discord');
        console.error('   Wait a few minutes and try again\n');
      } else {
        console.error('Diagnosis: Unknown Discord API error');
        console.error(`   Status: ${response.status} ${response.statusText}\n`);
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error during Discord auth check\n');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('\nPossible causes:');
    console.error('   - No internet connection');
    console.error('   - Discord API is down');
    console.error('   - Firewall blocking Discord API\n');
    process.exit(1);
  }
}

// Run verification
verifyDiscordAuth().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
