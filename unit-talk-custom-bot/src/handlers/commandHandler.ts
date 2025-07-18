import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { Client, Message, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PermissionsService } from '../services/permissions';
import { createUserProfileEmbed } from '../utils/embeds';
import { CommandContext } from '../types/index';
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
  async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

        case 'profile':
          await this.handleProfileCommand(context);
          break;

        case 'stats':
          await this.handleStatsCommand(context);
          break;

        case 'leaderboard':
          await this.handleLeaderboardCommand(context);
          break;

        case 'trial-status':
          await this.handleTrialStatusCommand(context);
          break;

        case 'upgrade':
          await this.handleUpgradeCommand(context);
          break;

        case 'test-onboarding':
          {
            const testOnboardingModule = await import('../commands/test-onboarding');
            await testOnboardingModule.execute(interaction, this.services);
          }
          break;

        case 'deploy-content':
          {
            const deployContentModule = await import('../commands/deploy-content');
            await deployContentModule.execute(interaction);
          }
          break;

        case 'roles':
          {
            const rolesModule = await import('../commands/roles');
            await rolesModule.execute(interaction);
          }
          break;

        case 'heat-signal':
          await this.handleHeatSignalCommand(context);
          break;

        case 'edge-tracker':
          {
            const edgeTrackerModule = await import('../commands/edge-tracker');
            await edgeTrackerModule.execute(interaction);
          }
          break;

        case 'ask-ai':
          {
            const askAiModule = await import('../commands/ask-ai');
            await askAiModule.execute(interaction);
          }
          break;

        case 'sample-picks':
          {
            const samplePicksModule = await import('../commands/sample-picks');
            await samplePicksModule.execute(interaction);
          }
          break;

        case 'recap':
          {
            const recapModule = await import('../commands/recap');
            await recapModule.execute(interaction);
          }
          break;

        case 'capper-leader':
          {
            const capperLeaderModule = await import('../commands/capper-leader');
            await capperLeaderModule.execute(interaction);
          }
          break;

        case 'alerts-setup':
          {
            const alertsSetupModule = await import('../commands/alerts-setup');
            await alertsSetupModule.execute(interaction);
          }
          break;

        case 'top-plays':
          {
            const topPlaysModule = await import('../commands/top-plays');
            await topPlaysModule.execute(interaction);
          }
          break;





        case 'pick':
          await this.handlePickCommand(context);
          break;

        case 'submit-pick':
          await this.handleCapperCommand(context, 'submit-pick');
          break;

        case 'capper-onboard':
          await this.handleCapperCommand(context, 'capper-onboard');
          break;

        case 'edit-pick':
          await this.handleCapperCommand(context, 'edit-pick');
          break;

        case 'delete-pick':
          await this.handleCapperCommand(context, 'delete-pick');
          break;

        case 'capper-stats':
          await this.handleCapperCommand(context, 'capper-stats');
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

        case 'faq-add':
          await this.handleFAQAddCommand(context);
          break;

        case 'faq-edit':
          await this.handleFAQEditCommand(context);
          break;

        case 'faq-init':
          await this.handleFAQInitCommand(context);
          break;

        case 'faq-bulk-update':
          await this.handleFAQBulkUpdateCommand(context);
          break;

        default:
          await interaction.reply({
            content: '❌ Unknown command.',
            ephemeral: true
          });
      }

    } catch (error) {
      logger.error('Error handling slash command:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while processing your command.',
            ephemeral: true
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ An error occurred while processing your command.'
          });
        }
        // If already replied, we can't send another response
      } catch (replyError) {
        logger.error('Error sending error response:', replyError);
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

    const response = `🏓 Pong!\n**Bot Latency:** ${ping}ms\n**Uptime:** ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    await interaction.reply({ content: response, ephemeral: true });
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

      const statsEmbed = new EmbedBuilder()
        .setTitle('📊 Bot Statistics')
        .setDescription('Current bot performance metrics')
        .addFields(
          { name: 'Total Users', value: stats?.totalUsers?.toString() || '0', inline: true },
          { name: 'Active Today', value: stats?.activeToday?.toString() || '0', inline: true },
          { name: 'Commands Used', value: stats?.commandsUsed?.toString() || '0', inline: true },
          { name: 'Last Updated', value: stats?.timestamp || 'Unknown', inline: false }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({
        embeds: [statsEmbed],
        ephemeral: true
      });
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      await interaction.reply({
        content: '❌ Error retrieving bot statistics.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle leaderboard command
   */
  private async handleLeaderboardCommand(context: CommandContext): Promise<void> {
    const { interaction } = context;

    if (!interaction) {
      return;
    }

    try {
      // Get leaderboard data from analytics service
      const leaderboardData = await this.services.advancedAnalyticsService.getLeaderboard();

      const leaderboardEmbed = new EmbedBuilder()
        .setTitle('🏆 Unit Talk Leaderboard')
        .setDescription('Top performers this month')
        .setColor(0xffd700)
        .setTimestamp();

      if (leaderboardData && leaderboardData.length > 0) {
        leaderboardData.forEach((entry: any, index: number) => {
          leaderboardEmbed.addFields({
            name: `${index + 1}. ${entry.username || 'Unknown'}`,
            value: `Score: ${entry.score || 0} | Wins: ${entry.wins || 0}`,
            inline: false
          });
        });
      } else {
        leaderboardEmbed.addFields({
          name: 'No data',
          value: 'Leaderboard data not available',
          inline: false
        });
      }

      await interaction.reply({
        embeds: [leaderboardEmbed],
        ephemeral: true
      });
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      await interaction.reply({
        content: '❌ Error retrieving leaderboard data.',
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



  /**
   * Handle trial status command
   */
  private async handleTrialStatusCommand(context: CommandContext): Promise<void> {
    if (!context.interaction) return;
    const { execute } = await import('../commands/trial-status');
    await execute(context.interaction);
  }

  /**
   * Handle upgrade command
   */
  private async handleUpgradeCommand(context: CommandContext): Promise<void> {
    if (!context.interaction) return;
    const { execute } = await import('../commands/upgrade');
    await execute(context.interaction);
  }


  /**
   * Handle heat signal command
   */
  private async handleHeatSignalCommand(context: CommandContext): Promise<void> {
    if (!context.interaction) return;
    const { execute } = await import('../commands/heat-signal');
    await execute(context.interaction);
  }

  /**
   * Handle profile command
   */
  private async handleProfileCommand(context: CommandContext): Promise<void> {
    const { interaction, userProfile } = context;

    if (!interaction) {
      return;
    }

    try {
      if (!userProfile) {
        await interaction.reply({
          content: '❌ Could not retrieve your profile information.',
          ephemeral: true
        });
        return;
      }

      // Create profile embed with proper type handling
      const profileData = {
        ...userProfile,
        tier: (userProfile as any).tier || 'member', // Type assertion for tier
        display_name: (userProfile as any).display_name || context.user.username,
        total_messages: (userProfile as any).total_messages || 0,
        join_date: (userProfile as any).join_date || new Date().toISOString().toISOString()
      };

      const embed = createUserProfileEmbed(profileData as any);

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error handling profile command:', error);
      await interaction.reply({
        content: '❌ An error occurred while retrieving your profile.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle edge-tracker command (VIP+ only)
   */
  private async handleEdgeTrackerCommand(context: CommandContext): Promise<void> {
    const { execute } = await import('../commands/edge-tracker');
    await execute(context.interaction as any);
  }

  /**
   * Handle ask-unit-talk command (VIP+ only)
   */
  // Removed handleAskUnitTalk method as the command was deleted





  /**
   * Handle capper commands
   */
  private async handleCapperCommand(context: CommandContext, commandName: string): Promise<void> {
    try {
      // Check if interaction exists
      if (!context.interaction) {
        logger.error('No interaction found in context for capper command');
        return;
      }

      // Import the capper interaction handler
      const { handleCapperInteraction } = await import('../handlers/capperInteractionHandler');
      await handleCapperInteraction(context.interaction, this.services.capperSystem);
    } catch (error) {
      logger.error(`Error handling capper command ${commandName}:`, error);

      if (context.interaction && !context.interaction.replied && !context.interaction.deferred) {
        await context.interaction.reply({
          content: '❌ An error occurred while processing your capper command.',
          ephemeral: true
        });
      }
    }

  }

  /**
   * Handle faq-add command (Staff only)
   */
  private async handleFAQAddCommand(context: CommandContext): Promise<void> {
    const { execute } = await import('../commands/faq-add');
    await execute(context.interaction as any);
  }

  /**
   * Handle faq-edit command (Staff only)
   */
  private async handleFAQEditCommand(context: CommandContext): Promise<void> {
    const { execute } = await import('../commands/faq-edit');
    await execute(context.interaction as any);
  }

  /**
   * Handle faq-init command (Admin only)
   */
  private async handleFAQInitCommand(context: CommandContext): Promise<void> {
    const { execute } = await import('../commands/faq-init');
    await execute(context.interaction as any);
  }

  /**
   * Handle faq-bulk-update command (Admin only)
   */
  private async handleFAQBulkUpdateCommand(context: CommandContext): Promise<void> {
    const { default: command } = await import('../commands/faq-bulk-update');
    await command.execute(context.interaction as any);
  }
}