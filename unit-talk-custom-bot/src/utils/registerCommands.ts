import { REST, Routes } from 'discord.js';
import { botConfig } from '../config';
import * as helpCommand from '../commands/help';
import * as vipInfoCommand from '../commands/vip-info';
import * as edgeTrackerCommand from '../commands/edge-tracker';
import * as askUnitTalkCommand from '../commands/ask-unit-talk-enhanced';
import * as evReportCommand from '../commands/ev-report';
import * as trendBreakerCommand from '../commands/trend-breaker';
import * as triggerOnboardingCommand from '../commands/trigger-onboarding';

const commands = [
  helpCommand.data.toJSON(),
  vipInfoCommand.data.toJSON(),
  edgeTrackerCommand.data.toJSON(),
  askUnitTalkCommand.data.toJSON(),
  evReportCommand.data.toJSON(),
  trendBreakerCommand.data.toJSON(),
  triggerOnboardingCommand.data.toJSON(),
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