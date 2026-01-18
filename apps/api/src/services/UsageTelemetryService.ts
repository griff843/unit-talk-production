/**
 * Usage Telemetry Service
 * Tracks billable events and resource consumption for multi-tenant analytics
 * 
 * Phase 15: Analytics and Monetization Engine
 * Date: 2025-01-25
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const logger = createLogger('UsageTelemetryService');

export type EventType =
  | 'api_call'
  | 'pick_submission'
  | 'grading_operation'
  | 'alert_sent'
  | 'webhook_delivery'
  | 'ai_analysis'
  | 'data_export'
  | 'report_generation'
  | 'storage_usage'
  | 'bandwidth_usage';

export type ResourceUnit = 'count' | 'gb' | 'mb' | 'seconds' | 'requests' | 'tokens';

export interface UsageEvent {
  tenantId?: string;
  userId: string;
  eventType: EventType;
  resourceType: string;
  resourceId?: string;
  quantity: number;
  unit?: ResourceUnit;
  billable?: boolean;
  costCents?: number;
  tierAtTime?: string;
  metadata?: Record<string, any>;
}

export interface UsageSummary {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  totalEvents: number;
  totalCostCents: number;
  byEventType: Record<EventType, number>;
  byResourceType: Record<string, number>;
}

export class UsageTelemetryService {
  private supabase: SupabaseClient;
  private batchBuffer: UsageEvent[] = [];
  private batchSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.startBatchFlusher();
  }

  /**
   * Track a usage event
   */
  async trackUsage(event: UsageEvent): Promise<void> {
    try {
      // Add to batch buffer
      this.batchBuffer.push(event);

      // Flush if buffer is full
      if (this.batchBuffer.length >= this.batchSize) {
        await this.flushBatch();
      }

      logger.debug('Usage event tracked', {
        userId: event.userId,
        eventType: event.eventType,
        resourceType: event.resourceType,
        quantity: event.quantity,
      });
    } catch (error) {
      logger.error('Failed to track usage event', {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
    }
  }

  /**
   * Track API call
   */
  async trackAPICall(
    userId: string,
    endpoint: string,
    method: string,
    durationMs: number,
    statusCode: number
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'api_call',
      resourceType: 'api_requests',
      quantity: 1,
      unit: 'requests',
      billable: true,
      costCents: this.calculateAPICost(endpoint, method),
      metadata: {
        endpoint,
        method,
        durationMs,
        statusCode,
      },
    });
  }

  /**
   * Track pick submission
   */
  async trackPickSubmission(
    userId: string,
    pickId: string,
    sport: string,
    tierAtTime: string
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'pick_submission',
      resourceType: 'picks',
      resourceId: pickId,
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 10, // $0.10 per pick
      tierAtTime,
      metadata: {
        sport,
        pickId,
      },
    });
  }

  /**
   * Track grading operation
   */
  async trackGradingOperation(
    userId: string,
    pickId: string,
    gradingType: string,
    durationMs: number
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'grading_operation',
      resourceType: 'grading_operations',
      resourceId: pickId,
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 5, // $0.05 per grading operation
      metadata: {
        pickId,
        gradingType,
        durationMs,
      },
    });
  }

  /**
   * Track alert sent
   */
  async trackAlertSent(
    userId: string,
    alertType: string,
    channel: string,
    pickId?: string
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'alert_sent',
      resourceType: 'alerts',
      resourceId: pickId,
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 2, // $0.02 per alert
      metadata: {
        alertType,
        channel,
        pickId,
      },
    });
  }

  /**
   * Track AI analysis
   */
  async trackAIAnalysis(
    userId: string,
    analysisType: string,
    tokensUsed: number,
    model: string
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'ai_analysis',
      resourceType: 'ai_analyses',
      quantity: tokensUsed,
      unit: 'tokens',
      billable: true,
      costCents: this.calculateAICost(tokensUsed, model),
      metadata: {
        analysisType,
        tokensUsed,
        model,
      },
    });
  }

  /**
   * Track data export
   */
  async trackDataExport(
    userId: string,
    exportType: string,
    recordCount: number,
    fileSizeMb: number
  ): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'data_export',
      resourceType: 'exports',
      quantity: 1,
      unit: 'count',
      billable: true,
      costCents: 50, // $0.50 per export
      metadata: {
        exportType,
        recordCount,
        fileSizeMb,
      },
    });
  }

  /**
   * Track storage usage
   */
  async trackStorageUsage(userId: string, storageGb: number): Promise<void> {
    await this.trackUsage({
      userId,
      eventType: 'storage_usage',
      resourceType: 'storage',
      quantity: storageGb,
      unit: 'gb',
      billable: true,
      costCents: Math.ceil(storageGb * 50), // $0.50 per GB
      metadata: {
        storageGb,
      },
    });
  }

  /**
   * Get usage summary for a user
   */
  async getUserUsageSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageSummary> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', periodStart.toISOString())
        .lte('timestamp', periodEnd.toISOString());

      if (error) throw error;

      const events = data || [];
      const totalEvents = events.length;
      const totalCostCents = events.reduce((sum, e) => sum + (e.cost_cents || 0), 0);

      const byEventType = events.reduce((acc, e) => {
        acc[e.event_type as EventType] = (acc[e.event_type as EventType] || 0) + 1;
        return acc;
      }, {} as Record<EventType, number>);

      const byResourceType = events.reduce((acc, e) => {
        acc[e.resource_type] = (acc[e.resource_type] || 0) + e.quantity;
        return acc;
      }, {} as Record<string, number>);

      return {
        userId,
        periodStart,
        periodEnd,
        totalEvents,
        totalCostCents,
        byEventType,
        byResourceType,
      };
    } catch (error) {
      logger.error('Failed to get usage summary', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if user has exceeded usage limits
   */
  async checkUsageLimit(
    userId: string,
    resourceType: string,
    quantity: number = 1
  ): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
    try {
      // Call database function to check limit
      const { data, error } = await this.supabase.rpc('check_usage_limit', {
        p_user_id: userId,
        p_resource_type: resourceType,
        p_quantity: quantity,
      });

      if (error) throw error;

      // Get current usage
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('usage_this_period, plan_id, subscription_plans(limits)')
        .eq('user_id', userId)
        .single();

      const currentUsage = subscription?.usage_this_period?.[resourceType] || 0;
      const limit = (subscription?.subscription_plans as any)?.[0]?.limits?.[resourceType] || 0;

      return {
        allowed: data === true,
        currentUsage,
        limit,
      };
    } catch (error) {
      logger.error('Failed to check usage limit', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        resourceType,
      });
      // Default to allowing if check fails (fail open)
      return { allowed: true, currentUsage: 0, limit: -1 };
    }
  }

  /**
   * Flush batch buffer to database
   */
  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    try {
      const records = batch.map((event) => ({
        tenant_id: event.tenantId || null,
        user_id: event.userId,
        event_type: event.eventType,
        resource_type: event.resourceType,
        resource_id: event.resourceId || null,
        quantity: event.quantity,
        unit: event.unit || 'count',
        billable: event.billable !== false,
        cost_cents: event.costCents || 0,
        tier_at_time: event.tierAtTime || null,
        metadata: event.metadata || {},
        timestamp: new Date().toISOString(),
      }));

      const { error } = await this.supabase.from('tenant_usage').insert(records);

      if (error) {
        logger.error('Failed to flush usage batch', {
          error: error.message,
          batchSize: batch.length,
        });
        // Re-add to buffer for retry
        this.batchBuffer.unshift(...batch);
      } else {
        logger.info('Usage batch flushed', { count: batch.length });
      }
    } catch (error) {
      logger.error('Failed to flush usage batch', {
        error: error instanceof Error ? error.message : String(error),
        batchSize: batch.length,
      });
      // Re-add to buffer for retry
      this.batchBuffer.unshift(...batch);
    }
  }

  /**
   * Start automatic batch flusher
   */
  private startBatchFlusher(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatch().catch((error) => {
        logger.error('Batch flush timer error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.flushInterval);
  }

  /**
   * Stop batch flusher and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushBatch();
    logger.info('UsageTelemetryService shutdown complete');
  }

  /**
   * Calculate API call cost based on endpoint
   */
  private calculateAPICost(endpoint: string, method: string): number {
    // Premium endpoints cost more
    if (endpoint.includes('/ai/') || endpoint.includes('/analytics/')) {
      return 5; // $0.05
    }
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return 2; // $0.02
    }
    return 1; // $0.01 for GET requests
  }

  /**
   * Calculate AI analysis cost based on tokens and model
   */
  private calculateAICost(tokens: number, model: string): number {
    // GPT-4 is more expensive
    if (model.includes('gpt-4')) {
      return Math.ceil((tokens / 1000) * 30); // $0.03 per 1K tokens
    }
    // GPT-3.5 is cheaper
    return Math.ceil((tokens / 1000) * 2); // $0.002 per 1K tokens
  }
}

// Singleton instance
let telemetryService: UsageTelemetryService | null = null;

export function initUsageTelemetry(supabase: SupabaseClient): UsageTelemetryService {
  if (!telemetryService) {
    telemetryService = new UsageTelemetryService(supabase);
    logger.info('UsageTelemetryService initialized');
  }
  return telemetryService;
}

export function getUsageTelemetry(): UsageTelemetryService {
  if (!telemetryService) {
    throw new Error('UsageTelemetryService not initialized. Call initUsageTelemetry first.');
  }
  return telemetryService;
}

