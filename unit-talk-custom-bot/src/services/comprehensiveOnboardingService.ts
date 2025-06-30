import {
  Client,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel
} from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { AdvancedAnalyticsService } from './advancedAnalyticsService';
import { 
  createFreeWelcomeEmbed,
  createVIPWelcomeEmbed,
  createVIPPlusWelcomeEmbed,
  createTrialWelcomeEmbed,
  createTrialReminderEmbed,
  createChannelUnlockEmbed,
  createReEngagementEmbed,
  createFirstWinCongratulationsEmbed,
  createMissedValueEmbed
} from '../utils/embeds';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import { UserTier } from '../types/index';

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  order: number;
  dmTemplate: string;
  buttonText?: string;
  nextStep?: string;
  roleToAssign?: string;
  channelToNotify?: string;
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  steps: OnboardingStep[];
  welcomeMessage: string;
  completionMessage: string;
  failureMessage: string;
  isActive: boolean;
}

export interface OnboardingProgress {
  userId: string;
  flowId: string;
  currentStep: string;
  completedSteps: string[];
  startedAt: Date;
  lastActivity: Date;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
  preferences: Record<string, any>;
  dmFailures: string[];
  retryCount: number;
}

export interface TrialUser {
  discord_id: string;
  started_at: Date;
  expires_at: Date;
  active: boolean;
  reminder_48h_sent: boolean;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
}

