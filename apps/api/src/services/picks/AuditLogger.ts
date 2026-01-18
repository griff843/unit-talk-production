import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import type { AuditLogEntry } from './types';

/**
 * AuditLogger - Service for writing audit logs to audit_events table
 *
 * Provides comprehensive audit trail for compliance and observability:
 * - Pick submissions
 * - Discord publications
 * - Status changes
 * - User actions
 */
export class AuditLogger {
  private supabase: SupabaseClient;
  private static instance: AuditLogger | null = null;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuditLogger {
    if (!this.instance) {
      this.instance = new AuditLogger();
    }
    return this.instance;
  }

  /**
   * Log an audit event
   *
   * @param entry - Audit log entry details
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const auditData = {
        tenant_id: entry.tenantId,
        event_type: entry.eventType,
        entity_type: entry.refType,
        entity_id: entry.refId,
        actor_id: entry.actorId || null,
        actor_type: entry.actorId ? 'user' : 'system',
        correlation_id: entry.correlationId || this.generateCorrelationId(),
        metadata: entry.data || {},
        created_at: new Date().toISOString(),
      };

      const { error } = await this.supabase.from('audit_events').insert(auditData);

      if (error) {
        logger.error('Failed to write audit log', {
          error: error.message,
          entry,
        });
      } else {
        logger.debug('Audit log written successfully', {
          eventType: entry.eventType,
          refType: entry.refType,
          refId: entry.refId,
        });
      }
    } catch (error) {
      logger.error('Error writing audit log', {
        error: error instanceof Error ? error.message : String(error),
        entry,
      });
    }
  }

  /**
   * Log pick submission event
   */
  async logPickSubmitted(
    pickId: string,
    tenantId: string,
    userId: string,
    data: {
      marketType: string;
      line: number;
      side: string;
      odds?: number;
      idempotencyKey?: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'pick.submitted',
      refType: 'pick',
      refId: pickId,
      tenantId,
      actorId: userId,
      data: {
        market_type: data.marketType,
        line: data.line,
        side: data.side,
        odds: data.odds,
        idempotency_key: data.idempotencyKey,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log Discord post event
   */
  async logDiscordPosted(
    publishId: string,
    tenantId: string,
    data: {
      pickId: string;
      messageId: string;
      threadId?: string;
      channel: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'discord.posted',
      refType: 'publish',
      refId: publishId,
      tenantId,
      data: {
        pick_id: data.pickId,
        message_id: data.messageId,
        thread_id: data.threadId,
        channel: data.channel,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log pick status change
   */
  async logPickStatusChange(
    pickId: string,
    tenantId: string,
    data: {
      oldStatus: string;
      newStatus: string;
      reason?: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'pick.status_changed',
      refType: 'pick',
      refId: pickId,
      tenantId,
      data: {
        old_status: data.oldStatus,
        new_status: data.newStatus,
        reason: data.reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log workflow stage change
   */
  async logWorkflowStageChange(
    pickId: string,
    tenantId: string,
    userId: string | undefined,
    data: {
      oldStage: string;
      newStage: string;
      reason?: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'pick.workflow_changed',
      refType: 'pick',
      refId: pickId,
      tenantId,
      actorId: userId,
      data: {
        old_stage: data.oldStage,
        new_stage: data.newStage,
        reason: data.reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log publish failure
   */
  async logPublishFailed(
    publishId: string,
    tenantId: string,
    data: {
      pickId: string;
      error: string;
      attempts: number;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'publish.failed',
      refType: 'publish',
      refId: publishId,
      tenantId,
      data: {
        pick_id: data.pickId,
        error: data.error,
        attempts: data.attempts,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log idempotent duplicate detection
   */
  async logIdempotentDuplicate(
    pickId: string,
    tenantId: string,
    data: {
      idempotencyKey: string;
      originalCreatedAt: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: 'pick.idempotent_duplicate',
      refType: 'pick',
      refId: pickId,
      tenantId,
      data: {
        idempotency_key: data.idempotencyKey,
        original_created_at: data.originalCreatedAt,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Generate correlation ID for tracking
   */
  private generateCorrelationId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// Export singleton instance for convenience
export const auditLogger = AuditLogger.getInstance();
