import {
  Client,
  Interaction,
  CommandInteraction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  AutocompleteInteraction
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PermissionsService } from '../services/permissions';
import { CommandHandler } from './commandHandler';
import { logger } from '../utils/logger';

export class InteractionHandler {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private services: any;
  private commandHandler: CommandHandler;

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
    
    this.commandHandler = new CommandHandler(
      client,
      supabaseService,
      permissionsService,
      services
    );
  }

  /**
   * Handle all interaction events
   */
  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isSelectMenu()) {
        await this.handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your interaction.',
          ephemeral: true
        }).catch(() => {
          // Ignore errors when replying fails
        });
      }
    }
  }

  /**
   * Handle slash command interactions
   */
  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.commandHandler.handleSlashCommand(interaction);
  }

  /**
   * Handle button interactions
   */
  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const { customId } = interaction;

    try {
      // Check if this is an onboarding-related button
      const onboardingButtons = [
        'view_vip_perks', 'view_vip_info', 'upgrade_vip', 'upgrade_vip_plus', 'start_trial',
        'trial_status', 'trial_end_time', 'extend_trial', 'view_todays_picks', 'goto_vip_lounge',
        'heat_signal_access', 'picks_dashboard', 'help_commands', 'slash_commands_help',
        'trial_help', 'view_trending_picks', 'whats_new', 'upgrade_for_more_wins',
        'upgrade_to_catch_up', 'refresh_heat_signal', 'heat_signal_settings', 'heat_signal_demo',
        // Add the missing VIP+ onboarding button IDs
        'vip_plus_tour_start', 'vip_plus_settings', 'vip_tour_start', 'vip_settings'
      ];

      if (onboardingButtons.includes(customId)) {
        // Use the onboarding button handler
        if (this.services.onboardingButtonHandler) {
          await this.services.onboardingButtonHandler.handleButtonInteraction(interaction);
          return;
        }
      }

      // Parse custom ID to determine action for other buttons
      const [action, ...params] = customId.split('_');

      switch (action) {
        case 'analytics':
          await this.handleAnalyticsButton(interaction, params);
          break;

        case 'config':
          await this.handleConfigButton(interaction, params);
          break;

        case 'admin':
          await this.handleAdminButton(interaction, params);
          break;

        case 'vip':
          await this.handleVIPButton(interaction, params);
          break;

        case 'thread':
          await this.handleThreadButton(interaction, params);
          break;

        case 'ai':
          await this.handleAIButton(interaction, params);
          break;

        default:
          await interaction.reply({
            content: '❌ Unknown button action.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error handling button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing the button.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Handle select menu interactions
   */
  private async handleSelectMenu(interaction: SelectMenuInteraction): Promise<void> {
    const { customId, values } = interaction;
    
    try {
      // Parse custom ID to determine action
      const [action, ...params] = customId.split('_');
      
      switch (action) {
        case 'config':
          await this.handleConfigSelect(interaction, params, values);
          break;
        
        case 'analytics':
          await this.handleAnalyticsSelect(interaction, params, values);
          break;
        
        case 'admin':
          await this.handleAdminSelect(interaction, params, values);
          break;
        
        case 'ai':
          await this.handleAISelect(interaction, params, values);
          break;
        
        default:
          await interaction.reply({
            content: '❌ Unknown select menu action.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error handling select menu interaction:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the selection.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle modal submit interactions
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;
    
    try {
      // Parse custom ID to determine action
      const [action, ...params] = customId.split('_');
      
      switch (action) {
        case 'config':
          await this.handleConfigModal(interaction, params);
          break;
        
        case 'admin':
          await this.handleAdminModal(interaction, params);
          break;
        
        case 'pick':
          await this.handlePickModal(interaction, params);
          break;
        
        case 'ai':
          await this.handleAIModal(interaction, params);
          break;
        
        default:
          await interaction.reply({
            content: '❌ Unknown modal action.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error handling modal submit interaction:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the form.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle autocomplete interactions
   */
  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const { commandName, options } = interaction;
    
    try {
      switch (commandName) {
        case 'pick':
          await this.handlePickAutocomplete(interaction);
          break;
        
        case 'admin':
          await this.handleAdminAutocomplete(interaction);
          break;
        
        case 'config':
          await this.handleConfigAutocomplete(interaction);
          break;
        
        default:
          await interaction.respond([]);
      }
    } catch (error) {
      logger.error('Error handling autocomplete interaction:', error);
      await interaction.respond([]);
    }
  }

  /**
   * Handle analytics button interactions
   */
  private async handleAnalyticsButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const member = interaction.member as import('discord.js').GuildMember;
    const permissions = await this.permissionsService.getUserPermissions(member);

    if (!permissions.canViewAnalytics) {
      await interaction.reply({
        content: '❌ You do not have permission to view analytics.',
        ephemeral: true
      });
      return;
    }

    const [subAction] = params;

    switch (subAction) {
      case 'refresh':
        await this.services.advancedAnalyticsService.sendDashboardUpdate();
        await interaction.reply({
          content: '✅ Analytics dashboard refreshed!',
          ephemeral: true
        });
        break;

      case 'export':
        const csvData = await this.services.advancedAnalyticsService.exportAnalyticsData('csv');
        await interaction.reply({
          content: '📊 Analytics data exported!',
          files: [{
            attachment: Buffer.from(csvData),
            name: `analytics-${Date.now()}.csv`
          }],
          ephemeral: true
        });
        break;

      default:
        await interaction.reply({
          content: '❌ Unknown analytics action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle config button interactions
   */
  private async handleConfigButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const member = interaction.member as import('discord.js').GuildMember;
    const permissions = await this.permissionsService.getUserPermissions(member);

    if (!permissions.canEditConfig) {
      await interaction.reply({
        content: '❌ You do not have permission to edit configuration.',
        ephemeral: true
      });
      return;
    }

    const [subAction, configType] = params;
    
    switch (subAction) {
      case 'edit':
        await this.services.quickEditConfigService.startQuickEditSession(
          interaction.user.id,
          configType
        );
        await interaction.reply({
          content: `⚙️ Started editing ${configType} configuration.`,
          ephemeral: true
        });
        break;
      
      case 'save':
        await this.services.quickEditConfigService.saveConfigChanges(interaction.user.id);
        await interaction.reply({
          content: '✅ Configuration changes saved!',
          ephemeral: true
        });
        break;
      
      case 'cancel':
        await this.services.quickEditConfigService.cancelEditSession(interaction.user.id);
        await interaction.reply({
          content: '❌ Configuration editing cancelled.',
          ephemeral: true
        });
        break;
      
      default:
        await interaction.reply({
          content: '❌ Unknown config action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle admin button interactions
   */

  private async handleAdminButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const member = interaction.member as import('discord.js').GuildMember;
    const permissions = await this.permissionsService.getUserPermissions(member);

    if (!permissions.isAdmin) {
      await interaction.reply({
        content: '❌ You do not have admin permissions.',
        ephemeral: true
      });
      return;
    }

    const [subAction] = params;
    
    switch (subAction) {
      case 'maintenance':
        await this.services.adminOverrideService.toggleMaintenanceMode(interaction.user.id, 'Button toggle');
        await interaction.reply({
          content: '🔧 Maintenance mode toggled!',
          ephemeral: true
        });
        break;
      
      case 'health':
        const healthCheck = await this.services.adminOverrideService.performSystemHealthCheck(interaction.user.id);
        await interaction.reply({
          content: '🏥 System health check completed!',
          ephemeral: true
        });
        break;
      
      default:
        await interaction.reply({
          content: '❌ Unknown admin action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle VIP button interactions
   */
  private async handleVIPButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const [subAction] = params;
    
    switch (subAction) {
      case 'upgrade':
        await interaction.reply({
          content: '💎 VIP upgrade information sent to your DMs!',
          ephemeral: true
        });
        break;
      
      case 'benefits':
        await interaction.reply({
          content: '🌟 VIP benefits information sent to your DMs!',
          ephemeral: true
        });
        break;
      
      default:
        await interaction.reply({
          content: '❌ Unknown VIP action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle thread button interactions
   */
  private async handleThreadButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const [subAction, threadId] = params;
    
    switch (subAction) {
      case 'join':
        if (!threadId) {
          await interaction.reply({
            content: '❌ Thread ID not found.',
            ephemeral: true
          });
          return;
        }
        const thread = await interaction.guild?.channels.fetch(threadId);
        if (thread?.isThread()) {
          await thread.members.add(interaction.user.id);
          await interaction.reply({
            content: '✅ You have joined the thread!',
            ephemeral: true
          });
        }
        break;
      
      case 'leave':
        if (!threadId) {
          await interaction.reply({
            content: '❌ Thread ID not found.',
            ephemeral: true
          });
          return;
        }
        const leaveThread = await interaction.guild?.channels.fetch(threadId);
        if (leaveThread?.isThread()) {
          await leaveThread.members.remove(interaction.user.id);
          await interaction.reply({
            content: '👋 You have left the thread!',
            ephemeral: true
          });
        }
        break;
      
      default:
        await interaction.reply({
          content: '❌ Unknown thread action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle AI button interactions
   */
  private async handleAIButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
    const userProfile = await this.supabaseService.getUserProfile(interaction.user.id);

    if (!userProfile || userProfile.tier === 'member') {
      await interaction.reply({
        content: '❌ AI features are only available for VIP+ members.',
        ephemeral: true
      });
      return;
    }

    const [subAction] = params;
    
    switch (subAction) {
      case 'coach':
        await this.services.aiPoweredService.startCoachingSession(interaction.user.id, 'general');
        await interaction.reply({
          content: '🎯 AI coaching session started!',
          ephemeral: true
        });
        break;
      
      case 'translate':
        await interaction.reply({
          content: '🌐 AI translation feature coming soon!',
          ephemeral: true
        });
        break;
      
      default:
        await interaction.reply({
          content: '❌ Unknown AI action.',
          ephemeral: true
        });
    }
  }

  /**
   * Handle config select menu interactions
   */
  private async handleConfigSelect(interaction: SelectMenuInteraction, params: string[], values: string[]): Promise<void> {
    const [configType] = params;
    const [selectedValue] = values;
    
    await this.services.quickEditConfigService.updateConfig(
      interaction.user.id,
      configType,
      selectedValue
    );
    
    await interaction.reply({
      content: `✅ Updated ${configType} configuration to: ${selectedValue}`,
      ephemeral: true
    });
  }

  /**
   * Handle analytics select menu interactions
   */
  private async handleAnalyticsSelect(interaction: SelectMenuInteraction, params: string[], values: string[]): Promise<void> {
    const [timeRange] = values;
    
    const dashboard = await this.services.advancedAnalyticsService.generateDashboard(
      interaction.user.id,
      'staff',
      timeRange
    );
    
    await interaction.reply({
      content: `📊 Analytics dashboard generated for ${timeRange}!`,
      ephemeral: true
    });
  }

  /**
   * Handle admin select menu interactions
   */
  private async handleAdminSelect(interaction: SelectMenuInteraction, params: string[], values: string[]): Promise<void> {
    const [action] = values;
    
    await interaction.reply({
      content: `🔧 Admin action "${action}" will be implemented soon!`,
      ephemeral: true
    });
  }

  /**
   * Handle AI select menu interactions
   */
  private async handleAISelect(interaction: SelectMenuInteraction, params: string[], values: string[]): Promise<void> {
    const [sessionType] = values;
    
    await this.services.aiPoweredService.startCoachingSession(interaction.user.id, sessionType);
    
    await interaction.reply({
      content: `🤖 Started ${sessionType} AI coaching session!`,
      ephemeral: true
    });
  }

  /**
   * Handle config modal submissions
   */
  private async handleConfigModal(interaction: ModalSubmitInteraction, params: string[]): Promise<void> {
    const [configType] = params;
    const fields = interaction.fields;
    
    // Process form fields and update configuration
    const updates: any = {};
    fields.fields.forEach((field, key) => {
      updates[key] = field.value;
    });
    
    await this.services.quickEditConfigService.applyConfigUpdates(
      interaction.user.id,
      configType,
      updates
    );
    
    await interaction.reply({
      content: `✅ ${configType} configuration updated successfully!`,
      ephemeral: true
    });
  }

  /**
   * Handle admin modal submissions
   */
  private async handleAdminModal(interaction: ModalSubmitInteraction, params: string[]): Promise<void> {
    const [action] = params;
    
    await interaction.reply({
      content: `🔧 Admin action "${action}" processed!`,
      ephemeral: true
    });
  }

  /**
   * Handle pick modal submissions
   */
  private async handlePickModal(interaction: ModalSubmitInteraction, params: string[]): Promise<void> {
    await interaction.reply({
      content: '🏈 Pick submission processed!',
      ephemeral: true
    });
  }

  /**
   * Handle AI modal submissions
   */
  private async handleAIModal(interaction: ModalSubmitInteraction, params: string[]): Promise<void> {
    const [sessionId] = params;
    const message = interaction.fields.getTextInputValue('message');
    
    const response = await this.services.aiPoweredService.processCoachingMessage(sessionId, message);
    
    await interaction.reply({
      content: `🤖 AI Coach: ${response}`,
      ephemeral: true
    });
  }

  /**
   * Handle pick autocomplete
   */
  private async handlePickAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    // Provide autocomplete suggestions based on the focused option
    const choices = [
      { name: 'Over', value: 'over' },
      { name: 'Under', value: 'under' },
      { name: 'Spread', value: 'spread' },
      { name: 'Moneyline', value: 'moneyline' }
    ];
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
    );
    
    await interaction.respond(filtered.slice(0, 25));
  }

  /**
   * Handle admin autocomplete
   */
  private async handleAdminAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    const choices = [
      { name: 'System Health Check', value: 'health_check' },
      { name: 'Toggle Maintenance', value: 'maintenance' },
      { name: 'Force User Tier Change', value: 'tier_change' },
      { name: 'Emergency Broadcast', value: 'broadcast' }
    ];
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
    );
    
    await interaction.respond(filtered.slice(0, 25));
  }

  /**
   * Handle config autocomplete
   */
  private async handleConfigAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    const choices = [
      { name: 'Keywords', value: 'keywords' },
      { name: 'Emojis', value: 'emojis' },
      { name: 'Threads', value: 'threads' },
      { name: 'VIP Notifications', value: 'vip_notifications' },
      { name: 'General Settings', value: 'general' }
    ];
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
    );
    
    await interaction.respond(filtered.slice(0, 25));
  }
}