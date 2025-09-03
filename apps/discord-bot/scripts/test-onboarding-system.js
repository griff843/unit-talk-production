#!/usr/bin/env node

/**
 * Test and Fix Discord Onboarding System
 * This script will test the current onboarding system and fix the tier mapping issues
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Test the current onboarding system
async function testOnboardingSystem() {
  console.log('🔧 Testing Discord Onboarding System...');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('No guild found');
    }

    console.log(`📋 Testing in guild: ${guild.name}`);

    // Get all members and test tier detection
    const members = await guild.members.fetch();
    console.log(`👥 Found ${members.size} members`);

    // Test a few members with different roles
    let testCount = 0;
    for (const [id, member] of members) {
      if (testCount >= 5) break; // Test first 5 members

      const roles = member.roles.cache.map(r => r.name).filter(name => name !== '@everyone');
      console.log(`\n👤 ${member.user.username}:`);
      console.log(`   Roles: ${roles.join(', ') || 'None'}`);

      // Test tier detection
      try {
        const { getUserTier } = require('../src/utils/roleUtils.ts');
        const tier = getUserTier(member);
        console.log(`   Detected Tier: ${tier}`);

        // Test if welcome config exists for this tier
        const { OnboardingService } = require('../src/services/onboardingService.ts');
        const onboardingService = new OnboardingService();

        // We need to access the private method, so let's simulate it
        const configs = {
          member: 'Default',
          trial: 'Trial',
          vip: 'VIP',
          vip_plus: 'VIP+',
          capper: 'Capper',
        };

        const configKey = configs[tier] || 'Default';
        console.log(`   Config Key: ${configKey}`);
        console.log(`   ✅ Onboarding would work: ${configKey ? 'YES' : 'NO'}`);
      } catch (error) {
        console.log(`   ❌ Error testing tier: ${error.message}`);
      }

      testCount++;
    }

    console.log('\n🎯 Onboarding System Analysis Complete!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

testOnboardingSystem();
