#!/usr/bin/env node

/**
 * Fix the failed FAQ with shorter content
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

async function fixFailedFAQ() {
  console.log('🔧 Fixing failed FAQ...');
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const FAQ_FORUM_ID = '1387837517298139267'; // Correct FAQ forum ID
    const forumChannel = await client.channels.fetch(FAQ_FORUM_ID);
    
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      throw new Error('FAQ forum channel not found');
    }

    // Shorter version of the subscription FAQ
    const shortFAQ = {
      title: "💎 What does my subscription include?",
      icon: "💎",
      description: `**VIP Membership ($49.99/month):**
✔️ All official capper picks (every sport, every day)
✔️ Instant Discord alerts for every pick
✔️ Access to Capper Corner with full pick history
✔️ Daily, weekly, and monthly transparent recaps
✔️ Private VIP channels with exclusive insights
✔️ Early access to giveaways and contests

**Special Offer: $1 Trial Week**
Experience everything VIP has to offer for just $1!

**VIP+ (Coming Soon):**
🚀 Steam & Injury Alerts
🛡️ Hedge & Middling Alerts  
🧠 AI-powered personal advice
📊 Advanced analytics and tracking

Ready to join the winning side?`,
      button_label: "Start $1 VIP Trial",
      button_url: "https://whop.com/unit-talk/"
    };

    console.log('📝 Creating shorter subscription FAQ...');
    
    const thread = await forumChannel.threads.create({
      name: shortFAQ.title,
      message: {
        content: shortFAQ.description,
        components: shortFAQ.button_url ? [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: shortFAQ.button_label,
            url: shortFAQ.button_url
          }]
        }] : []
      }
    });

    if (thread) {
      console.log(`✅ FAQ created successfully! Thread ID: ${thread.id}`);
    } else {
      console.log('❌ Failed to create FAQ');
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

fixFailedFAQ();