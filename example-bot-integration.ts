import { Client, GatewayIntentBits } from 'discord.js';
import { CapperSystem, CapperSystemConfig, createCapperSystem } from './src/capperSystem';

/**
 * Example integration of the UT Capper System
 * 
 * This example shows how to integrate the complete capper system
 * into your existing Discord bot.
 */

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Configure the capper system
const capperConfig: CapperSystemConfig = {
  discordClient: client,
  publishingChannelId: process.env.PICKS_CHANNEL_ID || 'YOUR_CHANNEL_ID_HERE',
  enabled: true
};

// Initialize the capper system
const capperSystem = createCapperSystem(capperConfig);

// Bot startup
async function startBot() {
  try {
    console.log('🚀 Starting UT Capper Discord Bot...');

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
    // Wait for client to be ready
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Discord client ready! Logged in as ${client.user?.tag}`);

    // Initialize the capper system
    await capperSystem.initialize();

    console.log('🎉 UT Capper System fully initialized and ready!');

    // Optional: Set up additional event handlers
    setupAdditionalHandlers();

    // Optional: Set up admin commands
    setupAdminCommands();

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Optional: Additional event handlers
function setupAdditionalHandlers() {
  // Log when the system is ready
  client.on('ready', () => {
    console.log(`📊 UT Capper System Status:`);
    console.log(`   - Bot: ${client.user?.tag}`);
    console.log(`   - Guilds: ${client.guilds.cache.size}`);
    console.log(`   - Publish Channel: ${capperConfig.publishingChannelId}`);
    console.log(`   - System Enabled: ${capperConfig.enabled ? 'Yes' : 'No'}`);
  });

  // Handle errors
  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  // Handle warnings
  client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
  });

  // Optional: Log interaction usage
  client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) {
      const capperCommands = ['submit-pick', 'edit-pick', 'delete-pick', 'capper-stats', 'capper-onboard'];
      if (capperCommands.includes(interaction.commandName)) {
        console.log(`📝 Capper command used: ${interaction.commandName} by ${interaction.user.username}`);
      }
    }
  });
}

// Optional: Admin commands for system management
function setupAdminCommands() {
  // Register admin commands
  const adminCommands = [
    {
      name: 'admin-publish-now',
      description: 'Manually trigger daily pick publishing',
      defaultMemberPermissions: '0' // Admin only
    },
    {
      name: 'admin-system-status',
      description: 'View capper system health and status',
      defaultMemberPermissions: '0' // Admin only
    },
    {
      name: 'admin-republish-failed',
      description: 'Republish failed picks for a specific date',
      defaultMemberPermissions: '0', // Admin only
      options: [{
        name: 'date',
        description: 'Date to republish (YYYY-MM-DD)',
        type: 3, // STRING
        required: true
      }]
    }
  ];

  // Handle admin commands
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Check if user has admin permissions
      const isAdmin = interaction.memberPermissions?.has('Administrator');

      if (!isAdmin) {
        await interaction.reply({
          content: '❌ You need administrator permissions to use this command.',
          ephemeral: true
        });
        return;
      }

      // Handle admin commands
      switch (interaction.commandName) {
        case 'admin-publish-now':
          await handleAdminPublishNow(interaction);
          break;
        
        case 'admin-system-status':
          await handleAdminSystemStatus(interaction);
          break;
        
        case 'admin-republish-failed':
          await handleAdminRepublishFailed(interaction);
          break;
      }

    } catch (error) {
      console.error('Error handling admin command:', error);
      
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ An error occurred while processing the admin command.',
          ephemeral: true
        });
      }
    }
  });

  // Register admin commands with Discord
  client.once('ready', async () => {
    try {
      await client.application?.commands.set(adminCommands);
      console.log('✅ Admin commands registered');
    } catch (error) {
      console.error('Failed to register admin commands:', error);
    }
  });
}

// Admin command handlers
async function handleAdminPublishNow(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  try {
    await capperSystem.publishDailyPicks();

    await interaction.editReply({
      content: '✅ Daily picks published successfully!'
    });

  } catch (error) {
    console.error('Admin publish now error:', error);
    await interaction.editReply({
      content: '❌ Error occurred during manual publishing.'
    });
  }
}

async function handleAdminSystemStatus(interaction: any) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const status = await capperSystem.getStatus();
    
    const statusEmbed = {
      title: '🔧 UT Capper System Status',
      color: status.initialized ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: '🤖 Bot Status',
          value: [
            `Ready: ${status.client?.ready ? '✅' : '❌'}`,
            `User: ${status.client?.user || 'Unknown'}`,
            `Guilds: ${status.client?.guilds || 0}`,
            `Uptime: ${status.client?.uptime ? Math.floor(status.client.uptime / 1000 / 60) + 'm' : 'Unknown'}`
          ].join('\n'),
          inline: true
        },
        {
          name: '💾 Database',
          value: `Connected: ${status.database?.connected ? '✅' : '❌'}`,
          inline: true
        },
        {
          name: '📅 Publisher',
          value: [
            `Running: ${status.publisher?.running ? '✅' : '❌'}`,
            `Next Run: ${status.publisher?.nextRun || 'Unknown'}`
          ].join('\n'),
          inline: true
        },
        {
          name: '⚙️ Configuration',
          value: [
            `Channel: <#${status.config?.publishingChannelId}>`,
            `Enabled: ${status.config?.enabled ? '✅' : '❌'}`
          ].join('\n'),
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    };

    await interaction.editReply({ embeds: [statusEmbed] });
    
  } catch (error) {
    console.error('Admin system status error:', error);
    await interaction.editReply({
      content: '❌ Error retrieving system status.'
    });
  }
}

async function handleAdminRepublishFailed(interaction: any) {
  const date = interaction.options.getString('date');

  await interaction.deferReply({ ephemeral: true });

  try {
    await capperSystem.publishDailyPicks();

    await interaction.editReply({
      content: `✅ Successfully republished failed picks for ${date}`
    });

  } catch (error) {
    console.error('Admin republish failed error:', error);
    await interaction.editReply({
      content: `❌ Error occurred while republishing picks for ${date}.`
    });
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down UT Capper Bot...');

  try {
    await client.destroy();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');

  try {
    await client.destroy();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the bot
if (require.main === module) {
  startBot();
}

// Export for use in other files
export { client, capperSystem, startBot };

/**
 * Environment Variables Required:
 * 
 * DISCORD_TOKEN=your_bot_token_here
 * PICKS_CHANNEL_ID=channel_id_for_daily_picks
 * ADMIN_ROLE_ID=admin_role_id_for_management (optional)
 * 
 * SUPABASE_URL=your_supabase_url
 * SUPABASE_ANON_KEY=your_supabase_anon_key
 * 
 * Optional:
 * CAPPER_TIMEZONE=America/New_York
 * ENABLE_SCHEDULED_PUBLISHING=true
 * LOG_LEVEL=info
 */