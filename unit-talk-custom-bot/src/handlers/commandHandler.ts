import { Client, Message, CommandInteraction, ButtonInteraction, SelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PermissionsService } from '../services/permissions';
import { CommandContext } from '../types';
import { logger } from '../utils/logger';

export class CommandHandler {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private services: any;

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    services: any
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.services = services;
  }

  /**
   * Handle slash commands
   */
  async handleSlashCommand(interaction: CommandInteraction): Promise<void> {
    try {
      const { commandName } = interaction;

      // Get user permissions and profile
      const member = interaction.member as import('discord.js').GuildMember;
      if (!member) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const permissions = await this.permissionsService.getUserPermissions(member);
      const userProfile = (await this.supabaseService.getUserProfile(interaction.user.id)) || undefined;

      const context: CommandContext = {
        interaction,
        user: interaction.user,
        member,
        channel: interaction.channel,
        guild: interaction.guild || undefined,
        permissions,
        userProfile
      };

      // Route commands
      switch (commandName) {
        case 'ping':
          await this.handlePingCommand(context);
          break;
        
        case 'pick':
          await this.handlePickCommand(context);
          break;
        
        case 'stats':
          await this.handleStatsCommand(context);
          break;
        
        case 'admin':
          await this.handleAdminCommand(context);
          break;
        
        case 'analytics':
          await this.handleAnalyticsCommand(context);
          break;
        
        case 'ai-grade':
          await this.handleAIGradeCommand(context);
          break;
        
        case 'ai-coach':
          await this.handleAICoachCommand(context);
          break;
        
        case 'config':
          await this.handleConfigCommand(context);
          break;
        
        case 'override':
          await this.handleOverrideCommand(context);
          break;
        
        default:
          await interaction.reply({
            content: '❌ Unknown command.',
            ephemeral: true
          });
      }

    } catch (error) {
      logger.error('Error handling slash command:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your command.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Handle ping command
   */
  private async handlePingCommand(context: CommandContext): Promise<void> {
    const { interaction } = context;

    if (!interaction) {
      return;
    }

    const ping = this.client.ws.ping;
    const uptime = process.uptime();

    await interaction.reply({
      content: `🏓 Pong!\n**Bot Latency:** ${ping}ms\n**Uptime:** ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      ephemeral: true
    });
  }

  /**
   * Handle pick command
   */
  private async handlePickCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!interaction) {
      return;
    }

    if (!permissions?.canUseCommand) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
      return;
    }

    // Handle pick submission logic here
    await interaction.reply({
      content: '🏈 Pick submission feature coming soon!',
      ephemeral: true
    });
  }

  /**
   * Handle stats command
   */
  private async handleStatsCommand(context: CommandContext): Promise<void> {
    const { interaction } = context;

    if (!interaction) {
      return;
    }

    try {
      const stats = await this.services.advancedAnalyticsService.getRealTimeStats();

      await interaction.reply({
        embeds: [{
          title: '📊 Bot Statistics',
          fields: [
            { name: 'Active Users', value: stats.activeUsers.toString(), inline: true },
            { name: 'Total Messages', value: stats.totalMessages.toString(), inline: true },
            { name: 'Picks Submitted', value: stats.picksSubmitted.toString(), inline: true },
            { name: 'Threads Created', value: stats.threadsCreated.toString(), inline: true },
            { name: 'DMs Sent', value: stats.dmsSent.toString(), inline: true },
            { name: 'Commands Executed', value: stats.commandsExecuted.toString(), inline: true }
          ],
          color: 0x00ff00,
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      await interaction.reply({
        content: '❌ Failed to retrieve statistics.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle admin command
   */
  private async handleAdminCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!interaction) {
      return;
    }

    if (!permissions?.isAdmin) {
      await interaction.reply({
        content: '❌ You do not have admin permissions.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: '🔧 Admin panel feature coming soon!',
      ephemeral: true
    });
  }

  /**
   * Handle analytics command
   */
  private async handleAnalyticsCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!interaction) {
      return;
    }

    if (!permissions?.canViewAnalytics) {
      await interaction.reply({
        content: '❌ You do not have permission to view analytics.',
        ephemeral: true
      });
      return;
    }

    try {
      const dashboard = await this.services.advancedAnalyticsService.generateDashboard(
        interaction.user.id,
        permissions.isOwner ? 'owner' : 'staff'
      );

      await interaction.reply({
        content: '📈 Analytics dashboard generated!',
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error generating analytics:', error);
      await interaction.reply({
        content: '❌ Failed to generate analytics dashboard.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle AI grade command
   */
  private async handleAIGradeCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!interaction) {
      return;
    }

    if (!permissions?.canUseCommand) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: '🤖 AI grading feature coming soon!',
      ephemeral: true
    });
  }

  /**
   * Handle AI coach command
   */
  private async handleAICoachCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions, userProfile } = context;

    if (!interaction) {
      return;
    }

    if (!userProfile || userProfile.tier === 'member') {
      await interaction.reply({
        content: '❌ AI coaching is only available for VIP+ members.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: '🎯 AI coaching feature coming soon!',
      ephemeral: true
    });
  }

  /**
   * Handle config command
   */
  private async handleConfigCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!interaction) {
      return;
    }

    if (!permissions?.canEditConfig) {
      await interaction.reply({
        content: '❌ You do not have permission to edit configuration.',
        ephemeral: true
      });
      return;
    }

    try {
      await this.services.quickEditConfigService.startQuickEditSession(
        interaction.user.id,
        'general'
      );

      await interaction.reply({
        content: '⚙️ Configuration editor started!',
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error starting config session:', error);
      await interaction.reply({
        content: '❌ Failed to start configuration session.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle override command
   */
  private async handleOverrideCommand(context: CommandContext): Promise<void> {
    const { interaction, permissions } = context;

    if (!permissions || !interaction) {
      return;
    }

    if (!permissions.isAdmin) {
      await interaction.reply({
        content: '❌ You do not have admin permissions.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: '🔐 Admin override feature coming soon!',
      ephemeral: true
    });
  }

  /**
   * Handle message-based commands (legacy support)
   */
  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    try {
      // Get user permissions and profile
      const member = message.member as import('discord.js').GuildMember;
      const permissions = await this.permissionsService.getUserPermissions(member);
      const userProfile = await this.supabaseService.getUserProfile(message.author.id);

      const context: CommandContext = {
        interaction: undefined,
        user: message.author,
        member: message.member as import('discord.js').GuildMember,
        channel: message.channel,
        guild: message.guild || undefined,
        permissions,
        userProfile: userProfile || undefined
      };

      // Handle legacy commands
      switch (command) {
        case 'ping':
          await message.reply('🏓 Pong! Use `/ping` for detailed info.');
          break;
        
        case 'help':
          await message.reply('ℹ️ Use slash commands like `/ping`, `/stats`, `/pick` etc.');
          break;
        
        default:
          // Don't respond to unknown legacy commands
          break;
      }

    } catch (error) {
      logger.error('Error handling message command:', error);
    }
  }
}