export class ComprehensiveOnboardingService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private analyticsService: AdvancedAnalyticsService;
  private onboardingFlows: Map<string, OnboardingFlow> = new Map();
  private userProgress: Map<string, OnboardingProgress> = new Map();
  private trialReminderInterval: NodeJS.Timeout | null = null;

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    analyticsService: AdvancedAnalyticsService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.analyticsService = analyticsService;

    this.initializeOnboardingFlows();
    this.startTrialReminderSystem();
  }

  /**
   * Create capper welcome embed
   */
  public createCapperWelcomeEmbed(username: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎯 Welcome UT Capper ${username}!`)
      .setColor('#E67E22')
      .setDescription('You\'ve been granted capper privileges! Here\'s how to get started:')
      .addFields(
        {
          name: '📋 Getting Started',
          value: [
            '• Complete your capper onboarding',
            '• Set your display name and tier',
            '• Learn the pick submission process',
            '• Understand performance tracking'
          ].join('\n'),
          inline: false
        },
        {
          name: '🎯 Your Capper Tools',
          value: [
            '• `/submit-pick` - Submit betting picks',
            '• `/edit-pick` - Edit existing picks',
            '• `/delete-pick` - Remove picks',
            '• `/capper-stats` - View your performance'
          ].join('\n'),
          inline: false
        },
        {
          name: '📊 Performance Tracking',
          value: [
            'All your picks are automatically tracked for:',
            '• Win/Loss record',
            '• ROI and profit tracking',
            '• Leaderboard rankings',
            '• Monthly performance reports'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Complete your onboarding to start submitting picks!' })
      .setTimestamp();
  }

  /**
   * Initialize default onboarding flows for each tier
   */
  private initializeOnboardingFlows(): void {
    // Free tier onboarding flow
    const freeFlow: OnboardingFlow = {
      id: 'free_welcome',
      name: 'Free Member Welcome',
      description: 'Welcome flow for new free members',
      targetRole: 'member',
      welcomeMessage: 'Welcome to Unit Talk!',
      completionMessage: 'Welcome complete!',
      failureMessage: 'Welcome failed',
      isActive: true,
      steps: [
        {
          id: 'free_welcome_dm',
          name: 'Welcome DM',
          description: 'Send welcome DM with upgrade options',
          required: true,
          order: 1,
          dmTemplate: 'free_welcome'
        }
      ]
    };

    this.onboardingFlows.set('free_welcome', freeFlow);
    logger.info('Initialized comprehensive onboarding flows');
  }

  /**
   * Handle new member join - determine tier and send appropriate welcome
   */
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      const userTier = this.permissionsService.getUserTier(member);
      logger.info(`New member joined: ${member.user.username} (tier: ${userTier})`);

      // Send appropriate welcome message based on tier
      await this.sendTierBasedWelcome(member, userTier);

      // Track the onboarding event
      await this.analyticsService.trackEvent('member_joined', member.id, {
        username: member.user.username,
        tier: userTier
      });

    } catch (error) {
      logger.error('Error handling member join:', error);
    }
  }

  /**
   * Handle role assignment - send tier-specific welcome when upgraded
   */
  async handleRoleAssignment(member: GuildMember, newTier: UserTier): Promise<void> {
    try {
      logger.info(`Role assigned: ${member.user.username} -> ${newTier}`);

      // Send tier-specific welcome
      await this.sendTierBasedWelcome(member, newTier);

      // Unlock appropriate channels
      await this.unlockTierChannels(member, newTier);

      // Track the upgrade event
      await this.analyticsService.trackEvent('tier_upgraded', member.id, {
        username: member.user.username,
        newTier: newTier
      });

    } catch (error) {
      logger.error('Error handling role assignment:', error);
    }
  }

  /**
   * Send tier-based welcome message with appropriate buttons
   */
  private async sendTierBasedWelcome(member: GuildMember, tier: UserTier): Promise<void> {
    try {
      let embed: EmbedBuilder;
      let actionRow: ActionRowBuilder<ButtonBuilder> | null = null;

      switch (tier as UserTier) {
        case 'member':
          const freeWelcome = createFreeWelcomeEmbed(member.user.username);
          embed = freeWelcome.embed;
          actionRow = freeWelcome.buttons;
          break;

        case 'trial':
          const trialWelcome = createTrialWelcomeEmbed(member.user.username);
          embed = trialWelcome.embed;
          actionRow = trialWelcome.buttons;
          break;

        case 'vip':
          embed = createVIPWelcomeEmbed(member.user.username);
          actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('start_vip_tour')
                .setLabel('Start VIP Tour')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯'),
              new ButtonBuilder()
                .setCustomId('goto_vip_lounge')
                .setLabel('VIP Lounge')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏆'),
              new ButtonBuilder()
                .setCustomId('upgrade_vip_plus')
                .setLabel('Upgrade to VIP+')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💎')
            );
          break;

        case 'vip_plus':
          embed = createVIPPlusWelcomeEmbed(member.user.username);
          actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('vip_plus_tour_start')
                .setLabel('Start VIP+ Tour')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🚀'),
              new ButtonBuilder()
                .setCustomId('ai_coaching')
                .setLabel('AI Coach')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🧠'),
              new ButtonBuilder()
                .setCustomId('view_analytics')
                .setLabel('Analytics')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
            );
          break;

        case 'capper':
          embed = this.createCapperWelcomeEmbed(member.user.username);
          actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('capper_onboard_start')
                .setLabel('Complete Onboarding')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯'),
              new ButtonBuilder()
                .setCustomId('capper_guide')
                .setLabel('Capper Guide')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📖'),
              new ButtonBuilder()
                .setCustomId('capper_support')
                .setLabel('Get Support')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🆘')
            );
          break;

        default:
          // For staff/admin/owner, use basic welcome
          const defaultWelcome = createFreeWelcomeEmbed(member.user.username);
          embed = defaultWelcome.embed;
          actionRow = defaultWelcome.buttons;
          break;
      }

      // Send DM with welcome message
      const components = actionRow ? [actionRow] : [];
      await this.sendDMToUser(member.id, { embeds: [embed], components });

    } catch (error) {
      logger.error(`Error sending tier-based welcome to ${member.user.username}:`, error);
    }
  }

  /**
   * Handle trial user welcome
   */
  async handleTrialWelcome(member: GuildMember): Promise<void> {
    try {
      const embed = createTrialWelcomeEmbed(member.user.username);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_full_vip')
            .setLabel('💎 Upgrade to Full VIP')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('trial_end_time')
            .setLabel('⏰ When does my trial end?')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('learn_vip_works')
            .setLabel('📖 Learn How VIP Works')
            .setStyle(ButtonStyle.Secondary)
        );

      await this.sendDMToUser(member.id, { embeds: [embed], components: [actionRow] });

      // Start trial in database
      await this.startUserTrial(member.id);

      logger.info(`Trial welcome sent to ${member.user.username}`);
    } catch (error) {
      logger.error('Error handling trial welcome:', error);
    }
  }

  /**
   * Start trial reminder system
   */
  private startTrialReminderSystem(): void {
    // Check for trial reminders every hour
    this.trialReminderInterval = setInterval(async () => {
      await this.checkTrialReminders();
    }, 60 * 60 * 1000); // 1 hour

    logger.info('Trial reminder system started');
  }

  /**
   * Check and send trial reminders
   */
  private async checkTrialReminders(): Promise<void> {
    try {
      const { data: trials, error } = await this.supabaseService.client
        .from('user_trials')
        .select('*')
        .eq('active', true);

      if (error || !trials) return;

      for (const trial of trials) {
        const now = new Date();
        const expiresAt = new Date(trial.expires_at);
        const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

        // Send 48-hour reminder
        if (hoursRemaining <= 48 && hoursRemaining > 24 && !trial.reminder_48h_sent) {
          await this.sendTrialReminder(trial.discord_id, 48);
          await this.markReminderSent(trial.id, 'reminder_48h_sent');
        }

        // Send 24-hour reminder
        if (hoursRemaining <= 24 && hoursRemaining > 1 && !trial.reminder_24h_sent) {
          await this.sendTrialReminder(trial.discord_id, 24);
          await this.markReminderSent(trial.id, 'reminder_24h_sent');
        }

        // Send 1-hour reminder
        if (hoursRemaining <= 1 && !trial.reminder_1h_sent) {
          await this.sendTrialReminder(trial.discord_id, 1);
          await this.markReminderSent(trial.id, 'reminder_1h_sent');
        }

        // Expire trial if time is up
        if (hoursRemaining <= 0) {
          await this.expireTrial(trial.discord_id);
        }
      }
    } catch (error) {
      logger.error('Error checking trial reminders:', error);
    }
  }

  /**
   * Send trial reminder to user
   */
  private async sendTrialReminder(discordId: string, hoursRemaining: number): Promise<void> {
    try {
      const embed = createTrialReminderEmbed(hoursRemaining);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip')
            .setLabel('💎 Upgrade Now')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('trial_status')
            .setLabel('⏰ Check Status')
            .setStyle(ButtonStyle.Secondary)
        );

      await this.sendDMToUser(discordId, { embeds: [embed], components: [actionRow] });
      
      logger.info(`Trial reminder sent to user ${discordId} (${hoursRemaining}h remaining)`);
    } catch (error) {
      logger.error(`Error sending trial reminder to ${discordId}:`, error);
    }
  }

  /**
   * Unlock tier-specific channels
   */
  private async unlockTierChannels(member: GuildMember, tier: UserTier): Promise<void> {
    try {
      const guild = member.guild;
      let channelName = '';
      let channelId = '';

      switch (tier) {
        case 'vip':
          channelName = 'VIP Lounge';
          channelId = botConfig.channels.vip;
          break;
        case 'vip_plus':
          channelName = 'VIP+ Elite';
          channelId = botConfig.channels.vipPlus;
          break;
        default:
          return; // No special channels for other tiers
      }

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (channel) {
        const unlockEmbed = createChannelUnlockEmbed(channelName, tier);
        
        // Send welcome message in the unlocked channel
        await channel.send({
          content: `Welcome to the ${channelName}, <@${member.id}>! 👋`,
          embeds: [unlockEmbed]
        });

        logger.info(`Channel ${channelName} unlocked for ${member.user.username}`);
      }
    } catch (error) {
      logger.error('Error unlocking tier channels:', error);
    }
  }

  /**
   * Handle re-engagement for inactive users
   */
  async handleReEngagement(userId: string, daysSinceActive: number): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const embed = createReEngagementEmbed(user.username, daysSinceActive);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('view_trending_picks')
            .setLabel('🔥 View Trending Picks')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('whats_new')
            .setLabel('📰 What\'s New')
            .setStyle(ButtonStyle.Secondary)
        );

      await this.sendDMToUser(userId, { embeds: [embed], components: [actionRow] });
      
      logger.info(`Re-engagement message sent to ${user.username} (${daysSinceActive} days inactive)`);
    } catch (error) {
      logger.error('Error handling re-engagement:', error);
    }
  }

  /**
   * Handle first win congratulations
   */
  async handleFirstWin(userId: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const embed = createFirstWinCongratulationsEmbed(user.username);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_for_more_wins')
            .setLabel('💎 Upgrade for More Wins')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('view_vip_benefits')
            .setLabel('📈 View VIP Benefits')
            .setStyle(ButtonStyle.Secondary)
        );

      await this.sendDMToUser(userId, { embeds: [embed], components: [actionRow] });
      
      logger.info(`First win congratulations sent to ${user.username}`);
    } catch (error) {
      logger.error('Error handling first win:', error);
    }
  }

  /**
   * Show missed value to encourage upgrades
   */
  async showMissedValue(userId: string, missedWins: number, missedProfit: number): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const embed = createMissedValueEmbed(user.username, missedWins, missedProfit);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_to_catch_up')
            .setLabel('🚀 Upgrade to Catch Up')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('start_trial_now')
            .setLabel('🎟️ Start $1 Trial')
            .setStyle(ButtonStyle.Secondary)
        );

      await this.sendDMToUser(userId, { embeds: [embed], components: [actionRow] });
      
      logger.info(`Missed value message sent to ${user.username} (${missedWins} wins, ${missedProfit}u profit)`);
    } catch (error) {
      logger.error('Error showing missed value:', error);
    }
  }

  /**
   * Utility method to send DM to user
   */
  private async sendDMToUser(userId: string, messageOptions: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(messageOptions);
    } catch (error) {
      logger.error(`Failed to send DM to user ${userId}:`, error);
      // Could implement fallback to channel mention or database logging
    }
  }

  /**
   * Start user trial in database
   */
  private async startUserTrial(discordId: string): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (72 * 60 * 60 * 1000)); // 72 hours

      await this.supabaseService.client
        .from('user_trials')
        .insert({
          discord_id: discordId,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          active: true,
          reminder_48h_sent: false,
          reminder_24h_sent: false,
          reminder_1h_sent: false
        });

      logger.info(`Trial started for user ${discordId}`);
    } catch (error) {
      logger.error('Error starting user trial:', error);
    }
  }

  /**
   * Mark reminder as sent
   */
  private async markReminderSent(trialId: string, reminderField: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('user_trials')
        .update({ [reminderField]: true })
        .eq('id', trialId);
    } catch (error) {
      logger.error('Error marking reminder as sent:', error);
    }
  }

  /**
   * Expire user trial
   */
  private async expireTrial(discordId: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('user_trials')
        .update({ active: false })
        .eq('discord_id', discordId);

      // Send trial expired message
      const user = await this.client.users.fetch(discordId);
      // Implementation for trial expired message would go here

      logger.info(`Trial expired for user ${discordId}`);
    } catch (error) {
      logger.error('Error expiring trial:', error);
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.trialReminderInterval) {
      clearInterval(this.trialReminderInterval);
      this.trialReminderInterval = null;
    }
    logger.info('Comprehensive onboarding service destroyed');
  }
}