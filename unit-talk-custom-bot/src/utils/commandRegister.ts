import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';

// Extend Client type to include commands
interface ExtendedClient extends Client {
  commands?: Map<string, any>;
}

/**
 * Register slash commands with Discord
 */
export async function registerCommands(client: Client): Promise<void> {
  try {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, '../commands');
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsPath)) {
      logger.warn('Commands directory does not exist, creating it...');
      fs.mkdirSync(commandsPath, { recursive: true });
      return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.js') || file.endsWith('.ts')
    );

    // Load command files
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          
          // Add to client commands collection
          const extendedClient = client as ExtendedClient;
          if (!extendedClient.commands) {
            extendedClient.commands = new Map();
          }
          extendedClient.commands.set(command.data.name, command);
          
          logger.debug(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Command file ${file} is missing required "data" or "execute" property`);
        }
      } catch (error) {
        logger.error(`Error loading command file ${file}:`, error);
      }
    }

    // Register commands with Discord
    if (commands.length > 0) {
      const rest = new REST().setToken(botConfig.discord!.token);

      logger.info(`Started refreshing ${commands.length} application (/) commands.`);

      // Register commands globally or per guild
      if (botConfig.discord!.guildId) {
        // Guild-specific commands (faster for development)
        await rest.put(
          Routes.applicationGuildCommands(botConfig.discord!.clientId, botConfig.discord!.guildId),
          { body: commands }
        );
        logger.info(`Successfully reloaded ${commands.length} guild application (/) commands.`);
      } else {
        // Global commands (takes up to 1 hour to propagate)
        await rest.put(
          Routes.applicationCommands(botConfig.discord!.clientId),
          { body: commands }
        );
        logger.info(`Successfully reloaded ${commands.length} global application (/) commands.`);
      }
    } else {
      logger.info('No commands found to register.');
    }

  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}

/**
 * Create basic command templates
 */
export function createBasicCommands(): Array<{ name: string; data: any; description: string }> {
  return [
    {
      name: 'ping',
      data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
      description: 'Basic ping command to test bot responsiveness'
    },
    {
      name: 'stats',
      data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your betting statistics')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to view stats for (optional)')
            .setRequired(false)
        ),
      description: 'Display user betting statistics and performance metrics'
    },
    {
      name: 'picks',
      data: new SlashCommandBuilder()
        .setName('picks')
        .setDescription('View recent picks')
        .addStringOption(option =>
          option.setName('sport')
            .setDescription('Filter by sport')
            .setRequired(false)
            .addChoices(
              { name: 'NFL', value: 'nfl' },
              { name: 'NBA', value: 'nba' },
              { name: 'MLB', value: 'mlb' },
              { name: 'NHL', value: 'nhl' },
              { name: 'NCAAF', value: 'ncaaf' },
              { name: 'NCAAB', value: 'ncaab' }
            )
        )
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of picks to show (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        ),
      description: 'Display recent sports picks with filtering options'
    },
    {
      name: 'leaderboard',
      data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the leaderboard')
        .addStringOption(option =>
          option.setName('timeframe')
            .setDescription('Timeframe for leaderboard')
            .setRequired(false)
            .addChoices(
              { name: 'All Time', value: 'all' },
              { name: 'This Month', value: 'month' },
              { name: 'This Week', value: 'week' },
              { name: 'Today', value: 'today' }
            )
        )
        .addStringOption(option =>
          option.setName('metric')
            .setDescription('Metric to rank by')
            .setRequired(false)
            .addChoices(
              { name: 'Win Rate', value: 'winrate' },
              { name: 'ROI', value: 'roi' },
              { name: 'Total Units', value: 'units' },
              { name: 'Total Picks', value: 'picks' }
            )
        ),
      description: 'Display leaderboard rankings with various metrics and timeframes'
    },
    {
      name: 'submit',
      data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit a new pick (VIP+ only)')
        .addStringOption(option =>
          option.setName('sport')
            .setDescription('Sport for the pick')
            .setRequired(true)
            .addChoices(
              { name: 'NFL', value: 'nfl' },
              { name: 'NBA', value: 'nba' },
              { name: 'MLB', value: 'mlb' },
              { name: 'NHL', value: 'nhl' },
              { name: 'NCAAF', value: 'ncaaf' },
              { name: 'NCAAB', value: 'ncaab' }
            )
        )
        .addStringOption(option =>
          option.setName('teams')
            .setDescription('Teams/matchup (e.g., "Chiefs vs Bills")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('pick')
            .setDescription('Your pick (e.g., "Chiefs -3.5")')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option.setName('units')
            .setDescription('Units to bet (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addStringOption(option =>
          option.setName('odds')
            .setDescription('Odds (e.g., "-110", "+150")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('book')
            .setDescription('Sportsbook')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Additional notes (optional)')
            .setRequired(false)
        ),
      description: 'Submit a new sports pick (requires VIP+ access)'
    },
    {
      name: 'help',
      data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help information'),
      description: 'Display help information and available commands'
    }
  ];
}