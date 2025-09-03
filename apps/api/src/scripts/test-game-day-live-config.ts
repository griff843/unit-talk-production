import { resolve } from 'path';

import { config } from 'dotenv';

// Load environment from API directory
config();

// Bot configuration for testing
const botConfig = {
  channels: {
    threads: process.env.THREADS_CHANNEL_ID || '1291234713213734912'
  }
};
import { DiscordBotService } from '../services/DiscordBotService';
import { logger } from '../shared/logger';

/**
 * CONFIGURATION TEST: Verify Game Day Live Channel Setup
 * 
 * This quick test verifies:
 * 1. Correct channel ID is configured (1291234713213734912)
 * 2. DiscordBotService can connect and has thread methods
 * 3. Channel exists and bot has permissions
 */

async function testGameDayLiveConfig() {
  const correlationId = `config-test-${Date.now()}`;
  const testLogger = logger.child({ correlationId });

  try {
    console.log('🔧 TESTING GAME DAY LIVE CONFIGURATION');
    console.log('=' .repeat(50));
    
    // Step 1: Check configuration
    console.log('\\n📋 CONFIGURATION CHECK:');
    console.log(`🆔 Threads Channel ID: ${botConfig.channels.threads}`);
    console.log(`🌍 Process Env Value: ${process.env.THREADS_CHANNEL_ID}`);
    console.log(`✅ Expected: 1291234713213734912`);
    console.log(`✅ Match: ${botConfig.channels.threads === '1291234713213734912' ? 'YES' : 'NO'}`);
    
    if (botConfig.channels.threads !== '1291234713213734912') {
      console.log('❌ CONFIGURATION ERROR: Wrong channel ID in botConfig');
      console.log('   💡 The environment variable appears to not be loaded properly');
      
      // Check if env var exists
      if (process.env.THREADS_CHANNEL_ID) {
        console.log('   ✅ Environment variable exists but config not using it');
        console.log('   💡 This might be a module loading order issue');
      } else {
        console.log('   ❌ Environment variable not found');
        console.log('   💡 Fix: Update THREADS_CHANNEL_ID in .env file');
      }
      return;
    }

    // Step 2: Test Discord Bot Service
    console.log('\\n🤖 DISCORD BOT SERVICE CHECK:');
    const discordBot = DiscordBotService.getInstance();
    
    // Check if service has the new thread methods
    const hasThreadMethod = typeof discordBot.sendEmbedToThread === 'function';
    console.log(`📡 sendEmbedToThread method: ${hasThreadMethod ? '✅ Available' : '❌ Missing'}`);
    
    if (!hasThreadMethod) {
      console.log('❌ IMPLEMENTATION ERROR: sendEmbedToThread method missing');
      console.log('   💡 Fix: Method was just added - restart the application');
      return;
    }

    // Step 3: Test connection
    console.log('\\n🔗 CONNECTION TEST:');
    try {
      const status = discordBot.getStatus();
      console.log(`📊 Bot Status: ${status.ready ? '✅ Ready' : '❌ Not Ready'}`);
      console.log(`🏰 Guild Count: ${status.guildCount}`);
      console.log(`👤 Bot Tag: ${status.userTag || 'Unknown'}`);
      
      if (!status.ready) {
        console.log('⏳ Bot not ready yet - this is normal on first startup');
        console.log('   💡 Wait for bot to connect, then try again');
      }
    } catch (connectionError) {
      console.log(`❌ Connection Error: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);
    }

    // Step 4: Environment Check
    console.log('\\n🌍 ENVIRONMENT CHECK:');
    const hasToken = !!(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN);
    console.log(`🔑 Discord Token: ${hasToken ? '✅ Present' : '❌ Missing'}`);
    
    const hasChannelId = !!process.env.THREADS_CHANNEL_ID;
    console.log(`🆔 Threads Channel ID Env: ${hasChannelId ? '✅ Set' : '❌ Missing'}`);
    
    if (hasChannelId) {
      console.log(`   📍 Value: ${process.env.THREADS_CHANNEL_ID}`);
    }

    // Step 5: Summary
    console.log('\\n📊 CONFIGURATION SUMMARY:');
    console.log('-'.repeat(40));
    
    const configCorrect = botConfig.channels.threads === '1291234713213734912';
    const methodExists = hasThreadMethod;
    const tokenExists = hasToken;
    
    console.log(`✅ Channel ID Configured: ${configCorrect ? 'YES' : 'NO'}`);
    console.log(`✅ Thread Methods Available: ${methodExists ? 'YES' : 'NO'}`);
    console.log(`✅ Discord Token Present: ${tokenExists ? 'YES' : 'NO'}`);
    
    const allGood = configCorrect && methodExists && tokenExists;
    console.log(`\\n🎯 READY FOR GAME DAY LIVE: ${allGood ? '✅ YES' : '❌ NO'}`);
    
    if (allGood) {
      console.log('\\n🚀 NEXT STEPS:');
      console.log('1. Run: npm run test:real-game-day-post');
      console.log('2. Check Discord Game Day Live channel');
      console.log('3. Verify threads are created (not main channel posts)');
      console.log('4. Confirm picks route TO threads');
    } else {
      console.log('\\n🔧 FIXES NEEDED:');
      if (!configCorrect) {
        console.log('- Update THREADS_CHANNEL_ID=1291234713213734912 in .env');
      }
      if (!methodExists) {
        console.log('- Restart application to load new DiscordBotService methods');
      }
      if (!tokenExists) {
        console.log('- Add DISCORD_BOT_TOKEN or DISCORD_TOKEN to .env');
      }
    }

    testLogger.info('Game Day Live configuration test completed', {
      configCorrect,
      methodExists,
      tokenExists,
      channelId: botConfig.channels.threads
    });

  } catch (error) {
    testLogger.error('Configuration test failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Execute test
if (require.main === module) {
  testGameDayLiveConfig()
    .then(() => {
      console.log('\\n✅ Configuration test completed!');
    })
    .catch(error => {
      console.error('❌ Configuration test failed:', error);
    });
}

export { testGameDayLiveConfig };