import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getUserTier, getTierDisplayName, getTierColor, fetchFreshMember, getUserTierWithFreshFetch } from '../utils/roleUtils';
import { logger } from '../utils/logger';

/**
 * Enhanced Onboarding Button Handler - Single Source of Truth
 * Handles all button interactions from onboarding messages with comprehensive features
 */
export class OnboardingButtonHandler {

  /**
   * Static method to check if a button ID is handled by this onboarding handler
   */
  static isOnboardingButton(customId: string): boolean {
    const allOnboardingButtons = [
      // Basic buttons (all users)
      'view_faq', 'start_vip_trial', 'view_trial_features', 'upgrade_to_vip', 'upgrade_to_vip_plus',

      // VIP buttons
      'view_vip_guide', 'setup_notifications', 'start_vip_tour', 'vip_tour_start', 'vip_settings', 'vip_tour',

      // VIP+ buttons
      'view_vip_plus_guide', 'access_elite_features', 'vip_plus_tour', 'setup_vip_plus_notifications',
      'vip_plus_tour_start', 'vip_plus_settings', 'start_vip_plus_tour', 'notification_settings', 'ai_coach', 'analytics',

      // Capper buttons
      'capper_onboard_start', 'capper_guide', 'capper_practice_pick', 'view_leaderboard',
      'capper_support', 'create_capper_thread',

      // Staff buttons
      'staff_guide', 'admin_panel', 'moderation_tools',

      // Secondary buttons
      'setup_notifications_now', 'notification_help',

      // Upgrade buttons
      'upgrade_vip', 'upgrade_vip_plus'
    ];

    return allOnboardingButtons.includes(customId);
  }

  /**
   * Main handler for all onboarding button interactions
   */
  async handleOnboardingButton(interaction: ButtonInteraction): Promise<void> {
    const { customId, user } = interaction;

    logger.info(`🔘 Button interaction: ${customId} from ${user.tag} (${user.id})`);

    try {
      // More robust guild detection
      const guild = interaction.guild || interaction.guildId ? interaction.client.guilds.cache.get(interaction.guildId!) : null;

      if (!guild) {
        logger.error(`❌ No guild found for button interaction ${customId} from ${user.tag}`, {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          hasGuild: !!interaction.guild,
          hasGuildId: !!interaction.guildId
        });
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true
        });
        return;
      }

      logger.info(`✅ Guild found: ${guild.name} (${guild.id}) for button ${customId}`);

      // Enhanced member fetching with retries and detailed error logging
      const member = await fetchFreshMember(guild, user.id);

      if (!member) {
        logger.error(`❌ Could not fetch member or roles for ${user.tag} (${user.id})`, {
          userId: user.id,
          username: user.username,
          tag: user.tag,
          action: customId,
          guildId: guild.id,
          error: 'Member fetch failed after retries'
        });

        await interaction.reply({
          content: '❌ **Unable to verify your permissions**\n\nPlease try again in a few seconds. If the issue persists, contact support.',
          ephemeral: true
        });
        return;
      }

      // Enhanced role debugging with fresh data
      const roleDetails = member.roles.cache.map(role => `${role.name}(${role.id})`).join(', ');
      logger.info(`👤 ${user.tag} fresh roles: [${roleDetails}]`);

      // Get current tier with fresh member data
      const currentTier = getUserTier(member);
      logger.info(`👤 ${user.tag} current tier: ${currentTier}`);

      // Validate access
      if (!this.validateButtonAccess(customId, currentTier)) {
        logger.warn(`❌ Access denied: ${customId} for tier ${currentTier}`, {
          userId: user.id,
          username: user.username,
          currentTier,
          requiredAccess: this.getRequiredTierForButton(customId)
        });
        await interaction.reply({
          content: `❌ **Access Denied**\n\nYour current tier: **${getTierDisplayName(currentTier)}**\n\nThis button requires a higher tier. Use \`/upgrade\` to upgrade your membership!`,
          ephemeral: true
        });
        return;
      }

