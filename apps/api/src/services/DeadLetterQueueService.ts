/**
 * Dead Letter Queue (DLQ) Service
 *
 * Purpose: Central service for routing failed events to the dead_letter_queue table
 * and providing replay/requeue capabilities.
 *
 * Phase 1 Modernization - DLQ Support Implementation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import { DLQMetrics } from '../monitoring/DLQMetrics';

export type DLQSource =
  | 'bridge_worker'
  | 'discord_publisher'
  | 'grading_worker'
  | 'ingestion_worker'
  | 'temporal_activity'
  | 'other';

export interface DLQEntry {
  id?: string;
  source: DLQSource;
  original_event_id?: string;
  original_table?: string;
  payload: any;
  error_message: string;
  error_stack?: string;
  error_code?: string;
  retry_count?: number;
  max_retries_attempted?: number;
  first_failed_at?: string;
  last_failed_at?: string;
  metadata?: Record<string, any>;
}

export interface ReplayOptions {
  requeued_by: string;
  notes?: string;
}

export class DeadLetterQueueService {
  private supabase: SupabaseClient;
  private logger: Logger;
  private metrics: DLQMetrics | null = null;

  constructor(supabase: SupabaseClient, logger: Logger, metrics?: DLQMetrics) {
    this.supabase = supabase;
    this.logger = logger;
    this.metrics = metrics || null;

    // Start periodic metrics update if metrics are enabled
    if (this.metrics) {
      this.startMetricsCollector();
    }
  }

  /**
   * Start periodic collection of DLQ depth metrics
   */
  private startMetricsCollector(): void {
    if (!this.metrics) return;

    // Update DLQ depth metrics every 30 seconds
    setInterval(async () => {
      await this.updateDLQDepthMetrics();
    }, 30000);

    // Initial update
    this.updateDLQDepthMetrics().catch((err) => {
      this.logger.warn('Failed to update DLQ depth metrics', { error: err });
    });
  }

  /**
   * Update current DLQ depth and oldest event age metrics for all sources
   */
  private async updateDLQDepthMetrics(): Promise<void> {
    if (!this.metrics) return;

    try {
      const summary = await this.getSummary();
      if (!summary) return;

      for (const sourceStats of summary) {
        const source = sourceStats.source as DLQSource;

        // Update depth gauge
        this.metrics.setMessagesInDLQ(source, sourceStats.pending_events || 0);

        // Update oldest event age
        if (sourceStats.oldest_failure) {
          const oldestAge = Date.now() - new Date(sourceStats.oldest_failure).getTime();
          this.metrics.setOldestEventAge(source, Math.floor(oldestAge / 1000));
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update DLQ depth metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add a failed event to the DLQ
   */
  async addToDLQ(entry: DLQEntry): Promise<string | null> {
    const endTimer = this.metrics?.startTimer('addToDLQ');

    try {
      const now = new Date().toISOString();

      const dlqRecord = {
        source: entry.source,
        original_event_id: entry.original_event_id,
        original_table: entry.original_table,
        payload: entry.payload,
        error_message: entry.error_message,
        error_stack: entry.error_stack,
        error_code: entry.error_code,
        retry_count: entry.retry_count || 0,
        max_retries_attempted: entry.max_retries_attempted,
        first_failed_at: entry.first_failed_at || now,
        last_failed_at: entry.last_failed_at || now,
        metadata: entry.metadata || {},
      };

      const { data, error } = await this.supabase
        .from('dead_letter_queue')
        .insert(dlqRecord)
        .select('id')
        .single();

      if (error) {
        this.logger.error('Failed to add event to DLQ', {
          error: error.message,
          source: entry.source,
          original_event_id: entry.original_event_id,
        });
        return null;
      }

      // Record metrics
      if (this.metrics) {
        const errorType = entry.error_code || 'unknown';
        this.metrics.recordMessageFailed(
          entry.source,
          errorType,
          entry.retry_count || 0
        );
      }

      this.logger.info('Event added to DLQ', {
        dlq_id: data.id,
        source: entry.source,
        original_event_id: entry.original_event_id,
        error: entry.error_message,
      });

      return data.id;
    } catch (error) {
      this.logger.error('Unexpected error adding to DLQ', {
        error: error instanceof Error ? error.message : String(error),
        source: entry.source,
      });
      return null;
    } finally {
      endTimer?.();
    }
  }

  /**
   * Get DLQ entries by source
   */
  async getBySource(source: DLQSource, limit = 100): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('source', source)
        .is('requeued_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Failed to fetch DLQ entries', {
          error: error.message,
          source,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Unexpected error fetching DLQ entries', {
        error: error instanceof Error ? error.message : String(error),
        source,
      });
      return [];
    }
  }

  /**
   * Get a single DLQ entry by ID
   */
  async getById(id: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        this.logger.error('Failed to fetch DLQ entry', {
          error: error.message,
          id,
        });
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Unexpected error fetching DLQ entry', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      return null;
    }
  }

  /**
   * Mark a DLQ entry for replay
   */
  async markForReplay(id: string, options: ReplayOptions): Promise<boolean> {
    const endTimer = this.metrics?.startTimer('markForReplay');

    try {
      // Get the entry to extract source for metrics
      const entry = await this.getById(id);
      if (!entry) {
        this.logger.error('DLQ entry not found for replay', { id });
        return false;
      }

      const { error } = await this.supabase
        .from('dead_letter_queue')
        .update({
          requeued_at: new Date().toISOString(),
          requeued_by: options.requeued_by,
          replay_status: 'pending',
          metadata: {
            notes: options.notes,
          },
        })
        .eq('id', id);

      if (error) {
        this.logger.error('Failed to mark DLQ entry for replay', {
          error: error.message,
          id,
        });
        return false;
      }

      // Record metrics
      if (this.metrics) {
        this.metrics.recordMessageRequeued(entry.source);
      }

      this.logger.info('DLQ entry marked for replay', {
        id,
        requeued_by: options.requeued_by,
      });

      return true;
    } catch (error) {
      this.logger.error('Unexpected error marking for replay', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      return false;
    } finally {
      endTimer?.();
    }
  }

  /**
   * Update replay status (succeeded/failed)
   */
  async updateReplayStatus(
    id: string,
    status: 'succeeded' | 'failed' | 'cancelled',
    errorMessage?: string
  ): Promise<boolean> {
    const endTimer = this.metrics?.startTimer('updateReplayStatus');

    try {
      // Get the entry to extract source for metrics
      const entry = await this.getById(id);
      if (!entry) {
        this.logger.error('DLQ entry not found for status update', { id });
        return false;
      }

      const { error } = await this.supabase
        .from('dead_letter_queue')
        .update({
          replay_status: status,
          replay_error: errorMessage,
        })
        .eq('id', id);

      if (error) {
        this.logger.error('Failed to update replay status', {
          error: error.message,
          id,
          status,
        });
        return false;
      }

      // Record metrics
      if (this.metrics) {
        if (status === 'succeeded') {
          this.metrics.recordReplaySuccess(entry.source);
        } else if (status === 'failed') {
          const errorType = errorMessage?.split(':')[0] || 'unknown';
          this.metrics.recordReplayFailure(entry.source, errorType);
        }
      }

      this.logger.info('DLQ replay status updated', {
        id,
        status,
      });

      return true;
    } catch (error) {
      this.logger.error('Unexpected error updating replay status', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      return false;
    } finally {
      endTimer?.();
    }
  }

  /**
   * Get DLQ summary statistics
   */
  async getSummary(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('vw_dlq_summary')
        .select('*');

      if (error) {
        this.logger.error('Failed to fetch DLQ summary', {
          error: error.message,
        });
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Unexpected error fetching DLQ summary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get recent DLQ events
   */
  async getRecent(limit = 100): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('vw_dlq_recent')
        .select('*')
        .limit(limit);

      if (error) {
        this.logger.error('Failed to fetch recent DLQ events', {
          error: error.message,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Unexpected error fetching recent DLQ events', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
