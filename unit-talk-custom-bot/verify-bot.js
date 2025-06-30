#!/usr/bin/env node

/**
 * Bot Verification Script
 * This script verifies that the bot can be instantiated without critical errors
 */

console.log('🔍 Verifying bot can be instantiated...');

try {
  // Set required environment variables for testing
  process.env.DISCORD_BOT_TOKEN = 'test-token-for-verification';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  
  // Import the bot class
  const { UnitTalkBot } = require('./dist/index.js');
  
  console.log('✅ Bot class imported successfully');
  
  // Try to create an instance (this will test the constructor and initialization)
  console.log('🏗️ Creating bot instance...');
  const bot = new UnitTalkBot();
  
  console.log('✅ Bot instance created successfully');
  console.log('🎉 Bot verification completed - no critical errors found!');
  
  // Clean shutdown
  setTimeout(() => {
    console.log('🔄 Cleaning up...');
    if (bot && typeof bot.shutdown === 'function') {
      bot.shutdown().catch(() => {
        // Ignore shutdown errors in verification
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 1000);
  
} catch (error) {
  console.error('❌ Bot verification failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}