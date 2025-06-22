import { Client, GuildMember, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { AdvancedAnalyticsService } from './advancedAnalyticsService';
import { KeywordEmojiDMService } from './keywordEmojiDMService';
import { AutomatedThreadService } from './automatedThreadService';
import { VIPNotificationService } from './vipNotificationService';
import { AIPoweredService } from './aiPoweredService';
import { AdminOverride, ConfigUpdate, SystemCommand, ExtendedSystemCommand } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class AdminOverrideService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private analyticsService: AdvancedAnalyticsService;
  private keywordDMService: KeywordEmojiDMService;
  private threadService: AutomatedThreadService;
  private vipNotificationService: VIPNotificationService;
  private aiService: AIPoweredService;
  private activeOverrides: Map<string, AdminOverride> = new Map();

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    analyticsService: AdvancedAnalyticsService,
    keywordDMService: KeywordEmojiDMService,
    threadService: AutomatedThreadService,
    vipNotificationService: VIPNotificationService,
    aiService: AIPoweredService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.analyticsService = analyticsService;
    this.keywordDMService = keywordDMService;
    this.threadService = threadService;
    this.vipNotificationService = vipNotificationService;
    this.aiService = aiService;
  }

  /**
   * Execute admin override command
   */
  async executeOverrideCommand(adminId: string, command: SystemCommand): Promise<any> {
    try {
      // Verify admin permissions
      const member = await this.client.guilds.cache.first()?.members.fetch(adminId);
      if (!member || !this.permissionsService.isAdmin(member)) {
        throw new Error('Insufficient permissions for admin override');
      }

      const override: AdminOverride = {
        id: `override_${Date.now()}_${adminId}`,
        adminId: adminId,
        command: command.name as ExtendedSystemCommand,
        parameters: command.parameters,
        reason: command.reason,
        timestamp: new Date(),
        status: 'executing'
      };

      this.activeOverrides.set(override.id, override);

      let result: any;

      switch (command.name) {
        case 'force_user_tier_change':
          result = await this.forceUserTierChange(adminId, command.parameters);
          break;
        case 'emergency_broadcast':
          result = await this.emergencyBroadcast(adminId, command.parameters);
          break;
        case 'force_pick_result':
          result = await this.forcePickResult(adminId, command.parameters);
          break;
        case 'system_maintenance_mode':
          result = await this.toggleMaintenanceMode(adminId, command.parameters);
          break;
        case 'bulk_user_action':
          result = await this.executeBulkUserAction(adminId, command.parameters);
          break;
        case 'override_cooldowns':
          result = await this.overrideCooldowns(adminId, command.parameters);
          break;
        case 'force_thread_action':
          result = await this.forceThreadAction(adminId, command.parameters);
          break;
        case 'emergency_dm_blast':
          result = await this.emergencyDMBlast(adminId, command.parameters);
          break;
        case 'system_health_check':
          result = await this.performSystemHealthCheck(adminId);
          break;
        case 'force_analytics_refresh':
          result = await this.forceAnalyticsRefresh(adminId);
          break;
        default:
          throw new Error(`Unknown admin command: ${command.name}`);
      }

      override.status = 'completed';
      override.result = result;
      override.completedAt = new Date();

      // Log admin action
      await this.logAdminAction(override);

      // Send confirmation to admin
      await this.sendAdminConfirmation(adminId, override);

      return result;

    } catch (error) {
      logger.error(`Admin override command failed: ${command.name}`, error);
      throw error;
    }
  }

  /**
   * Force change user tier (emergency situations)
   */
  private async forceUserTierChange(adminId: string, params: any): Promise<any> {
    try {
      const { userId, newTier, reason } = params;

      // Update user tier in database
      const { error } = await this.supabaseService.client
        .from('user_profiles')
        .update({
          tier: newTier,
          tier_changed_by: adminId,
          tier_change_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('discord_id', userId);

      if (error) throw error;

      // Update Discord roles
      const guild = this.client.guilds.cache.first();
      const member = await guild?.members.fetch(userId);
      
      if (member) {
        // Remove old tier roles
        const oldRoles = [botConfig.roles.vip, botConfig.roles.vipPlus];
        await member.roles.remove(oldRoles.filter(role => role));

        // Add new tier role
        if (newTier === 'vip' && botConfig.roles.vip) {
          await member.roles.add(botConfig.roles.vip);
        } else if (newTier === 'vip_plus' && botConfig.roles.vipPlus) {
          await member.roles.add(botConfig.roles.vipPlus);
        }
      }

      // Send notification to user
      await this.sendTierChangeNotification(userId, newTier, reason);

      return {
        success: true,
        userId: userId,
        oldTier: 'unknown', // Would need to fetch from previous state
        newTier: newTier,
        reason: reason
      };

    } catch (error) {
      logger.error('Failed to force user tier change:', error);
      throw error;
    }
  }

  /**
   * Emergency broadcast to all channels
   */
  private async emergencyBroadcast(adminId: string, params: any): Promise<any> {
    try {
      const { message, channels, priority } = params;

      const embed = new EmbedBuilder()
        .setTitle('🚨 EMERGENCY BROADCAST')
        .setDescription(message)
        .setColor('#FF0000')
        .setTimestamp()
        .setFooter({ text: `Broadcast by Admin | Priority: ${priority}` });

      const results = [];

      for (const channelId of channels) {
        try {
          const channel = this.client.channels.cache.get(channelId) as TextChannel;
          if (channel) {
            await channel.send({ embeds: [embed] });
            results.push({ channelId, status: 'sent' });
          } else {
            results.push({ channelId, status: 'channel_not_found' });
          }
        } catch (error) {
          results.push({ channelId, status: 'failed', error: (error as Error).message });
        }
      }

      return {
        success: true,
        message: message,
        results: results,
        totalChannels: channels.length,
        successCount: results.filter(r => r.status === 'sent').length
      };

    } catch (error) {
      logger.error('Failed to send emergency broadcast:', error);
      throw error;
    }
  }

  /**
   * Force pick result (for corrections)
   */
  private async forcePickResult(adminId: string, params: any): Promise<any> {
    try {
      const { pickId, newResult, reason } = params;

      // Update pick result
      const { error } = await this.supabaseService.client
        .from('final_picks')
        .update({
          result: newResult,
          result_overridden_by: adminId,
          result_override_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', pickId);

      if (error) throw error;

      // Recalculate user statistics
      await this.recalculateUserStats(pickId);

      // Send notification about correction
      await this.sendPickCorrectionNotification(pickId, newResult, reason);

      return {
        success: true,
        pickId: pickId,
        newResult: newResult,
        reason: reason
      };

    } catch (error) {
      logger.error('Failed to force pick result:', error);
      throw error;
    }
  }

  /**
   * Toggle system maintenance mode
   */
  private async toggleMaintenanceMode(adminId: string, params: any): Promise<any> {
    try {
      const { enabled, message, estimatedDuration } = params;

      // Update system configuration
      await this.supabaseService.client
        .from('system_config')
        .upsert({
          key: 'maintenance_mode',
          value: {
            enabled: enabled,
            message: message,
            estimatedDuration: estimatedDuration,
            enabledBy: adminId,
            enabledAt: new Date().toISOString()
          }
        });

      if (enabled) {
        // Send maintenance notification to all channels
        await this.sendMaintenanceNotification(message, estimatedDuration);
        
        // Disable non-essential bot functions
        await this.disableNonEssentialFunctions();
      } else {
        // Re-enable all functions
        await this.enableAllFunctions();
        
        // Send maintenance complete notification
        await this.sendMaintenanceCompleteNotification();
      }

      return {
        success: true,
        maintenanceMode: enabled,
        message: message,
        estimatedDuration: estimatedDuration
      };

    } catch (error) {
      logger.error('Failed to toggle maintenance mode:', error);
      throw error;
    }
  }

  /**
   * Execute bulk user actions
   */
  private async executeBulkUserAction(adminId: string, params: any): Promise<any> {
    try {
      const { action, userIds, parameters } = params;
      const results = [];

      for (const userId of userIds) {
        try {
          let result;
          
          switch (action) {
            case 'tier_change':
              result = await this.forceUserTierChange(adminId, { userId, ...parameters });
              break;
            case 'send_dm':
              result = await this.sendBulkDM(userId, parameters.message);
              break;
            case 'add_role':
              result = await this.addRoleToUser(userId, parameters.roleId);
              break;
            case 'remove_role':
              result = await this.removeRoleFromUser(userId, parameters.roleId);
              break;
            default:
              throw new Error(`Unknown bulk action: ${action}`);
          }

          results.push({ userId, status: 'success', result });
        } catch (error) {
          results.push({ userId, status: 'failed', error: error instanceof Error ? error.message : String(error) });
        }
      }

      return {
        success: true,
        action: action,
        totalUsers: userIds.length,
        results: results,
        successCount: results.filter(r => r.status === 'success').length,
        failedCount: results.filter(r => r.status === 'failed').length
      };

    } catch (error) {
      logger.error('Failed to execute bulk user action:', error);
      throw error;
    }
  }

  /**
   * Override user cooldowns
   */
  private async overrideCooldowns(adminId: string, params: any): Promise<any> {
    try {
      const { userId, cooldownType, action } = params; // action: 'reset' or 'extend'

      if (action === 'reset') {
        // Reset all cooldowns for user
        await this.supabaseService.client
          .from('user_cooldowns')
          .delete()
          .eq('user_id', userId);
      } else if (action === 'extend') {
        // Extend cooldowns
        await this.supabaseService.client
          .from('user_cooldowns')
          .update({
            expires_at: new Date(Date.now() + params.extensionMinutes * 60 * 1000).toISOString()
          })
          .eq('user_id', userId)
          .eq('cooldown_type', cooldownType);
      }

      return {
        success: true,
        userId: userId,
        action: action,
        cooldownType: cooldownType
      };

    } catch (error) {
      logger.error('Failed to override cooldowns:', error);
      throw error;
    }
  }

  /**
   * Force thread actions
   */
  private async forceThreadAction(adminId: string, params: any): Promise<any> {
    try {
      const { threadId, action, parameters } = params;

      const thread = this.client.channels.cache.get(threadId);
      if (!thread || !thread.isThread()) {
        throw new Error('Thread not found');
      }

      let result;

      switch (action) {
        case 'archive':
          await thread.setArchived(true, parameters.reason);
          result = 'Thread archived';
          break;
        case 'unarchive':
          await thread.setArchived(false, parameters.reason);
          result = 'Thread unarchived';
          break;
        case 'lock':
          await thread.setLocked(true, parameters.reason);
          result = 'Thread locked';
          break;
        case 'unlock':
          await thread.setLocked(false, parameters.reason);
          result = 'Thread unlocked';
          break;
        case 'rename':
          await thread.setName(parameters.newName, parameters.reason);
          result = `Thread renamed to: ${parameters.newName}`;
          break;
        default:
          throw new Error(`Unknown thread action: ${action}`);
      }

      return {
        success: true,
        threadId: threadId,
        action: action,
        result: result
      };

    } catch (error) {
      logger.error('Failed to force thread action:', error);
      throw error;
    }
  }

  /**
   * Emergency DM blast to specific users
   */
  private async emergencyDMBlast(adminId: string, params: any): Promise<any> {
    try {
      const { userIds, message, priority } = params;

      const embed = new EmbedBuilder()
        .setTitle('🚨 URGENT MESSAGE')
        .setDescription(message)
        .setColor('#FF0000')
        .setTimestamp()
        .setFooter({ text: `Emergency message from Unit Talk Staff | Priority: ${priority}` });

      const results = [];

      for (const userId of userIds) {
        try {
          const user = await this.client.users.fetch(userId);
          await user.send({ embeds: [embed] });
          results.push({ userId, status: 'sent' });
        } catch (error) {
          results.push({ userId, status: 'failed', error: (error as Error).message });
        }
      }

      return {
        success: true,
        message: message,
        results: results,
        totalUsers: userIds.length,
        successCount: results.filter(r => r.status === 'sent').length
      };

    } catch (error: unknown) {
      logger.error('Failed to send emergency DM blast:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive system health check
   */
  private async performSystemHealthCheck(adminId: string): Promise<any> {
    try {
      const healthCheck = {
        timestamp: new Date().toISOString(),
        performedBy: adminId,
        database: await this.checkDatabaseHealth(),
        discord: await this.checkDiscordHealth(),
        services: await this.checkServicesHealth(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        errors: await this.getRecentErrors(),
        recommendations: [] as string[]
      };

      // Generate recommendations based on health check
      healthCheck.recommendations = this.generateHealthRecommendations(healthCheck);

      // Store health check result
      await this.supabaseService.client
        .from('system_health_checks')
        .insert(healthCheck);

      return healthCheck;

    } catch (error) {
      logger.error('Failed to perform system health check:', error);
      throw error;
    }
  }

  /**
   * Force analytics refresh
   */
  private async forceAnalyticsRefresh(adminId: string): Promise<any> {
    try {
      // Refresh all analytics caches
      await this.analyticsService.getRealTimeStats();
      
      // Regenerate dashboards
      const ownerDashboard = await this.analyticsService.generateOwnerDashboard();
      const staffDashboard = await this.analyticsService.generateStaffDashboard();

      // Refresh keyword/emoji triggers
      await this.keywordDMService.reloadConfiguration();

      return {
        success: true,
        refreshedAt: new Date().toISOString(),
        refreshedBy: adminId,
        dashboards: {
          owner: ownerDashboard.id,
          staff: staffDashboard.id
        }
      };

    } catch (error) {
      logger.error('Failed to force analytics refresh:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive error report
   */
  async getErrorReport(adminId: string, timeRange: string = '24h'): Promise<any> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(adminId);
      if (!member || !this.permissionsService.isAdmin(member)) {
        throw new Error('Insufficient permissions');
      }

      const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data: errors } = await this.supabaseService.client
        .from('error_logs')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      const { data: events } = await this.supabaseService.client
        .from('event_logs')
        .select('*')
        .gte('timestamp', since)
        .eq('severity', 'error')
        .order('timestamp', { ascending: false });

      const report = {
        timeRange: timeRange,
        generatedAt: new Date().toISOString(),
        generatedBy: adminId,
        totalErrors: errors?.length || 0,
        totalEvents: events?.length || 0,
        errorsByType: this.categorizeErrors(errors || []),
        criticalErrors: (errors || []).filter(e => this.isCriticalError(e)),
        recentErrors: (errors || []).slice(0, 20),
        errorTrends: this.analyzeErrorTrends(errors || []),
        recommendations: this.generateErrorRecommendations(errors || [])
      };

      return report;

    } catch (error) {
      logger.error('Failed to generate error report:', error);
      throw error;
    }
  }

  // Private helper methods
  private async logAdminAction(override: AdminOverride): Promise<void> {
    try {
      await this.supabaseService.client
        .from('admin_actions')
        .insert({
          id: override.id,
          admin_id: override.adminId,
          command: override.command,
          parameters: override.parameters,
          reason: override.reason,
          status: override.status,
          result: override.result,
          timestamp: override.timestamp,
          completed_at: override.completedAt
        });
    } catch (error) {
      logger.error('Failed to log admin action:', error);
    }
  }

  private async sendAdminConfirmation(adminId: string, override: AdminOverride): Promise<void> {
    try {
      const admin = await this.client.users.fetch(adminId);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Admin Override Complete')
        .setDescription(`Command "${override.command}" executed successfully`)
        .addFields(
          { name: 'Override ID', value: override.id, inline: true },
          { name: 'Status', value: override.status || 'unknown', inline: true },
          { name: 'Completed At', value: override.completedAt ? new Date(override.completedAt).toISOString() : 'N/A', inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();

      if (override.result) {
        embed.addFields({ name: 'Result', value: JSON.stringify(override.result).substring(0, 1000), inline: false });
      }

      await admin.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send admin confirmation:', error);
    }
  }

  private async sendTierChangeNotification(userId: string, newTier: string, reason: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('🎯 Tier Change Notification')
        .setDescription(`Your tier has been updated to **${newTier.toUpperCase()}**`)
        .addFields({ name: 'Reason', value: reason, inline: false })
        .setColor('#4169E1')
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send tier change notification:', error);
    }
  }

  private async recalculateUserStats(pickId: string): Promise<void> {
    // Implementation to recalculate user statistics after pick result change
    try {
      const { data: pick } = await this.supabaseService.client
        .from('final_picks')
        .select('user_id')
        .eq('id', pickId)
        .single();

      if (pick) {
        // Recalculate user's win rate, units, etc.
        // This would involve complex calculations based on all user's picks
      }
    } catch (error) {
      logger.error('Failed to recalculate user stats:', error);
    }
  }

  private async sendPickCorrectionNotification(pickId: string, newResult: string, reason: string): Promise<void> {
    // Implementation to notify users about pick result corrections
  }

  private async sendMaintenanceNotification(message: string, duration: string): Promise<void> {
    // Implementation to send maintenance notifications to all channels
  }

  private async disableNonEssentialFunctions(): Promise<void> {
    // Implementation to disable non-essential bot functions during maintenance
  }

  private async enableAllFunctions(): Promise<void> {
    // Implementation to re-enable all bot functions after maintenance
  }

  private async sendMaintenanceCompleteNotification(): Promise<void> {
    // Implementation to send maintenance complete notifications
  }

  private async sendBulkDM(userId: string, message: string): Promise<any> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(message);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async addRoleToUser(userId: string, roleId: string): Promise<any> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (member) {
        await member.roles.add(roleId);
        return { success: true };
      }
      return { success: false, error: 'Member not found' };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async removeRoleFromUser(userId: string, roleId: string): Promise<any> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (member) {
        await member.roles.remove(roleId);
        return { success: true };
      }
      return { success: false, error: 'Member not found' };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async checkDatabaseHealth(): Promise<any> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('user_profiles')
        .select('count')
        .limit(1);

      return {
        status: error ? 'unhealthy' : 'healthy',
        error: error?.message,
        responseTime: Date.now() // Would measure actual response time
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        responseTime: null
      };
    }
  }

  private async checkDiscordHealth(): Promise<any> {
    return {
      status: this.client.isReady() ? 'healthy' : 'unhealthy',
      ping: this.client.ws.ping,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size
    };
  }

  private async checkServicesHealth(): Promise<any> {
    return {
      analytics: 'healthy', // Would check actual service health
      keywordDM: 'healthy',
      threads: 'healthy',
      vipNotifications: 'healthy',
      ai: 'healthy'
    };
  }

  private async getRecentErrors(): Promise<any[]> {
    const { data } = await this.supabaseService.client
      .from('error_logs')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('timestamp', { ascending: false })
      .limit(10);

    return data || [];
  }

  private generateHealthRecommendations(healthCheck: any): string[] {
    const recommendations: string[] = [];

    if (healthCheck.database.status === 'unhealthy') {
      recommendations.push('Database connection issues detected - check connection settings');
    }

    if (healthCheck.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
      recommendations.push('High memory usage detected - consider restarting the bot');
    }

    if (healthCheck.errors.length > 10) {
      recommendations.push('High error rate detected - investigate recent errors');
    }

    return recommendations;
  }

  private categorizeErrors(errors: any[]): Record<string, number> {
    const categories: Record<string, number> = {};

    errors.forEach(error => {
      const category = this.categorizeError(error);
      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  private categorizeError(error: unknown): string {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    if (message.includes('database') || message.includes('supabase')) return 'database';
    if (message.includes('discord') || message.includes('api')) return 'discord_api';
    if (message.includes('permission')) return 'permissions';
    if (message.includes('network') || message.includes('timeout')) return 'network';

    return 'other';
  }

  private isCriticalError(error: unknown): boolean {
    const criticalKeywords = ['database', 'connection', 'auth', 'critical', 'fatal'];
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return criticalKeywords.some(keyword => message.includes(keyword));
  }

  private analyzeErrorTrends(errors: any[]): any {
    // Implementation for error trend analysis
    return {
      increasing: false,
      stable: true,
      decreasing: false
    };
  }

  private generateErrorRecommendations(errors: any[]): string[] {
    const recommendations = [];

    const errorCategories = this.categorizeErrors(errors);

    if (errorCategories['database'] && errorCategories['database'] > 5) {
      recommendations.push('High database error rate - check database connection and queries');
    }

    if (errorCategories['discord_api'] && errorCategories['discord_api'] > 3) {
      recommendations.push('Discord API errors detected - check rate limits and permissions');
    }

    return recommendations;
  }
}