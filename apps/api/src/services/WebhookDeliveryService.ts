/**
 * Webhook Delivery Service
 * Phase 14: Reliable webhook delivery with HMAC signatures and retry logic
 */

import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { supabaseClient } from './supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('WebhookDelivery');

export interface WebhookEvent {
  type: string;
  id: string;
  data: any;
  timestamp: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  retry_count: number;
  timeout_seconds: number;
}

export class WebhookDeliveryService {
  private static instance: WebhookDeliveryService;
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WebhookDeliveryService {
    if (!WebhookDeliveryService.instance) {
      WebhookDeliveryService.instance = new WebhookDeliveryService();
    }
    return WebhookDeliveryService.instance;
  }

  /**
   * Deliver webhook event to all registered webhooks
   */
  async deliverEvent(
    partnerId: string,
    event: WebhookEvent
  ): Promise<void> {
    try {
      // Find all active webhooks for this partner that subscribe to this event
      const { data: webhooks, error } = await supabaseClient
        .from('partner_webhooks')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .contains('events', [event.type]);

      if (error) {
        logger.error('Failed to fetch webhooks for event delivery', {
          partnerId,
          eventType: event.type,
          error: error.message,
        });
        return;
      }

      if (!webhooks || webhooks.length === 0) {
        logger.debug('No webhooks found for event', {
          partnerId,
          eventType: event.type,
        });
        return;
      }

      // Deliver to each webhook
      const deliveryPromises = webhooks.map((webhook) =>
        this.deliverToWebhook(webhook, event, partnerId)
      );

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      logger.error('Error in webhook event delivery', {
        partnerId,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Deliver event to a specific webhook
   */
  private async deliverToWebhook(
    webhook: WebhookConfig,
    event: WebhookEvent,
    partnerId: string,
    attemptNumber: number = 1
  ): Promise<void> {
    const logId = crypto.randomUUID();

    try {
      // Generate payload
      const payload = {
        event: event.type,
        event_id: event.id,
        timestamp: event.timestamp,
        data: event.data,
      };

      // Generate HMAC signature
      const signature = this.generateSignature(payload, webhook.secret);

      // Create initial log entry
      await this.createWebhookLog(
        webhook.id,
        partnerId,
        event,
        payload,
        attemptNumber,
        'pending',
        logId
      );

      // Make HTTP request
      const startTime = Date.now();
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.type,
          'X-Webhook-Event-ID': event.id,
          'X-Webhook-Delivery-ID': logId,
          'User-Agent': 'Unit-Talk-Webhooks/1.0',
        },
        timeout: webhook.timeout_seconds * 1000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const responseTime = Date.now() - startTime;

      // Update log with success
      await this.updateWebhookLog(logId, {
        status: 'success',
        http_status_code: response.status,
        response_time_ms: responseTime,
        delivered_at: new Date().toISOString(),
      });

      // Reset consecutive failures on success
      await supabaseClient
        .from('partner_webhooks')
        .update({
          consecutive_failures: 0,
          last_success_at: new Date().toISOString(),
          last_triggered_at: new Date().toISOString(),
        })
        .eq('id', webhook.id);

      logger.info('Webhook delivered successfully', {
        webhookId: webhook.id,
        eventType: event.type,
        attemptNumber,
        responseTime,
      });
    } catch (error) {
      await this.handleDeliveryFailure(
        webhook,
        event,
        partnerId,
        logId,
        attemptNumber,
        error
      );
    }
  }

  /**
   * Handle webhook delivery failure with retry logic
   */
  private async handleDeliveryFailure(
    webhook: WebhookConfig,
    event: WebhookEvent,
    partnerId: string,
    logId: string,
    attemptNumber: number,
    error: any
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const httpStatusCode =
      error instanceof AxiosError ? error.response?.status : null;

    logger.warn('Webhook delivery failed', {
      webhookId: webhook.id,
      eventType: event.type,
      attemptNumber,
      error: errorMessage,
      httpStatusCode,
    });

    // Update webhook log
    await this.updateWebhookLog(logId, {
      status: attemptNumber < webhook.retry_count ? 'retrying' : 'failed',
      http_status_code: httpStatusCode,
      error_message: errorMessage,
      error_details: {
        type: error.constructor.name,
        code: error instanceof AxiosError ? error.code : undefined,
      },
    });

    // Update webhook consecutive failures
    await supabaseClient
      .from('partner_webhooks')
      .update({
        consecutive_failures: supabaseClient.rpc('increment', { x: 1 }),
        last_failure_at: new Date().toISOString(),
        last_triggered_at: new Date().toISOString(),
      })
      .eq('id', webhook.id);

    // Check if we should disable the webhook (too many failures)
    const { data: webhookData } = await supabaseClient
      .from('partner_webhooks')
      .select('consecutive_failures')
      .eq('id', webhook.id)
      .single();

    if (webhookData && webhookData.consecutive_failures >= 10) {
      await supabaseClient
        .from('partner_webhooks')
        .update({ is_active: false })
        .eq('id', webhook.id);

      logger.error('Webhook disabled due to consecutive failures', {
        webhookId: webhook.id,
        consecutiveFailures: webhookData.consecutive_failures,
      });
    }

    // Schedule retry if attempts remaining
    if (attemptNumber < webhook.retry_count) {
      this.scheduleRetry(webhook, event, partnerId, attemptNumber);
    }
  }

  /**
   * Schedule webhook retry with exponential backoff
   */
  private scheduleRetry(
    webhook: WebhookConfig,
    event: WebhookEvent,
    partnerId: string,
    attemptNumber: number
  ): void {
    // Exponential backoff: 1min, 5min, 15min
    const delays = [60000, 300000, 900000]; // milliseconds
    const delay = delays[Math.min(attemptNumber - 1, delays.length - 1)];
    const nextRetryAt = new Date(Date.now() + delay);

    logger.info('Scheduling webhook retry', {
      webhookId: webhook.id,
      eventType: event.type,
      attemptNumber: attemptNumber + 1,
      nextRetryAt: nextRetryAt.toISOString(),
    });

    // Update log with retry schedule
    supabaseClient
      .from('partner_webhook_logs')
      .update({ next_retry_at: nextRetryAt.toISOString() })
      .eq('webhook_id', webhook.id)
      .eq('event_id', event.id)
      .eq('attempt_number', attemptNumber);

    // Schedule retry
    const timeoutId = setTimeout(() => {
      this.deliverToWebhook(webhook, event, partnerId, attemptNumber + 1);
      this.retryQueue.delete(`${webhook.id}-${event.id}`);
    }, delay);

    this.retryQueue.set(`${webhook.id}-${event.id}`, timeoutId);
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify HMAC signature (for webhook receivers to use)
   */
  static verifySignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Create webhook delivery log
   */
  private async createWebhookLog(
    webhookId: string,
    partnerId: string,
    event: WebhookEvent,
    payload: any,
    attemptNumber: number,
    status: string,
    logId: string
  ): Promise<void> {
    await supabaseClient.from('partner_webhook_logs').insert({
      id: logId,
      webhook_id: webhookId,
      partner_id: partnerId,
      event_type: event.type,
      event_id: event.id,
      payload,
      attempt_number: attemptNumber,
      status,
    });
  }

  /**
   * Update webhook delivery log
   */
  private async updateWebhookLog(
    logId: string,
    updates: any
  ): Promise<void> {
    await supabaseClient
      .from('partner_webhook_logs')
      .update(updates)
      .eq('id', logId);
  }

  /**
   * Process pending retries from database
   */
  async processPendingRetries(): Promise<void> {
    try {
      // Find logs that need retry
      const { data: pendingLogs, error } = await supabaseClient
        .from('partner_webhook_logs')
        .select(`
          *,
          partner_webhooks!inner (*)
        `)
        .eq('status', 'retrying')
        .lte('next_retry_at', new Date().toISOString())
        .limit(100);

      if (error) {
        logger.error('Failed to fetch pending retries', { error: error.message });
        return;
      }

      if (!pendingLogs || pendingLogs.length === 0) {
        return;
      }

      logger.info('Processing pending webhook retries', {
        count: pendingLogs.length,
      });

      // Process each retry
      for (const log of pendingLogs) {
        const webhook = log.partner_webhooks;
        const event: WebhookEvent = {
          type: log.event_type,
          id: log.event_id,
          data: log.payload.data,
          timestamp: log.payload.timestamp,
        };

        await this.deliverToWebhook(
          webhook,
          event,
          log.partner_id,
          log.attempt_number + 1
        );
      }
    } catch (error) {
      logger.error('Error processing pending retries', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start background retry processor
   */
  startRetryProcessor(intervalMs: number = 60000): void {
    setInterval(() => {
      this.processPendingRetries();
    }, intervalMs);

    logger.info('Webhook retry processor started', {
      intervalMs,
    });
  }
}

// Export singleton instance
export const webhookDelivery = WebhookDeliveryService.getInstance();
