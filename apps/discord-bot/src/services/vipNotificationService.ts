import {
  Client,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';

import { botConfig } from '../config';
import { UserTier, VIPNotificationSequence } from '../types/index';
import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
} from '../utils/dateUtils';
import { logger } from '../utils/logger';

import { PermissionsService } from './permissions';
import { SupabaseService } from './supabase';

export class VIPNotificationService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private activeSequences: Map<string, VIPNotificationSequence> = new Map();

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.initializeSequences();
  }

  /**
   * Initialize VIP notification sequences from database
   */
  private async initializeSequences(): Promise<void> {
    try {
      const { data: sequences } = await this.supabaseService.client
        .from('vip_notification_sequences')
        .select('*')
        .eq('is_active', true);

      if (sequences) {
        sequences.forEach(seq => {
          this.activeSequences.set(seq.id, seq as VIPNotificationSequence);
        });
        logger.info(`Loaded ${sequences.length} VIP notification sequences`);
      }
    } catch (error) {
      logger.error('Failed to load VIP notification sequences:', error);
    }
  }

  /**
   * Handle new VIP+ member welcome flow
   * DISABLED: ComprehensiveOnboardingService now handles all welcome messages
   */

  /**
   * Send is_instant pick alerts to VIP+ users
   */
  async sendVIPPlusInstantAlert(pickData: any): Promise<void> {
    try {
      const vipPlusUsers = await this.getVIPPlusUsers();

      for (const user of vipPlusUsers) {
        const embed = new EmbedBuilder()
          .setTitle('🚨 VIP+ INSTANT PICK ALERT')
          .setDescription(`**${pickData.teams}**\n${pickData.pick}`)
          .addFields(
            { name: 'Units', value: `${pickData.units}`, inline: true },
            { name: 'Odds', value: `${pickData.odds}`, inline: true },
            { name: 'Confidence', value: `${pickData.confidence}%`, inline: true }
          )
          .setColor('#FFD700')
          .setTimestamp()
          .setFooter({ text: 'VIP+ Exclusive - Instant Alert' });

        if (pickData.reasoning) {
          embed.addFields({ name: 'Reasoning', value: pickData.reasoning });
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`track_pick_${pickData.id}`)
            .setLabel('Track This Pick')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`view_analysis_${pickData.id}`)
            .setLabel('View Analysis')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
        );

        await this.sendDMToUser(user.discord_id, { embeds: [embed], components: [actionRow] });
      }

      logger.info(`Sent VIP+ is_instant alerts to ${vipPlusUsers.length} users`);
    } catch (error) {
      logger.error('Failed to send VIP+ is_instant alerts:', error);
    }
  }

  /**
   * Send delayed pick alerts to VIP users (15-30 minute delay)
   */
  async sendVIPDelayedAlert(pickData: any): Promise<void> {
    try {
      const vipUsers = await this.getVIPUsers();
      const delay = Math.floor(Math.random() * 15 + 15) * 60 * 1000; // 15-30 minutes

      setTimeout(async () => {
        for (const user of vipUsers) {
          const embed = new EmbedBuilder()
            .setTitle('📈 VIP PICK ALERT')
            .setDescription(`**${pickData.teams}**\n${pickData.pick}`)
            .addFields(
              { name: 'Units', value: `${pickData.units}`, inline: true },
              { name: 'Odds', value: `${pickData.odds}`, inline: true }
            )
            .setColor('#4169E1')
            .setTimestamp()
            .setFooter({ text: 'VIP Alert' });

          await this.sendDMToUser(user.discord_id, { embeds: [embed] });
        }
        logger.info(`Sent VIP delayed alerts to ${vipUsers.length} users`);
      }, delay);
    } catch (error) {
      logger.error('Failed to send VIP delayed alerts:', error);
    }
  }

  /**
   * Send personalized reminder sequences
   */
  async sendPersonalizedReminder(userId: string, reminderType: string): Promise<void> {
    try {
      const user = await this.getUserProfile(userId);
      if (!user) return;

      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member) return;

      const tier = this.permissionsService.getUserTier(member);

      let embed: EmbedBuilder;

      switch (reminderType) {
        case 'daily_picks':
          embed = this.createDailyPicksReminder(user, tier);
          break;
        case 'weekly_recap':
          embed = await this.createWeeklyRecapReminder(user, tier);
          break;
        case 'tier_benefits':
          embed = this.createTierBenefitsReminder(user, tier);
          break;
        case 'engagement_boost':
          embed = this.createEngagementBoostReminder(user, tier);
          break;
        default:
          return;
      }

      await this.sendDMToUser(userId, { embeds: [embed] });

      // Track reminder sent
      await this.trackReminderSent(userId, reminderType, tier);
    } catch (error) {
      logger.error(`Failed to send personalized reminder to ${userId}:`, error);
    }
  }

  /**
   * Execute welcome flow step
   */
  private async executeWelcomeStep(flow: any, stepIndex: number): Promise<void> {
    if (!flow.steps || stepIndex >= flow.steps.length) {
      flow.completed = true;
      return;
    }

    const step = flow.steps[stepIndex];
    if (!step || step.delay === undefined) {
      return;
    }

    if (step.delay > 0) {
      setTimeout(
        async () => {
          if (step && flow.userId) {
            await this.sendDMToUser(flow.userId, step.content);
            flow.currentStep = stepIndex + 1;

            if (!step.requiresResponse) {
              await this.executeWelcomeStep(flow, stepIndex + 1);
            }
          }
        },
        step.delay * 60 * 1000
      );
    } else {
      if (flow.userId) {
        await this.sendDMToUser(flow.userId, step.content);
        flow.currentStep = stepIndex + 1;

        if (!step.requiresResponse) {
          await this.executeWelcomeStep(flow, stepIndex + 1);
        }
      }
    }
  }

  /**
   * Create VIP+ welcome message
   */

  // Helper methods
  private async getVIPPlusUsers(): Promise<any[]> {
    const { data } = await this.supabaseService.client
      .from('user_profiles')
      .select('*')
      .eq('tier', 'vip_plus')
      .eq('is_active', true);
    return data || [];
  }

  private async getVIPUsers(): Promise<any[]> {
    const { data } = await this.supabaseService.client
      .from('user_profiles')
      .select('*')
      .eq('tier', 'vip')
      .eq('is_active', true);
    return data || [];
  }

  private async getUserProfile(userId: string): Promise<any> {
    const { data } = await this.supabaseService.client
      .from('user_profiles')
      .select('*')
      .eq('discord_id', userId)
      .single();
    return data;
  }

  private async sendDMToUser(userId: string, content: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(content);
    } catch (error) {
      logger.error(`Failed to send DM to user ${userId}:`, error);
    }
  }

  private createFeaturesTourMessage(): any {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP+ Features Tour')
      .setDescription('Let me show you around your exclusive features!')
      .addFields(
        { name: '1. Instant Alerts ⚡', value: "You'll receive picks immediately when posted" },
        { name: '2. AI Coaching 🤖', value: 'Get personalized analysis of your betting patterns' },
        { name: '3. Multi-language 🌍', value: 'Receive content in your preferred language' },
        { name: '4. Advanced Analytics 📊', value: 'Deep dive into your performance metrics' }
      )
      .setColor('#FFD700');

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tour_complete')
        .setLabel('Got it!')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    return { embeds: [embed], components: [actionRow] };
  }

  private createVIPFeaturesTourMessage(): any {
    const embed = new EmbedBuilder()
      .setTitle('📈 VIP Features Overview')
      .setDescription("Here's what you have access to as a VIP member:")
      .addFields(
        { name: 'Early Access 🕐', value: 'Get picks 15-30 minutes before free members' },
        { name: 'Detailed Analysis 📊', value: 'See reasoning behind each pick' },
        { name: 'Performance Tracking 📈', value: 'Monitor your betting success' }
      )
      .setColor('#4169E1')
      .setFooter({ text: 'Want is_instant alerts and AI features? Upgrade to VIP+!' });

    return { embeds: [embed] };
  }

  private createFirstPickReminderMessage(): any {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Ready for Your First VIP+ Pick?')
      .setDescription(
        "You've been a VIP+ member for 24 hours now. Have you tried tracking a pick yet?"
      )
      .addFields(
        { name: 'How to Track', value: 'Click the "Track This Pick" button on any pick alert' },
        { name: 'Benefits', value: 'Get detailed analytics and AI insights on your selections' }
      )
      .setColor('#FFD700');

    return { embeds: [embed] };
  }

  private createEngagementCheckMessage(): any {
    const embed = new EmbedBuilder()
      .setTitle("💬 How's Your VIP+ Experience?")
      .setDescription("You've been with us for 3 days now. How are you finding the VIP+ features?")
      .setColor('#FFD700');

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('feedback_excellent')
        .setLabel('Excellent!')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🌟'),
      new ButtonBuilder()
        .setCustomId('feedback_good')
        .setLabel('Good')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👍'),
      new ButtonBuilder()
        .setCustomId('feedback_needs_help')
        .setLabel('Need Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓')
    );

    return { embeds: [embed], components: [actionRow] };
  }

  private createUpgradeSuggestionMessage(): any {
    const embed = new EmbedBuilder()
      .setTitle('⬆️ Ready to Level Up?')
      .setDescription("You've been enjoying VIP features! Consider upgrading to VIP+ for:")
      .addFields(
        { name: '⚡ Instant Alerts', value: 'No more waiting - get picks immediately' },
        { name: '🤖 AI Coaching', value: 'Personal AI analysis of your betting patterns' },
        { name: '🌍 Multi-language Support', value: 'Content in your preferred language' }
      )
      .setColor('#4169E1')
      .setFooter({ text: 'Contact an admin to upgrade to VIP+' });

    return { embeds: [embed] };
  }

  private createDailyPicksReminder(user: any, tier: UserTier): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📅 Daily Picks Available!')
      .setDescription(`Hey ${user.username}! Fresh picks are ready for today.`)
      .addFields(
        { name: 'Your Tier', value: tier.toUpperCase(), inline: true },
        {
          name: 'Available Picks',
          value: tier === 'vip_plus' ? 'All Picks' : tier === 'vip' ? 'VIP + Free' : 'Free Only',
          inline: true,
        }
      )
      .setColor(tier === 'vip_plus' ? '#FFD700' : tier === 'vip' ? '#4169E1' : '#808080')
      .setTimestamp();
  }

  private async createWeeklyRecapReminder(user: any, _tier: UserTier): Promise<EmbedBuilder> {
    // Get user's weekly stats
    const stats = await this.getUserWeeklyStats(user.discord_id);

    return new EmbedBuilder()
      .setTitle('📊 Your Weekly Recap')
      .setDescription(`Here's how you performed this week, ${user.username}!`)
      .addFields(
        { name: 'Picks Tracked', value: `${stats.picksTracked}`, inline: true },
        { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
        {
          name: 'Units Won/Lost',
          value: `${stats.unitsChange > 0 ? '+' : ''}${stats.unitsChange}`,
          inline: true,
        }
      )
      .setColor(stats.unitsChange > 0 ? '#00FF00' : '#FF0000')
      .setTimestamp();
  }

  private createTierBenefitsReminder(_user: any, tier: UserTier): EmbedBuilder {
    const benefits: Record<UserTier, string[]> = {
      member: ['Free picks access', 'Basic community features'],
      trial: ['Limited AI coaching', 'Basic analysis', 'Community access'],
      vip: ['Early pick access', 'Detailed analysis', 'Performance tracking'],
      vip_plus: ['Instant alerts', 'AI coaching', 'Multi-language support', 'Advanced analytics'],
      capper: ['Professional tools', 'Advanced analytics', 'Capper insights'],
      staff: ['All VIP+ features', 'Staff tools', 'Moderation access'],
      admin: ['All staff features', 'Admin panel access', 'System management'],
      owner: ['Full system access', 'All features unlocked'],
    };

    return new EmbedBuilder()
      .setTitle(`🎯 Your ${tier.toUpperCase()} Benefits`)
      .setDescription(`Don't forget about all the features available to you:`)
      .addFields(
        benefits[tier].map((benefit: string, index: number) => ({
          name: `${index + 1}. ${benefit}`,
          value: '\u200b',
          inline: false,
        }))
      )
      .setColor(tier === 'vip_plus' ? '#FFD700' : tier === 'vip' ? '#4169E1' : '#808080');
  }

  private createEngagementBoostReminder(user: any, _tier: UserTier): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🚀 Boost Your Engagement!')
      .setDescription(`${user.username}, here are some ways to get more value:`)
      .addFields(
        {
          name: '📊 Track More Picks',
          value: 'Use the tracking feature to analyze your performance',
        },
        { name: '💬 Join Discussions', value: 'Engage with the community in channels' },
        { name: '🎯 Set Goals', value: 'Define your betting objectives and track progress' }
      )
      .setColor('#FF6B35')
      .setTimestamp();
  }

  private async getUserWeeklyStats(_userId: string): Promise<any> {
    // Implementation would fetch actual stats from database
    return {
      picksTracked: 12,
      winRate: 67,
      unitsChange: 5.5,
    };
  }

  private async trackReminderSent(
    userId: string,
    reminderType: string,
    tier: UserTier
  ): Promise<void> {
    try {
      await this.supabaseService.client.from('notification_logs').insert({
        user_id: userId,
        type: 'reminder',
        subtype: reminderType,
        tier: tier,
        sent_at: toISOString(new Date()),
      });
    } catch (error) {
      logger.error('Failed to track reminder sent:', error);
    }
  }

  /**
   * Handle new member joining
   * DISABLED: Now handled by OnboardingService
   */
  async handleNewMember(member: GuildMember): Promise<void> {
    // Completely disabled - OnboardingService handles all welcome messages
    return;
  }

  /**
   * Handle regular member welcome with enhanced onboarding
   * DISABLED: OnboardingService now handles all welcome messages
   */
  async handleRegularMemberWelcome(member: GuildMember): Promise<void> {
    // Completely disabled - OnboardingService handles all welcome messages
    return;
  }

  /**
   * Handle tier changes
   */
  async handleTierChange(member: GuildMember, oldTier: string, newTier: string): Promise<void> {
    try {
      // Only handle tier change notifications, not welcome messages
      if (oldTier === newTier) return;

      // Log tier change
      logger.info(`Tier change for ${member.user.username}: ${oldTier} -> ${newTier}`);

      // Handle downgrades only - upgrades are handled by OnboardingService
      if (oldTier === 'vip_plus' && newTier !== 'vip_plus') {
        await this.handleVIPPlusDowngrade(member, newTier as UserTier);
      } else if (oldTier === 'vip' && newTier === 'member') {
        await this.handleVIPDowngrade(member);
      }
    } catch (error) {
      logger.error('Error handling tier change:', error);
    }
  }

  /**
   * Initialize notification flows
   */
  async initializeNotificationFlows(): Promise<void> {
    await this.initializeSequences();
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue(): Promise<void> {
    try {
      // Process any pending notifications
      // Temporarily disable welcome flows processing
      // for (const [userId, flow] of this.welcomeFlows) {
      //   if (!flow.completed) {
      //     await this.processWelcomeFlow(userId, flow);
      //   }
      // }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    }
  }

  /**
   * Process welcome flow for a user
   */
  private async processWelcomeFlow(userId: string, flow: any): Promise<void> {
    // Placeholder for welcome flow processing
    // This will be implemented when needed
  }

  /**
   * Handle VIP+ downgrade notification
   */
  private async handleVIPPlusDowngrade(member: GuildMember, newTier: UserTier): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📉 VIP+ Access Updated')
        .setDescription(`Hi ${member.displayName}, your VIP+ access has been updated.`)
        .addFields(
          {
            name: '📋 What Changed',
            value:
              newTier === 'vip'
                ? 'You now have VIP access instead of VIP+'
                : 'You now have standard member access',
          },
          {
            name: '🔒 Features No Longer Available',
            value:
              '• Heat Signal alerts\n• AI coaching features\n• Instant pick notifications\n• Advanced analytics\n• Multi-language support',
          },
          {
            name: '✅ Still Available',
            value:
              newTier === 'vip'
                ? '• VIP picks and analysis\n• Early access to picks\n• Basic analytics\n• VIP channels'
                : '• Free daily picks\n• Basic community access',
          },
          {
            name: '🔄 Want to Upgrade Again?',
            value: "Contact our team if you'd like to restore your VIP+ access!",
          }
        )
        .setColor('#FF6B6B')
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      const upgradeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⬆️')
      );

      await member.send({
        embeds: [embed],
        components: [upgradeButton],
      });

      logger.info('VIP+ downgrade notification sent', {
        userId: member.id,
        username: member.user.username,
        newTier,
      });
    } catch (error) {
      logger.error('Error sending VIP+ downgrade notification:', error);
    }
  }

  /**
   * Handle VIP downgrade notification
   */
  private async handleVIPDowngrade(member: GuildMember): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📉 VIP Access Updated')
        .setDescription(
          `Hi ${member.displayName}, your VIP access has been updated to standard member access.`
        )
        .addFields(
          {
            name: '🔒 Features No Longer Available',
            value:
              '• VIP exclusive picks\n• Early access to picks\n• VIP channels\n• Basic analytics\n• Premium content',
          },
          {
            name: '✅ Still Available',
            value: '• Free daily picks\n• Community discussions\n• Basic support',
          },
          {
            name: '🔄 Want VIP Access Again?',
            value: 'You can upgrade back to VIP anytime to restore your premium features!',
          }
        )
        .setColor('#FF6B6B')
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      const upgradeButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_vip')
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⬆️'),
        new ButtonBuilder()
          .setCustomId('upgrade_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💎')
      );

      await member.send({
        embeds: [embed],
        components: [upgradeButtons],
      });

      logger.info('VIP downgrade notification sent', {
        userId: member.id,
        username: member.user.username,
      });
    } catch (error) {
      logger.error('Error sending VIP downgrade notification:', error);
    }
  }

  /**
   * Handle Capper welcome notification
   */
  private async handleCapperWelcome(member: GuildMember): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`🎯 Welcome UT Capper ${member.displayName}!`)
        .setDescription("You've been granted capper privileges! Here's how to get started:")
        .addFields(
          {
            name: '📋 Getting Started',
            value: [
              '• Complete your capper onboarding with `/capper-onboard`',
              '• Set your display name and tier',
              '• Learn the pick submission process',
              '• Understand performance tracking',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🎯 Your Capper Tools',
            value: [
              '• `/submit-pick` - Submit betting picks',
              '• `/edit-pick` - Edit existing picks',
              '• `/delete-pick` - Remove picks',
              '• `/capper-stats` - View your performance',
            ].join('\n'),
            inline: false,
          },
          {
            name: '📊 Performance Tracking',
            value: [
              'All your picks are automatically tracked for:',
              '• Win/Loss record',
              '• ROI and profit tracking',
              '• Leaderboard rankings',
              '• Monthly performance reports',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🏆 Capper Benefits',
            value: [
              '• Submit unlimited picks',
              '• Access to capper-only channels',
              '• Performance analytics dashboard',
              '• Monthly leaderboard competitions',
              '• Direct feedback from the community',
            ].join('\n'),
            inline: false,
          }
        )
        .setColor('#E67E22')
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'Complete your onboarding to start submitting picks!' })
        .setTimestamp();

      const capperButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

      await member.send({
        embeds: [embed],
        components: [capperButtons],
      });

      logger.info('Capper welcome notification sent', {
        userId: member.id,
        username: member.user.username,
        displayName: member.displayName,
      });

      // Also notify admins about new capper
      await this.notifyAdminsOfCapperAssignment(member);
    } catch (error) {
      logger.error('Error sending capper welcome notification:', error);

      // If DM fails, try to notify in a channel
      await this.fallbackCapperNotification(member);
    }
  }

  /**
   * Notify admins about new capper assignment
   */
  private async notifyAdminsOfCapperAssignment(member: GuildMember): Promise<void> {
    try {
      const adminChannelId = process.env.ADMIN_CHANNEL_ID;
      if (!adminChannelId) return;

      const adminChannel = member.guild.channels.cache.get(adminChannelId) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🎯 New Capper Assigned')
        .setDescription(
          `${member.displayName} (${member.user.tag}) has been assigned the UT Capper role.`
        )
        .addFields(
          { name: 'User ID', value: member.id, inline: true },
          { name: 'Join Date', value: member.joinedAt?.toDateString() || 'Unknown', inline: true },
          { name: 'Account Created', value: member.user.createdAt.toDateString(), inline: true }
        )
        .setColor('#E67E22')
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await adminChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error notifying admins of capper assignment:', error);
    }
  }

  /**
   * Fallback notification if DM fails
   */
  private async fallbackCapperNotification(member: GuildMember): Promise<void> {
    try {
      const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
      if (!welcomeChannelId) return;

      const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🎯 Welcome New UT Capper!')
        .setDescription(`Welcome ${member.displayName}! You've been assigned as a UT Capper.`)
        .addFields(
          {
            name: '📧 DM Issue',
            value:
              "We tried to send you a welcome DM but couldn't reach you. Make sure your DMs are open for important capper notifications!",
            inline: false,
          },
          {
            name: '🚀 Next Steps',
            value: 'Use `/capper-onboard` to complete your onboarding and start submitting picks!',
            inline: false,
          }
        )
        .setColor('#E67E22')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error sending fallback capper notification:', error);
    }
  }

  /**
   * Send welcome message for tier change
   * DISABLED: Now handled by OnboardingService
   */
  async sendWelcomeMessage(member: GuildMember, tier: string): Promise<void> {
    // Welcome messages are now handled by OnboardingService
    logger.info(
      `Welcome message for ${member.user.username} (${tier}) handled by OnboardingService`
    );
  }
}
