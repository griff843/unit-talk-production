require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

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
};

console.log('Bot Config:', {
  hasToken: !!config.token,
  clientId: config.clientId,
  guildId: config.guildId,
  roles: config.roles,
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

// Define commands
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test command to verify bot functionality'),
  new SlashCommandBuilder().setName('roles').setDescription('Check your roles and permissions'),
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

      case 'roles':
        const member = interaction.member;
        if (!member) {
          await interaction.reply('❌ Could not fetch your member information.');
          return;
        }

        const userRoles = member.roles.cache.map(role => role.name).join(', ');
        const hasVip = member.roles.cache.has(config.roles.vip);
        const hasVipPlus = member.roles.cache.has(config.roles.vipPlus);
        const hasAdmin = member.roles.cache.has(config.roles.admin);
        const hasModerator = member.roles.cache.has(config.roles.moderator);

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
