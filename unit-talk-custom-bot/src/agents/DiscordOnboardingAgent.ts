import { GuildMember, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { OnboardingService } from '../services/onboardingService';
import { getUserTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

interface OnboardingMetrics {
  totalOnboardings: number;
  successfulOnboardings: number;
  failedOnboardings: number;
  onboardingsByTier: Record<string, number>;
  averageResponseTime: number;
  lastOnboardingTime: Date | null;
}

interface OnboardingIssue {
  id: string;
  userId: string;
  username: string;
  issue: string;
  timestamp: Date;
  resolved: boolean;
  tier: string;
}

export class DiscordOnboardingAgent {
  private name: string;
  private config: any;
  private onboardingService: OnboardingService;
  private metrics: OnboardingMetrics;
  private issues: OnboardingIssue[];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.name = 'DiscordOnboardingAgent';
    this.config = {
      description: 'Monitors and manages Discord member onboarding process',
      capabilities: [
        'Monitor onboarding success/failure rates',
        'Detect onboarding issues and failures',
        'Provide onboarding analytics and insights',
        'Auto-retry failed onboardings',
        'Generate onboarding reports',
        'Handle manual onboarding triggers'
      ],
      version: '1.0.0'
    };

    this.onboardingService = new OnboardingService();
    this.metrics = {
      totalOnboardings: 0,
      successfulOnboardings: 0,
      failedOnboardings: 0,
      onboardingsByTier: {},
      averageResponseTime: 0,
      lastOnboardingTime: null
    };
    this.issues = [];
  }

  async initialize(): Promise<void> {
    try {
      // Start monitoring
      this.startMonitoring();
      
      logger.info('DiscordOnboardingAgent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DiscordOnboardingAgent:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      logger.info('DiscordOnboardingAgent shut down successfully');
    } catch (error) {
      logger.error('Error shutting down DiscordOnboardingAgent:', error);
      throw error;
    }
  }

  /**
   * Handle new member onboarding
   */
  async handleNewMemberOnboarding(member: GuildMember): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      logger.info(`🆕 New member onboarding: ${member.user.tag}`);
      
      const tier = getUserTier(member);
      
      // Track metrics
      this.metrics.totalOnboardings++;
      this.metrics.onboardingsByTier[tier] = (this.metrics.onboardingsByTier[tier] || 0) + 1;
      this.metrics.lastOnboardingTime = new Date();
      
      // Attempt onboarding
      await this.onboardingService.handleNewMember(member);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      // Mark as successful
      this.metrics.successfulOnboardings++;
      
      logger.info(`✅ Successfully onboarded ${member.user.tag} (${tier}) in ${responseTime}ms`);
      
      // Send success notification to monitoring channel
      await this.sendOnboardingNotification(member, tier, 'success', responseTime);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to onboard ${member.user.tag}:`, error);
      
      // Track failure
      this.metrics.failedOnboardings++;
      
      // Create issue
      const issue: OnboardingIssue = {
        id: `onboarding_${member.id}_${Date.now()}`,
        userId: member.id,
        username: member.user.tag,
        issue: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        resolved: false,
        tier: getUserTier(member)
      };
      
      this.issues.push(issue);
      
      // Send failure notification
      await this.sendOnboardingNotification(member, getUserTier(member), 'failure', Date.now() - startTime, error);
      
      // Attempt retry after delay
      setTimeout(() => {
        this.retryOnboarding(member, issue.id);
      }, 30000); // Retry after 30 seconds
      
      return false;
    }
  }

  /**
   * Handle role change onboarding
   */
  async handleRoleChangeOnboarding(oldMember: GuildMember, newMember: GuildMember): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const oldTier = getUserTier(oldMember);
      const newTier = getUserTier(newMember);
      
      if (oldTier === newTier) {
        return true; // No tier change
      }
      
      logger.info(`🔄 Role change onboarding: ${newMember.user.tag} (${oldTier} → ${newTier})`);
      
      // Track metrics
      this.metrics.totalOnboardings++;
      this.metrics.onboardingsByTier[newTier] = (this.metrics.onboardingsByTier[newTier] || 0) + 1;
      this.metrics.lastOnboardingTime = new Date();
      
      // Attempt onboarding
      await this.onboardingService.handleRoleChange(oldMember, newMember);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      // Mark as successful
      this.metrics.successfulOnboardings++;
      
      logger.info(`✅ Successfully handled role change for ${newMember.user.tag} in ${responseTime}ms`);
      
      // Send success notification
      await this.sendRoleChangeNotification(newMember, oldTier, newTier, 'success', responseTime);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed role change onboarding for ${newMember.user.tag}:`, error);
      
      // Track failure
      this.metrics.failedOnboardings++;
      
      // Create issue
      const issue: OnboardingIssue = {
        id: `role_change_${newMember.id}_${Date.now()}`,
        userId: newMember.id,
        username: newMember.user.tag,
        issue: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        resolved: false,
        tier: getUserTier(newMember)
      };
      
      this.issues.push(issue);
      
      // Send failure notification
      await this.sendRoleChangeNotification(
        newMember, 
        getUserTier(oldMember), 
        getUserTier(newMember), 
        'failure', 
        Date.now() - startTime, 
        error
      );
      
      return false;
    }
  }

  /**
   * Manually trigger onboarding for a member
   */
  async triggerManualOnboarding(member: GuildMember, triggeredBy: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      logger.info(`🔧 Manual onboarding triggered for ${member.user.tag} by ${triggeredBy}`);
      
      const tier = getUserTier(member);
      
      // Track metrics
      this.metrics.totalOnboardings++;
      this.metrics.onboardingsByTier[tier] = (this.metrics.onboardingsByTier[tier] || 0) + 1;
      this.metrics.lastOnboardingTime = new Date();
      
      // Attempt onboarding
      await this.onboardingService.triggerOnboarding(member);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      // Mark as successful
      this.metrics.successfulOnboardings++;
      
      logger.info(`✅ Manual onboarding successful for ${member.user.tag} in ${responseTime}ms`);
      
      // Send success notification
      await this.sendManualOnboardingNotification(member, tier, triggeredBy, 'success', responseTime);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Manual onboarding failed for ${member.user.tag}:`, error);
      
      // Track failure
      this.metrics.failedOnboardings++;
      
      // Send failure notification
      await this.sendManualOnboardingNotification(
        member, 
        getUserTier(member), 
        triggeredBy, 
        'failure', 
        Date.now() - startTime, 
        error
      );
      
      return false;
    }
  }

  /**
   * Retry failed onboarding
   */
  private async retryOnboarding(member: GuildMember, issueId: string): Promise<void> {
    try {
      logger.info(`🔄 Retrying onboarding for ${member.user.tag}`);
      
      const success = await this.handleNewMemberOnboarding(member);
      
      if (success) {
        // Mark issue as resolved
        const issue = this.issues.find(i => i.id === issueId);
        if (issue) {
          issue.resolved = true;
          logger.info(`✅ Retry successful for ${member.user.tag}, issue ${issueId} resolved`);
        }
      }
      
    } catch (error) {
      logger.error(`❌ Retry failed for ${member.user.tag}:`, error);
    }
  }

  /**
   * Get onboarding metrics
   */
  getMetrics(): OnboardingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get unresolved issues
   */
  getUnresolvedIssues(): OnboardingIssue[] {
    return this.issues.filter(issue => !issue.resolved);
  }

  /**
   * Generate onboarding report
   */
  async generateReport(): Promise<EmbedBuilder> {
    const successRate = this.metrics.totalOnboardings > 0 
      ? (this.metrics.successfulOnboardings / this.metrics.totalOnboardings * 100).toFixed(1)
      : '0';
    
    const unresolvedIssues = this.getUnresolvedIssues();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Discord Onboarding Report')
      .setColor(0x00FF00)
      .setTimestamp()
      .addFields(
        {
          name: '📈 Overall Statistics',
          value: `• Total Onboardings: ${this.metrics.totalOnboardings}\n• Successful: ${this.metrics.successfulOnboardings}\n• Failed: ${this.metrics.failedOnboardings}\n• Success Rate: ${successRate}%`,
          inline: true
        },
        {
          name: '⚡ Performance',
          value: `• Avg Response Time: ${this.metrics.averageResponseTime.toFixed(0)}ms\n• Last Onboarding: ${this.metrics.lastOnboardingTime ? this.metrics.lastOnboardingTime.toLocaleString() : 'Never'}`,
          inline: true
        },
        {
          name: '🎯 By Tier',
          value: Object.entries(this.metrics.onboardingsByTier)
            .map(([tier, count]) => `• ${tier}: ${count}`)
            .join('\n') || 'No data',
          inline: false
        }
      );
    
    if (unresolvedIssues.length > 0) {
      embed.addFields({
        name: '⚠️ Unresolved Issues',
        value: `${unresolvedIssues.length} issues need attention`,
        inline: false
      });
    }
    
    return embed;
  }

  /**
   * Start monitoring for issues
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Error in onboarding monitoring:', error);
      }
    }, 300000); // Check every 5 minutes
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const unresolvedIssues = this.getUnresolvedIssues();
    
    if (unresolvedIssues.length > 5) {
      logger.warn(`⚠️ High number of unresolved onboarding issues: ${unresolvedIssues.length}`);
      await this.sendHealthAlert('high_unresolved_issues', unresolvedIssues.length);
    }
    
    const recentFailures = this.issues.filter(
      issue => !issue.resolved && Date.now() - issue.timestamp.getTime() < 3600000 // Last hour
    );
    
    if (recentFailures.length > 3) {
      logger.warn(`⚠️ High failure rate in last hour: ${recentFailures.length} failures`);
      await this.sendHealthAlert('high_failure_rate', recentFailures.length);
    }
  }

  /**
   * Send health alert
   */
  private async sendHealthAlert(alertType: string, count: number): Promise<void> {
    // Implementation would send alert to monitoring channel
    logger.warn(`🚨 Onboarding health alert: ${alertType} (${count})`);
  }

  /**
   * Send onboarding notification
   */
  private async sendOnboardingNotification(
    member: GuildMember, 
    tier: string, 
    status: 'success' | 'failure', 
    responseTime: number,
    error?: any
  ): Promise<void> {
    // Implementation would send to monitoring channel
    const statusEmoji = status === 'success' ? '✅' : '❌';
    logger.info(`${statusEmoji} Onboarding ${status} for ${member.user.tag} (${tier}) - ${responseTime}ms`);
  }

  /**
   * Send role change notification
   */
  private async sendRoleChangeNotification(
    member: GuildMember,
    oldTier: string,
    newTier: string,
    status: 'success' | 'failure',
    responseTime: number,
    error?: any
  ): Promise<void> {
    const statusEmoji = status === 'success' ? '✅' : '❌';
    logger.info(`${statusEmoji} Role change ${status} for ${member.user.tag} (${oldTier} → ${newTier}) - ${responseTime}ms`);
  }

  /**
   * Send manual onboarding notification
   */
  private async sendManualOnboardingNotification(
    member: GuildMember,
    tier: string,
    triggeredBy: string,
    status: 'success' | 'failure',
    responseTime: number,
    error?: any
  ): Promise<void> {
    const statusEmoji = status === 'success' ? '✅' : '❌';
    logger.info(`${statusEmoji} Manual onboarding ${status} for ${member.user.tag} (${tier}) by ${triggeredBy} - ${responseTime}ms`);
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newTime: number): void {
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = newTime;
    } else {
      this.metrics.averageResponseTime = (this.metrics.averageResponseTime + newTime) / 2;
    }
  }
}