      // Route to appropriate handler
      await this.routeButtonHandler(interaction, customId, currentTier);
      logger.info(`✅ Successfully handled ${customId} for ${user.tag}`);

    } catch (error) {
      logger.error(`❌ Button error ${customId} for ${user.tag} (${user.id}):`, {
        userId: user.id,
        username: user.username,
        tag: user.tag,
        action: customId,
        error: error instanceof Error ? error.message : String(error),
        fullError: error
      });
      await this.handleError(interaction, error);
    }
  }

  /**
   * Enhanced access validation with detailed logging
   */
  /**
   * Enhanced access validation with detailed logging and owner bypass
   */
  private validateButtonAccess(customId: string, userTier: string): boolean {
    // Owner and admin bypass - they should have access to everything
    if (userTier === 'owner' || userTier === 'admin') {
      logger.info(`🔓 Admin/Owner bypass granted for ${customId} (tier: ${userTier})`);
      return true;
    }

    const accessMap: Record<string, string[]> = {
      // Basic buttons (all users)
      basic: ['view_faq', 'start_vip_trial', 'view_trial_features', 'upgrade_to_vip', 'upgrade_to_vip_plus', 'upgrade_vip', 'upgrade_vip_plus'],

      // VIP buttons
      vip: ['view_vip_guide', 'setup_notifications', 'start_vip_tour', 'vip_tour_start', 'vip_settings', 'vip_tour'],

      // VIP+ buttons
      vip_plus: ['view_vip_plus_guide', 'access_elite_features', 'vip_plus_tour', 'vip_plus_tour_start', 'setup_vip_plus_notifications', 'vip_plus_settings', 'start_vip_plus_tour', 'notification_settings', 'ai_coach', 'analytics'],

      // Capper buttons
      capper: ['capper_onboard_start', 'capper_guide', 'capper_practice_pick', 'view_leaderboard', 'capper_support', 'create_capper_thread'],

      // Staff buttons
      staff: ['staff_guide', 'admin_panel', 'moderation_tools'],

      // Secondary buttons (available to most tiers)
      secondary: ['setup_notifications_now', 'notification_help']
    };

    const tierHierarchy: Record<string, string[]> = {
      'member': ['basic'],
      'trial': ['basic'],
      'free': ['basic'], // Add explicit free tier support
      'vip': ['basic', 'vip', 'secondary'],
      'vip_plus': ['basic', 'vip', 'vip_plus', 'secondary'],
      'capper': ['basic', 'capper', 'secondary'],
      'staff': ['basic', 'vip', 'vip_plus', 'capper', 'staff', 'secondary'],
      'admin': ['basic', 'vip', 'vip_plus', 'capper', 'staff', 'secondary'],
      'owner': ['basic', 'vip', 'vip_plus', 'capper', 'staff', 'secondary']
    };

    const allowedCategories = tierHierarchy[userTier] || ['basic'];
    const hasAccess = allowedCategories.some((category: string) =>
      accessMap[category]?.includes(customId)
    );

    logger.info(`🔍 Access check: ${customId} | Tier: ${userTier} | Categories: [${allowedCategories.join(', ')}] | Access: ${hasAccess ? 'GRANTED' : 'DENIED'}`);

    // Additional debugging for denied access
    if (!hasAccess) {
      const buttonCategory = Object.keys(accessMap).find(category =>
        accessMap[category].includes(customId)
      );
      logger.warn(`❌ Button '${customId}' requires category '${buttonCategory}' but user tier '${userTier}' only has access to: [${allowedCategories.join(', ')}]`);
    }

    return hasAccess;
  }

  /**
   * Get required tier for a specific button (for error messages)
   */
  private getRequiredTierForButton(customId: string): string {
    const accessMap: Record<string, string[]> = {
      basic: ['view_faq', 'start_vip_trial', 'view_trial_features', 'upgrade_to_vip', 'upgrade_to_vip_plus', 'upgrade_vip', 'upgrade_vip_plus'],
      vip: ['view_vip_guide', 'setup_notifications', 'start_vip_tour', 'vip_tour_start', 'vip_settings'],
      vip_plus: ['view_vip_plus_guide', 'access_elite_features', 'vip_plus_tour', 'vip_plus_tour_start', 'setup_vip_plus_notifications', 'vip_plus_settings'],
      capper: ['capper_onboard_start', 'capper_guide', 'capper_practice_pick', 'view_leaderboard', 'capper_support', 'create_capper_thread'],
      staff: ['staff_guide', 'admin_panel', 'moderation_tools'],
      secondary: ['setup_notifications_now', 'notification_help']
    };

    for (const [tier, buttons] of Object.entries(accessMap)) {
      if (buttons.includes(customId)) {
        return tier;
      }
    }
    return 'unknown';
  }

  /**
   * Route button interactions to appropriate handlers
   */
  private async routeButtonHandler(interaction: ButtonInteraction, customId: string, userTier: string): Promise<void> {
    const handlers: Record<string, () => Promise<void>> = {
      // VIP handlers
      'view_vip_guide': () => this.handleVipGuide(interaction, userTier),
      'setup_notifications': () => this.handleNotificationSetup(interaction, userTier),
      'start_vip_tour': () => this.handleVipTour(interaction, userTier),
      'vip_tour_start': () => this.handleVipTour(interaction, userTier), // Alias
      'vip_settings': () => this.handleVipSettings(interaction, userTier),

      // VIP+ handlers
      'view_vip_plus_guide': () => this.handleVipPlusGuide(interaction, userTier),
      'access_elite_features': () => this.handleEliteFeatures(interaction, userTier),
      'vip_plus_tour': () => this.handleVipPlusTour(interaction, userTier),
      'vip_plus_tour_start': () => this.handleVipPlusTour(interaction, userTier), // Alias
      'setup_vip_plus_notifications': () => this.handleVipPlusNotifications(interaction, userTier),
      'vip_plus_settings': () => this.handleVipPlusSettings(interaction, userTier),

      // New onboarding test handlers
      'start_vip_plus_tour': () => this.handleStartVipPlusTour(interaction),
      'notification_settings': () => this.handleNotificationSettings(interaction),
      'ai_coach': () => this.handleAiCoach(interaction),
      'analytics': () => this.handleAnalytics(interaction),
      'vip_tour': () => this.handleVipTour(interaction, userTier),

      // Basic handlers
      'view_faq': () => this.handleFaq(interaction),
      'start_vip_trial': () => this.handleVipTrial(interaction),
      'view_trial_features': () => this.handleTrialFeatures(interaction),
      'upgrade_to_vip': () => this.handleUpgradeVip(interaction),
      'upgrade_to_vip_plus': () => this.handleUpgradeVipPlus(interaction),
      'upgrade_vip': () => this.handleUpgradeVip(interaction), // Alias
      'upgrade_vip_plus': () => this.handleUpgradeVipPlus(interaction), // Alias

      // Capper handlers
      'capper_onboard_start': () => this.handleCapperOnboarding(interaction),
      'capper_guide': () => this.handleCapperGuide(interaction),
      'capper_practice_pick': () => this.handleCapperPractice(interaction),
      'view_leaderboard': () => this.handleLeaderboard(interaction),
      'capper_support': () => this.handleCapperSupport(interaction),
      'create_capper_thread': () => this.handleCreateCapperThread(interaction),

      // Staff handlers
      'staff_guide': () => this.handleStaffGuide(interaction),

      // Secondary handlers
      'setup_notifications_now': () => this.handleNotificationSetup(interaction, userTier),
      'notification_help': () => this.handleNotificationHelp(interaction)
    };

    const handler = handlers[customId];
    if (handler) {
      await handler();
    } else {
      await this.handleUnknownButton(interaction, customId);
    }
  }

  /**
   * VIP HANDLERS - Enhanced with personalization
   */
  private async handleVipGuide(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP Member Guide')
      .setDescription(`Welcome ${interaction.user.displayName}! Here's your complete VIP guide.`)
      .setColor(getTierColor('vip'))
      .addFields(
        {
          name: '🏆 Your VIP Benefits',
          value: '• Premium capper picks with analysis\n• Exclusive VIP channels access\n• Priority customer support\n• Advanced analytics dashboard\n• Early access to new features\n• Weekly performance reports',
          inline: false
        },
        {
          name: '📍 Quick Start Guide',
          value: '1. Visit <#vip-picks> for daily premium picks\n2. Join discussions in <#vip-lounge>\n3. Set up notifications for your favorite cappers\n4. Check your analytics in <#vip-analytics>\n5. Use `/vip-info` for detailed stats',
          inline: false
        },
        {
          name: '🎯 Pro Tips',
          value: '• Follow bankroll management guidelines\n• Track your performance weekly\n• Engage with the VIP community\n• Use the `/pick` command to submit your own picks',
          inline: false
        }
      )
      .setFooter({ text: `${userTier} Member • Use /support or ask in #vip-support` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_notifications')
          .setLabel('Setup Notifications')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('start_vip_tour')
          .setLabel('Take VIP Tour')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleNotificationSetup(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Notification Setup')
      .setDescription('Configure your personalized notification preferences')
      .setColor(getTierColor(userTier))
      .addFields(
        {
          name: '📱 Available Notifications',
          value: userTier === 'vip_plus' 
            ? '• New picks from ALL cappers\n• High-confidence plays (90%+)\n• Live game updates\n• Instant win/loss notifications\n• Weekly performance reports\n• Exclusive VIP+ alerts\n• Direct capper messages'
            : '• New picks from favorite cappers\n• High-confidence plays (85%+)\n• Daily game updates\n• Weekly performance reports\n• VIP community highlights',
          inline: false
        },
        {
          name: '⚙️ Setup Options',
          value: '• DM notifications\n• Channel mentions\n• Email summaries (coming soon)\n• Mobile push (coming soon)',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_notifications_now')
          .setLabel('Configure Now')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('notification_help')
          .setLabel('Need Help?')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleVipTour(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP Feature Tour')
      .setDescription('Let me show you around your VIP features!')
      .setColor(getTierColor('vip'))
      .addFields(
        {
          name: '1️⃣ Premium Picks',
          value: 'Access expert picks in <#vip-picks> with detailed analysis and confidence ratings.',
          inline: false
        },
        {
          name: '2️⃣ VIP Community',
          value: 'Join exclusive discussions in <#vip-lounge> with other VIP members.',
          inline: false
        },
        {
          name: '3️⃣ Analytics Dashboard',
          value: 'Track your performance with advanced analytics in <#vip-analytics>.',
          inline: false
        },
        {
          name: '4️⃣ Priority Support',
          value: 'Get fast help in <#vip-support> or use `/support` for direct assistance.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * VIP+ HANDLERS - Most exclusive features
   */
  private async handleVipPlusGuide(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔱 VIP+ Elite Member Guide')
      .setDescription(`Welcome to the elite tier, ${interaction.user.displayName}! You have access to our most exclusive features.`)
      .setColor(getTierColor('vip_plus'))
      .addFields(
        {
          name: '💎 Elite Benefits',
          value: '• ALL VIP benefits included\n• Exclusive VIP+ picks from top cappers\n• Private VIP+ channels\n• Direct access to capper insights\n• Custom analytics & reports\n• Priority everything\n• Beta feature access\n• Personal capper consultations',
          inline: false
        },
        {
          name: '🚀 Exclusive Access',
          value: '• <#vip-plus-picks> - Highest tier picks\n• <#vip-plus-lounge> - Elite discussions\n• <#capper-insights> - Behind the scenes\n• <#vip-plus-analytics> - Advanced metrics',
          inline: false
        },
        {
          name: '🎯 Elite Features',
          value: '• Custom pick alerts\n• Personal performance tracking\n• Direct capper communication\n• Exclusive live streams\n• Priority feature requests',
          inline: false
        }
      )
      .setFooter({ text: 'VIP+ Elite - The Ultimate Experience' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('access_elite_features')
          .setLabel('Elite Features')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌟'),
        new ButtonBuilder()
          .setCustomId('vip_plus_tour')
          .setLabel('Elite Tour')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🚀')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleEliteFeatures(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🌟 VIP+ Elite Features')
      .setDescription('Access your exclusive elite features')
      .setColor(getTierColor('vip_plus'))
      .addFields(
        {
          name: '🎯 Elite Picks',
          value: 'Highest confidence picks from our top-tier cappers with detailed breakdowns.',
          inline: false
        },
        {
          name: '📊 Advanced Analytics',
          value: 'Custom performance tracking, ROI analysis, and predictive modeling.',
          inline: false
        },
        {
          name: '💬 Direct Access',
          value: 'Private communication channels with cappers and exclusive insights.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleVipPlusTour(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🚀 VIP+ Elite Tour')
      .setDescription('Explore your elite features!')
      .setColor(getTierColor('vip_plus'));

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleVipPlusNotifications(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 VIP+ Elite Notifications')
      .setDescription('Configure your elite notification preferences')
      .setColor(getTierColor('vip_plus'));

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * BASIC HANDLERS - Available to all users
   */
  private async handleFaq(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('❓ Unit Talk - Frequently Asked Questions')
      .setDescription('Professional answers to help you maximize your sports betting intelligence.')
      .setColor(0x2C3E50)
      .addFields(
        {
          name: '🏆 How do I upgrade to VIP or VIP+?',
          value: 'Use the `/upgrade` command or click the upgrade buttons in your onboarding messages. VIP starts at $97/month, VIP+ Elite at $197/month. First month 50% off for new members.',
          inline: false
        },
        {
          name: '📊 What makes Unit Talk different?',
          value: 'We use Fortune 100-grade analytics, vetted professional cappers, and AI-powered insights. Our VIP members average 73% win rates with +12.4 units weekly performance.',
          inline: false
        },
        {
          name: '💰 How do picks work?',
          value: 'Our expert cappers provide daily picks with detailed analysis, confidence ratings, unit recommendations, and risk assessments. VIP+ members get access to $10K+ value plays.',
          inline: false
        },
        {
          name: '🎯 What is bankroll management?',
          value: 'Professional money management system to protect and grow your betting capital. We provide institutional-grade guidelines, tracking tools, and personal coaching (VIP+ only).',
          inline: false
        },
        {
          name: '📈 How can I track my performance?',
          value: 'Use our advanced analytics dashboard, `/stats` command, and performance reports. VIP+ members get personal AI coaching and portfolio optimization.',
          inline: false
        },
        {
          name: '🚀 Ready to upgrade?',
          value: 'Join 2,000+ profitable members. VIP gets you premium picks and analytics. VIP+ Elite includes personal AI coaching and $10K+ value plays.',
          inline: false
        }
      )
      .setFooter({ text: 'Unit Talk - Professional Sports Intelligence | Use /upgrade to join VIP' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip')
          .setLabel('🔥 Upgrade to VIP')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('💎 Go VIP+ Elite')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('start_vip_trial')
          .setLabel('📊 View Features')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleVipTrial(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🚀 VIP Trial - Experience Elite Sports Intelligence')
      .setDescription('Try VIP risk-free and see why our members consistently outperform the market.')
      .setColor(0x27AE60)
      .addFields(
        {
          name: '🎁 7-Day VIP Trial Includes',
          value: [
            '• **Premium Picks** - Access to all VIP capper selections',
            '• **Advanced Analytics** - Professional-grade performance tracking',
            '• **VIP Channels** - Exclusive community and discussions',
            '• **Priority Support** - White-glove customer service',
            '• **Risk Management Tools** - Professional bankroll guidance',
            '• **Performance Reports** - Weekly detailed analysis'
          ].join('\n'),
          inline: false
        },
        {
          name: '📊 What VIP Members Experience',
          value: [
            '• **73% Average Win Rate** on premium picks',
            '• **+12.4 Units Weekly** average performance',
            '• **$2,847 Average Profits** per week (based on $100/unit)',
            '• **24/7 Expert Support** for strategic guidance'
          ].join('\n'),
          inline: false
        },
        {
          name: '🔥 Special Offer',
          value: 'Start your trial today and get 50% off your first month when you upgrade. No risk, maximum reward.',
          inline: false
        }
      )
      .setFooter({ text: 'VIP Trial - Risk-Free Excellence | Contact support to start' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip')
          .setLabel('🚀 Start VIP Trial')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('💎 Go VIP+ Elite')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('view_trial_features')
          .setLabel('📋 Compare Plans')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleTrialFeatures(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Trial Features')
      .setDescription('Explore what\'s available during your trial period')
      .setColor(Colors.Yellow);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleUpgradeVip(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ Upgrade to VIP - Join the Winning Elite')
      .setDescription('Ready to join 2,000+ profitable members who treat sports betting like the professional investment it is?')
      .setColor(0x8B4513)
      .addFields(
        {
          name: '🏆 VIP Elite Benefits',
          value: [
            '• **Premium Capper Network** - Vetted professionals only',
            '• **73% Average Win Rate** - Consistently profitable picks',
            '• **Advanced Analytics Dashboard** - Fortune 500-level insights',
            '• **Priority Support** - White-glove customer service',
            '• **Exclusive VIP Community** - Network with serious professionals',
            '• **Risk Management Tools** - Protect and grow your bankroll'
          ].join('\n'),
          inline: false
        },
        {
          name: '💰 VIP Performance Results',
          value: [
            '• **+12.4 Units Weekly** - Average member performance',
            '• **$2,847 Weekly Profits** - Based on $100/unit betting',
            '• **ROI of 24.8%** - Monthly return on investment',
            '• **Consistent Profitability** - 89% of VIP members profitable after 3 months'
          ].join('\n'),
          inline: false
        },
        {
          name: '🔥 Limited Time Offer',
          value: '**First Month 50% Off** - Only $48.50 instead of $97. Cancel anytime, but you won\'t want to.',
          inline: false
        }
      )
      .setFooter({ text: 'VIP Membership - Professional Excellence | Use /upgrade or contact support' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('💎 Go VIP+ Elite Instead')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('view_trial_features')
          .setLabel('📊 Compare All Plans')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleUpgradeVipPlus(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP+ Elite - The Ultimate Edge')
      .setDescription('Join the top 1% of sports intelligence professionals. Where legends are made and fortunes are built.')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🔥 VIP+ Elite Exclusive Features',
          value: [
            '• **Personal AI Coach** - Custom strategy optimization',
            '• **$10K+ Value Plays** - Institutional-grade opportunities',
            '• **Direct Capper Access** - Private consultation with legends',
            '• **Advanced Market Intelligence** - Wall Street-level data',
            '• **Custom Portfolio Management** - Personalized risk strategies',
            '• **VIP+ Exclusive Events** - Private masterclasses and networking'
          ].join('\n'),
          inline: false
        },
        {
          name: '📊 VIP+ Elite Performance',
          value: [
            '• **81% Win Rate** - On VIP+ exclusive plays',
            '• **+18.7 Units Weekly** - Average member performance',
            '• **$4,200+ Weekly Profits** - Based on $100/unit betting',
            '• **Personal Success Manager** - Dedicated account management'
          ].join('\n'),
          inline: false
        },
        {
          name: '⚡ Exclusive VIP+ Offer',
          value: '**First Month 50% Off** - Only $98.50 instead of $197. Limited availability - VIP+ is capped at 500 members.',
          inline: false
        }
      )
      .setFooter({ text: 'VIP+ Elite - The Ultimate Edge | Limited to 500 Members Worldwide' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * CAPPER HANDLERS - For capper onboarding and features
   */
  private async handleCapperOnboarding(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('capper_onboarding_modal')
      .setTitle('🎯 Capper Onboarding');

    const nameInput = new TextInputBuilder()
      .setCustomId('capper_name')
      .setLabel('Preferred Capper Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your capper display name')
      .setRequired(true)
      .setMaxLength(50);

    const experienceInput = new TextInputBuilder()
      .setCustomId('capper_experience')
      .setLabel('Experience Level')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Beginner, Intermediate, or Expert')
      .setRequired(true);

    const sportsInput = new TextInputBuilder()
      .setCustomId('capper_sports')
      .setLabel('Sports Specialization')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('NFL, NBA, MLB, NHL, etc.')
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput);
    const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(sportsInput);

    modal.addComponents(row1, row2, row3);
    await interaction.showModal(modal);
  }

  private async handleCapperGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Capper Guide')
      .setDescription('Complete guide for cappers')
      .setColor(Colors.Purple);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleCapperPractice(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏋️ Practice Pick')
      .setDescription('Submit a practice pick to get started')
      .setColor(Colors.Blue);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleLeaderboard(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Capper Leaderboard')
      .setDescription('Top performing cappers this month')
      .setColor(Colors.Gold);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleCapperSupport(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🆘 Capper Support')
      .setDescription('Get help with capper features')
      .setColor(Colors.Red);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleCreateCapperThread(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🧵 Create Capper Thread')
      .setDescription('Create your personal capper discussion thread')
      .setColor(Colors.Green);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * STAFF HANDLERS
   */
  private async handleStaffGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('👮 Staff Guide')
      .setDescription('Staff guidelines and responsibilities')
      .setColor(Colors.Purple);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * SECONDARY HANDLERS
   */
  private async handleNotificationHelp(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('❓ Notification Help')
      .setDescription('Help with notification setup')
      .setColor(Colors.Blue);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * ERROR HANDLERS
   */
  private async handleUnknownButton(interaction: ButtonInteraction, customId: string): Promise<void> {
    logger.warn(`❓ Unknown button: ${customId}`);
    await interaction.reply({
      content: `❓ Unknown button: ${customId}. Please contact support if this continues.`,
      ephemeral: true
    });
  }

  private async handleError(interaction: ButtonInteraction, error: any): Promise<void> {
    logger.error('Button interaction error:', error);

    const errorMessage = `❌ **Button Error**\n\nSomething went wrong processing your request.\n\n**Error Details:**\n\`\`\`\n${error.message || 'Unknown error'}\n\`\`\`\n\nPlease try again or contact support if this continues.`;

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: errorMessage
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }

  /**
   * ADDITIONAL VIP HANDLERS
   */
  private async handleVipSettings(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ VIP Settings')
      .setDescription(`Customize your VIP experience, ${interaction.user.displayName}!`)
      .setColor(getTierColor('vip'))
      .addFields(
        {
          name: '🔔 Notification Settings',
          value: '• Pick alerts: ON/OFF\n• Performance reports: Weekly\n• Capper updates: Instant\n• Market alerts: Enabled',
          inline: false
        },
        {
          name: '📊 Dashboard Preferences',
          value: '• Default view: Performance\n• Chart type: Line graphs\n• Time range: 30 days\n• Auto-refresh: 5 minutes',
          inline: false
        },
        {
          name: '🎯 Pick Preferences',
          value: '• Sports focus: All enabled\n• Risk level: Medium-High\n• Bankroll alerts: 5% threshold\n• Auto-follow: Top 3 cappers',
          inline: false
        }
      )
      .setFooter({ text: `${userTier} Settings • Use buttons below to modify` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_notifications')
          .setLabel('Notification Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('dashboard_settings')
          .setLabel('Dashboard Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleVipPlusSettings(interaction: ButtonInteraction, userTier: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ VIP+ Elite Settings')
      .setDescription(`Advanced settings for ${interaction.user.displayName}'s VIP+ experience!`)
      .setColor(getTierColor('vip_plus'))
      .addFields(
        {
          name: '🔔 Elite Notifications',
          value: '• Instant pick alerts: ON\n• Performance reports: Daily\n• Market movements: Real-time\n• Exclusive insights: Enabled\n• AI predictions: Active',
          inline: false
        },
        {
          name: '📊 Advanced Analytics',
          value: '• Live tracking: Enabled\n• Predictive models: Active\n• Risk analysis: Advanced\n• Portfolio optimization: ON\n• Custom alerts: 12 active',
          inline: false
        },
        {
          name: '🎯 Elite Features',
          value: '• Auto-betting: Configured\n• Smart bankroll: Active\n• Hedge recommendations: ON\n• Live arbitrage: Enabled\n• Premium research: Full access',
          inline: false
        }
      )
      .setFooter({ text: `${userTier} Elite Settings • Premium configuration active` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_vip_plus_notifications')
          .setLabel('Elite Notifications')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('advanced_analytics')
          .setLabel('Analytics Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('elite_features')
          .setLabel('Elite Features')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⭐')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  /**
   * NEW ONBOARDING TEST HANDLERS
   */

  private async handleStartVipPlusTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🚀 VIP+ Tour Started!')
      .setDescription(`Welcome to your exclusive VIP+ features, ${interaction.user.displayName}!`)
      .addFields(
        {
          name: '🌟 Premium Analytics',
          value: 'Advanced performance tracking and insights',
          inline: true
        },
        {
          name: '⚡ Instant Alerts',
          value: 'Real-time pick notifications',
          inline: true
        },
        {
          name: '🧠 AI Coaching',
          value: 'Personalized betting insights',
          inline: true
        },
        {
          name: '🎯 Direct Access',
          value: 'Priority support channel',
          inline: true
        },
        {
          name: '📊 Exclusive Tools',
          value: 'Advanced betting analytics',
          inline: true
        },
        {
          name: '💎 Elite Community',
          value: 'VIP+ exclusive discussions',
          inline: true
        }
      )
      .setFooter({ text: 'Use /help to see all your new VIP+ commands!' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleNotificationSettings(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('⚙️ VIP+ Notification Settings')
      .setDescription('Your premium notification preferences:')
      .addFields(
        {
          name: '✅ Active Notifications',
          value: '• Instant pick alerts\n• Market movement notifications\n• Performance updates\n• Exclusive content alerts\n• AI insights\n• Risk management alerts',
          inline: false
        },
        {
          name: '🔧 Customization',
          value: 'Contact our support team or use `/settings` to customize these preferences.',
          inline: false
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleAiCoach(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🧠 AI Coach Activated!')
      .setDescription('Your personal AI betting coach is ready to help!')
      .addFields(
        {
          name: '📈 Analysis',
          value: 'Get detailed pick breakdowns and market analysis',
          inline: false
        },
        {
          name: '🎯 Strategy',
          value: 'Receive personalized betting advice and recommendations',
          inline: false
        },
        {
          name: '📊 Performance',
          value: 'Track your improvement areas and success patterns',
          inline: false
        },
        {
          name: '🔍 Insights',
          value: 'Market trend analysis and predictive modeling',
          inline: false
        },
        {
          name: '💡 Try Asking',
          value: '"Analyze my recent betting performance"\n"What\'s the best strategy for NBA games?"\n"Show me my risk profile"',
          inline: false
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleAnalytics(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📊 VIP+ Analytics Dashboard')
      .setDescription('Access your comprehensive betting analytics:')
      .addFields(
        {
          name: '📈 Win Rate Tracking',
          value: 'Monitor your success percentage across all sports',
          inline: false
        },
        {
          name: '💰 ROI Analysis',
          value: 'Track your return on investment and profit trends',
          inline: false
        },
        {
          name: '🎯 Pattern Recognition',
          value: 'Identify your most successful betting patterns',
          inline: false
        },
        {
          name: '⚖️ Risk Management',
          value: 'Portfolio optimization and bankroll management tools',
          inline: false
        },
        {
          name: '🚀 Quick Access',
          value: 'Use `/analytics` to view your detailed performance dashboard!',
          inline: false
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}