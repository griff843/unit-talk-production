#!/usr/bin/env node

/**
 * Quick FAQ Test Script
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { FAQService } from '../src/services/faqService';

async function quickTest() {
  console.log('🚀 Quick FAQ Test Starting...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    console.log('🔗 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);

    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const faqService = new FAQService(client);
    console.log('✅ FAQ Service initialized');

    // Test creating one FAQ
    const testFAQ = {
      title: 'Test FAQ - What is Unit Talk?',
      icon: '🏆',
      description:
        'Unit Talk is the premier sports betting community where elite cappers share their winning picks. Join thousands of members who trust our expert analysis and proven track record.',
      button_label: null,
      button_url: null,
    };

    console.log('📝 Creating test FAQ...');
    const thread = await faqService.createOrUpdateFAQThread(testFAQ);

    if (thread) {
      console.log(`✅ Test FAQ created successfully! Thread ID: ${thread.id}`);
    } else {
      console.log('❌ Failed to create test FAQ');
    }

    // List existing FAQs
    const existingThreads = await faqService.getAllFAQThreads();
    console.log(`📋 Total FAQ threads: ${existingThreads.length}`);

    console.log('🎉 Quick test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

quickTest();
