/**
 * Analytics Event Consumer
 * Consumes events from the events table and writes to tenant_usage for billing
 * 
 * Phase 15: Analytics & Monetization Layer
 * Date: 2025-01-25
 * 
 * Event Types Consumed:
 * - pick.submitted (pick_submission)
 * - pick.scored (grading_operation)
 * - api.requested (api_call)
 * - partner.webhook.sent (webhook_delivery)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';
import { getUsageTelemetry } from '../services/UsageTelemetryService';

const logger = createLogger('AnalyticsEventConsumer');

interface EventRecord {
  id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_type: string;
  event_data: any;
  metadata: any;
  created_at: string;
  processed_at?: string;
}

interface ConsumerMetrics {
  eventsConsumed: number;
  eventsProcessed: number;
  eventsFailed: number;
  lastProcessedAt?: Date;
  avgProcessingTimeMs: number;
}

export class AnalyticsEventConsumer {
  private supabase: SupabaseClient;
  private isRunning = false;
  private pollInterval = 5000; // 5 seconds
  private batchSize = 100;
  private pollTimer?: NodeJS.Timeout;
  private metrics: ConsumerMetrics = {
    eventsConsumed: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    avgProcessingTimeMs: 0,
  };

  // Event type mapping to tenant_usage event types
  private eventTypeMapping: Record<string, string> = {
    'pick.submitted': 'pick_submission',
    'ticket.submitted.v1': 'pick_submission',
    'pick.scored': 'grading_operation',
    'grading.completed.v1': 'grading_operation',
    'api.requested': 'api_call',
    'partner.webhook.sent': 'webhook_delivery',
    'alert.sent': 'alert_sent',
  };

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AnalyticsEventConsumer already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AnalyticsEventConsumer...', {
      pollInterval: this.pollInterval,
      batchSize: this.batchSize,
    });

    // Start polling for events
    this.pollTimer = setInterval(() => {
      this.pollEvents().catch((error) => {
        logger.error('Error polling events', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.pollInterval);

    // Initial poll
    await this.pollEvents();
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    logger.info('AnalyticsEventConsumer stopped', { metrics: this.metrics });
  }

  /**
   * Poll for unprocessed events
   */
  private async pollEvents(): Promise<void> {
    try {
      // Get unprocessed analytics events
      const { data: events, error } = await this.supabase
        .from('events')
        .select('*')
        .is('processed_at', null)
        .in('event_type', Object.keys(this.eventTypeMapping))
        .order('created_at', { ascending: true })
        .limit(this.batchSize);

      if (error) throw error;

      if (!events || events.length === 0) {
        return; // No events to process
      }

      logger.info(`Polling ${events.length} analytics events`);
      this.metrics.eventsConsumed += events.length;

      // Process events in parallel with concurrency limit
      const concurrency = 10;
      for (let i = 0; i < events.length; i += concurrency) {
        const batch = events.slice(i, i + concurrency);
        await Promise.allSettled(
          batch.map((event) => this.processEvent(event as EventRecord))
        );
      }
    } catch (error) {
      logger.error('Failed to poll events', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: EventRecord): Promise<void> {
    const startTime = Date.now();

    try {
      // Map event type to tenant_usage event type
      const usageEventType = this.eventTypeMapping[event.event_type];
      if (!usageEventType) {
        logger.warn('Unknown event type for analytics', { eventType: event.event_type });
        await this.markEventAsProcessed(event.id);
        return;
      }

      // Extract tenant and user context
      const { tenantId, userId } = await this.extractTenantContext(event);
      if (!userId) {
        logger.warn('No user context for event', { eventId: event.id });
        await this.markEventAsProcessed(event.id);
        return;
      }

      // Get telemetry service
      const telemetry = getUsageTelemetry();

      // Track usage based on event type
      switch (usageEventType) {
        case 'pick_submission':
          await this.trackPickSubmission(telemetry, event, userId, tenantId);
          break;

        case 'grading_operation':
          await this.trackGradingOperation(telemetry, event, userId, tenantId);
          break;

        case 'api_call':
          await this.trackAPICall(telemetry, event, userId, tenantId);
          break;

        case 'webhook_delivery':
          await this.trackWebhookDelivery(telemetry, event, userId, tenantId);
          break;

        case 'alert_sent':
          await this.trackAlertSent(telemetry, event, userId, tenantId);
          break;

        default:
          logger.warn('Unhandled usage event type', { usageEventType });
      }

      // Mark event as processed
      await this.markEventAsProcessed(event.id);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.eventsProcessed++;
      this.metrics.lastProcessedAt = new Date();
      this.metrics.avgProcessingTimeMs =
        (this.metrics.avgProcessingTimeMs + processingTime) / 2;

      logger.debug('Event processed successfully', {
        eventId: event.id,
        eventType: event.event_type,
        processingTimeMs: processingTime,
      });
    } catch (error) {
      this.metrics.eventsFailed++;
      logger.error('Failed to process event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark event as failed
      await this.markEventAsFailed(event.id, error);
    }
  }

  /**
   * Extract tenant and user context from event
   */
  private async extractTenantContext(
    event: EventRecord
  ): Promise<{ tenantId?: string; userId?: string }> {
    // Try to get user_id from event_data
    let userId = event.event_data?.user_id || event.event_data?.userId;

    // For pick submissions, get from capper_id
    if (!userId && event.event_data?.capper_id) {
      userId = event.event_data.capper_id;
    }

    // For grading events, get from ticket data
    if (!userId && event.aggregate_type === 'ticket') {
      const { data: ticket } = await this.supabase
        .from('unified_picks')
        .select('user_id')
        .eq('bet_slip_id', event.aggregate_id)
        .single();

      userId = ticket?.user_id;
    }

    // Get tenant_id from user
    let tenantId: string | undefined;
    if (userId) {
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // For now, use user_id as tenant_id (single-tenant per user)
      // In multi-tenant scenarios, this would come from a tenants table
      tenantId = user?.id;
    }

    return { tenantId, userId };
  }

  /**
   * Track pick submission event
   */
  private async trackPickSubmission(
    telemetry: any,
    event: EventRecord,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    const pickData = event.event_data;
    await telemetry.trackUsage({
      tenantId,
      userId,
      eventType: 'pick_submission',
      resourceType: 'picks',
      resourceId: event.aggregate_id,
      quantity: pickData.selections?.length || 1,
      unit: 'count',
      billable: true,
      costCents: 10, // $0.10 per pick
      metadata: {
        sport: pickData.sport,
        betSlipId: pickData.bet_slip_id,
        eventId: event.id,
      },
    });
  }

  /**
   * Track grading operation event
   */
  private async trackGradingOperation(
    telemetry: any,
    event: EventRecord,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    await telemetry.trackUsage({
      tenantId,
      userId,
      eventType: 'grading_operation',
      resourceType: 'grading_operations',
      resourceId: event.aggregate_id,
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 5, // $0.05 per grading operation
      metadata: {
        gradingType: event.event_data?.grading_type || 'standard',
        eventId: event.id,
      },
    });
  }

  /**
   * Track API call event
   */
  private async trackAPICall(
    telemetry: any,
    event: EventRecord,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    const apiData = event.event_data;
    await telemetry.trackUsage({
      tenantId,
      userId,
      eventType: 'api_call',
      resourceType: 'api_requests',
      quantity: 1,
      unit: 'requests',
      billable: true,
      costCents: this.calculateAPICost(apiData.endpoint, apiData.method),
      metadata: {
        endpoint: apiData.endpoint,
        method: apiData.method,
        statusCode: apiData.statusCode,
        durationMs: apiData.durationMs,
        eventId: event.id,
      },
    });
  }

  /**
   * Track webhook delivery event
   */
  private async trackWebhookDelivery(
    telemetry: any,
    event: EventRecord,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    await telemetry.trackUsage({
      tenantId,
      userId,
      eventType: 'webhook_delivery',
      resourceType: 'webhooks',
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 2, // $0.02 per webhook
      metadata: {
        webhookType: event.event_data?.webhook_type,
        partner: event.event_data?.partner,
        eventId: event.id,
      },
    });
  }

  /**
   * Track alert sent event
   */
  private async trackAlertSent(
    telemetry: any,
    event: EventRecord,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    await telemetry.trackUsage({
      tenantId,
      userId,
      eventType: 'alert_sent',
      resourceType: 'alerts',
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 2, // $0.02 per alert
      metadata: {
        alertType: event.event_data?.alert_type,
        channel: event.event_data?.channel,
        eventId: event.id,
      },
    });
  }

  /**
   * Calculate API call cost based on endpoint
   */
  private calculateAPICost(endpoint: string, method: string): number {
    // Premium endpoints cost more
    if (endpoint?.includes('/ai/') || endpoint?.includes('/analytics/')) {
      return 5; // $0.05
    }
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return 2; // $0.02
    }
    return 1; // $0.01 for GET requests
  }

  /**
   * Mark event as processed
   */
  private async markEventAsProcessed(eventId: string): Promise<void> {
    await this.supabase
      .from('events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId);
  }

  /**
   * Mark event as failed
   */
  private async markEventAsFailed(eventId: string, error: any): Promise<void> {
    await this.supabase
      .from('events')
      .update({
        failed_at: new Date().toISOString(),
        retry_count: this.supabase.rpc('increment', { row_id: eventId }),
        metadata: {
          error_message: error instanceof Error ? error.message : String(error),
        },
      })
      .eq('id', eventId);
  }

  /**
   * Get consumer metrics
   */
  getMetrics(): ConsumerMetrics {
    return { ...this.metrics };
  }
}

// Singleton instance
let analyticsConsumer: AnalyticsEventConsumer | null = null;

export function initAnalyticsEventConsumer(
  supabase: SupabaseClient
): AnalyticsEventConsumer {
  if (!analyticsConsumer) {
    analyticsConsumer = new AnalyticsEventConsumer(supabase);
    logger.info('AnalyticsEventConsumer initialized');
  }
  return analyticsConsumer;
}

export function getAnalyticsEventConsumer(): AnalyticsEventConsumer {
  if (!analyticsConsumer) {
    throw new Error(
      'AnalyticsEventConsumer not initialized. Call initAnalyticsEventConsumer first.'
    );
  }
  return analyticsConsumer;
}

