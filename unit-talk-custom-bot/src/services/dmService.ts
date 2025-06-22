import { Client, User, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SupabaseService } from './supabase';
import { UserTier, DMTrigger, DMTemplate, DMConditions } from '../types';
import { PermissionUtils } from '../utils/permissions';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class DMService {
  private client: Client;
  private supabaseService: SupabaseService;
  private triggers: Map<string, DMTrigger> = new Map();
  private userCooldowns: Map<string, Map<string, number>> = new Map();

  constructor(client: Client, supabaseService: SupabaseService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.loadTriggers();
  }

  /**
   * Load DM triggers from database
   */
  private async loadTriggers(): Promise<void> {
    try {
      const { data: triggers } = await this.supabaseService.client
        .from('dm_triggers')
        .select('*')
        .eq('is_active', true);

      if (triggers) {
        this.triggers.clear();
        triggers.forEach(trigger => {
          this.triggers.set(trigger.id, trigger as DMTrigger);
        });
        logger.info(`Loaded ${triggers.length} DM triggers`);
      }
    } catch (error) {
      logger.error('Failed to load DM triggers:', error);
    }
  }

  /**
   * Send DM to user based on tier and content type
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
    } = {}
  ): Promise<boolean> {
    try {
      // Check if user should receive this type of DM
      // For now, we'll use a simple check based on tier
      const shouldReceive = tier === 'vip' || tier === 'vip_plus';
      if (!shouldReceive) {
        return false;
      }

      // Check cooldowns
      if (this.isOnCooldown(userId, contentType)) {
        logger.debug(`User ${userId} is on cooldown for ${contentType}`);
        return false;
      }

      // Get delay based on tier
      const delay = options.delay ?? this.getDMDelayForTier(tier);
      if (delay < 0) return false; // No DMs for this tier

      // Schedule DM
      if (delay > 0) {
        setTimeout(() => {
          this.sendDirectMessage(userId, content, options.templateId);
        }, delay * 60 * 1000);
      } else {
        await this.sendDirectMessage(userId, content, options.templateId);
      }

      // Set cooldown
      this.setCooldown(userId, contentType);

      // Track DM sent
      await this.trackDMSent(userId, contentType, tier);

      return true;
    } catch (error) {
      logger.error(`Failed to send DM to user ${userId}:`, error);
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
            content: `🚨 **NEW PICK ALERT** 🚨`
          });
        }
        // VIP gets high-confidence picks with delay
        else if (tier === 'vip' && pickData.confidence >= 8) {
          await this.sendTierBasedDM(user.discord_id, tier, 'high_confidence_picks', {
            embeds: [pickEmbed],
            content: `⭐ **HIGH CONFIDENCE PICK** ⭐`
          }, { delay: 5 });
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
          content: `🔴 **LIVE UPDATE** 🔴`
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
        const delay = tier === 'vip_plus' ? 0 : 15; // VIP+ instant, VIP 15min delay

        await this.sendTierBasedDM(user.discord_id, tier, 'recaps', {
          embeds: [recapEmbed],
          content: `📊 **DAILY RECAP** 📊`
        }, { delay });
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
        components: [this.createCoachingButtons()]
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
          const templateId = typeof trigger.template === 'string' ? trigger.template : (trigger.template as any)?.id;
          const template = await this.getTemplate(templateId);
          if (template) {
            await this.sendDirectMessage(userId, {
              content: this.processTemplate(template.content, { userId }) || (trigger.trigger || 'Trigger activated'),
              embeds: template.embeds || []
            });

            this.setCooldown(userId, triggerId, trigger.conditions?.cooldown || 60);
            await this.updateTriggerStats(triggerId);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process triggers:', error);
    }
  }

  /**
   * Send direct message to user
   */
  private async sendDirectMessage(userId: string, content: any, templateId?: string): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) return false;

      await user.send(content);
      
      // Log DM sent
      await this.logDMSent(userId, content, templateId);
      
      return true;
    } catch (error) {
      logger.error(`Failed to send DM to ${userId}:`, error);
      return false;
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
      .setColor(0x00FF00)
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
        { name: '📊 Score', value: gameData.score, inline: true },
        { name: '⏱️ Time', value: gameData.time, inline: true },
        { name: '📈 Impact', value: gameData.impact, inline: true }
      )
      .setColor(0xFF0000)
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
      .setColor(0x0099FF)
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
        { name: '💡 Key Recommendations', value: coachingData.recommendations.join('\n'), inline: false }
      )
      .setColor(0x9B59B6)
      .setTimestamp();
  }

  /**
   * Create coaching action buttons
   */
  private createCoachingButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
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
   * Check if user is on cooldown for specific trigger
   */
  private isOnCooldown(userId: string, triggerId: string): boolean {
    const userCooldowns = this.userCooldowns.get(userId);
    if (!userCooldowns) return false;

    const cooldownEnd = userCooldowns.get(triggerId);
    if (!cooldownEnd) return false;

    return Date.now() < cooldownEnd;
  }

  /**
   * Set cooldown for user and trigger
   */
  private setCooldown(userId: string, triggerId: string, minutes: number = 60): void {
    if (!this.userCooldowns.has(userId)) {
      this.userCooldowns.set(userId, new Map());
    }

    const userCooldowns = this.userCooldowns.get(userId)!;
    userCooldowns.set(triggerId, Date.now() + (minutes * 60 * 1000));
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
      const now = new Date();

      // Null safety for startHour and endHour
      const startHour = (trigger.conditions.timeWindow as any)?.startHour;
      const endHour = (trigger.conditions.timeWindow as any)?.endHour;
      const timezone = (trigger.conditions.timeWindow as any)?.timezone;

      const currentHour = timezone && typeof timezone === 'string' ?
        parseInt((new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false }).split(' ')[1] || '0:0').split(':')[0] ?? '0') :
        (now?.getHours() ?? new Date().getHours());

      if (typeof startHour === 'number' && typeof endHour === 'number') {
        if (currentHour < startHour || currentHour > endHour) {
          return false;
        }
      } else if (typeof trigger.conditions.timeWindow === 'object' &&
          'start' in trigger.conditions.timeWindow &&
          'end' in trigger.conditions.timeWindow) {
        const timeWindow = trigger.conditions.timeWindow as { start: number; end: number };
        const startTime = timeWindow.start;
        const endTime = timeWindow.end;

        const currentTime = now.getHours() * 60 + now.getMinutes();

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
      await this.supabaseService.client
        .from('dm_analytics')
        .insert({
          user_id: userId,
          content_type: contentType,
          tier: tier,
          sent_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to track DM sent:', error);
    }
  }

  /**
   * Log DM sent
   */
  private async logDMSent(userId: string, content: any, templateId?: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('dm_logs')
        .insert({
          user_id: userId,
          content: JSON.stringify(content),
          template_id: templateId,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });
    } catch (error) {
      logger.error('Failed to log DM:', error);
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
          last_triggered: new Date().toISOString()
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
      'member': -1, // No DMs
      'vip': 300000, // 5 minutes
      'vip_plus': 0 // Instant
    };
    return delays[tier] ?? -1;
  }

  async sendWelcomeDM(userId: string): Promise<void> {
    try {
      const welcomeMessage = "Welcome to Unit Talk! 🎉\n\nWe're excited to have you join our community of sports betting enthusiasts.";
      await this.sendDirectMessage(userId, welcomeMessage);
    } catch (error) {
      logger.error(`Failed to send welcome DM to ${userId}:`, error);
    }
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