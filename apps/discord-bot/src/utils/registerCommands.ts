import { REST, Routes } from 'discord.js';

import * as commandModules from '../commands';
import { botConfig } from '../config';
import { COMMAND_CONFIG } from '../config/commands';

import { logger } from './logger';

// Import all commands

const commands = Object.entries(COMMAND_CONFIG)
  .filter(([_, config]) => config.enabled)
  .map(([commandName, _]) => {
    const command = (commandModules as any)[commandName];
    if (!command?.data) {
      logger.warn(`Command ${commandName} is enabled in config but implementation not found`);
      return null;
    }
    return command.data.toJSON();
  })
  .filter(Boolean);

const rest = new REST({ version: '10' }).setToken(botConfig.discord!.token);

export async function registerCommands() {
  try {
    logger.info('Started refreshing application (/) commands.');
    logger.info(`Registering ${commands.length} commands...`);

    await rest.put(
      Routes.applicationGuildCommands(botConfig.discord!.clientId, botConfig.discord!.guildId),
      { body: commands }
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}
