// Discord guild discovery and deployment
const { Client, GatewayIntentBits } = require('discord.js');
const deployContent = require('./dist/commands/deploy-content');
require('dotenv').config();

async function discoverAndDeploy() {
  console.log('🚀 DISCOVERING DISCORD GUILD AND DEPLOYING CONTENT');
  console.log('=' .repeat(60));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔐 Connecting to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    await new Promise((resolve) => {
      client.once('ready', () => {
        console.log(`🤖 Bot ready as ${client.user.tag}`);
        console.log(`🏠 Connected to ${client.guilds.cache.size} guilds`);
        
        // List all guilds the bot is in
        console.log('\n📋 Available Guilds:');
        client.guilds.cache.forEach(guild => {
          console.log(`   🏠 ${guild.name} (ID: ${guild.id})`);
          console.log(`   👥 Members: ${guild.memberCount}`);
        });
        
        resolve();
      });
    });

    // Get the first (and likely only) guild
    const guild = client.guilds.cache.first();
    
    if (!guild) {
      throw new Error('No guilds found!');
    }

    console.log(`\n✅ Using guild: ${guild.name} (${guild.id})`);

    // List some channels to verify we have access
    console.log('\n📍 Available Channels:');
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) { // Text channels
        console.log(`   #${channel.name} (${channel.id})`);
      }
    });

    // Now deploy the content
    console.log('\n🎯 Deploying professional content...');

    const mockInteraction = {
      options: {
        getString: (name) => name === 'section' ? 'all' : null,
        getChannel: (name) => null
      },
      
      deferReply: async () => {
        console.log('⏳ Preparing professional content deployment...');
      },
      
      reply: async (content) => {
        console.log('📤 Deployment initiated');
      },
      
      editReply: async (content) => {
        const message = typeof content === 'string' ? content : content.content;
        console.log('✅ Final Status:', message);
      },
      
      followUp: async (content) => {
        console.log('📤 Follow-up deployment');
      },

      guild: guild,
      user: { id: 'deployment-system', username: 'ProfessionalDeployer' },
      member: { permissions: { has: () => true } }
    };

    await deployContent.execute(mockInteraction);
    
    console.log('\n🎉 PROFESSIONAL CONTENT DEPLOYED TO DISCORD!');
    console.log('🌟 Check your Discord server for the new professional embeds!');
    
    client.destroy();
    return true;
    
  } catch (error) {
    console.error('❌ Deployment Error:', error.message);
    console.error('📋 Stack:', error.stack);
    if (client) client.destroy();
    return false;
  }
}

// Execute discovery and deployment
discoverAndDeploy()
  .then(success => {
    if (success) {
      console.log('\n🎊 PROFESSIONAL CONTENT SYSTEM DEPLOYED!');
      console.log('🚀 Your Discord server now has Fortune 100-level presentation!');
    }
    process.exit(0);
  });