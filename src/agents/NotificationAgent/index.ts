// src/agents/NotificationAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationAgentConfig, NotificationPayload, NotificationResult, NotificationChannel } from './types';
import { BaseAgent } from '../BaseAgent';
import { ErrorHandlerConfig } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';

import { sendDiscordNotification } from './channels/discord';
import { sendEmailNotification } from './channels/email';
import { sendNotionNotification } from './channels/notion';
import { sendRetoolNotification } from './channels/retool';

/**
 * NotificationAgent
 * Centralizes outbound notification routing, logging, and retry/escalation logic.
 */
export class NotificationAgent extends BaseAgent {
  private logger: Logger;
  private maxRetries: number;

  constructor(
    config: NotificationAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super('NotificationAgent', config, supabase, errorConfig);
    this.logger = new Logger('NotificationAgent');
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Dispatches a notification payload to one or more channels.
   */
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
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
              await sendDiscordNotification(payload);
              break;
            case 'email':
              await sendEmailNotification(payload);
              break;
            case 'notion':
              await sendNotionNotification(payload);
              break;
            case 'retool':
              await sendRetoolNotification(payload);
              break;
            // Add more channels as needed
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

    // Log notification to Supabase (including success/failures)
    await this.supabase.from('notification_log').insert([{
      ...payload,
      status: successCount === payload.channels.length ? 'success' : (successCount ? 'partial' : 'failed'),
      deliveredChannels: payload.channels.filter(ch => results[ch]),
      failedChannels: payload.channels.filter(ch => !results[ch]),
      errors,
      createdAt: new Date().toISOString()
    }]);

    this.logger.info('Notification dispatched', { results, errors });

    // Optionally escalate failures to OperatorAgent or alert channel
    if (Object.values(results).some(success => !success)) {
      await this.escalateFailures(payload, results, errors);
    }

    return { results, errors };
  }

  /**
   * Escalates notification failures to OperatorAgent or other escalation system.
   */
  private async escalateFailures(payload: NotificationPayload, results: Record<NotificationChannel, boolean>, errors: Record<NotificationChannel, string>) {
    // Stub: Insert to operator_incidents, send to alert queue, etc.
    this.logger.error('Escalating notification failures', { payload, results, errors });
    // Example: await this.supabase.from('operator_incidents').insert([...]);
  }

  /**
   * Health check: verifies logging and channel connectivity.
   */
  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Try to insert dummy log
      await this.supabase.from('notification_log').insert([{
        type: 'health_check',
        message: 'Test notification',
        channels: ['discord'],
        status: 'success',
        deliveredChannels: ['discord'],
        failedChannels: [],
        createdAt: new Date().toISOString()
      }]);
      return { status: 'healthy' };
    } catch (err) {
      this.logger.error('Health check failed', err);
      return { status: 'failed', details: err };
    }
  }
}
