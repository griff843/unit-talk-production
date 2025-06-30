#!/usr/bin/env node

/**
 * Check Discord Roles and Fix Onboarding
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function checkRolesAndFixOnboarding() {
  console.log('🔧 Checking Discord Roles...');
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('No guild found');
    }

    console.log(`📋 Checking roles in guild: ${guild.name}`);

    // Get all roles
    const roles = guild.roles.cache;
    console.log('\n🎭 All Server Roles:');
    roles.forEach(role => {
      if (role.name !== '@everyone') {
        console.log(`   - ${role.name} (ID: ${role.id})`);
      }
    });

    // Look for VIP-related roles specifically
    console.log('\n🔍 VIP/Tier Related Roles:');
    const vipRoles = roles.filter(role => 
      role.name.toLowerCase().includes('vip') || 
      role.name.toLowerCase().includes('trial') ||
      role.name.toLowerCase().includes('premium') ||
      role.name.toLowerCase().includes('member') ||
      role.name.toLowerCase().includes('capper')
    );

    vipRoles.forEach(role => {
      console.log(`   ⭐ ${role.name} (ID: ${role.id})`);
    });

    // Test with a few members who have roles
    console.log('\n👥 Testing Members with Roles:');
    const members = await guild.members.fetch();
    let testCount = 0;
    
    for (const [id, member] of members) {
      if (testCount >= 10) break;
      
      const memberRoles = member.roles.cache.filter(r => r.name !== '@everyone');
      if (memberRoles.size > 0) {
        console.log(`\n👤 ${member.user.username}:`);
        memberRoles.forEach(role => {
          console.log(`   - ${role.name}`);
        });
        testCount++;
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.destroy();
    console.log('\n✅ Disconnected');
    process.exit(0);
  }
}

checkRolesAndFixOnboarding();