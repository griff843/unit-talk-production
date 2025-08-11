// Discord thread discovery and deployment
const { Client, GatewayIntentBits } = require('discord.js');
const deployContent = require('./dist/commands/deploy-content');
require('dotenv').config();

async function findThreadsAndDeploy() {
  console.log('🚀 DISCOVERING THREADS AND DEPLOYING TO CORRECT LOCATIONS');
  console.log('='.repeat(60));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  try {
    console.log('🔐 Connecting to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);

    await new Promise(resolve => {
      client.once('ready', () => {
        console.log(`🤖 Bot ready as ${client.user.tag}`);
        resolve();
      });
    });

    const guild = client.guilds.cache.first();
    if (!guild) throw new Error('No guilds found!');

    console.log(`✅ Using guild: ${guild.name}`);

    // Your specified thread IDs
    const threadIds = [
      '1387143551992987879', // Welcome Guide
      '1387144072032157736', // Onboarding Checklist
      '1387152040328953926', // Capper Guide
      '1387158075814838495', // Server Map
      '1387158575515697232', // Analytics Preview
      '1387184046680834140', // VIP Perks
    ];

    console.log('\n🔍 Checking for your specified thread IDs...');

    // Check each thread ID
    for (const threadId of threadIds) {
      try {
        const channel = await client.channels.fetch(threadId);
        if (channel) {
          console.log(`✅ Found: ${channel.name} (${threadId}) - Type: ${channel.type}`);
        }
      } catch (error) {
        console.log(`❌ Thread ${threadId} not found or not accessible`);
      }
    }

    // Also check for threads in channels
    console.log('\n📋 Searching for threads in all channels...');
    for (const [channelId, channel] of guild.channels.cache) {
      if (channel.type === 0) {
        // Text channel
        try {
          const threads = await channel.threads.fetchActive();
          if (threads.threads.size > 0) {
            console.log(`\n📍 Channel: #${channel.name} (${channelId})`);
            threads.threads.forEach(thread => {
              console.log(`   🧵 Thread: ${thread.name} (${thread.id})`);
            });
          }

          // Also check archived threads
          const archivedThreads = await channel.threads.fetchArchived();
          if (archivedThreads.threads.size > 0) {
            console.log(`   📦 Archived threads in #${channel.name}:`);
            archivedThreads.threads.forEach(thread => {
              console.log(`   🧵 ${thread.name} (${thread.id})`);
            });
          }
        } catch (error) {
          // Skip channels we can't access
        }
      }
    }

    console.log('\n🎯 Would you like me to:');
    console.log('1. Create new threads with the specified names?');
    console.log('2. Use existing channels instead?');
    console.log('3. Deploy to the threads that were found?');

    client.destroy();
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (client) client.destroy();
    return false;
  }
}

// Execute thread discovery
findThreadsAndDeploy().then(() => {
  console.log('\n🔍 Thread discovery complete!');
  process.exit(0);
});
