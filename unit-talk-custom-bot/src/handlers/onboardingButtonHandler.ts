import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger';
import { supabaseService } from '../services/supabase';
import { permissionsService } from '../services/permissions';
import { botConfig } from '../config';
import {
  createInfoEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  getTierColor
} from '../utils/embeds';

export class OnboardingButtonHandler {
  private client: Client;
  private supabaseService: any;
  private permissionsService: any;
  private comprehensiveOnboardingService: any;

  constructor(
    client: Client,
    supabaseService: any,
    permissionsService: any,
    comprehensiveOnboardingService: any
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.comprehensiveOnboardingService = comprehensiveOnboardingService;
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;
      
      logger.info(`Button interaction received: ${customId}`, {
        service: 'unit-talk-bot',
        userId: interaction.user.id,
        username: interaction.user.username
      });

      switch (customId) {
        case 'vip_plus_tour_start':
          await this.handleVipPlusTourStart(interaction);
          break;
        case 'vip_plus_settings':
          await this.handleVipPlusSettings(interaction);
          break;
        case 'vip_tour_start':
          await this.handleVipTourStart(interaction);
          break;
        case 'vip_settings':
          await this.handleVipSettings(interaction);
          break;
        case 'heat_signal_access':
          await this.handleHeatSignalAccess(interaction);
          break;
        case 'customize_alerts':
          await this.handleCustomizeAlerts(interaction);
          break;
        case 'view_analytics':
          await this.handleViewAnalytics(interaction);
          break;
        case 'ai_coaching':
          await this.handleAiCoaching(interaction);
          break;
        case 'upgrade_vip_plus':
          await this.handleUpgradeVipPlus(interaction);
          break;
        case 'upgrade_vip':
          await this.handleUpgradeVip(interaction);
          break;
        case 'view_vip_perks':
          await this.handleViewVipPerks(interaction);
          break;
        case 'view_vip_info':
          await this.handleViewVipInfo(interaction);
          break;
        case 'start_trial':
          await this.handleStartTrial(interaction);
          break;
        case 'trial_status':
          await this.handleTrialStatus(interaction);
          break;
        case 'view_todays_picks':
          await this.handleViewTodaysPicks(interaction);
          break;
        case 'goto_vip_lounge':
          await this.handleGotoVipLounge(interaction);
          break;
        case 'picks_dashboard':
          await this.handlePicksDashboard(interaction);
          break;
        case 'help_commands':
          await this.handleHelpCommands(interaction);
          break;
        case 'slash_commands_help':
          await this.handleSlashCommandsHelp(interaction);
          break;
        case 'trial_help':
          await this.handleTrialHelp(interaction);
          break;
        case 'view_trending_picks':
          await this.handleViewTrendingPicks(interaction);
          break;
        case 'whats_new':
          await this.handleWhatsNew(interaction);
          break;
        case 'upgrade_for_more_wins':
          await this.handleUpgradeForMoreWins(interaction);
          break;
        case 'upgrade_to_catch_up':
          await this.handleUpgradeToCatchUp(interaction);
          break;
        case 'refresh_heat_signal':
          await this.handleRefreshHeatSignal(interaction);
          break;
        case 'heat_signal_settings':
          await this.handleHeatSignalSettings(interaction);
          break;
        case 'heat_signal_demo':
          await this.sendHeatSignalDemo(interaction);
          break;
        default:
          logger.warn(`Unknown button interaction: ${customId}`);
          await interaction.reply({
            content: 'This button is not yet implemented.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error handling button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing your request.',
          ephemeral: true
        });
      }
    }
  }

  async handleVipPlusTourStart(interaction: ButtonInteraction): Promise<void> {
    const tourEmbed = createInfoEmbed('🚀 VIP+ Tour Started!', 'Welcome to your exclusive VIP+ features tour!')
      .addFields(
        {
          name: '⚡ Instant Alerts',
          value: 'Get picks the moment they\'re released - no delays!'
        },
        {
          name: '🤖 AI Coaching',
          value: 'Personal AI analysis and coaching for your bets'
        },
        {
          name: '🌐 Multi-Language',
          value: 'Support in your preferred language'
        },
        {
          name: '📊 Advanced Analytics',
          value: 'Detailed performance tracking and insights'
        },
        {
          name: '🎯 Premium Picks',
          value: 'Access to highest confidence plays'
        },
        {
          name: '🔥 Heat Signal',
          value: 'Real-time line movement alerts and sharp money tracking'
        }
      )
      .setColor('#FFD700');

    const tourButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('heat_signal_access')
          .setLabel('Try Heat Signal')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔥'),
        new ButtonBuilder()
          .setCustomId('vip_plus_settings')
          .setLabel('Customize Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️')
      );

    await interaction.reply({
      embeds: [tourEmbed],
      components: [tourButtons],
      ephemeral: true
    });

    // Send Heat Signal demo after a short delay
    setTimeout(async () => {
      await this.sendHeatSignalDemo(interaction);
    }, 2000);
  }

  async handleVipTourStart(interaction: ButtonInteraction): Promise<void> {
    const tourEmbed = createInfoEmbed('⭐ VIP Tour Started!', 'Welcome to your VIP features tour!')
      .addFields(
        {
          name: '🎯 VIP Picks',
          value: 'Access to premium pick analysis'
        },
        {
          name: '⚡ Early Access',
          value: 'Get picks before free members'
        },
        {
          name: '📊 Basic Analytics',
          value: 'Track your betting performance'
        },
        {
          name: '🎨 Quality Content',
          value: 'Curated picks with reasoning'
        }
      )
      .setColor('#f1c40f');

    const tourButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('view_analytics')
          .setLabel('View Analytics')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('vip_settings')
          .setLabel('Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️')
      );

    await interaction.reply({
      embeds: [tourEmbed],
      components: [tourButtons],
      ephemeral: true
    });
  }

  async handleVipPlusSettings(interaction: ButtonInteraction): Promise<void> {
    const settingsEmbed = createInfoEmbed('⚙️ VIP+ Settings', 'Customize your VIP+ experience')
      .addFields(
        {
          name: '🔔 Alert Preferences',
          value: 'Choose when and how you receive notifications'
        },
        {
          name: '🎯 Pick Filters',
          value: 'Set confidence thresholds and sport preferences'
        },
        {
          name: '📊 Analytics Dashboard',
          value: 'Customize your performance tracking'
        },
        {
          name: '🤖 AI Coaching',
          value: 'Configure your personal AI assistant'
        }
      )
      .setColor('#FFD700');

    const settingsButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('customize_alerts')
          .setLabel('Alert Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('ai_coaching')
          .setLabel('AI Coaching')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🤖')
      );

    await interaction.reply({
      embeds: [settingsEmbed],
      components: [settingsButtons],
      ephemeral: true
    });
  }

  async handleVipSettings(interaction: ButtonInteraction): Promise<void> {
    const settingsEmbed = createInfoEmbed('⚙️ VIP Settings', 'Customize your VIP experience')
      .addFields(
        {
          name: '🔔 Notifications',
          value: 'Choose your notification preferences'
        },
        {
          name: '📊 Analytics',
          value: 'Set up your performance tracking'
        },
        {
          name: '🎯 Pick Preferences',
          value: 'Configure your pick filters'
        }
      )
      .setColor('#f1c40f');

    const settingsButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('customize_alerts')
          .setLabel('Notifications')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('view_analytics')
          .setLabel('Analytics')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    await interaction.reply({
      embeds: [settingsEmbed],
      components: [settingsButtons],
      ephemeral: true
    });
  }

  async handleHeatSignalAccess(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier !== 'vip_plus') {
        const upgradeEmbed = createInfoEmbed('🔥 Heat Signal Access', 'VIP+ Feature Required')
          .setDescription('Heat Signal is an exclusive VIP+ feature that provides real-time line movement alerts and sharp money tracking.')
          .addFields(
            {
              name: '🎯 What is Heat Signal?',
              value: '• Real-time line movement tracking\n• Sharp money detection\n• Instant alerts for value opportunities\n• Professional betting insights',
              inline: false
            },
            {
              name: '💎 Upgrade to VIP+',
              value: 'Get access to Heat Signal and all other VIP+ features',
              inline: false
            }
          )
          .setColor('#e74c3c');

        const upgradeButtons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Upgrade to VIP+')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('💎')
              .setCustomId('upgrade_vip_plus'),
            new ButtonBuilder()
              .setLabel('View Demo')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('👀')
              .setCustomId('heat_signal_demo')
          );

        await interaction.reply({
          embeds: [upgradeEmbed],
          components: [upgradeButtons],
          ephemeral: true
        });
        return;
      }

      // VIP+ user - show heat signal
      await this.sendHeatSignalDemo(interaction);

    } catch (error) {
      logger.error('Error handling heat signal access:', error);
      await interaction.reply({
        content: '❌ An error occurred while accessing heat signal.',
        ephemeral: true
      });
    }
  }

  async sendHeatSignalDemo(interaction: ButtonInteraction): Promise<void> {
    try {
      const heatSignalEmbed = createInfoEmbed('🔥 Heat Signal Alert', 'Live Line Movement Detected!')
        .addFields(
          {
            name: '🏀 Game',
            value: 'Lakers vs Warriors',
            inline: true
          },
          {
            name: '📊 Line Movement',
            value: 'Spread: -3.5 → -5.5',
            inline: true
          },
          {
            name: '💰 Sharp Money',
            value: '78% on Lakers',
            inline: true
          },
          {
            name: '⚡ Action',
            value: 'Heavy betting on Lakers causing line to move 2 points in 10 minutes',
            inline: false
          },
          {
            name: '🎯 Recommendation',
            value: '**STRONG BUY** - Lakers -5.5\nConfidence: 87%',
            inline: false
          }
        )
        .setColor('#FF4500')
        .setTimestamp();

      const heatButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('place_bet')
            .setLabel('Place Bet')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('more_analysis')
            .setLabel('More Analysis')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      // Send as a follow-up message to simulate real Heat Signal
      await interaction.followUp({
        embeds: [heatSignalEmbed],
        components: [heatButtons],
        ephemeral: true
      });

      // Also send a DM with Heat Signal
      try {
        const dmChannel = await interaction.user.createDM();
        await dmChannel.send({
          embeds: [heatSignalEmbed],
          components: [heatButtons]
        });
        
        logger.info('Heat Signal DM sent successfully', {
          service: 'unit-talk-bot',
          userId: interaction.user.id,
          username: interaction.user.username
        });
      } catch (dmError) {
        logger.warn('Could not send Heat Signal DM', {
          service: 'unit-talk-bot',
          userId: interaction.user.id,
          error: dmError
        });
      }
    } catch (error) {
      logger.error('Error sending Heat Signal demo:', error);
    }
  }

  async handleCustomizeAlerts(interaction: ButtonInteraction): Promise<void> {
    const alertsEmbed = createInfoEmbed('🔔 Alert Customization', 'Configure your notification preferences')
      .addFields(
        {
          name: '⚡ Instant Alerts',
          value: 'Get notified immediately when picks are released'
        },
        {
          name: '🔥 Heat Signals',
          value: 'Real-time line movement and sharp money alerts'
        },
        {
          name: '📊 Performance Updates',
          value: 'Daily/weekly performance summaries'
        },
        {
          name: '🎯 Custom Filters',
          value: 'Only get alerts for your preferred sports/confidence levels'
        }
      )
      .setColor('#3498db');

    await interaction.reply({
      embeds: [alertsEmbed],
      ephemeral: true
    });
  }

  async handleViewAnalytics(interaction: ButtonInteraction): Promise<void> {
    const analyticsEmbed = createInfoEmbed('📊 Your Analytics Dashboard', 'Performance tracking and insights')
      .addFields(
        {
          name: '🎯 Win Rate',
          value: '67.3% (Last 30 days)',
          inline: true
        },
        {
          name: '💰 Profit',
          value: '+$1,247.50',
          inline: true
        },
        {
          name: '📈 ROI',
          value: '12.4%',
          inline: true
        },
        {
          name: '🏆 Best Sport',
          value: 'NBA (74% win rate)',
          inline: true
        },
        {
          name: '📊 Total Bets',
          value: '156 bets placed',
          inline: true
        },
        {
          name: '⭐ Streak',
          value: '7 wins in a row',
          inline: true
        }
      )
      .setColor('#2ecc71');

    await interaction.reply({
      embeds: [analyticsEmbed],
      ephemeral: true
    });
  }



  async handleRefreshHeatSignal(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier !== 'vip_plus') {
        await interaction.reply({
          content: '❌ Heat Signal is a VIP+ exclusive feature. Upgrade to access real-time alerts!',
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setLabel('Upgrade to VIP+')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('💎')
                  .setCustomId('upgrade_vip_plus')
              )
          ],
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Simulate refreshing heat signal data
      await new Promise(resolve => setTimeout(resolve, 2000));

      const refreshedEmbed = createSuccessEmbed('🔄 Heat Signal Refreshed', 'Latest market data loaded')
        .addFields(
          {
            name: '🔥 Active Alerts',
            value: '• Lakers total moving UP (220.5 → 222)\n• Chiefs spread tightening (-3.5 → -3)\n• Sharp money on Warriors +4.5',
            inline: false
          },
          {
            name: '⚡ New Opportunities',
            value: '2 new value plays detected in the last 5 minutes',
            inline: false
          },
          {
            name: '📊 Market Status',
            value: 'High activity detected - 15 lines moving',
            inline: false
          }
        )
        .setColor('#2ecc71');

      const refreshButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Details')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊')
            .setCustomId('heat_signal_access'),
          new ButtonBuilder()
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
            .setCustomId('heat_signal_settings')
        );

      await interaction.editReply({
        embeds: [refreshedEmbed],
        components: [refreshButtons]
      });

    } catch (error) {
      logger.error('Error refreshing heat signal:', error);
      await interaction.reply({
        content: '❌ An error occurred while refreshing heat signal.',
        ephemeral: true
      });
    }
  }

  async handleAiCoaching(interaction: ButtonInteraction): Promise<void> {
    const coachingEmbed = createInfoEmbed('🤖 AI Coaching Assistant', 'Your personal betting coach')
      .addFields(
        {
          name: '📈 Performance Analysis',
          value: 'AI analyzes your betting patterns and suggests improvements'
        },
        {
          name: '🎯 Personalized Tips',
          value: 'Get custom advice based on your betting history'
        },
        {
          name: '⚠️ Risk Management',
          value: 'AI helps you manage bankroll and avoid common mistakes'
        },
        {
          name: '🔍 Pick Analysis',
          value: 'Detailed breakdown of why each pick was recommended'
        }
      )
      .setColor('#9b59b6');

    await interaction.reply({
      embeds: [coachingEmbed],
      ephemeral: true
    });
  }

  // Stub implementations for the newly added handlers



  async handleHeatSignalSettings(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier !== 'vip_plus') {
        await interaction.reply({
          content: '❌ Heat Signal settings are only available for VIP+ members.',
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setLabel('Upgrade to VIP+')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('💎')
                  .setCustomId('upgrade_vip_plus')
              )
          ],
          ephemeral: true
        });
        return;
      }

      const settingsEmbed = createInfoEmbed('⚙️ Heat Signal Settings', 'Configure your alert preferences')
        .addFields(
          {
            name: '🔔 Notification Types',
            value: '✅ Line Movement Alerts\n✅ Sharp Money Alerts\n✅ Value Play Alerts\n❌ Steam Alerts',
            inline: false
          },
          {
            name: '📊 Thresholds',
            value: 'Line Movement: ±1.5 points\nSharp Money: 70%+ backing\nValue Plays: 5%+ edge',
            inline: false
          },
          {
            name: '⏰ Timing',
            value: 'Instant notifications: ON\nDigest mode: OFF\nQuiet hours: 11 PM - 7 AM',
            inline: false
          },
          {
            name: '🎯 Sports Filter',
            value: 'NFL: ✅ | NBA: ✅ | MLB: ❌\nNHL: ❌ | Soccer: ❌ | Tennis: ❌',
            inline: false
          }
        )
        .setColor('#3498db');

      const settingsButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Edit Notifications')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔')
            .setCustomId('edit_notifications'),
          new ButtonBuilder()
            .setLabel('Sports Filter')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏈')
            .setCustomId('sports_filter'),
          new ButtonBuilder()
            .setLabel('Test Alert')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🧪')
            .setCustomId('test_heat_alert')
        );

      await interaction.reply({
        embeds: [settingsEmbed],
        components: [settingsButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error showing heat signal settings:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading settings.',
        ephemeral: true
      });
    }
  }

  async handleUpgradeVip(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      // Check current tier
      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier === 'vip' || currentTier === 'vip_plus') {
        await interaction.reply({
          content: '✅ You already have VIP access or higher! Use `/vip-dashboard` to access your features.',
          ephemeral: true
        });
        return;
      }

      const upgradeEmbed = createInfoEmbed('⭐ VIP Upgrade', 'Ready to unlock VIP features?')
        .addFields(
          {
            name: '🎯 VIP Picks',
            value: 'Access to premium pick analysis',
            inline: false
          },
          {
            name: '⚡ Early Access',
            value: 'Get picks before free members',
            inline: false
          },
          {
            name: '📊 Basic Analytics',
            value: 'Track your betting performance',
            inline: false
          },
          {
            name: '🔔 Priority Notifications',
            value: 'Get notified of important updates first',
            inline: false
          },
          {
            name: '💰 Pricing',
            value: 'Contact admin for VIP upgrade pricing',
            inline: false
          }
        )
        .setColor('#f1c40f');

      const upgradeButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Contact Admin')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬')
            .setCustomId('contact_admin_vip'),
          new ButtonBuilder()
            .setLabel('Start Trial')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🆓')
            .setCustomId('start_trial')
        );

      await interaction.reply({
        embeds: [upgradeEmbed],
        components: [upgradeButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error handling VIP upgrade:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your upgrade request.',
        ephemeral: true
      });
    }
  }

  async handleViewVipPerks(interaction: ButtonInteraction): Promise<void> {
    const perksEmbed = createInfoEmbed('⭐ VIP Perks', 'See what VIP membership includes')
      .addFields(
        {
          name: '🎯 Premium Picks',
          value: 'Access to our highest confidence plays',
          inline: false
        },
        {
          name: '⚡ Early Access',
          value: 'Get picks before they\'re released to free members',
          inline: false
        },
        {
          name: '📊 Performance Analytics',
          value: 'Track your betting performance with detailed stats',
          inline: false
        },
        {
          name: '🔔 Priority Notifications',
          value: 'Get notified of important updates and picks first',
          inline: false
        },
        {
          name: '💬 VIP Chat Access',
          value: 'Join exclusive VIP discussions and strategies',
          inline: false
        }
      )
      .setColor('#f1c40f');

    await interaction.reply({
      embeds: [perksEmbed],
      ephemeral: true
    });
  }

  async handleViewVipInfo(interaction: ButtonInteraction): Promise<void> {
    const infoEmbed = createInfoEmbed('ℹ️ VIP Information', 'Everything you need to know about VIP')
      .addFields(
        {
          name: '💎 VIP vs VIP+',
          value: 'VIP: Premium picks and early access\nVIP+: Everything in VIP plus Heat Signal, AI Coaching, and Advanced Analytics',
          inline: false
        },
        {
          name: '🆓 Free Trial',
          value: 'Try VIP features for free before upgrading',
          inline: false
        },
        {
          name: '💰 Pricing',
          value: 'Contact admin for current pricing and payment options',
          inline: false
        },
        {
          name: '🔄 Cancellation',
          value: 'Cancel anytime - no long-term commitments',
          inline: false
        }
      )
      .setColor('#3498db');

    const infoButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Start Trial')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🆓')
          .setCustomId('start_trial'),
        new ButtonBuilder()
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
          .setCustomId('upgrade_vip'),
        new ButtonBuilder()
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💎')
          .setCustomId('upgrade_vip_plus')
      );

    await interaction.reply({
      embeds: [infoEmbed],
      components: [infoButtons],
      ephemeral: true
    });
  }

  async handleStartTrial(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      // Check if user already has VIP access
      const currentTier = this.permissionsService.getUserTier(member);
      if (currentTier === 'vip' || currentTier === 'vip_plus') {
        await interaction.reply({
          content: '✅ You already have VIP access! No trial needed.',
          ephemeral: true
        });
        return;
      }

      // Check if user already has an active trial
      const existingTrial = await this.supabaseService.getTrialUser(interaction.user.id);
      if (existingTrial && existingTrial.active) {
        const expiresAt = new Date(existingTrial.expires_at);
        await interaction.reply({
          content: `⏰ You already have an active trial that expires on ${expiresAt.toLocaleDateString()}.`,
          ephemeral: true
        });
        return;
      }

      // Start new trial
      const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      const expiresAt = new Date(Date.now() + trialDuration);

      await this.supabaseService.createTrialUser({
        discord_id: interaction.user.id,
        started_at: new Date(),
        expires_at: expiresAt,
        active: true,
        reminder_48h_sent: false,
        reminder_24h_sent: false,
        reminder_1h_sent: false
      });

      const trialEmbed = createSuccessEmbed('🆓 Trial Started!', 'Your 7-day VIP trial is now active!')
        .addFields(
          {
            name: '⏰ Trial Duration',
            value: '7 days',
            inline: true
          },
          {
            name: '📅 Expires',
            value: expiresAt.toLocaleDateString(),
            inline: true
          },
          {
            name: '🎯 What\'s Included',
            value: '• Premium picks\n• Early access\n• Performance analytics\n• Priority notifications',
            inline: false
          }
        )
        .setColor('#2ecc71');

      const trialButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Today\'s Picks')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎯')
            .setCustomId('view_todays_picks'),
          new ButtonBuilder()
            .setLabel('VIP Dashboard')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
            .setCustomId('picks_dashboard')
        );

      await interaction.reply({
        embeds: [trialEmbed],
        components: [trialButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error starting trial:', error);
      await interaction.reply({
        content: '❌ An error occurred while starting your trial.',
        ephemeral: true
      });
    }
  }

  async handleTrialStatus(interaction: ButtonInteraction): Promise<void> {
    try {
      const trial = await this.supabaseService.getTrialUser(interaction.user.id);

      if (!trial || !trial.active) {
        await interaction.reply({
          content: '❌ You don\'t have an active trial. Use the "Start Trial" button to begin your free trial!',
          ephemeral: true
        });
        return;
      }

      const expiresAt = new Date(trial.expires_at);
      const timeLeft = expiresAt.getTime() - Date.now();
      const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));

      const statusEmbed = createInfoEmbed('⏰ Trial Status', 'Your current trial information')
        .addFields(
          {
            name: '📅 Started',
            value: new Date(trial.started_at).toLocaleDateString(),
            inline: true
          },
          {
            name: '⏰ Expires',
            value: expiresAt.toLocaleDateString(),
            inline: true
          },
          {
            name: '📊 Days Left',
            value: daysLeft > 0 ? `${daysLeft} days` : 'Expired',
            inline: true
          }
        )
        .setColor(daysLeft > 2 ? '#2ecc71' : '#e74c3c');

      const statusButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Upgrade to VIP')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐')
            .setCustomId('upgrade_vip'),
          new ButtonBuilder()
            .setLabel('Upgrade to VIP+')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💎')
            .setCustomId('upgrade_vip_plus')
        );

      await interaction.reply({
        embeds: [statusEmbed],
        components: [statusButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error checking trial status:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking your trial status.',
        ephemeral: true
      });
    }
  }

  async handleViewTodaysPicks(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      // Check if user has access to picks
      if (currentTier === 'member') {
        // Check for active trial
        const trial = await this.supabaseService.getTrialUser(interaction.user.id);
        if (!trial || !trial.active) {
          await interaction.reply({
            content: '❌ You need VIP access to view today\'s picks. Start a free trial or upgrade to VIP!',
            components: [
              new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new ButtonBuilder()
                    .setLabel('Start Free Trial')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🆓')
                    .setCustomId('start_trial'),
                  new ButtonBuilder()
                    .setLabel('Upgrade to VIP')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⭐')
                    .setCustomId('upgrade_vip')
                )
            ],
            ephemeral: true
          });
          return;
        }
      }

      // User has access - show picks
      const picksEmbed = createInfoEmbed('🎯 Today\'s Picks', 'Your premium picks for today')
        .setDescription('Here are today\'s carefully analyzed picks:')
        .addFields(
          {
            name: '🏀 NBA',
            value: 'Lakers vs Warriors - Over 220.5 (3 units)\nConfidence: High | Line Movement: Favorable',
            inline: false
          },
          {
            name: '🏈 NFL',
            value: 'Chiefs -3.5 vs Bills (2 units)\nConfidence: Medium | Sharp Money: 65%',
            inline: false
          },
          {
            name: '📊 Today\'s Stats',
            value: `Total Picks: 2\nTotal Units: 5\nTier Access: ${currentTier.toUpperCase()}`,
            inline: false
          }
        )
        .setColor('#2ecc71');

      const picksButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('VIP Dashboard')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊')
            .setCustomId('picks_dashboard'),
          new ButtonBuilder()
            .setLabel('View Analytics')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📈')
            .setCustomId('view_analytics')
        );

      if (currentTier === 'vip_plus') {
        picksButtons.addComponents(
          new ButtonBuilder()
            .setLabel('Heat Signal')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔥')
            .setCustomId('heat_signal_access')
        );
      }

      await interaction.reply({
        embeds: [picksEmbed],
        components: [picksButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error viewing today\'s picks:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading today\'s picks.',
        ephemeral: true
      });
    }
  }

  async handleGotoVipLounge(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier === 'member') {
        await interaction.reply({
          content: '❌ You need VIP access to enter the VIP lounge. Upgrade or start a free trial!',
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setLabel('Start Free Trial')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('🆓')
                  .setCustomId('start_trial'),
                new ButtonBuilder()
                  .setLabel('Upgrade to VIP')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('⭐')
                  .setCustomId('upgrade_vip')
              )
          ],
          ephemeral: true
        });
        return;
      }

      // Get appropriate VIP channel based on tier
      const channelId = currentTier === 'vip_plus'
        ? botConfig.channels.vipPlusGeneral
        : botConfig.channels.vipGeneral;

      await interaction.reply({
        content: `🎉 Welcome to the VIP Lounge! Click here to join: <#${channelId}>`,
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error accessing VIP lounge:', error);
      await interaction.reply({
        content: '❌ An error occurred while accessing the VIP lounge.',
        ephemeral: true
      });
    }
  }

  async handlePicksDashboard(interaction: ButtonInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        await interaction.reply({
          content: '❌ Could not find your server membership.',
          ephemeral: true
        });
        return;
      }

      const currentTier = this.permissionsService.getUserTier(member);

      if (currentTier === 'member') {
        await interaction.reply({
          content: '❌ You need VIP access to view the picks dashboard. Upgrade or start a free trial!',
          ephemeral: true
        });
        return;
      }

      const dashboardEmbed = createInfoEmbed('📊 Picks Dashboard', `Your ${currentTier.toUpperCase()} Dashboard`)
        .addFields(
          {
            name: '📈 This Week',
            value: 'Record: 12-3 (80%)\nUnits: +8.5\nROI: 42%',
            inline: true
          },
          {
            name: '📅 This Month',
            value: 'Record: 45-15 (75%)\nUnits: +28.2\nROI: 38%',
            inline: true
          },
          {
            name: '🏆 All Time',
            value: 'Record: 234-89 (72%)\nUnits: +156.8\nROI: 35%',
            inline: true
          },
          {
            name: '🎯 Recent Picks',
            value: '✅ Lakers Over 220.5\n✅ Chiefs -3.5\n❌ Warriors ML\n✅ Cowboys Under 48.5',
            inline: false
          }
        )
        .setColor('#3498db');

      const dashboardButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Analytics')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📈')
            .setCustomId('view_analytics'),
          new ButtonBuilder()
            .setLabel('Today\'s Picks')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎯')
            .setCustomId('view_todays_picks')
        );

      if (currentTier === 'vip_plus') {
        dashboardButtons.addComponents(
          new ButtonBuilder()
            .setLabel('AI Coaching')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🤖')
            .setCustomId('ai_coaching')
        );
      }

      await interaction.reply({
        embeds: [dashboardEmbed],
        components: [dashboardButtons],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error showing picks dashboard:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading the dashboard.',
        ephemeral: true
      });
    }
  }

  // Missing handler methods
  async handleUpgradeVipPlus(interaction: ButtonInteraction): Promise<void> {
    await this.handleUpgradeVip(interaction); // Reuse existing VIP upgrade logic
  }

  async handleHelpCommands(interaction: ButtonInteraction): Promise<void> {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📚 Help Commands')
      .setDescription('Here are the available commands and how to use them:')
      .addFields(
        { name: '/pick', value: 'Submit a new sports pick', inline: true },
        { name: '/stats', value: 'View your betting statistics', inline: true },
        { name: '/leaderboard', value: 'View the community leaderboard', inline: true },
        { name: '/help', value: 'Get help and support', inline: true }
      )
      .setColor('#0099ff')
      .setTimestamp();

    await interaction.reply({
      embeds: [helpEmbed],
      ephemeral: true
    });
  }

  async handleSlashCommandsHelp(interaction: ButtonInteraction): Promise<void> {
    const slashHelpEmbed = new EmbedBuilder()
      .setTitle('⚡ Slash Commands Guide')
      .setDescription('Complete guide to using slash commands:')
      .addFields(
        { name: '🎯 Basic Commands', value: '`/pick` - Submit picks\n`/stats` - View stats\n`/help` - Get help', inline: false },
        { name: '📊 Advanced Commands', value: '`/leaderboard` - Rankings\n`/analytics` - Detailed stats', inline: false },
        { name: '💡 Tips', value: 'Type `/` to see all available commands\nUse Tab to autocomplete', inline: false }
      )
      .setColor('#00ff99')
      .setTimestamp();

    await interaction.reply({
      embeds: [slashHelpEmbed],
      ephemeral: true
    });
  }

  async handleTrialHelp(interaction: ButtonInteraction): Promise<void> {
    const trialHelpEmbed = new EmbedBuilder()
      .setTitle('🆓 Trial Help')
      .setDescription('Everything you need to know about your free trial:')
      .addFields(
        { name: '⏰ Trial Duration', value: '7 days of full VIP access', inline: true },
        { name: '🎯 What\'s Included', value: 'All VIP picks and features', inline: true },
        { name: '📈 Track Progress', value: 'Monitor your trial performance', inline: true },
        { name: '🔄 After Trial', value: 'Upgrade to continue VIP access', inline: false }
      )
      .setColor('#ffaa00')
      .setTimestamp();

    await interaction.reply({
      embeds: [trialHelpEmbed],
      ephemeral: true
    });
  }

  async handleViewTrendingPicks(interaction: ButtonInteraction): Promise<void> {
    const trendingEmbed = new EmbedBuilder()
      .setTitle('🔥 Trending Picks')
      .setDescription('Most popular picks from the community:')
      .addFields(
        { name: '🏈 NFL', value: 'Chiefs -3.5 vs Bills\n85% community backing', inline: true },
        { name: '🏀 NBA', value: 'Lakers Over 215.5\n78% community backing', inline: true },
        { name: '⚽ Soccer', value: 'Man City to Win\n92% community backing', inline: true }
      )
      .setColor('#ff6600')
      .setTimestamp();

    await interaction.reply({
      embeds: [trendingEmbed],
      ephemeral: true
    });
  }

  async handleWhatsNew(interaction: ButtonInteraction): Promise<void> {
    const whatsNewEmbed = new EmbedBuilder()
      .setTitle('🆕 What\'s New')
      .setDescription('Latest updates and features:')
      .addFields(
        { name: '🔥 Heat Signal System', value: 'New AI-powered pick recommendations', inline: false },
        { name: '📊 Enhanced Analytics', value: 'Improved statistics and tracking', inline: false },
        { name: '🎯 Smart Alerts', value: 'Personalized notifications for better picks', inline: false }
      )
      .setColor('#9900ff')
      .setTimestamp();

    await interaction.reply({
      embeds: [whatsNewEmbed],
      ephemeral: true
    });
  }

  async handleUpgradeForMoreWins(interaction: ButtonInteraction): Promise<void> {
    const upgradeEmbed = new EmbedBuilder()
      .setTitle('🚀 Upgrade for More Wins')
      .setDescription('Unlock premium features to boost your success:')
      .addFields(
        { name: '🎯 VIP Picks', value: 'Access to expert-curated selections', inline: true },
        { name: '📊 Advanced Analytics', value: 'Detailed performance insights', inline: true },
        { name: '🔥 Heat Signals', value: 'AI-powered pick recommendations', inline: true }
      )
      .setColor('#00ff00')
      .setTimestamp();

    const upgradeButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_vip')
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⭐')
      );

    await interaction.reply({
      embeds: [upgradeEmbed],
      components: [upgradeButton],
      ephemeral: true
    });
  }

  async handleUpgradeToCatchUp(interaction: ButtonInteraction): Promise<void> {
    const catchUpEmbed = new EmbedBuilder()
      .setTitle('⚡ Upgrade to Catch Up')
      .setDescription('Don\'t fall behind - upgrade now to access winning strategies:')
      .addFields(
        { name: '📈 Proven Results', value: 'Join winners with 70%+ success rate', inline: true },
        { name: '🎯 Expert Picks', value: 'Curated by professional analysts', inline: true },
        { name: '🔥 Hot Streaks', value: 'Ride the momentum with trending picks', inline: true }
      )
      .setColor('#ff0066')
      .setTimestamp();

    const upgradeButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🚀')
      );

    await interaction.reply({
      embeds: [catchUpEmbed],
      components: [upgradeButton],
      ephemeral: true
    });
  }
}