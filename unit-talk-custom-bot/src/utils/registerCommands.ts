import { REST, Routes } from 'discord.js';
import { botConfig } from '../config';
import { helpCommand } from '../commands/help';
import { vipInfoCommand } from '../commands/vip-info';
import { trialStatusCommand } from '../commands/trial-status';
import { upgradeCommand } from '../commands/upgrade';
import { heatSignalCommand } from '../commands/heat-signal';
import * as edgeTrackerCommand from '../commands/edge-tracker';
import * as askUnitTalkCommand from '../commands/ask-unit-talk';

const commands = [
  helpCommand.data.toJSON(),
  vipInfoCommand.data.toJSON(),
  trialStatusCommand.data.toJSON(),
  upgradeCommand.data.toJSON(),
  heatSignalCommand.data.toJSON(),
  edgeTrackerCommand.data.toJSON(),
  askUnitTalkCommand.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(botConfig.discord.token);

export async function registerCommands() {
  try {
    console.log('🔄 Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(botConfig.discord.clientId, botConfig.discord.guildId),
      { body: commands },
    );

    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}