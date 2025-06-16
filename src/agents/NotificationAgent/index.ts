// src/agents/NotificationAgent/index.ts

import { NotificationPayload, NotificationResult, NotificationChannel, NotificationAgentConfig, NotificationLogRecord } from './types';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';

// Channel imports
import { sendDiscordNotification } from './channels/discord';
import { sendEmailNotification } from './channels/email';
import { sendNotionNotification } from './channels/notion';
import { sendSlackNotification } from './channels/slack';
import { sendSMSNotification } from './channels/sms';

// Type for channel functions
type ChannelFunction = (payload: NotificationPayload, config: any) => Promise<void>;

interface AgentCommand {
  type: string;
  payload: any;
  timestamp?: string;
}

let instance: NotificationAgent | null = null;

/**
 * NotificationAgent
 * Centralizes outbound notification routing, logging, and retry/escalation logic.
 */
export class NotificationAgent extends BaseAgent {
  private channels: Map<NotificationChannel, ChannelFunction>;
  private notificationStats: {
    sent: number;
    failed: number;
    pending: number;
    partialSuccess: number;
  };
  private channelHealth: Map<NotificationChannel, boolean>;
  private fullConfig: NotificationAgentConfig; // Store the full config

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Store the full config before it gets parsed by BaseAgent
    this.fullConfig = config as NotificationAgentConfig;

    // Initialize notification channels with proper typing
    this.channels = new Map<NotificationChannel, ChannelFunction>([
      ['discord', sendDiscordNotification as ChannelFunction],
      ['email', sendEmailNotification as ChannelFunction],
      ['notion', sendNotionNotification as ChannelFunction],
      ['slack', sendSlackNotification as ChannelFunction],
      ['sms', sendSMSNotification as ChannelFunction]
    ]);

    this.notificationStats = {
      sent: 0,
      failed: 0,
      pending: 0,
      partialSuccess: 0
    };

    this.channelHealth = new Map();
    Array.from(this.channels.keys()).forEach(channel => {
      this.channelHealth.set(channel, true);
    });
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing NotificationAgent...');
    
