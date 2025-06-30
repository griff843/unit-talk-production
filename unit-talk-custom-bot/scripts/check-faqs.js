#!/usr/bin/env node

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

async function checkExistingFAQs() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    
    const FAQ_FORUM_ID = '1387837517298139267';
    const forumChannel = await client.channels.fetch(FAQ_FORUM_ID);
    
    if (forumChannel && forumChannel.type === ChannelType.GuildForum) {
      const threads = await forumChannel.threads.fetchActive();
      const archivedThreads = await forumChannel.threads.fetchArchived();
      
      const allThreads = [...threads.threads.values(), ...archivedThreads.threads.values()];
      
      console.log('=== EXISTING FAQ THREADS ===');
      allThreads.forEach((thread, index) => {
        console.log(`${index + 1}. ${thread.name}`);
      });
      
      console.log(`\nTotal threads: ${allThreads.length}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.destroy();
    process.exit(0);
  }
}

checkExistingFAQs();