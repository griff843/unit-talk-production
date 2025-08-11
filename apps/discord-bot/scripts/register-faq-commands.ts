#!/usr/bin/env node

/**
 * Command registration script for Unit Talk Discord Bot
 * This script registers all slash commands with Discord
 */

import 'dotenv/config';
import { registerCommands } from '../src/utils/commandRegister';
import { Client, GatewayIntentBits } from 'discord.js';
import { logger } from '../src/utils/logger';

async function main() {
  console.log('🚀 Starting command registration...');

  // Create a temporary client for command registration
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');

    // Register commands
    await registerCommands(client);
    console.log('✅ Commands registered successfully');

    // Logout
    await client.destroy();
    console.log('✅ Disconnected from Discord');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    logger.error('Error registering commands:', error);
    process.exit(1);
  }
}

main();
