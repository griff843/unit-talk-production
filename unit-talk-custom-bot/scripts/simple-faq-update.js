#!/usr/bin/env node

/**
 * Simple FAQ Update Script
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function updateFAQs() {
  console.log('🚀 Starting FAQ Update...');
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    console.log('🔗 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    // Import the FAQ service after client is ready
    const { FAQService } = require('../src/services/faqService');
    const faqService = new FAQService(client);
    console.log('✅ FAQ Service initialized');

    // Test FAQ data
    const testFAQ = {
      title: "🏆 What is Unit Talk?",
      icon: "🏆",
      description: `Unit Talk is the premier sports betting community where elite cappers share their winning picks and strategies.

Join thousands of members who trust our expert analysis, transparent track record, and proven results across all major sports.

**What makes us different:**
• Fully transparent grading and results tracking
• Expert cappers with verified win rates
• Real-time Discord alerts for every pick
• Comprehensive analytics and insights
• Active community of winning bettors

Ready to start winning? Join the Unit Talk family today!`,
      button_label: "Join Unit Talk",
      button_url: "https://whop.com/unit-talk/"
    };

    console.log('📝 Creating/updating FAQ...');
    const thread = await faqService.createOrUpdateFAQThread(testFAQ);
    
    if (thread) {
      console.log(`✅ FAQ updated successfully! Thread ID: ${thread.id}`);
    } else {
      console.log('❌ Failed to update FAQ');
    }

    console.log('🎉 Update completed!');

  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

updateFAQs();