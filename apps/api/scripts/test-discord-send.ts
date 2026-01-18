/**
 * Test Discord Send Directly
 *
 * Tests sending a message to CANARY channel directly without OutboxPublisher
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CANARY_CHANNEL_ID = process.env.DISCORD_CANARY_CHANNEL_ID || '1296531122234327100';

async function testDiscordSend(): Promise<void> {
  console.log('🧪 Testing Discord send directly\n');

  console.log(`Bot Token: ${BOT_TOKEN.substring(0, 20)}...`);
  console.log(`CANARY Channel ID: ${CANARY_CHANNEL_ID}\n`);

  const embed = {
    title: '🔥 Test CANARY Pick',
    description: 'This is a test message from the test-discord-send script',
    color: 0x00ff00,
    fields: [
      { name: '🏆 Sport/League', value: 'NFL', inline: true },
      { name: '⬆️ Pick/Side', value: 'Test Player OVER 25.5', inline: true },
      { name: '💰 Odds', value: '-110', inline: true },
      { name: '💵 Units', value: '1', inline: true },
      { name: '🎯 Confidence', value: '75', inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Unit Talk • Test Message',
    },
  };

  const payload = {
    embeds: [embed],
  };

  console.log('📡 Sending POST request to Discord...\n');
  console.log(`URL: ${DISCORD_API_BASE}/channels/${CANARY_CHANNEL_ID}/messages`);
  console.log(`Authorization: Bot ${BOT_TOKEN.substring(0, 30)}...`);
  console.log(`Payload:`, JSON.stringify(payload, null, 2).substring(0, 200), '...\n');

  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${CANARY_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${BOT_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    console.log(`Response Status: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Message sent to CANARY channel!\n');
      console.log(`Discord Message ID: ${data.id}`);
      console.log(`Channel ID: ${data.channel_id}`);
      console.log(`Timestamp: ${data.timestamp}\n`);
      process.exit(0);
    } else {
      const errorText = await response.text();
      console.error('❌ FAILED!\n');
      console.error(`Error Response: ${errorText}\n`);

      if (response.status === 401) {
        console.error('Diagnosis: Unauthorized');
        console.error('Possible causes:');
        console.error('   - Invalid bot token');
        console.error('   - Token expired');
        console.error('   - Token not from Discord Developer Portal\n');
      } else if (response.status === 403) {
        console.error('Diagnosis: Forbidden');
        console.error('Possible causes:');
        console.error('   - Bot lacks SEND_MESSAGES permission');
        console.error('   - Bot not in the server');
        console.error('   - Channel permissions restrict bot\n');
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testDiscordSend().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
