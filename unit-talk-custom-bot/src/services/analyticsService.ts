import { Client, GuildMember, Message, ThreadChannel, User } from 'discord.js';
import { SupabaseService } from './supabase';
import { 
  AnalyticsEvent, 
  UserEngagementMetrics, 
  SystemMetrics, 
  ChannelAnalytics,
  UserTier,
  AnalyticsTimeframe,
  EngagementTrend,
  UserBehaviorPattern
} from '../types';
import { PermissionUtils } from '../utils/permissions';
import { logger } from '../utils/logger';

export class AnalyticsService {
  private client: Client;
  private supabaseService: SupabaseService;
  private eventQueue: AnalyticsEvent[] = [];
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor(client: Client, supabaseService: SupabaseService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.startBatchProcessor();
  }

  // Event Tracking Methods
  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event
    };

    this.eventQueue.push(analyticsEvent);

    // Flush immediately for critical events
    if (event.type === 'error' || event.type === 'security') {
      await this.flushEvents();
    }
  }

  async trackUserEngagement(userId: string, action: string, metadata?: Record<string, any>, guildId?: string): Promise<void> {
    await this.trackEvent({
      type: 'engagement',
      userId,
      guildId: guildId || 'unknown',
      action,
      metadata: {
        ...metadata,
        userTier: await this.getUserTier(userId)
      }
    });
  }

  async trackMessage(userId: string, channelId: string, message: any, guildId?: string): Promise<void> {
    const userTier = await this.getUserTier(userId);
    await this.trackEvent({
      type: 'message',
      userId,
      channelId,
      guildId: guildId || 'unknown',
      action: 'sent',
      metadata: {
        messageLength: message.content?.length || 0,
        hasAttachments: message.attachments?.size > 0,
        hasEmbeds: message.embeds?.length > 0,
        userTier,
        channelType: message.channel?.type
      }
    });
  }

  async trackReaction(userId: string, messageId: string, emoji: string, guildId?: string): Promise<void> {
    const userTier = await this.getUserTier(userId);
    await this.trackEvent({
      type: 'reaction',
      userId,
      guildId: guildId || 'unknown',
      action: 'added',
      metadata: {
        messageId,
        emoji,
        userTier
      }
    });
  }

  async trackThreadActivity(userId: string, channelId: string, threadData: any, guildId?: string): Promise<void> {
    const userTier = await this.getUserTier(userId);
    await this.trackEvent({
      type: 'thread',
      userId,
      channelId,
      guildId: guildId || 'unknown',
      action: 'created',
      metadata: {
        threadName: threadData.name,
        parentChannelId: threadData.parentId,
        messageCount: threadData.messageCount,
        memberCount: threadData.memberCount,
        userTier
      }
    });
  }

  async trackCommand(userId: string, commandName: string, metadata?: Record<string, any>, guildId?: string): Promise<void> {
    await this.trackEvent({
      type: 'command',
      userId,
      guildId: guildId || 'unknown',
      action: commandName,
      metadata: metadata || {}
    });
  }

  async trackDM(userId: string, dmType?: string, guildId?: string): Promise<void> {
    const userTier = await this.getUserTier(userId);
    await this.trackEvent({
      type: 'dm',
      userId,
      guildId: guildId || 'unknown',
      action: 'sent',
      metadata: {
        dmType,
        userTier
      }
    });
  }

  async trackSystemEvent(eventType: string, metadata: Record<string, any>): Promise<void> {
    await this.trackEvent({
      type: 'system',
      userId: 'system',
      guildId: 'system',
      action: eventType,
      metadata
    });
  }

  // Analytics Retrieval Methods
  async getUserEngagementMetrics(userId: string, timeframe: AnalyticsTimeframe = '30d'): Promise<UserEngagementMetrics> {
    const dateFilter = this.getDateFilter(timeframe);
    
    const { data: events } = await this.supabaseService.client
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', dateFilter)
      .order('timestamp', { ascending: false });

    if (!events) {
      return this.getEmptyUserMetrics();
    }

    return this.calculateUserMetrics(events);
  }

  async getChannelAnalytics(channelId: string, timeframe: AnalyticsTimeframe = '30d'): Promise<ChannelAnalytics> {
    const dateFilter = this.getDateFilter(timeframe);
    
    const { data: events } = await this.supabaseService.client
      .from('analytics_events')
      .select('*')
      .eq('channel_id', channelId)
      .gte('timestamp', dateFilter)
      .order('timestamp', { ascending: false });

    if (!events) {
      return this.getEmptyChannelAnalytics();
    }

    return this.calculateChannelMetrics(events);
  }

  async getSystemMetrics(timeframe: AnalyticsTimeframe = '24h'): Promise<SystemMetrics> {
    const dateFilter = this.getDateFilter(timeframe);

    const [
      { data: events },
      { data: errors },
      { data: users }
    ] = await Promise.all([
      this.supabaseService.client
        .from('analytics_events')
        .select('*')
        .gte('timestamp', dateFilter),
      this.supabaseService.client
        .from('analytics_events')
        .select('*')
        .eq('type', 'error')
        .gte('timestamp', dateFilter),
      this.supabaseService.client
        .from('user_profiles')
        .select('discord_id, tier, last_active')
        .gte('last_active', dateFilter)
    ]);

    const errorCount = errors?.length || 0;
    const totalEvents = events?.length || 0;
    const memoryUsage = process.memoryUsage().heapUsed;
    const uptime = await this.calculateUptime(timeframe);

    return {
      status: errorCount > totalEvents * 0.1 ? 'critical' : errorCount > totalEvents * 0.05 ? 'warning' : 'healthy',
      uptime,
      memoryUsage,
      cpuUsage: 0, // TODO: Implement CPU usage calculation
      errors: errorCount,
      warnings: 0 // TODO: Implement warning count
    };
  }

  async getEngagementTrends(timeframe: AnalyticsTimeframe = '30d'): Promise<EngagementTrend[]> {
    const dateFilter = this.getDateFilter(timeframe);
    const interval = this.getIntervalForTimeframe(timeframe);
    
    const { data: trends } = await this.supabaseService.client
      .rpc('get_engagement_trends', {
        start_date: dateFilter,
        interval_type: interval
      });

    return trends || [];
  }

  async getUserBehaviorPatterns(userId: string): Promise<UserBehaviorPattern> {
    const { data: events } = await this.supabaseService.client
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', this.getDateFilter('90d'))
      .order('timestamp', { ascending: false });

    if (!events || events.length === 0) {
      return this.getEmptyBehaviorPattern();
    }

    return this.analyzeBehaviorPatterns(events);
  }

  async getTopUsers(metric: 'messages' | 'reactions' | 'threads' | 'picks', timeframe: AnalyticsTimeframe = '30d', limit = 10): Promise<Array<{userId: string, count: number, tier: UserTier}>> {
    const dateFilter = this.getDateFilter(timeframe);
    
    const { data: topUsers } = await this.supabaseService.client
      .rpc('get_top_users_by_metric', {
        metric_type: metric,
        start_date: dateFilter,
        user_limit: limit
      });

    return topUsers || [];
  }

  // Advanced Analytics Methods
  async generateDashboardData(timeframe: AnalyticsTimeframe = '30d'): Promise<any> {
    const [
      systemMetrics,
      engagementTrends,
      topUsers,
      channelActivity
    ] = await Promise.all([
      this.getSystemMetrics(timeframe),
      this.getEngagementTrends(timeframe),
      this.getTopUsers('messages', timeframe, 5),
      this.getChannelActivitySummary(timeframe)
    ]);

    return {
      systemMetrics,
      engagementTrends,
      topUsers,
      channelActivity,
      generatedAt: new Date().toISOString()
    };
  }

  async getChannelActivitySummary(timeframe: AnalyticsTimeframe = '30d'): Promise<any[]> {
    const dateFilter = this.getDateFilter(timeframe);
    
    const { data: channelActivity } = await this.supabaseService.client
      .rpc('get_channel_activity_summary', {
        start_date: dateFilter
      });

    return channelActivity || [];
  }

  async trackConversionFunnel(userId: string, step: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      type: 'conversion',
      userId,
      guildId: 'default', // Add default guildId
      action: `funnel_${step}`,
      metadata: {
        ...metadata,
        userTier: await this.getUserTier(userId),
        timestamp: new Date().toISOString()
      }
    });
  }

  async getConversionMetrics(timeframe: AnalyticsTimeframe = '30d'): Promise<any> {
    const dateFilter = this.getDateFilter(timeframe);
    
    const { data: conversions } = await this.supabaseService.client
      .from('analytics_events')
      .select('*')
      .eq('type', 'conversion')
      .gte('timestamp', dateFilter);

    if (!conversions) return {};

    // Calculate conversion rates between steps
    const funnelSteps = ['signup', 'first_message', 'first_reaction', 'tier_upgrade', 'pick_submit'];
    const conversionRates: Record<string, number> = {};

    for (let i = 0; i < funnelSteps.length - 1; i++) {
      const currentStep = funnelSteps[i];
      const nextStep = funnelSteps[i + 1];
      
      const currentStepUsers = new Set(
        conversions
          .filter(c => c.action === `funnel_${currentStep}`)
          .map(c => c.user_id)
      );
      
      const nextStepUsers = new Set(
        conversions
          .filter(c => c.action === `funnel_${nextStep}`)
          .map(c => c.user_id)
      );

      const convertedUsers = [...currentStepUsers].filter(userId => nextStepUsers.has(userId));
      conversionRates[`${currentStep}_to_${nextStep}`] = 
        currentStepUsers.size > 0 ? convertedUsers.length / currentStepUsers.size : 0;
    }

    return { conversionRates, totalUsers: conversions.length };
  }

  // Retention Analysis
  async getUserRetentionMetrics(cohortDate: string): Promise<any> {
    const { data: retentionData } = await this.supabaseService.client
      .rpc('calculate_user_retention', {
        cohort_date: cohortDate
      });

    return retentionData || {};
  }

  // Real-time Analytics
  async getRealTimeMetrics(): Promise<any> {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentEvents } = await this.supabaseService.client
      .from('analytics_events')
      .select('*')
      .gte('timestamp', last5Minutes);

    const activeUsers = new Set(recentEvents?.map(e => e.user_id) || []).size;
    const eventsByType = this.groupEventsByType(recentEvents || []);

    return {
      activeUsers,
      eventsByType,
      totalEvents: recentEvents?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  // Private Helper Methods
  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.flushEvents();
      }
    }, this.flushInterval);
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = this.eventQueue.splice(0, this.batchSize);
    
    try {
      const { error } = await this.supabaseService.client
        .from('analytics_events')
        .insert(eventsToFlush.map(event => ({
          id: event.id,
          type: event.type,
          user_id: event.userId,
          channel_id: event.channelId,
          action: event.action,
          metadata: event.metadata,
          timestamp: event.timestamp
        })));

      if (error) {
        logger.error('Failed to flush analytics events:', error);
        // Re-add events to queue for retry
        this.eventQueue.unshift(...eventsToFlush);
      } else {
        logger.debug(`Flushed ${eventsToFlush.length} analytics events`);
      }
    } catch (error) {
      logger.error('Analytics batch processing error:', error);
      // Re-add events to queue for retry
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  private async getUserTier(userId: string): Promise<UserTier> {
    try {
      const guild = this.client.guilds.cache.first();
      if (!guild) return 'member';

      const member = await guild.members.fetch(userId);
      return PermissionUtils.getUserTier(member);
    } catch {
      return 'member';
    }
  }

  private getDateFilter(timeframe: AnalyticsTimeframe): string {
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  private getIntervalForTimeframe(timeframe: AnalyticsTimeframe): string {
    switch (timeframe) {
      case '1h':
      case '24h':
        return 'hour';
      case '7d':
      case '30d':
        return 'day';
      case '90d':
        return 'week';
      default:
        return 'day';
    }
  }

  private calculateUserMetrics(events: any[]): UserEngagementMetrics {
    const messageEvents = events.filter(e => e.type === 'message');
    const reactionEvents = events.filter(e => e.type === 'reaction');
    const threadEvents = events.filter(e => e.type === 'thread');
    const pickEvents = events.filter(e => e.type === 'pick');

    return {
      userId: '', // This should be passed as a parameter
      messagesCount: messageEvents.length,
      reactionsGiven: reactionEvents.filter(e => e.action === 'reaction_added').length,
      reactionsReceived: reactionEvents.filter(e => e.action === 'reaction_received').length,
      threadsCreated: threadEvents.filter(e => e.action === 'thread_created').length,
      threadsParticipated: new Set(threadEvents.map(e => e.channel_id)).size,
      commandsUsed: events.filter(e => e.type === 'command').length,
      averageSessionLength: messageEvents.reduce((sum, e) => sum + (e.metadata?.messageLength || 0), 0) / messageEvents.length || 0,
      lastActive: new Date(events[0]?.timestamp || Date.now()),
      engagementScore: this.calculateEngagementScore(events),
      totalMessages: messageEvents.length,
      totalReactions: reactionEvents.length,
      picksSubmitted: pickEvents.filter(e => e.action === 'pick_submitted').length,
      mostActiveHours: this.calculateMostActiveHours(events)
    };
  }

  private calculateChannelMetrics(events: any[]): ChannelAnalytics {
    const uniqueUsers = new Set(events.map(e => e.user_id)).size;
    const messageEvents = events.filter(e => e.type === 'message');

    return {
      channelId: events[0]?.channel_id || '',
      channelName: events[0]?.metadata?.channelName || 'Unknown',
      messageCount: messageEvents.length,
      uniqueUsers,
      averageMessagesPerUser: messageEvents.length / uniqueUsers || 0,
      peakActivity: new Date(this.calculatePeakActivity(events)),
      totalMessages: messageEvents.length,
      userTierBreakdown: this.calculateUserTierBreakdown(events)
    };
  }

  private groupUsersByTier(users: any[]): Record<UserTier, number> {
    return users.reduce((acc, user) => {
      const tier = user.tier || 'member';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {
      member: 0,
      vip: 0,
      vip_plus: 0,
      staff: 0,
      admin: 0,
      owner: 0
    });
  }

  private groupEventsByType(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
  }

  private async calculateAverageResponseTime(timeframe: AnalyticsTimeframe): Promise<number> {
    // This would calculate average bot response time
    // For now, return a mock value
    return 150; // milliseconds
  }

  private async calculateUptime(timeframe: AnalyticsTimeframe): Promise<number> {
    // This would calculate actual uptime percentage
    // For now, return a mock value
    return 99.8; // percentage
  }

  private calculateMostActiveHours(events: any[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculateEngagementScore(events: any[]): number {
    // Weighted scoring system
    const weights = {
      message: 1,
      reaction: 0.5,
      thread: 2,
      pick: 3,
      dm: 1.5
    };

    return events.reduce((score, event) => {
      const weight = weights[event.type as keyof typeof weights] || 1;
      return score + weight;
    }, 0);
  }

  private calculatePeakActivity(events: any[]): Date {
    const hourCounts: Record<number, number> = {};

    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peak = Object.entries(hourCounts)
      .reduce((max, [hour, count]) =>
        count > max.count ? { hour: parseInt(hour), count } : max,
        { hour: 0, count: 0 }
      );

    // Return a Date object representing the peak hour today
    const today = new Date();
    today.setHours(peak.hour, 0, 0, 0);
    return today;
  }

  private calculateUserTierBreakdown(events: any[]): Record<UserTier, number> {
    const tierCounts: Record<UserTier, number> = {
      member: 0,
      vip: 0,
      vip_plus: 0,
      staff: 0,
      admin: 0,
      owner: 0
    };

    events.forEach(event => {
      const tier = (event.metadata?.userTier || 'member') as UserTier;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    return tierCounts;
  }

  private calculateEngagementTrend(events: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (events.length < 2) return 'stable';
    
    const midpoint = Math.floor(events.length / 2);
    const firstHalf = events.slice(0, midpoint).length;
    const secondHalf = events.slice(midpoint).length;
    
    if (secondHalf > firstHalf * 1.1) return 'increasing';
    if (secondHalf < firstHalf * 0.9) return 'decreasing';
    return 'stable';
  }

  private analyzeBehaviorPatterns(events: any[]): UserBehaviorPattern {
    const patterns = {
      userId: events[0]?.user_id || 'unknown',
      patterns: {
        messageFrequency: events.filter(e => e.type === 'message').length,
        reactionFrequency: events.filter(e => e.type === 'reaction').length,
        threadParticipation: events.filter(e => e.type === 'thread').length
      },
      predictions: {
        nextActiveTime: this.predictNextActiveTime(events),
        likelyChannels: this.getTopChannels(events, 3)
      },
      recommendations: this.generateRecommendations(events),
      mostActiveTimeOfDay: this.calculateMostActiveHours(events)[0] || 12,
      preferredChannels: this.getTopChannels(events, 3),
      engagementStyle: this.determineEngagementStyle(events),
      activityFrequency: this.calculateActivityFrequency(events),
      interactionPreferences: this.analyzeInteractionPreferences(events)
    };

    return patterns;
  }

  private getTopChannels(events: any[], limit: number): string[] {
    const channelCounts: Record<string, number> = {};
    
    events.forEach(event => {
      if (event.channel_id) {
        channelCounts[event.channel_id] = (channelCounts[event.channel_id] || 0) + 1;
      }
    });

    return Object.entries(channelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([channelId]) => channelId);
  }

  private predictNextActiveTime(events: any[]): Date {
    // Simple prediction based on average time between events
    const timestamps = events.map(e => new Date(e.timestamp).getTime()).sort();
    if (timestamps.length < 2) return new Date();

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      const current = timestamps[i];
      const previous = timestamps[i - 1];
      if (current !== undefined && previous !== undefined) {
        intervals.push(current - previous);
      }
    }

    const avgInterval = intervals.length > 0 ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0;
    const lastTimestamp = timestamps[timestamps.length - 1];
    return new Date((lastTimestamp || Date.now()) + avgInterval);
  }

  private generateRecommendations(events: any[]): string[] {
    const recommendations = [];

    const messageEvents = events.filter(e => e.type === 'message');
    const reactionEvents = events.filter(e => e.type === 'reaction');

    if (messageEvents.length < 5) {
      recommendations.push('Consider participating more in discussions');
    }

    if (reactionEvents.length < messageEvents.length * 0.1) {
      recommendations.push('Try reacting to messages you find interesting');
    }

    const uniqueChannels = new Set(events.map(e => e.channel_id)).size;
    if (uniqueChannels < 3) {
      recommendations.push('Explore different channels to diversify your engagement');
    }

    return recommendations;
  }

  private determineEngagementStyle(events: any[]): 'active' | 'moderate' | 'passive' {
    const messageEvents = events.filter(e => e.type === 'message');
    const reactionEvents = events.filter(e => e.type === 'reaction');
    const totalEvents = events.length;

    if (messageEvents.length > totalEvents * 0.6) return 'active';
    if (messageEvents.length > totalEvents * 0.3) return 'moderate';
    return 'passive';
  }

  private calculateActivityFrequency(events: any[]): 'daily' | 'weekly' | 'sporadic' {
    if (events.length === 0) return 'sporadic';

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentEvents = events.filter(e => new Date(e.timestamp) > dayAgo);
    const weeklyEvents = events.filter(e => new Date(e.timestamp) > weekAgo);

    if (recentEvents.length > 0) return 'daily';
    if (weeklyEvents.length > 0) return 'weekly';
    return 'sporadic';
  }

  private analyzeInteractionPreferences(events: any[]): Record<string, number> {
    const preferences: Record<string, number> = {
      messages: 0,
      reactions: 0,
      threads: 0,
      picks: 0
    };

    events.forEach(event => {
      if (event && event.type && typeof event.type === 'string' && preferences.hasOwnProperty(event.type)) {
        preferences[event.type as keyof typeof preferences]++;
      }
    });

    return preferences;
  }

  private getEmptyUserMetrics(): UserEngagementMetrics {
    return {
      userId: '',
      messagesCount: 0,
      reactionsGiven: 0,
      reactionsReceived: 0,
      totalMessages: 0,
      totalReactions: 0,
      threadsParticipated: 0,
      threadsCreated: 0,
      picksSubmitted: 0,
      commandsUsed: 0,
      averageSessionLength: 0,
      mostActiveHours: [],
      engagementScore: 0,
      lastActive: new Date()
    };
  }

  private getEmptyChannelAnalytics(): ChannelAnalytics {
    return {
      channelId: '',
      channelName: '',
      messageCount: 0,
      uniqueUsers: 0,
      averageMessagesPerUser: 0,
      peakActivity: new Date(),
      totalMessages: 0,
      userTierBreakdown: { member: 0, vip: 0, vip_plus: 0 }
    };
  }


  private getEmptyBehaviorPattern(): UserBehaviorPattern {
    return {
      userId: '',
      mostActiveTimeOfDay: 12,
      preferredChannels: [],
      engagementStyle: 'passive',
      activityFrequency: 'sporadic',
      interactionPreferences: {},
      patterns: [],
      predictions: [],
      recommendations: []
    };
  }
}

// Export singleton instance - will be initialized when needed
export let analyticsService: AnalyticsService | null = null;

export function initializeAnalyticsService(client: Client, supabaseService: SupabaseService): AnalyticsService {
  if (!analyticsService) {
    analyticsService = new AnalyticsService(client, supabaseService);
  }
  return analyticsService;
}