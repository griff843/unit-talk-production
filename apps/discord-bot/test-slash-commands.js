const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function testSlashCommands() {
  console.log('🧪 Testing Slash Command Response...\n');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once('ready', () => {
    console.log(`✅ Test bot logged in as: ${client.user.tag}`);
    console.log('🎯 Listening for slash command interactions...\n');
  });

  client.on('interactionCreate', async interaction => {
    console.log('🔔 Interaction received!');
    console.log(`   Type: ${interaction.type}`);
    console.log(`   Is Command: ${interaction.isCommand()}`);

    if (interaction.isCommand()) {
      console.log(`   Command Name: ${interaction.commandName}`);
      console.log('   Attempting to reply...');

      try {
        await interaction.reply({
          content: `🏓 Test response to /${interaction.commandName}!\nBot is working correctly!`,
          ephemeral: true,
        });
        console.log('   ✅ Reply sent successfully!');
      } catch (error) {
        console.log('   ❌ Failed to reply:', error.message);
      }
    }
  });

  await client.login(process.env.DISCORD_TOKEN);

  console.log('💡 Now try using a slash command in Discord...');
  console.log('💡 Press Ctrl+C to stop the test');
}

testSlashCommands().catch(console.error);
