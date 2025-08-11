const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function registerBasicCommands() {
  console.log('🔧 Registering Basic Discord Slash Commands...\n');

  // Define basic commands manually to avoid TypeScript compilation issues
  const commands = [
    {
      name: 'ping',
      description: 'Replies with Pong! and shows latency information',
    },
    {
      name: 'help',
      description: 'Shows available commands and bot information',
    },
    {
      name: 'stats',
      description: 'Shows bot and server statistics',
    },
  ];

  console.log(`🚀 Registering ${commands.length} basic commands with Discord...`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    // Register to guild for immediate testing
    console.log('⚡ Registering guild commands for immediate testing...');
    const guildData = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log(`✅ Successfully registered ${guildData.length} guild commands.`);

    // Also register globally
    console.log('📡 Registering global commands...');
    const globalData = await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log(`✅ Successfully registered ${globalData.length} global commands.`);

    console.log('\n🎉 Command registration complete!');
    console.log('💡 Guild commands are available immediately in your server.');
    console.log('💡 Global commands may take up to 1 hour to appear in other servers.');
    console.log('\n📋 Registered commands:');
    commands.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    if (error.code === 50001) {
      console.error('💡 This error usually means the bot lacks "applications.commands" scope.');
      console.error('💡 Please re-invite the bot with the correct permissions.');
    }
  }
}

registerBasicCommands();
