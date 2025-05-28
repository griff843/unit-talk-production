// src/agents/NotificationAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationAgentConfig, NotificationPayload, NotificationResult, NotificationChannel } from './types';
import { BaseAgent, BaseAgentDependencies } from '../BaseAgent';
import { ErrorHandlerConfig } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { 
  AgentCommand, 
  HealthCheckResult, 
  AgentMetrics,
  AgentStatus 
} from '../../types/agent';

import { sendDiscordNotification } from './channels/discord';
import { sendEmailNotification } from './channels/email';
import { sendNotionNotification } from './channels/notion';
import { sendSlackNotification } from './channels/slack';
import { sendSMSNotification } from './channels/sms';

let instance: NotificationAgent | null = null;

/**
 * NotificationAgent
 * Centralizes outbound notification routing, logging, and retry/escalation logic.
 */
export class NotificationAgent extends BaseAgent {
  protected readonly logger: Logger;
  private readonly config: NotificationAgentConfig;
  private maxRetries: number;

  constructor(dependencies: BaseAgentDependencies) {
    super(dependencies);
    this.logger = dependencies.logger || new Logger('NotificationAgent');
    this.config = dependencies.config as NotificationAgentConfig;
    this.maxRetries = dependencies.config.maxRetries ?? 3;
  }

  public async initialize(): Promise<void> {
    await this.validateDependencies();
    await this.initializeResources();
    this.logger.info('NotificationAgent initialized successfully');
  }

  public async cleanup(): Promise<void> {
    // No cleanup needed
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    return this.healthCheck();
  }

  protected async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const { error } = await this.supabase
      .from('notifications')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Failed to access notifications table: ${error.message}`);
    }

    // Verify channel configurations
    if (this.config.channels.discord?.enabled && !this.config.channels.discord.webhookUrl) {
      throw new Error('Discord webhook URL is required when Discord is enabled');
    }

    if (this.config.channels.notion?.enabled && !this.config.channels.notion.apiKey) {
      throw new Error('Notion API key is required when Notion is enabled');
    }

    if (this.config.channels.email?.enabled) {
      const { smtpConfig } = this.config.channels.email;
      if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
        throw new Error('SMTP configuration is incomplete');
      }
    }

    if (this.config.channels.sms?.enabled && !this.config.channels.sms.apiKey) {
      throw new Error('SMS API key is required when SMS is enabled');
    }

    if (this.config.channels.slack?.enabled && !this.config.channels.slack.webhookUrl) {
      throw new Error('Slack webhook URL is required when Slack is enabled');
    }
  }

  protected async initializeResources(): Promise<void> {
    // No additional resources needed
  }

  protected async process(): Promise<void> {
    // Process any pending notifications
    const { data: pendingNotifications, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to fetch pending notifications: ${error.message}`);
    }

    for (const notification of pendingNotifications || []) {
      try {
        await this.processNotification(notification);
        this.metrics.successCount++;
      } catch (error) {
        this.metrics.errorCount++;
        if (error instanceof Error) {
          this.logger.error(`Error processing notification ${notification.id}:`, error);
        }
      }
    }
  }

  protected async healthCheck(): Promise<HealthCheckResult> {
    const health: HealthCheckResult = {
      status: 'healthy',
      details: {
        errors: [],
        warnings: [],
        info: {
          lastCheck: new Date().toISOString(),
          enabledChannels: Object.entries(this.config.channels)
            .filter(([_, config]) => config?.enabled)
            .map(([channel]) => channel)
        }
      },
      timestamp: new Date().toISOString()
    };

    // Check database connectivity
    const { error } = await this.supabase
      .from('notifications')
      .select('id')
      .limit(1);

    if (error) {
      health.status = 'unhealthy';
      if (health.details) {
        health.details.errors.push(`Database connectivity issue: ${error.message}`);
      }
    }

    return health;
  }

  protected async collectMetrics(): Promise<AgentMetrics> {
    const { data: notificationStats } = await this.supabase
      .from('notifications')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const baseMetrics = this.metrics;
    const status: AgentStatus = baseMetrics.errorCount > 0 ? 'degraded' : 'healthy';

    return {
      ...baseMetrics,
      status,
      agentName: this.config.name,
      successCount: (notificationStats || []).filter(s => s.status === 'sent').length,
      warningCount: (notificationStats || []).filter(s => s.status === 'pending').length,
      errorCount: (notificationStats || []).filter(s => s.status === 'failed').length
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'SEND_NOTIFICATION':
        await this.sendNotification(command.payload);
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  private async processNotification(notification: NotificationPayload): Promise<void> {
    await this.sendNotification(notification);
  }

  public async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const results: Record<NotificationChannel, boolean> = {};
    const errors: Record<NotificationChannel, string> = {};
    let successCount = 0;

    this.logger.info('Dispatching notification', payload);

    for (const channel of payload.channels) {
      let attempts = 0, delivered = false;
      while (attempts < this.maxRetries && !delivered) {
        try {
          switch (channel) {
            case 'discord':
              await sendDiscordNotification(payload, this.config.channels.discord!);
              break;
            case 'email':
              await sendEmailNotification(payload, this.config.channels.email!);
              break;
            case 'notion':
              await sendNotionNotification(payload, this.config.channels.notion!);
              break;
            case 'slack':
              await sendSlackNotification(payload, this.config.channels.slack!);
              break;
            case 'sms':
              await sendSMSNotification(payload, this.config.channels.sms!);
              break;
            default:
              throw new Error(`Unknown notification channel: ${channel}`);
          }
          delivered = true;
          results[channel] = true;
          successCount++;
        } catch (err) {
          attempts++;
          errors[channel] = (err as Error).message;
          this.logger.warn(`Notification failed on ${channel}, attempt ${attempts}: ${errors[channel]}`);
          if (attempts >= this.maxRetries) {
            results[channel] = false;
          }
        }
      }
    }

    // Log notification to Supabase
    await this.supabase.from('notification_log').insert([{
      ...payload,
      status: successCount === payload.channels.length ? 'success' : (successCount ? 'partial' : 'failed'),
      deliveredChannels: payload.channels.filter(ch => results[ch]),
      failedChannels: payload.channels.filter(ch => !results[ch]),
      errors,
      createdAt: new Date().toISOString()
    }]);

    this.logger.info('Notification dispatched', { results, errors });

    // Optionally escalate failures to OperatorAgent
    if (Object.values(results).some(success => !success)) {
      await this.escalateFailures(payload, results, errors);
    }

    return {
      success: successCount > 0,
      notificationId: payload.id || 'generated-id',
      channels: payload.channels,
      error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : undefined
    };
  }

  private async escalateFailures(
    payload: NotificationPayload,
    results: Record<NotificationChannel, boolean>,
    errors: Record<NotificationChannel, string>
  ): Promise<void> {
    this.logger.error('Escalating notification failures', { payload, results, errors });
    // Insert to operator_incidents table
    await this.supabase.from('operator_incidents').insert([{
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
  }
}

export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  if (!instance) {
    throw new Error('NotificationAgent not initialized');
  }
  return instance.sendNotification(payload);
}

export function initializeNotificationAgent(dependencies: BaseAgentDependencies): NotificationAgent {
  if (!instance) {
    instance = new NotificationAgent(dependencies);
  }
  return instance;
}
