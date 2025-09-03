require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// Helper function to get the first role ID from a comma-separated list
const getFirstRoleId = (envVar, defaultValue) => {
  if (!envVar) return defaultValue;
  return envVar.split(',')[0].trim();
};

// Bot configuration
const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  roles: {
    vip: getFirstRoleId(process.env.VIP_ROLE_IDS, '1234567890123456789'),
    vipPlus: getFirstRoleId(process.env.VIP_PLUS_ROLE_IDS, '1234567890123456789'),
    admin: getFirstRoleId(process.env.ADMIN_ROLE_IDS, '1234567890123456789'),
    moderator: getFirstRoleId(process.env.MODERATOR_ROLE_IDS, '1234567890123456789'),
  },
  channels: {
    welcome:
      process.env.WELCOME_CHANNEL_ID ||
      process.env.ANNOUNCEMENTS_CHANNEL_ID ||
      '1288606775121285273',
    general: process.env.GENERAL_CHANNEL_ID || '1234567890123456789',
  },
};

console.log('Bot Config:', {
  hasToken: !!config.token,
  clientId: config.clientId,
  guildId: config.guildId,
  roles: config.roles,
  channels: config.channels,
});

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Helper function to get user tier
const getUserTier = member => {
  if (member.roles.cache.has(config.roles.vipPlus)) return 'vip_plus';
  if (member.roles.cache.has(config.roles.vip)) return 'vip';
  return 'member';
};

// Helper function to create help embed
const createHelpEmbed = (tier = 'member') => {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Unit Talk Bot - Help')
    .setDescription('Here are the available commands and features:')
    .setColor(tier === 'vip_plus' ? 0xffd700 : tier === 'vip' ? 0x9932cc : 0x36393f)
    .addFields(
      {
        name: '📋 Basic Commands',
        value:
          '• `/ping` - Check if bot is responsive\n• `/test` - Test bot functionality\n• `/roles` - Check your roles and permissions\n• `/help` - Show this help message',
        inline: false,
      },
      {
        name: '💎 VIP Features',
        value:
          tier === 'vip' || tier === 'vip_plus'
            ? '• Access to VIP channels\n• Priority support\n• Advanced analytics'
            : '• Upgrade to VIP for exclusive features!\n• Contact an admin for VIP access',
        inline: false,
      }
    )
    .setFooter({ text: 'Unit Talk - Your Betting Community' })
    .setTimestamp();

  if (tier === 'vip_plus') {
    embed.addFields({
      name: '💎+ VIP Plus Exclusive',
      value: '• Premium analytics\n• Direct access to experts\n• Exclusive picks',
      inline: false,
    });
  }

  return embed;
};

// Helper function to create welcome embed
const createWelcomeEmbed = member => {
  return new EmbedBuilder()
    .setTitle('🎉 Welcome to Unit Talk!')
    .setDescription(
      `Hey ${member.displayName || member.user.username}! Welcome to our betting community!`
    )
    .setColor(0x00ff00)
    .addFields(
      {
        name: '🚀 Getting Started',
        value:
          '• Check out our rules and guidelines\n• Introduce yourself in the general chat\n• Use `/help` to see available commands',
        inline: false,
      },
      {
        name: '💎 Want VIP Access?',
        value:
          '• Get exclusive picks and analytics\n• Join our VIP community\n• Contact an admin for upgrade info',
        inline: false,
      },
      {
        name: '❓ Need Help?',
        value:
          '• Use `/help` for bot commands\n• Ask questions in general chat\n• Contact moderators for support',
        inline: false,
      }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: 'Welcome to the community!' })
    .setTimestamp();
};

// Define commands
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test command to verify bot functionality'),
  new SlashCommandBuilder().setName('roles').setDescription('Check your roles and permissions'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and bot information'),
];

// Register commands
async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    const rest = new REST({ version: '10' }).setToken(config.token);

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands.map(command => command.toJSON()),
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  await registerCommands();
});

// Handle new member joins
client.on('guildMemberAdd', async member => {
  try {
    console.log(`👋 New member joined: ${member.user.username} (${member.id})`);

    // Send welcome message to the member via DM
    try {
      const welcomeEmbed = createWelcomeEmbed(member);
      await member.send({ embeds: [welcomeEmbed] });
      console.log(`✅ Sent welcome DM to ${member.user.username}`);
    } catch (dmError) {
      console.log(`❌ Could not send DM to ${member.user.username}:`, dmError.message);

      // If DM fails, try to send to welcome channel
      try {
        const welcomeChannel = member.guild.channels.cache.get(config.channels.welcome);
        if (welcomeChannel) {
          const welcomeEmbed = createWelcomeEmbed(member);
          await welcomeChannel.send({
            content: `Welcome ${member}!`,
            embeds: [welcomeEmbed],
          });
          console.log(`✅ Sent welcome message to channel for ${member.user.username}`);
        }
      } catch (channelError) {
        console.log(`❌ Could not send welcome message to channel:`, channelError.message);
      }
    }
  } catch (error) {
    console.error('Error handling member join:', error);
  }
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`📝 Received command: ${interaction.commandName} from ${interaction.user.tag}`);

  try {
    switch (interaction.commandName) {
      case 'ping':
        await interaction.reply('🏓 Pong!');
        break;

      case 'test':
        await interaction.reply('✅ Bot is working correctly!');
        break;

      case 'help':
        const member = interaction.member;
        const tier = member ? getUserTier(member) : 'member';
        const helpEmbed = createHelpEmbed(tier);
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        break;

      case 'roles':
        const memberForRoles = interaction.member;
        if (!memberForRoles) {
          await interaction.reply('❌ Could not fetch your member information.');
          return;
        }

        const userRoles = memberForRoles.roles.cache.map(role => role.name).join(', ');
        const hasVip = memberForRoles.roles.cache.has(config.roles.vip);
        const hasVipPlus = memberForRoles.roles.cache.has(config.roles.vipPlus);
        const hasAdmin = memberForRoles.roles.cache.has(config.roles.admin);
        const hasModerator = memberForRoles.roles.cache.has(config.roles.moderator);

        const embed = {
          title: '👤 Your Roles & Permissions',
          fields: [
            { name: '🎭 Your Roles', value: userRoles || 'No roles', inline: false },
            { name: '💎 VIP Status', value: hasVip ? '✅ VIP' : '❌ Not VIP', inline: true },
            {
              name: '💎+ VIP Plus Status',
              value: hasVipPlus ? '✅ VIP Plus' : '❌ Not VIP Plus',
              inline: true,
            },
            {
              name: '👑 Admin Status',
              value: hasAdmin ? '✅ Admin' : '❌ Not Admin',
              inline: true,
            },
            {
              name: '🛡️ Moderator Status',
              value: hasModerator ? '✅ Moderator' : '❌ Not Moderator',
              inline: true,
            },
          ],
          color: hasVipPlus ? 0xffd700 : hasVip ? 0x9932cc : 0x36393f,
          timestamp: new Date().toISOString(),
        };

        await interaction.reply({ embeds: [embed] });
        break;

      default:
        await interaction.reply('❌ Unknown command.');
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied) {
      await interaction.reply('❌ An error occurred while processing your command.');
    }
  }
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login
client.login(config.token).catch(error => {
  console.error('Failed to login:', error);
});
