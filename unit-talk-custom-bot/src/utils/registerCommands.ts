import { REST, Routes } from 'discord.js';
import * as pingCommand from '../commands/ping';
import * as upgradeCommand from '../commands/upgrade';
import * as statsCommand from '../commands/stats';
import * as pickCommand from '../commands/pick';
import * as enhancedPickCommand from '../commands/enhanced-pick';
import * as askAiCommand from '../commands/ask-ai';
import * as recapCommand from '../commands/recap';
import * as rolesCommand from '../commands/roles';
import * as testOnboardingCommand from '../commands/test-onboarding';
import * as debugTierCommand from '../commands/debug-tier';
import * as trialStatusCommand from '../commands/trial-status';
import * as capperOnboardCommand from '../commands/capper-onboard';
import * as capperStatsCommand from '../commands/capper-stats';
import * as capperLeaderCommand from '../commands/capper-leader';
import * as samplePicksCommand from '../commands/sample-picks';
import * as topPlaysCommand from '../commands/top-plays';
import * as heatSignalCommand from '../commands/heat-signal';
import * as edgeTrackerCommand from '../commands/edge-tracker';
import * as alertsSetupCommand from '../commands/alerts-setup';
import * as editPickCommand from '../commands/edit-pick';
import * as deletePickCommand from '../commands/delete-pick';
import * as deployContentCommand from '../commands/deploy-content';
import config from '../../config.json';

const botConfig = {
  discord: {
    token: process.env['DISCORD_BOT_TOKEN'] || '',
    clientId: config.bot.clientid,
    guildId: config.discord.guildid
  }
};

const commands = [
  pingCommand.data.toJSON(),
  upgradeCommand.data.toJSON(),
  statsCommand.data.toJSON(),
  pickCommand.data.toJSON(),
  enhancedPickCommand.data.toJSON(),
  askAiCommand.data.toJSON(),
  recapCommand.data.toJSON(),
  rolesCommand.data.toJSON(),
  testOnboardingCommand.data.toJSON(),
  debugTierCommand.data.toJSON(),
  trialStatusCommand.data.toJSON(),
  capperOnboardCommand.data.toJSON(),
  capperStatsCommand.data.toJSON(),
  capperLeaderCommand.data.toJSON(),
  samplePicksCommand.data.toJSON(),
  topPlaysCommand.data.toJSON(),
  heatSignalCommand.data.toJSON(),
  edgeTrackerCommand.data.toJSON(),
  alertsSetupCommand.data.toJSON(),
  editPickCommand.data.toJSON(),
  deletePickCommand.data.toJSON(),
  deployContentCommand.data.toJSON(),
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