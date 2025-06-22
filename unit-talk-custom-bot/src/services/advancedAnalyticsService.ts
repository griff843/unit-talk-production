import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { AnalyticsDashboard, RealTimeStats, ErrorLog, EventLog, UserAnalytics } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class AdvancedAnalyticsService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private realTimeStats!: RealTimeStats;
  private dashboardCache: Map<string, any> = new Map();
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(client: Client, supabaseService: SupabaseService, permissionsService: PermissionsService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.realTimeStats = this.initializeRealTimeStats();
    this.startMetricsCollection();
  }

  /**
   * Initialize real-time stats structure
   */
  private initializeRealTimeStats(): RealTimeStats {
    return {
      activeUsers: 0,
      onlineUsers: 0,
      messagesLastHour: 0,
      commandsLastHour: 0,
      totalMessages: 0,
      picksSubmitted: 0,
      threadsCreated: 0,
      dmsSent: 0,
      commandsExecuted: 0,
      errorsCount: 0,
      uptime: Date.now(),
      lastUpdated: new Date(),
      tierDistribution: {
        member: 0,
        vip: 0,
        vip_plus: 0,
        staff: 0,
        admin: 0,
        owner: 0
      },
      channelActivity: {},
      hourlyMetrics: Array(24).fill(0).map((_, i) => ({
        hour: i,
        count: 0,
        messages: 0,
        picks: 0,
        users: 0
      }))
    };
  }

  /**
   * Start collecting metrics every minute
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectRealTimeMetrics();
      await this.updateHourlyMetrics();
    }, 60000); // Every minute

    logger.info('Started real-time metrics collection');
  }

  /**
   * Generate comprehensive analytics dashboard for owners/staff
   */
  async generateOwnerDashboard(): Promise<AnalyticsDashboard> {
    try {
      const dashboard: AnalyticsDashboard = {
        id: `dashboard_${Date.now()}`,
        name: 'Owner Dashboard',
        description: 'Comprehensive analytics dashboard for owners/staff',
        widgets: [], // We'll populate this with actual widgets
        permissions: ['owner', 'admin', 'staff'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Cache dashboard for 5 minutes
      this.dashboardCache.set('owner_dashboard', {
        data: dashboard,
        expires: Date.now() + 5 * 60 * 1000
      });

      return dashboard;
    } catch (error) {
      logger.error('Failed to generate owner dashboard:', error);
      throw error;
    }
  }

  /**
   * Generate staff-level dashboard (limited access)
   */
  async generateStaffDashboard(): Promise<AnalyticsDashboard> {
    try {
      const dashboard: AnalyticsDashboard = {
        id: `staff_dashboard_${Date.now()}`,
        name: 'Staff Dashboard',
        description: 'Limited analytics dashboard for staff',
        widgets: [],
        permissions: ['staff'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      return dashboard;
    } catch (error) {
      logger.error('Failed to generate staff dashboard:', error);
      throw error;
    }
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats(): RealTimeStats {
    return { ...this.realTimeStats };
  }

  /**
   * Update real-time user count
   */
  updateActiveUsers(count: number): void {
    this.realTimeStats.activeUsers = count;
    this.realTimeStats.lastUpdated = new Date();
  }

  /**
   * Increment message count
   */
  incrementMessageCount(channelId?: string): void {
    if (this.realTimeStats.totalMessages !== undefined) {
      this.realTimeStats.totalMessages++;
    }
    if (channelId && this.realTimeStats.channelActivity) {
      if (!this.realTimeStats.channelActivity[channelId]) {
        this.realTimeStats.channelActivity[channelId] = 0;
      }
      this.realTimeStats.channelActivity[channelId]++;
    }
    this.updateHourlyMetric('messages');
  }

  /**
   * Increment pick count
   */
  incrementPickCount(): void {
    this.realTimeStats.picksSubmitted++;
    this.updateHourlyMetric('picks');
  }

  /**
   * Increment thread count
   */
  incrementThreadCount(): void {
    this.realTimeStats.threadsCreated++;
  }

  /**
   * Increment DM count
   */
  incrementDMCount(): void {
    this.realTimeStats.dmsSent++;
  }

  /**
   * Increment command count
   */
  incrementCommandCount(): void {
    this.realTimeStats.commandsExecuted++;
  }

  /**
   * Increment error count
   */
  incrementErrorCount(): void {
    this.realTimeStats.errorsCount++;
  }

  /**
   * Log error with context
   */
  async logError(error: any, context: any): Promise<void> {
    try {
      const errorLog: ErrorLog = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        level: 'error',
        message: error.message || String(error),
        stack: error.stack,
        context: context,
        userId: context.userId,
        guildId: context.guildId
      };

      await this.supabaseService.client
        .from('error_logs')
        .insert(errorLog);

      this.incrementErrorCount();
      
      // Send alert for critical errors
      if (this.isCriticalError(error)) {
        await this.sendCriticalErrorAlert(errorLog);
      }

    } catch (logError) {
      logger.error('Failed to log error:', logError);
    }
  }

  /**
   * Log event with context
   */
  async logEvent(eventType: string, description: string, context: any): Promise<void> {
    try {
      const eventLog: EventLog = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        type: eventType,
        userId: context.userId,
        channelId: context.channelId,
        guildId: context.guildId,
        severity: context.severity || 'info'
      };

      await this.supabaseService.client
        .from('event_logs')
        .insert(eventLog);

    } catch (error) {
      logger.error('Failed to log event:', error);
    }
  }

  /**
   * Generate user analytics report
   */
  async generateUserAnalyticsReport(userId: string): Promise<UserAnalytics> {
    try {
      const { data: userProfile } = await this.supabaseService.client
        .from('user_profiles')
        .select('*')
        .eq('discord_id', userId)
        .single();

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const { data: userPicks } = await this.supabaseService.client
        .from('user_picks')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const { data: userMessages } = await this.supabaseService.client
        .from('user_messages')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const analytics: UserAnalytics = {
        userId: userId,
        username: userProfile.username,
        tier: userProfile.tier,
        joinDate: userProfile.created_at,
        lastActive: userProfile.last_active,
        totalMessages: userMessages?.length || 0,
        totalPicks: userPicks?.length || 0,
        winRate: this.calculateWinRate(userPicks || []),
        profitLoss: this.calculateUnitsWonLost(userPicks || []),
        favoriteChannels: await this.getUserFavoriteChannels(userId),
        activityPattern: await this.getUserActivityPattern(userId),
        engagementScore: this.calculateEngagementScore(userProfile, userMessages || [], userPicks || []),
      };

      return analytics;
    } catch (error) {
      logger.error(`Failed to generate user analytics for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send real-time dashboard update to admin channel
   */
  async sendDashboardUpdate(): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('📊 Real-Time Dashboard Update')
        .setDescription('Current system statistics')
        .addFields(
          { name: '👥 Active Users', value: `${this.realTimeStats.activeUsers}`, inline: true },
          { name: '💬 Messages Today', value: `${this.realTimeStats.totalMessages}`, inline: true },
          { name: '🎯 Picks Submitted', value: `${this.realTimeStats.picksSubmitted}`, inline: true },
          { name: '🧵 Threads Created', value: `${this.realTimeStats.threadsCreated}`, inline: true },
          { name: '📨 DMs Sent', value: `${this.realTimeStats.dmsSent}`, inline: true },
          { name: '⚠️ Errors', value: `${this.realTimeStats.errorsCount}`, inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp()
        .setFooter({ text: 'Auto-generated dashboard update' });

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('dashboard_full')
            .setLabel('Full Dashboard')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId('dashboard_errors')
            .setLabel('View Errors')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️'),
          new ButtonBuilder()
            .setCustomId('dashboard_users')
            .setLabel('User Analytics')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥')
        );

      await adminChannel.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send dashboard update:', error);
    }
  }

  /**
   * Export analytics data to CSV
   */
  async exportAnalyticsData(type: string, timeRange: string): Promise<string> {
    try {
      let data: any[] = [];
      let headers: string[] = [];

      switch (type) {
        case 'users':
          data = await this.getUsersExportData(timeRange);
          headers = ['User ID', 'Username', 'Tier', 'Join Date', 'Messages', 'Picks', 'Win Rate', 'Units'];
          break;
        case 'picks':
          data = await this.getPicksExportData(timeRange);
          headers = ['Pick ID', 'User', 'Teams', 'Pick', 'Units', 'Odds', 'Result', 'Date'];
          break;
        case 'engagement':
          data = await this.getEngagementExportData(timeRange);
          headers = ['Date', 'Messages', 'Active Users', 'Picks', 'Threads', 'DMs'];
          break;
        default:
          throw new Error('Invalid export type');
      }

      // Convert to CSV
      const csvContent = this.convertToCSV(data, headers);
      
      // Store in temporary location or return as string
      return csvContent;
    } catch (error) {
      logger.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  // Private helper methods
  private async collectRealTimeMetrics(): Promise<void> {
    try {
      // Update active users count
      const guild = this.client.guilds.cache.first();
      if (guild) {
        const onlineMembers = guild.members.cache.filter(member => 
          member.presence?.status === 'online' || 
          member.presence?.status === 'idle' || 
          member.presence?.status === 'dnd'
        ).size;
        this.updateActiveUsers(onlineMembers);
      }

      // Update tier distribution
      await this.updateTierDistribution();
    } catch (error) {
      logger.error('Failed to collect real-time metrics:', error);
    }
  }

  private async updateTierDistribution(): Promise<void> {
    try {
      const { data: tierCounts } = await this.supabaseService.client
        .from('user_profiles')
        .select('tier')
        .eq('is_active', true);

      if (tierCounts) {
        this.realTimeStats.tierDistribution = {
          member: tierCounts.filter(u => u.tier === 'member').length,
          vip: tierCounts.filter(u => u.tier === 'vip').length,
          vip_plus: tierCounts.filter(u => u.tier === 'vip_plus').length,
          staff: tierCounts.filter(u => u.tier === 'staff').length,
          admin: tierCounts.filter(u => u.tier === 'admin').length,
          owner: tierCounts.filter(u => u.tier === 'owner').length
        };
      }
    } catch (error) {
      logger.error('Failed to update tier distribution:', error);
    }
  }

  private updateHourlyMetric(type: 'messages' | 'picks' | 'users'): void {
    const currentHour = new Date().getHours();
    const hourlyMetric = this.realTimeStats.hourlyMetrics?.[currentHour];

    if (!hourlyMetric) {
      this.realTimeStats.hourlyMetrics[currentHour] = {
        hour: currentHour,
        count: 0,
        messages: 0,
        picks: 0,
        users: 0
      };
    }

    const metric = this.realTimeStats.hourlyMetrics[currentHour];

    switch (type) {
      case 'messages':
        if (metric?.messages !== undefined) metric.messages++;
        break;
      case 'picks':
        if (metric?.picks !== undefined) metric.picks++;
        break;
      case 'users':
        if (metric?.users !== undefined) metric.users++;
        break;
    }
  }

  private async updateHourlyMetrics(): Promise<void> {
    // Reset metrics for new hour
    const currentHour = new Date().getHours();
    const currentTime = Date.now();
    const hourStart = new Date();
    hourStart.setHours(currentHour, 0, 0, 0);
    
    // If it's a new hour, reset the metrics
    if (currentTime - hourStart.getTime() < 60000) { // Within first minute of hour
      this.realTimeStats.hourlyMetrics[currentHour] = {
        hour: currentHour,
        count: 0,
        messages: 0,
        picks: 0,
        users: 0
      };
    }
  }

  private getFilteredRealTimeStats(): RealTimeStats {
    // Return stats without sensitive information for staff
    const filtered = { ...this.realTimeStats };
    // Remove or modify sensitive fields as needed
    return filtered;
  }

  private async getUserAnalytics(): Promise<any> {
    const { data } = await this.supabaseService.client
      .from('user_profiles')
      .select('tier, created_at, is_active')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return {
      totalUsers: data?.length || 0,
      newUsersLast30Days: data?.filter(u => u?.created_at && new Date(u.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length || 0,
      activeUsers: data?.filter(u => u?.is_active).length || 0,
      tierDistribution: this.realTimeStats?.tierDistribution || {}
    };
  }

  private async getBasicUserAnalytics(): Promise<any> {
    // Limited version for staff
    return {
      totalUsers: this.realTimeStats.tierDistribution.member + this.realTimeStats.tierDistribution.vip + this.realTimeStats.tierDistribution.vip_plus,
      tierDistribution: this.realTimeStats.tierDistribution
    };
  }

  private async getPickAnalytics(): Promise<any> {
    const { data } = await this.supabaseService.client
      .from('final_picks')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const totalPicks = data?.length || 0;
    const wonPicks = data?.filter(p => p.result === 'won').length || 0;
    const lostPicks = data?.filter(p => p.result === 'lost').length || 0;

    return {
      totalPicks,
      wonPicks,
      lostPicks,
      winRate: totalPicks > 0 ? Math.round((wonPicks / totalPicks) * 100) : 0,
      averageUnits: totalPicks > 0 ? (data?.reduce((sum, p) => sum + (p.units || 0), 0) || 0) / totalPicks : 0
    };
  }

  private async getEngagementMetrics(): Promise<any> {
    // Implementation for engagement metrics
    return {
      averageMessagesPerUser: 0,
      averageSessionDuration: 0,
      retentionRate: 0,
      mostActiveChannels: []
    };
  }

  private async getRevenueMetrics(): Promise<any> {
    // Implementation for revenue metrics (if applicable)
    return {
      monthlyRevenue: 0,
      tierUpgrades: 0,
      churnRate: 0
    };
  }

  private async getSystemHealth(): Promise<any> {
    return {
      uptime: Date.now() - this.realTimeStats.uptime,
      memoryUsage: process.memoryUsage(),
      errorRate: this.realTimeStats.errorsCount,
      responseTime: 0 // Would need to implement response time tracking
    };
  }

  private async getBasicSystemHealth(): Promise<any> {
    return {
      uptime: Date.now() - this.realTimeStats.uptime,
      errorRate: this.realTimeStats.errorsCount
    };
  }

  private async getRecentErrors(limit: number = 100): Promise<ErrorLog[]> {
    const { data } = await this.supabaseService.client
      .from('error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    return data || [];
  }

  private async getRecentEvents(limit: number = 200): Promise<EventLog[]> {
    const { data } = await this.supabaseService.client
      .from('event_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    return data || [];
  }

  private async getTrendAnalysis(): Promise<any> {
    // Implementation for trend analysis
    return {
      userGrowthTrend: 'increasing',
      engagementTrend: 'stable',
      pickAccuracyTrend: 'improving'
    };
  }

  private async getBasicTrendAnalysis(): Promise<any> {
    return {
      userGrowthTrend: 'increasing',
      engagementTrend: 'stable'
    };
  }

  private async getActiveAlerts(): Promise<any[]> {
    // Implementation for active alerts
    return [];
  }

  private calculateWinRate(picks: any[]): number {
    if (picks.length === 0) return 0;
    const wonPicks = picks.filter(p => p.result === 'won').length;
    return Math.round((wonPicks / picks.length) * 100);
  }

  private calculateUnitsWonLost(picks: any[]): number {
    return picks.reduce((total, pick) => {
      if (pick.result === 'won') {
        return total + (pick.units * (pick.odds > 0 ? pick.odds / 100 : Math.abs(100 / pick.odds)));
      } else if (pick.result === 'lost') {
        return total - pick.units;
      }
      return total;
    }, 0);
  }

  private calculateAverageConfidence(picks: any[]): number {
    if (picks.length === 0) return 0;
    const totalConfidence = picks.reduce((sum, pick) => sum + (pick.confidence || 0), 0);
    return Math.round(totalConfidence / picks.length);
  }

  private async getUserFavoriteChannels(userId: string): Promise<string[]> {
    // Implementation to get user's favorite channels
    return [];
  }

  private async getUserActivityPattern(userId: string): Promise<any> {
    // Implementation to get user's activity pattern
    return {};
  }

  private calculateEngagementScore(profile: any, messages: any[], picks: any[]): number {
    // Implementation for engagement score calculation
    return 0;
  }

  private async checkTierUpgradeEligibility(profile: any): Promise<boolean> {
    // Implementation for tier upgrade eligibility
    return false;
  }

  private isCriticalError(error: any): boolean {
    // Define what constitutes a critical error
    const criticalKeywords = ['database', 'connection', 'auth', 'payment'];
    const errorMessage = (error.message || '').toLowerCase();
    return criticalKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private async sendCriticalErrorAlert(errorLog: ErrorLog): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🚨 CRITICAL ERROR ALERT')
        .setDescription(`A critical error has occurred and requires immediate attention.`)
        .addFields(
          { name: 'Error ID', value: errorLog.id, inline: true },
          { name: 'Timestamp', value: errorLog.timestamp.toString(), inline: true },
          { name: 'Message', value: errorLog.message.substring(0, 1000), inline: false }
        )
        .setColor('#FF0000')
        .setTimestamp();

      if (errorLog.context) {
        embed.addFields({ name: 'Context', value: JSON.stringify(errorLog.context).substring(0, 1000), inline: false });
      }

      await adminChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send critical error alert:', error);
    }
  }

  private async getUsersExportData(timeRange: string): Promise<any[]> {
    // Implementation for users export data
    return [];
  }

  private async getPicksExportData(timeRange: string): Promise<any[]> {
    // Implementation for picks export data
    return [];
  }

  private async getEngagementExportData(timeRange: string): Promise<any[]> {
    // Implementation for engagement export data
    return [];
  }

  private convertToCSV(data: any[], headers: string[]): string {
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Increment message count for analytics
   */

  /**
   * Cleanup method to stop metrics collection
   */
  destroy(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }
}