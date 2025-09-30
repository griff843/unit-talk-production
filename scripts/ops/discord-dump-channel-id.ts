/**
 * Discord channel ID discovery script
 * Finds channel ID by name without sending any messages
 */
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

interface DiscordChannelDiscovery {
  channelName: string;
  channelId: string | null;
  guildName?: string;
  guildId?: string;
  error?: string;
}

async function discoverChannelId(channelName: string): Promise<DiscordChannelDiscovery> {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    return {
      channelName,
      channelId: null,
      error: 'DISCORD_TOKEN or DISCORD_BOT_TOKEN not set in environment'
    };
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  return new Promise((resolve) => {
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({
        channelName,
        channelId: null,
        error: 'Timeout: Could not connect to Discord in 10 seconds'
      });
    }, 10000);

    client.once('ready', () => {
      clearTimeout(timeout);
      console.log(`✅ Connected to Discord as ${client.user?.tag}`);

      // Search all guilds for the channel
      let found = false;
      for (const guild of client.guilds.cache.values()) {
        const channel = guild.channels.cache.find(
          ch => ch.name === channelName && ch instanceof TextChannel
        ) as TextChannel | undefined;

        if (channel) {
          console.log(`📍 Found channel "${channelName}" in guild "${guild.name}"`);

          client.destroy();
          resolve({
            channelName,
            channelId: channel.id,
            guildName: guild.name,
            guildId: guild.id
          });
          found = true;
          break;
        }
      }

      if (!found) {
        // List available channels for debugging
        console.log('\n📋 Available channels:');
        for (const guild of client.guilds.cache.values()) {
          console.log(`  Guild: ${guild.name}`);
          const textChannels = guild.channels.cache
            .filter(ch => ch instanceof TextChannel)
            .map(ch => ch.name);

          if (textChannels.length > 0) {
            console.log(`    Channels: ${textChannels.join(', ')}`);
          }
        }

        client.destroy();
        resolve({
          channelName,
          channelId: null,
          error: `Channel "${channelName}" not found in any guild`
        });
      }
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ Discord client error:', error.message);
      client.destroy();
      resolve({
        channelName,
        channelId: null,
        error: error.message
      });
    });

    // Login to Discord
    client.login(token).catch((error) => {
      clearTimeout(timeout);
      console.error('❌ Failed to login to Discord:', error.message);
      resolve({
        channelName,
        channelId: null,
        error: `Login failed: ${error.message}`
      });
    });
  });
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let channelName = 'vip-canary'; // Default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      channelName = args[i + 1];
      i++;
    }
  }

  console.log(`🔍 Searching for Discord channel: "${channelName}"\n`);

  // Discover channel ID
  const discovery = await discoverChannelId(channelName);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'out', 'ops');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write discovery file
  const outputPath = path.join(outputDir, 'discord.channels.json');
  fs.writeFileSync(outputPath, JSON.stringify(discovery, null, 2));

  // Log results
  console.log('\n📊 Discovery Results:');
  console.log(JSON.stringify(discovery, null, 2));

  if (discovery.channelId) {
    console.log(`\n✅ Channel found!`);
    console.log(`  Channel ID: ${discovery.channelId}`);
    console.log(`  Guild: ${discovery.guildName}`);
    console.log(`\n📝 Add to environment:`);
    console.log(`  CANARY_CHANNEL_ID=${discovery.channelId}`);
  } else {
    console.log(`\n❌ Channel not found`);
    if (discovery.error) {
      console.log(`  Error: ${discovery.error}`);
    }
    console.log(`\n📝 To set manually:`);
    console.log(`  1. Get the channel ID from Discord (right-click channel > Copy ID)`);
    console.log(`  2. Set: CANARY_CHANNEL_ID=<channel-id>`);
  }

  console.log(`\n  Output saved to: ${outputPath}`);

  // Exit with appropriate code
  process.exit(discovery.channelId ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});