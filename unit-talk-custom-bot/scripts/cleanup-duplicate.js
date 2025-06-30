#!/usr/bin/env node

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

async function cleanupDuplicate() {
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
      
      // Find duplicate subscription threads
      const subscriptionThreads = allThreads.filter(t => 
        t.name === '💎 What does my subscription include?'
      );
      
      console.log(`Found ${subscriptionThreads.length} subscription threads`);
      
      // Keep the newest one, delete the older one
      if (subscriptionThreads.length > 1) {
        subscriptionThreads.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        
        for (let i = 1; i < subscriptionThreads.length; i++) {
          try {
            await subscriptionThreads[i].delete();
            console.log(`✅ Deleted duplicate: ${subscriptionThreads[i].name}`);
          } catch (error) {
            console.log(`❌ Failed to delete duplicate`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.destroy();
    process.exit(0);
  }
}

cleanupDuplicate();