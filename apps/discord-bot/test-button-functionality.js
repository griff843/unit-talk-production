const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { config } = require('dotenv');

// Load environment variables
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Test button configurations
const testButtons = {
  vip: {
    title: '🎉 VIP Test Message',
    description: 'Testing VIP onboarding buttons',
    buttons: [
      { customId: 'view_vip_guide', label: 'VIP Guide', style: ButtonStyle.Primary, emoji: '📖' },
      {
        customId: 'setup_notifications',
        label: 'Setup Notifications',
        style: ButtonStyle.Secondary,
        emoji: '🔔',
      },
    ],
  },
  trial: {
    title: '🚀 Trial Test Message',
    description: 'Testing trial onboarding buttons',
    buttons: [
      {
        customId: 'view_trial_features',
        label: 'Getting Started Guide',
        style: ButtonStyle.Primary,
        emoji: '🎯',
      },
      {
        customId: 'upgrade_to_vip',
        label: 'Upgrade to VIP',
        style: ButtonStyle.Success,
        emoji: '⭐',
      },
    ],
  },
  capper: {
    title: '🎯 Capper Test Message',
    description: 'Testing capper onboarding buttons',
    buttons: [
      { customId: 'capper_guide', label: 'Capper Guide', style: ButtonStyle.Primary, emoji: '📋' },
      {
        customId: 'create_capper_thread',
        label: 'Create Threads',
        style: ButtonStyle.Success,
        emoji: '🧵',
      },
    ],
  },
};

client.once('ready', () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  console.log('🔧 Button test functionality loaded');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  console.log(`🔘 Button clicked: ${interaction.customId} by ${interaction.user.tag}`);

  // Test response for any button click
  try {
    await interaction.reply({
      content: `✅ Button "${interaction.customId}" is working! This is a test response.`,
      ephemeral: true,
    });
    console.log(`✅ Successfully responded to button: ${interaction.customId}`);
  } catch (error) {
    console.error(`❌ Error responding to button ${interaction.customId}:`, error);
  }
});

// Command to send test messages
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Only respond to test commands from authorized users
  if (!message.content.startsWith('!test-buttons')) return;

  const args = message.content.split(' ');
  const testType = args[1]; // vip, trial, capper, or all

  if (!testType || !['vip', 'trial', 'capper', 'all'].includes(testType)) {
    await message.reply('Usage: `!test-buttons <vip|trial|capper|all>`');
    return;
  }

  try {
    if (testType === 'all') {
      // Send all test messages
      for (const [type, config] of Object.entries(testButtons)) {
        await sendTestMessage(message.channel, type, config);
      }
    } else {
      // Send specific test message
      await sendTestMessage(message.channel, testType, testButtons[testType]);
    }

    await message.reply('✅ Test messages sent! Try clicking the buttons.');
  } catch (error) {
    console.error('❌ Error sending test messages:', error);
    await message.reply('❌ Error sending test messages. Check console for details.');
  }
});

async function sendTestMessage(channel, type, config) {
  const embed = new EmbedBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setColor(0x00ae86)
    .setTimestamp()
    .setFooter({ text: `Test Type: ${type.toUpperCase()}` });

  const row = new ActionRowBuilder();

  config.buttons.forEach(button => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(button.customId)
        .setLabel(button.label)
        .setStyle(button.style)
        .setEmoji(button.emoji)
    );
  });

  await channel.send({
    embeds: [embed],
    components: [row],
  });

  console.log(
    `📤 Sent ${type} test message with buttons: ${config.buttons.map(b => b.customId).join(', ')}`
  );
}

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

console.log('🚀 Starting button functionality test...');
console.log('📝 Commands:');
console.log('  !test-buttons vip     - Test VIP buttons');
console.log('  !test-buttons trial   - Test trial buttons');
console.log('  !test-buttons capper  - Test capper buttons');
console.log('  !test-buttons all     - Test all buttons');