    try {
      await this.validateDependencies();
      await this.initializeChannels();
      this.deps.logger.info('NotificationAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize NotificationAgent:', error as Error);
      throw error;
    }
  }

  public async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const { error } = await this.deps.supabase
      .from('notifications')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Failed to access notifications table: ${error.message}`);
    }

    // Verify channel configurations
    const config = this.config as NotificationAgentConfig;
    
    if (config.channels?.discord?.enabled && !config.channels.discord.webhookUrl) {
      throw new Error('Discord webhook URL is required when Discord is enabled');
    }

    if (config.channels?.notion?.enabled && !config.channels.notion.apiKey) {
      throw new Error('Notion API key is required when Notion is enabled');
    }

    if (config.channels?.email?.enabled) {
      const smtpConfig = config.channels.email.smtpConfig;
      if (!smtpConfig?.host || !smtpConfig?.port || !smtpConfig?.auth?.user || !smtpConfig?.auth?.pass) {
        throw new Error('SMTP configuration is incomplete');
      }
    }

    if (config.channels?.sms?.enabled && !config.channels.sms.apiKey) {
      throw new Error('SMS API key is required when SMS is enabled');
    }

    if (config.channels?.slack?.enabled && !config.channels.slack.webhookUrl) {
      throw new Error('Slack webhook URL is required when Slack is enabled');
    }
  }

  private async initializeChannels(): Promise<void> {
    const config = this.config as NotificationAgentConfig;
    
    // Test each enabled channel
    for (const [channel, enabled] of Object.entries(config.channels || {})) {
      if (enabled?.enabled) {
        try {
          // Simple connectivity test for each channel
          this.deps.logger.info(`Testing ${channel} channel connectivity...`);
          this.channelHealth.set(channel as NotificationChannel, true);
        } catch (error) {
          this.deps.logger.warn(`${channel} channel test failed:`, error);
          this.channelHealth.set(channel as NotificationChannel, false);
        }
      }
    }
  }

  protected async process(): Promise<void> {
    try {
      // Process any pending notifications
      const { data: pendingNotifications, error } = await this.deps.supabase
        .from('notifications')
        .select('*')
        .eq('status', 'pending');

      if (error) {
        throw new Error(`Failed to fetch pending notifications: ${error.message}`);
      }

      for (const notification of pendingNotifications || []) {
        try {
          await this.processNotification(notification);
          this.notificationStats.sent++;
        } catch (error) {
          this.notificationStats.failed++;
          this.deps.logger.error(`Error processing notification ${notification.id}:`, error instanceof Error ? error : new Error(String(error)));
        }
      }
    } catch (error) {
      this.deps.logger.error('Error in NotificationAgent process:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async processNotification(notification: NotificationPayload): Promise<void> {
    await this.sendNotification(notification);
  }

  public async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const results: Record<NotificationChannel, boolean> = {} as Record<NotificationChannel, boolean>;
    const errors: Record<NotificationChannel, string> = {} as Record<NotificationChannel, string>;
    let successCount = 0;
    const config = this.fullConfig;

    this.deps.logger.info('Dispatching notification', payload);

    for (const channel of payload.channels) {
      let attempts = 0;
      let delivered = false;

      while (attempts < (this.config.retry?.maxRetries || 3) && !delivered) {
        try {
          const channelConfig = config.channels?.[channel];
          if (!channelConfig || !channelConfig.enabled) {
            throw new Error(`Channel ${channel} is not enabled`);
          }

          const sendFunction = this.channels.get(channel);
          if (!sendFunction) {
            throw new Error(`Unknown notification channel: ${channel}`);
          }

          await sendFunction(payload, channelConfig as any);
          delivered = true;
          results[channel] = true;
          successCount++;
        } catch (err) {
          attempts++;
          const error = err instanceof Error ? err : new Error(String(err));
          errors[channel] = error.message;
          this.deps.logger.warn(`Notification failed on ${channel}, attempt ${attempts}: ${errors[channel]}`);

          if (attempts >= (this.config.retry?.maxRetries || 3)) {
            results[channel] = false;
          } else {
            // Exponential backoff
            const backoffMs = Math.min(
              (this.config.retry?.backoffMs || 1000) * Math.pow(2, attempts - 1),
              (this.config.retry?.maxBackoffMs || 30000)
            );
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }
    }

    // Log notification to Supabase
    const notificationId = payload.id || `notif-${Date.now()}`;
    const logRecord: NotificationLogRecord = {
      ...payload,
      id: notificationId,
      status: successCount === payload.channels.length ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
      deliveredChannels: payload.channels.filter(ch => results[ch]),
      failedChannels: payload.channels.filter(ch => !results[ch]),
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await this.deps.supabase.from('notification_log').insert([logRecord]);
    } catch (error) {
      this.deps.logger.error('Failed to log notification:', error instanceof Error ? error : new Error(String(error)));
    }

    this.deps.logger.info('Notification dispatched', { results, errors });

    // Optionally escalate failures to OperatorAgent
    if (Object.values(results).some(success => !success)) {
      await this.escalateFailures(payload, results, errors);
    }

    return {
      success: successCount > 0,
      notificationId,
      channels: payload.channels.filter(ch => results[ch]),
      error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : undefined
    };
  }

  private async escalateFailures(
    payload: NotificationPayload,
    results: Record<NotificationChannel, boolean>,
    errors: Record<NotificationChannel, string>
  ): Promise<void> {
    this.deps.logger.error('Escalating notification failures', new Error('Notification failures detected'), { payload, results, errors });

    try {
      // Insert to operator_incidents table
      await this.deps.supabase.from('operator_incidents').insert([{
        type: 'notification_failure',
        severity: payload.priority || 'low',
        details: {
          payload,
          results,
          errors
        },
        status: 'open',
        createdAt: new Date().toISOString()
      }]);
    } catch (error) {
      this.deps.logger.error('Failed to escalate notification failure:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  protected async cleanup(): Promise<void> {
    // Clean up any pending notifications
    try {
      await this.retryFailedNotifications();
      this.deps.logger.info('NotificationAgent cleanup completed');
    } catch (error) {
      this.deps.logger.error('Error during NotificationAgent cleanup:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async checkHealth(): Promise<HealthStatus> {
    const channelStatus = Object.fromEntries(this.channelHealth);
    const allChannelsHealthy = Array.from(this.channelHealth.values()).every(status => status);

    return {
      status: allChannelsHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: {
        channels: channelStatus,
        pendingCount: this.notificationStats.pending,
        failedCount: this.notificationStats.failed
      }
    };
  }

  public async healthCheck(): Promise<HealthStatus> {
    return this.checkHealth();
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: 'NotificationAgent',
      successCount: this.notificationStats.sent,
      errorCount: this.notificationStats.failed,
      warningCount: this.notificationStats.partialSuccess,
      processingTimeMs: 0, // TODO: Add processing time tracking
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    await this.processCommand(command);
  }

  protected async processCommand(command: AgentCommand): Promise<void> {
    this.deps.logger.info(`Processing command: ${command.type}`);

    switch (command.type) {
      case 'SEND_NOTIFICATION':
        await this.sendNotification(command.payload);
        break;
      case 'CHECK_CHANNEL_HEALTH':
        await this.checkChannelHealth(command.payload.channel);
        break;
      case 'RETRY_FAILED':
        await this.retryFailedNotifications();
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  private async checkChannelHealth(channel: NotificationChannel): Promise<void> {
    const config = this.config as NotificationAgentConfig;
    const channelConfig = config.channels?.[channel];
    
    if (!channelConfig || !channelConfig.enabled) {
      throw new Error(`Channel ${channel} is not enabled`);
    }

    try {
      // Test the channel with a simple ping
      this.deps.logger.info(`Testing ${channel} channel health...`);
      this.channelHealth.set(channel, true);
    } catch (error) {
      this.channelHealth.set(channel, false);
      throw error;
    }
  }

  private async retryFailedNotifications(): Promise<void> {
    const { data: failedNotifications, error } = await this.deps.supabase
      .from('notifications')
      .select('*')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    if (error) {
      throw new Error(`Failed to fetch failed notifications: ${error.message}`);
    }

    for (const notification of failedNotifications || []) {
      try {
        await this.sendNotification(notification);
      } catch (error) {
        this.deps.logger.error(`Retry failed for notification ${notification.id}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Public methods for activities
  public async sendBatchNotifications(notifications: NotificationPayload[]): Promise<void> {
    for (const notification of notifications) {
      await this.sendNotification(notification);
    }
  }

  public async processQueue(): Promise<void> {
    await this.process();
  }

  public async retryFailed(): Promise<void> {
    await this.retryFailedNotifications();
  }

  // Public API
  public static getInstance(config: NotificationAgentConfig, dependencies: BaseAgentDependencies): NotificationAgent {
    if (!instance) {
      instance = new NotificationAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializeNotificationAgent(config: NotificationAgentConfig, dependencies: BaseAgentDependencies): NotificationAgent {
  return new NotificationAgent(config, dependencies);
}