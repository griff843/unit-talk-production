import {
  Client,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { botConfig } from '../config';
import { UserTier, DMTrigger, DMTemplate, DMConditions } from '../types';
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
import { PermissionUtils } from '../utils/permissions';

import { SupabaseService } from './supabase';

export class DMService {
  private client: Client;
  private supabaseService: SupabaseService;
  private cooldowns: Map<string, Map<string, number>> = new Map();
  private readonly DEFAULT_COOLDOWN = 300000; // 5 minutes in milliseconds
  private triggers: Map<string, DMTrigger> = new Map();

  constructor(client: Client, supabaseService: SupabaseService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.loadTriggers().catch(error => {
      logger.error('Failed to load DM triggers:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  }

  /**
   * Load DM triggers from configuration
   */
  private async loadTriggers(): Promise<void> {
    try {
      // Initialize with empty triggers for now
      this.triggers = new Map();
      logger.info('Loaded DM triggers:', { triggerCount: this.triggers.size });
    } catch (error) {
      logger.error('Error loading DM triggers:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Send a tier-based DM to a user
   */
  async sendTierBasedDM(
    userId: string,
    tier: UserTier,
    contentType: string,
    content: any,
    options: {
      delay?: number;
      priority?: 'high' | 'medium' | 'low';
      templateId?: string;
      bypassTierCheck?: boolean;
    } = {}
  ): Promise<boolean> {
    logger.info('[DM] sendTierBasedDM called', {
      userId,
      tier,
      contentType,
      options,
      hasContent: !!content,
      hasEmbeds: !!content.embeds,
      hasComponents: !!content.components,
    });
    try {
      const isOnboarding = contentType === 'onboarding';
      const shouldReceive =
        options.bypassTierCheck || isOnboarding || tier === 'vip' || tier === 'vip_plus';
      logger.info('[DM] Eligibility check', { userId, tier, contentType, shouldReceive });

      if (!shouldReceive) {
        logger.debug('[DM] User not eligible for DMs', { userId, tier, contentType });
        return false;
      }

      if (!isOnboarding && this.isOnCooldown(userId, contentType)) {
        logger.debug('[DM] User is on cooldown', { userId, contentType });
        return false;
      }

      logger.info('[DM] Attempting to fetch user', { userId });
      let user: User | null = null;
      try {
        user = await this.client.users.fetch(userId);
        logger.info('[DM] Successfully fetched user', { userId, username: user.username });
      } catch (fetchError) {
        logger.error('[DM] Could not fetch user', {
          userId,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        return false;
      }

      logger.info('[DM] Attempting to create DM channel', { userId });
      let dmChannel;
      try {
        dmChannel = await user.createDM();
        logger.info('[DM] Successfully created DM channel', { userId });
      } catch (dmError) {
        logger.error('[DM] Could not create DM channel', {
          userId,
          error: dmError instanceof Error ? dmError.message : String(dmError),
        });
        return false;
      }

      logger.info('[DM] Attempting to send DM', { userId, contentType, hasContent: !!content });
      try {
        await dmChannel.send(content);
        logger.info('[DM] Successfully sent DM', { userId, username: user.username });

        if (!isOnboarding) {
          this.setCooldown(userId, contentType);
        }

        await this.logDMSent(userId, content, options.templateId);
        return true;
      } catch (sendError) {
        logger.error('[DM] Failed to send DM', {
          userId,
          error: sendError instanceof Error ? sendError.message : String(sendError),
        });
        return false;
      }
    } catch (error) {
      logger.error('[DM] Error in sendTierBasedDM', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Send pick alerts to VIP+ users instantly, VIP users with delay
   */
  async sendPickAlert(pickData: any): Promise<void> {
    try {
      // Get all VIP+ and VIP users
      const { data: users } = await this.supabaseService.client
        .from('user_profiles')
        .select('discord_id, tier, preferences')
        .in('tier', ['vip', 'vip_plus'])
        .eq('preferences->dmNotifications', true)
        .eq('preferences->pickAlerts', true);

      if (!users) return;

      const pickEmbed = this.createPickEmbed(pickData);

      for (const user of users) {
        const tier = user.tier as UserTier;

        // VIP+ gets all picks instantly
        if (tier === 'vip_plus') {
          await this.sendTierBasedDM(user.discord_id, tier, 'all_picks', {
            embeds: [pickEmbed],
            content: `🚨 **NEW PICK ALERT** 🚨`,
          });
        }
        // VIP gets high-confidence picks with delay
        else if (tier === 'vip' && pickData.confidence >= 8) {
          await this.sendTierBasedDM(
            user.discord_id,
            tier,
            'high_confidence_picks',
            {
              embeds: [pickEmbed],
              content: `⭐ **HIGH CONFIDENCE PICK** ⭐`,
            },
            { delay: 5 }
          );
        }
      }
    } catch (error) {
      logger.error('Failed to send pick alerts:', error);
    }
  }

  /**
   * Send live game updates to VIP+ users
   */
  async sendLiveUpdate(gameData: any, updateType: string): Promise<void> {
    try {
      const { data: users } = await this.supabaseService.client
        .from('user_profiles')
        .select('discord_id, tier, preferences')
        .eq('tier', 'vip_plus')
        .eq('preferences->liveUpdates', true);

      if (!users) return;

      const updateEmbed = this.createLiveUpdateEmbed(gameData, updateType);

      for (const user of users) {
        await this.sendTierBasedDM(user.discord_id, 'vip_plus', 'live_alerts', {
          embeds: [updateEmbed],
          content: `🔴 **LIVE UPDATE** 🔴`,
        });
      }
    } catch (error) {
      logger.error('Failed to send live updates:', error);
    }
  }

  /**
   * Send recap summaries to VIP and VIP+ users
   */
  async sendRecapSummary(recapData: any): Promise<void> {
    try {
      const { data: users } = await this.supabaseService.client
        .from('user_profiles')
        .select('discord_id, tier, preferences')
        .in('tier', ['vip', 'vip_plus'])
        .eq('preferences->recapSummaries', true);

      if (!users) return;

      const recapEmbed = this.createRecapEmbed(recapData);

      for (const user of users) {
        const tier = user.tier as UserTier;
        const delay = tier === 'vip_plus' ? 0 : 15; // VIP+ is_instant, VIP 15min delay

        await this.sendTierBasedDM(
          user.discord_id,
          tier,
          'recaps',
          {
            embeds: [recapEmbed],
            content: `📊 **DAILY RECAP** 📊`,
          },
          { delay }
        );
      }
    } catch (error) {
      logger.error('Failed to send recap summaries:', error);
    }
  }

  /**
   * Send personalized coaching DMs to VIP+ users
   */
  async sendCoachingDM(userId: string, coachingData: any): Promise<void> {
    try {
      const { data: user } = await this.supabaseService.client
        .from('user_profiles')
        .select('tier, preferences')
        .eq('discord_id', userId)
        .single();

      if (!user || user.tier !== 'vip_plus') return;

      const coachingEmbed = this.createCoachingEmbed(coachingData);

      await this.sendTierBasedDM(userId, 'vip_plus', 'coaching', {
        embeds: [coachingEmbed],
        content: `🎯 **PERSONALIZED COACHING** 🎯`,
        components: [this.createCoachingButtons()],
      });
    } catch (error) {
      logger.error('Failed to send coaching DM:', error);
    }
  }

  /**
   * Process keyword/emoji triggers
   */
  async processTrigger(userId: string, content: string, channelId: string): Promise<void> {
    try {
      for (const [triggerId, trigger] of this.triggers) {
        if (this.matchesTrigger(trigger, content, channelId)) {
          // Check if user meets conditions
          const userTier = await this.getUserTier(userId);
          if (!trigger.conditions?.tiers?.includes(userTier)) continue;

          // Check cooldown
          if (this.isOnCooldown(userId, triggerId)) continue;

          // Send DM
          if (!trigger.template) continue;
          const templateId =
            typeof trigger.template === 'string' ? trigger.template : (trigger.template as any)?.id;
          const template = await this.getTemplate(templateId);
          if (template) {
            await this.sendTierBasedDM(userId, userTier, triggerId, {
              content:
                this.processTemplate(template.content, { userId }) ||
                trigger.trigger ||
                'Trigger activated',
              embeds: template.embeds || [],
            });

            this.setCooldown(userId, triggerId);
            await this.updateTriggerStats(triggerId);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process triggers:', error);
    }
  }

  /**
   * Create pick alert embed
   */
  private createPickEmbed(pickData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎯 ${pickData.sport} Pick`)
      .setDescription(pickData.description)
      .addFields(
        { name: '🎲 Odds', value: pickData.odds, inline: true },
        { name: '💰 Units', value: pickData.units.toString(), inline: true },
        { name: '📊 Confidence', value: `${pickData.confidence}/10`, inline: true },
        { name: '⚡ Edge', value: `${pickData.edge}%`, inline: true },
        { name: '🏆 Tier', value: pickData.tier, inline: true },
        { name: '⏰ Game Time', value: pickData.gameTime, inline: true }
      )
      .setColor(0x00ff00)
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - Premium Picks' });
  }

  /**
   * Create live update embed
   */
  private createLiveUpdateEmbed(gameData: any, updateType: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🔴 Live Update: ${gameData.teams}`)
      .setDescription(`**${updateType}**: ${gameData.update}`)
      .addFields(
        { name: '📊 Score', value: gameData.professional_score, inline: true },
        { name: '⏱️ Time', value: gameData.time, inline: true },
        { name: '📈 Impact', value: gameData.impact, inline: true }
      )
      .setColor(0xff0000)
      .setTimestamp();
  }

  /**
   * Create recap embed
   */
  private createRecapEmbed(recapData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📊 Daily Recap Summary')
      .setDescription(recapData.summary)
      .addFields(
        { name: '✅ Wins', value: recapData.wins.toString(), inline: true },
        { name: '❌ Losses', value: recapData.losses.toString(), inline: true },
        { name: '📈 Win Rate', value: `${recapData.winRate}%`, inline: true },
        { name: '💰 Profit/Loss', value: `${recapData.profitLoss} units`, inline: true },
        { name: '🎯 Best Pick', value: recapData.bestPick, inline: false }
      )
      .setColor(0x0099ff)
      .setTimestamp();
  }

  /**
   * Create coaching embed
   */
  private createCoachingEmbed(coachingData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🎯 Your Personalized Coaching Report')
      .setDescription(coachingData.summary)
      .addFields(
        { name: '📈 Strengths', value: coachingData.strengths.join('\n'), inline: true },
        { name: '🎯 Focus Areas', value: coachingData.improvements.join('\n'), inline: true },
        {
          name: '💡 Key Recommendations',
          value: coachingData.recommendations.join('\n'),
          inline: false,
        }
      )
      .setColor(0x9b59b6)
      .setTimestamp();
  }

  /**
   * Create coaching action buttons
   */
  private createCoachingButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('coaching_schedule')
        .setLabel('Schedule Session')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📅'),
      new ButtonBuilder()
        .setCustomId('coaching_feedback')
        .setLabel('Provide Feedback')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId('coaching_history')
        .setLabel('View History')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );
  }

  /**
   * Check if a user is on cooldown for a specific content type
   */
  private isOnCooldown(userId: string, contentType: string): boolean {
    const userCooldowns = this.cooldowns.get(userId);
    if (!userCooldowns) return false;

    const lastSent = userCooldowns.get(contentType);
    if (!lastSent) return false;

    const now = Date.now();
    return now - lastSent < this.DEFAULT_COOLDOWN;
  }

  /**
   * Set cooldown for a user and content type
   */
  private setCooldown(userId: string, contentType: string): void {
    if (!this.cooldowns.has(userId)) {
      this.cooldowns.set(userId, new Map());
    }
    this.cooldowns.get(userId)!.set(contentType, Date.now());
  }

  /**
   * Check if content matches trigger
   */
  private matchesTrigger(trigger: DMTrigger, content: string, channelId: string): boolean {
    // Check channel conditions
    if (trigger.conditions?.channels && !trigger.conditions.channels.includes(channelId)) {
      return false;
    }

    // Check time window
    if (trigger.conditions?.timeWindow) {
      const now = toISOString(new Date());

      // Null safety for startHour and endHour
      const startHour = (trigger.conditions.timeWindow as any)?.startHour;
      const endHour = (trigger.conditions.timeWindow as any)?.endHour;
      const timezone = (trigger.conditions.timeWindow as any)?.timezone;

      const currentHour =
        timezone && typeof timezone === 'string'
          ? parseInt(
              (
                new Date()
                  .toLocaleString('en-US', { timeZone: timezone, hour12: false })
                  .split(' ')[1] || '0:0'
              ).split(':')[0] ?? '0'
            )
          : now
            ? getHours(now)
            : getHours(new Date());

      if (typeof startHour === 'number' && typeof endHour === 'number') {
        if (currentHour < startHour || currentHour > endHour) {
          return false;
        }
      } else if (
        typeof trigger.conditions.timeWindow === 'object' &&
        'start' in trigger.conditions.timeWindow &&
        'end' in trigger.conditions.timeWindow
      ) {
        const timeWindow = trigger.conditions.timeWindow as { start: number; end: number };
        const startTime = timeWindow.start;
        const endTime = timeWindow.end;

        const currentTime = new Date(now).getHours() * 60 + getMinutes(now);

        if (currentTime < startTime || currentTime > endTime) {
          return false;
        }
      }
    }

    // Check trigger match
    switch (trigger.type) {
      case 'keyword':
        // Check keyword match
        if (trigger.trigger && content.toLowerCase().includes(trigger.trigger.toLowerCase())) {
          return true;
        }
        return false;
      case 'emoji':
        return trigger.trigger ? content.includes(trigger.trigger) : false;
      default:
        return false;
    }
  }

  /**
   * Get user tier from database
   */
  private async getUserTier(userId: string): Promise<UserTier> {
    try {
      const { data: user } = await this.supabaseService.client
        .from('user_profiles')
        .select('tier')
        .eq('discord_id', userId)
        .single();

      return (user?.tier as UserTier) || 'member';
    } catch (error) {
      return 'member';
    }
  }

  /**
   * Get template from database
   */
  private async getTemplate(templateId: string): Promise<DMTemplate | null> {
    try {
      const { data: template } = await this.supabaseService.client
        .from('dm_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      return template as DMTemplate;
    } catch (error) {
      return null;
    }
  }

  /**
   * Process template variables
   */
  private processTemplate(content: string, variables: Record<string, any>): string {
    let processed = content;
    for (const [key, value] of Object.entries(variables)) {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return processed;
  }

  /**
   * Track DM sent for analytics
   */
  private async trackDMSent(userId: string, contentType: string, tier: UserTier): Promise<void> {
    try {
      await this.supabaseService.client.from('dm_analytics').insert({
        user_id: userId,
        content_type: contentType,
        tier: tier,
        sent_at: toISOString(new Date()),
      });
    } catch (error) {
      logger.error('Failed to track DM sent:', error);
    }
  }

  /**
   * Log DM sent to database
   */
  private async logDMSent(userId: string, content: any, templateId?: string): Promise<void> {
    try {
      // await this.supabaseService.createDMLog({ // Method doesn't exist yet
      // Temporary logging instead
      logger.info('DM Log would be created:', {
        user_id: userId,
        content_type: typeof content === 'string' ? 'text' : 'rich',
        template_id: templateId,
        sent_at: toISOString(new Date()),
      });
    } catch (error) {
      logger.error(`Failed to log DM for ${userId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Update trigger statistics
   */
  private async updateTriggerStats(triggerId: string): Promise<void> {
    try {
      // First get the current count
      const { data: currentData } = await this.supabaseService.client
        .from('dm_triggers')
        .select('trigger_count')
        .eq('id', triggerId)
        .single();

      const newCount = (currentData?.trigger_count || 0) + 1;

      await this.supabaseService.client
        .from('dm_triggers')
        .update({
          trigger_count: newCount,
          last_triggered: toISOString(new Date()),
        })
        .eq('id', triggerId);
    } catch (error) {
      logger.error('Failed to update trigger stats:', error);
    }
  }

  /**
   * Reload triggers (for admin updates)
   */
  async reloadTriggers(): Promise<void> {
    await this.loadTriggers();
  }

  /**
   * Get DM analytics
   */
  async getDMAnalytics(days: number = 30): Promise<any> {
    try {
      const { data: analytics } = await this.supabaseService.client
        .from('dm_analytics')
        .select('*')
        .gte('sent_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      return analytics;
    } catch (error) {
      logger.error('Failed to get DM analytics:', error);
      return [];
    }
  }

  private getDMDelayForTier(tier: string): number {
    const delays: Record<string, number> = {
      member: -1, // No DMs
      vip: 300000, // 5 minutes
      vip_plus: 0, // Instant
    };
    return delays[tier] ?? -1;
  }

  /**
   * Send welcome message
   * DISABLED: Now handled by OnboardingService
   */
  async sendWelcomeMessage(member: any, tier: string): Promise<void> {
    // Welcome messages are now handled by OnboardingService
    logger.info(
      `Welcome message for ${member.user.username} (${tier}) handled by OnboardingService`
    );
  }

  async checkMessageTriggers(message: any): Promise<void> {
    // Implementation for checking message triggers
    // This would analyze the message content and trigger appropriate DMs
    try {
      // Placeholder implementation
      logger.debug('Checking message triggers for DM system');
    } catch (error) {
      logger.error('Failed to check message triggers:', error);
    }
  }
}

export const dmService = new DMService(
  {} as Client, // Will be initialized in main
  {} as SupabaseService // Will be initialized in main
);
