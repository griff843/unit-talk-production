import { ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_CONFIG } from '../config/commands';
import { logger } from '../utils/logger';
import { SupabaseService } from '../services/supabase';
import { getUserTier } from '../utils/roleUtils';
import { toGuildMember } from '../utils/discordUtils';

export class CommandHandler {
  private commands: Map<string, any> = new Map();
  private supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
    this.loadCommands();
  }

  private async loadCommands() {
    try {
      // Dynamically import all commands
      const commandFiles = Object.keys(COMMAND_CONFIG);
      for (const commandName of commandFiles) {
        if (!COMMAND_CONFIG[commandName].enabled) continue;

        try {
          const command = await import(`../commands/${commandName}`);
          this.commands.set(commandName, command);
          logger.info(`Loaded command: ${commandName}`);
        } catch (error) {
          logger.error(`Failed to load command ${commandName}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error loading commands:', error);
    }
  }

  public async handleCommand(interaction: ChatInputCommandInteraction) {
    const commandName = interaction.commandName;
    const command = this.commands.get(commandName);
    const config = COMMAND_CONFIG[commandName];

    if (!command || !config) {
      await interaction.reply({
        content: '❌ This command is not currently available.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Check if command requires Supabase
      if (config.supabaseRequired && !this.supabaseService.isInitialized()) {
        await interaction.reply({
          content: '❌ Database connection is not available. Please try again later.',
          ephemeral: true,
        });
        return;
      }

      // Get user's tier
      const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

      // Check permissions
      if (!this.hasPermission(userTier, config.allowedTiers)) {
        const tierName = userTier === 'member' ? 'Free' : userTier.toUpperCase();
        const requiredTier = this.getMinimumRequiredTier(config.allowedTiers);
        await interaction.reply({
          content: `❌ This command requires ${requiredTier} access. You currently have ${tierName} access.`,
          ephemeral: true,
        });
        return;
      }

      // Execute command
      await command.execute(interaction);

      // Log command usage
      logger.info(`Command executed: ${commandName}`, {
        userId: interaction.user.id,
        username: interaction.user.username,
        tier: userTier,
      });
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);

      // Handle the error gracefully
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your command.',
          ephemeral: true,
        });
      }
    }
  }

  private hasPermission(userTier: string, allowedTiers: string[]): boolean {
    if (allowedTiers.includes('all')) return true;
    if (userTier === 'owner') return true; // Owner can access everything

    // Handle tier hierarchy
    const tierHierarchy: { [key: string]: number } = {
      black_label: 4,
      vip_plus: 3,
      vip: 2,
      member: 1,
    };

    const userTierLevel = tierHierarchy[userTier] || 0;
    return allowedTiers.some(tier => {
      const requiredLevel = tierHierarchy[tier] || 0;
      return userTierLevel >= requiredLevel;
    });
  }

  private getMinimumRequiredTier(allowedTiers: string[]): string {
    if (allowedTiers.includes('all')) return 'Free';
    const tierDisplay: { [key: string]: string } = {
      black_label: 'Black Label',
      vip_plus: 'VIP+',
      vip: 'VIP',
      member: 'Free',
    };
    return tierDisplay[allowedTiers[0]] || allowedTiers[0].toUpperCase();
  }
}
