#!/usr/bin/env node

/**
 * FAQ System Test Script
 * Tests the FAQ service functionality
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { FAQService, FAQItem } from '../src/services/faqService';
import { logger } from '../src/utils/logger';

// Test FAQ data
const testFAQ: FAQItem = {
  title: 'Test FAQ',
  icon: '🧪',
  description: 'This is a test FAQ to verify the system is working correctly.',
  button_label: 'Test Button',
  button_url: 'https://example.com',
};

async function testFAQSystem() {
  console.log('🧪 Starting FAQ System Test...');

  // Create client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    // Login to Discord
    console.log('🔗 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');

    // Initialize FAQ service
    const faqService = new FAQService(client);
    console.log('✅ FAQ Service initialized');

    // Test getting all FAQ threads
    console.log('📋 Fetching existing FAQ threads...');
    const existingThreads = await faqService.getAllFAQThreads();
    console.log(`✅ Found ${existingThreads.length} existing FAQ threads`);

    // List existing threads
    if (existingThreads.length > 0) {
      console.log('📝 Existing FAQ threads:');
      existingThreads.forEach((thread, index) => {
        console.log(`  ${index + 1}. ${thread.name} (ID: ${thread.id})`);
      });
    }

    // Test creating a test FAQ (optional - uncomment to test)
    /*
    console.log('🆕 Creating test FAQ...');
    const testThread = await faqService.createOrUpdateFAQThread(testFAQ);
    
    if (testThread) {
      console.log(`✅ Test FAQ created: ${testThread.name} (ID: ${testThread.id})`);
      
      // Clean up - delete the test FAQ
      console.log('🧹 Cleaning up test FAQ...');
      const deleted = await faqService.deleteFAQThread(testFAQ.title);
      if (deleted) {
        console.log('✅ Test FAQ cleaned up successfully');
      } else {
        console.log('⚠️ Failed to clean up test FAQ');
      }
    } else {
      console.log('❌ Failed to create test FAQ');
    }
    */

    console.log('✅ FAQ System test completed successfully');
  } catch (error) {
    console.error('❌ FAQ System test failed:', error);
    logger.error('FAQ System test failed:', error);
  } finally {
    // Cleanup
    await client.destroy();
    console.log('✅ Disconnected from Discord');
    process.exit(0);
  }
}

// Run the test
testFAQSystem();
