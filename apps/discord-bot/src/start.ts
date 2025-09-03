import { registerCommands } from './utils/registerCommands';

async function startBot() {
  try {
    console.log('🚀 Starting Unit Talk Discord Bot...');

    // Register slash commands first
    await registerCommands();

    console.log('✅ Commands registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    // Continue anyway - the bot can still work with existing commands
  }
}

// Register commands and then let the main index.ts handle bot startup
startBot();
