#!/usr/bin/env node

/**
 * FAQ Debug Script
 * Tests FAQ service functionality with detailed logging
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { FAQService, FAQItem } from '../src/services/faqService';

console.log('🔍 Starting FAQ Debug Script...');

// Test FAQ data (just 2 items for testing)
const testFAQs: FAQItem[] = [
  {
    title: "What is Unit Talk?",
    icon: "🏆",
    description: "Unit Talk is the premier sports betting community where elite cappers share their winning picks. Join thousands of members who trust our expert analysis and proven track record.",
    button_label: null,
    button_url: null
  },
  {
    title: "What does my subscription include?",
    icon: "💎",
    description: "VIP access to all capper picks, exclusive Discord channels, real-time alerts, detailed analysis, and 24/7 support. Everything you need to win consistently.",
    button_label: "Upgrade to VIP",
    button_url: "https://your-upgrade-link.com"
  }
];

async function debugFAQSystem() {
  console.log('🤖 Creating Discord client...');
  
  // Create client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    // Login to Discord
    console.log('🔗 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');

    // Wait for client to be ready
    await new Promise(resolve => {
      client.once('ready', resolve);
    });

    console.log(`✅ Bot ready as ${client.user?.tag}`);

    // Initialize FAQ service
    const faqService = new FAQService(client);
    console.log('✅ FAQ Service initialized');

    // Test forum channel access
    console.log('🔍 Testing forum channel access...');
    const forumChannelId = '1387837517298139267';

    try {
      const channel = await client.channels.fetch(forumChannelId);
      console.log(`✅ Channel fetched: ${channel?.type}`);

      if (channel && 'name' in channel) {
        console.log(`   Channel name: ${channel.name}`);
      }

      if (channel?.type === ChannelType.GuildForum) {
        console.log('✅ Channel is a forum channel');
        
        // Check permissions
        const permissions = channel.permissionsFor(client.user!);
        console.log('🔐 Bot permissions:');
        console.log(`  - View Channel: ${permissions?.has('ViewChannel')}`);
        console.log(`  - Send Messages: ${permissions?.has('SendMessages')}`);
        console.log(`  - Create Public Threads: ${permissions?.has('CreatePublicThreads')}`);
        console.log(`  - Manage Threads: ${permissions?.has('ManageThreads')}`);
        
      } else {
        console.log(`❌ Channel is not a forum (type: ${channel?.type})`);
      }
    } catch (error) {
      console.error('❌ Error fetching forum channel:', error);
    }

    // Test getting existing threads
    console.log('📋 Fetching existing FAQ threads...');
    try {
      const existingThreads = await faqService.getAllFAQThreads();
      console.log(`✅ Found ${existingThreads.length} existing FAQ threads`);

      if (existingThreads.length > 0) {
        console.log('📝 Existing threads:');
        existingThreads.forEach((thread, index) => {
          console.log(`  ${index + 1}. ${thread.name} (ID: ${thread.id})`);
        });
      }
    } catch (error) {
      console.error('❌ Error fetching threads:', error);
    }

    // Test creating a single FAQ
    console.log('🧪 Testing single FAQ creation...');
    try {
      const testFAQ = testFAQs[0];
      console.log(`Creating FAQ: ${testFAQ.title}`);
      
      const thread = await faqService.createOrUpdateFAQThread(testFAQ);
      
      if (thread) {
        console.log(`✅ FAQ created successfully: ${thread.name} (ID: ${thread.id})`);
      } else {
        console.log('❌ FAQ creation returned null');
      }
    } catch (error) {
      console.error('❌ Error creating FAQ:', error);
    }

    console.log('✅ FAQ Debug completed');

  } catch (error) {
    console.error('❌ FAQ Debug failed:', error);
  } finally {
    // Cleanup
    await client.destroy();
    console.log('✅ Disconnected from Discord');
    process.exit(0);
  }
}

// Run the debug
debugFAQSystem();