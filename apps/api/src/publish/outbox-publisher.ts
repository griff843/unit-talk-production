/**
 * Outbox Publisher with Retry, Backoff, Jitter, and Circuit Breaker
 *
 * Production-grade outbox pattern implementation featuring:
 * - Exponential backoff with jitter (5s, 15s, 45s, 2m, 6m, 15m, cap 30m)
 * - Circuit breaker integration
 * - Idempotent delivery via dedupe_key
 * - Shadow mode support
 * - Structured logging
 */

import crypto from 'crypto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../shared/logger';

import { getCircuitBreaker } from './circuit-breaker';
import { sendEmbed, formatPickEmbed } from './discord-sender';

export interface PublishJob {
  id: string;
  pick_id: string;
  tenant_id: string;
  attempts: number;
  status: string;
  discord_channel_id?: string; // Added: explicit Discord channel ID from pick_publish
  dedupe_key?: string;
  external_message_id?: string;
  payload?: any;
  metadata?: any;
  created_at: string;
  next_attempt_at?: string;
  last_attempt_at?: string;
  last_error?: string;
}

/**
 * Backoff schedule in milliseconds
 * Attempts: 1,    2,     3,      4,       5,        6,         7+
 * Delays:   5s,   15s,   45s,    2m,      6m,       15m,       30m (cap)
 */
const BACKOFF_SCHEDULE_MS = [
  5_000, // 5 seconds
  15_000, // 15 seconds
  45_000, // 45 seconds
  120_000, // 2 minutes
  360_000, // 6 minutes
  900_000, // 15 minutes
];

const MAX_BACKOFF_MS = 1_800_000; // 30 minutes cap

/**
 * Calculate backoff delay with jitter
 *
 * @param attempts - Number of attempts (1-indexed)
 * @returns Delay in milliseconds
 */
export function backoffWithJitter(attempts: number): number {
  const index = Math.min(attempts - 1, BACKOFF_SCHEDULE_MS.length - 1);
  const baseDelay = index >= 0 ? BACKOFF_SCHEDULE_MS[index] : MAX_BACKOFF_MS;

  // Add jitter: ±25% of base delay
  const jitter = (Math.random() - 0.5) * 0.5 * baseDelay;
  const delay = Math.min(baseDelay + jitter, MAX_BACKOFF_MS);

  return Math.max(delay, 0);
}

/**
 * Generate stable dedupe key for idempotency
 */
export function generateDedupeKey(pick: any, tenantId: string): string {
  const parts = [
    pick.id || pick.pick_id,
    pick.league || pick.sport || '',
    pick.market_type || pick.marketType || '',
    String(pick.line || ''),
    (pick.side || pick.direction || '').toLowerCase(),
    tenantId,
  ];

  const content = parts.join(':');
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Outbox Publisher
 */
export class OutboxPublisher {
  private supabase: SupabaseClient;
  private circuitBreaker = getCircuitBreaker();
  private isShadowMode: boolean;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
    this.isShadowMode = process.env.SHADOW_MODE === 'true';

    logger.info('Outbox publisher initialized', {
      event: 'outbox_publisher_init',
      shadowMode: this.isShadowMode,
      // @ts-ignore - env.picks property (legacy config structure)
      publishMode: env.picks.publishMode,
    });
  }

  /**
   * Run pending publish jobs
   *
   * @param maxBatch - Maximum number of jobs to process
   * @returns Number of jobs processed
   */
  async runPending(maxBatch = 50): Promise<number> {
    const now = new Date().toISOString();

    try {
      // Select pending jobs
      const { data: jobs, error } = await this.supabase
        .from('pick_publish')
        .select('*')
        .eq('status', 'pending')
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
        .order('created_at', { ascending: true })
        .limit(maxBatch);

      if (error) {
        logger.error('Failed to fetch pending publish jobs', {
          event: 'outbox_fetch_error',
          error: error.message,
        });
        return 0;
      }

      if (!jobs || jobs.length === 0) {
        return 0;
      }

      logger.info('Processing pending publish jobs', {
        event: 'outbox_batch_start',
        count: jobs.length,
      });

      // Process each job
      let processed = 0;
      for (const job of jobs) {
        try {
          await this.publishOne(job as PublishJob);
          processed++;
        } catch (error) {
          logger.error('Job processing failed', {
            event: 'outbox_job_error',
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return processed;
    } catch (error) {
      logger.error('runPending failed', {
        event: 'outbox_run_error',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Publish a single job
   */
  // eslint-disable-next-line max-lines-per-function, complexity -- Outbox pattern requires comprehensive state handling and error recovery
  async publishOne(job: PublishJob): Promise<void> {
    const startTime = Date.now();

    logger.debug('Publishing job', {
      event: 'outbox_publish_start',
      jobId: job.id,
      pickId: job.pick_id,
      attempts: job.attempts,
      dedupeKey: job.dedupe_key,
    });

    // Check circuit breaker
    const cbAllowed = await this.circuitBreaker.allowRequest();
    const cbState = await this.circuitBreaker.getState();

    if (!cbAllowed) {
      logger.warn('Circuit breaker OPEN - delaying publish', {
        event: 'outbox_circuit_open',
        jobId: job.id,
        cbState: cbState.state,
      });

      // Delay next attempt
      const nextAttempt = new Date(Date.now() + 60_000).toISOString(); // 60s delay

      await this.supabase
        .from('pick_publish')
        .update({
          next_attempt_at: nextAttempt,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return;
    }

    // Shadow mode: simulate success
    if (this.isShadowMode) {
      await this.handleShadowMode(job);
      await this.circuitBreaker.recordSuccess();
      return;
    }

    // Check if already sent (idempotent)
    if (job.status === 'sent' || job.external_message_id) {
      logger.info('Job already sent (idempotent)', {
        event: 'outbox_idempotent_skip',
        jobId: job.id,
        externalMessageId: job.external_message_id,
      });
      return;
    }

    // Generate dedupe key if not present
    const pickForDedupe = job.payload || {
      id: job.pick_id,
      league: (job as any).league || (job as any).sport || job.metadata?.league,
      market_type: (job as any).market_type || job.metadata?.market_type,
      line: (job as any).line || job.metadata?.line,
      side: (job as any).side || (job as any).direction || job.metadata?.side,
    };

    const dedupeKey = job.dedupe_key || generateDedupeKey(pickForDedupe, job.tenant_id);

    try {
      // Fetch pick data if needed
      const pick = job.payload || (await this.fetchPickData(job.pick_id));

      // Format and send
      const embed = formatPickEmbed(pick);
      const result = await sendEmbed(embed, {
        dedupeKey,
        discordChannelId: job.discord_channel_id, // PRIORITY: Use explicit channel from pick_publish
        capperName: pick.capper_name || pick.capperName,
        tenantId: job.tenant_id,
        pickId: job.pick_id,
      });

      if (result.success) {
        // Success - update status
        await this.supabase
          .from('pick_publish')
          .update({
            status: 'sent',
            external_message_id: result.messageId,
            attempts: job.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            dedupe_key: dedupeKey,
          })
          .eq('id', job.id);

        await this.circuitBreaker.recordSuccess();

        logger.info('Job published successfully', {
          event: 'outbox_publish_success',
          jobId: job.id,
          pickId: job.pick_id,
          messageId: result.messageId,
          attempts: job.attempts + 1,
          duration: Date.now() - startTime,
        });
      } else {
        // Failure - schedule retry
        await this.handleFailure(job, result.error || 'Unknown error', cbState.state);
        await this.circuitBreaker.recordFailure();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleFailure(job, errorMessage, cbState.state);
      await this.circuitBreaker.recordFailure();
    }
  }

  /**
   * Handle shadow mode (simulate success)
   */
  private async handleShadowMode(job: PublishJob): Promise<void> {
    const syntheticId = `shadow-${crypto.randomUUID()}`;

    await this.supabase
      .from('pick_publish')
      .update({
        status: 'sent',
        external_message_id: syntheticId,
        attempts: job.attempts + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    logger.info('Shadow mode publish simulated', {
      event: 'outbox_shadow_success',
      jobId: job.id,
      syntheticId,
    });
  }

  /**
   * Handle publish failure
   */
  private async handleFailure(
    job: PublishJob,
    errorMessage: string,
    cbState: string
  ): Promise<void> {
    const newAttempts = job.attempts + 1;
    const backoffMs = backoffWithJitter(newAttempts);
    const nextAttempt = new Date(Date.now() + backoffMs).toISOString();

    // Truncate error message
    const truncatedError = errorMessage.substring(0, 1000);

    await this.supabase
      .from('pick_publish')
      .update({
        attempts: newAttempts,
        last_error: truncatedError,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: nextAttempt,
      })
      .eq('id', job.id);

    logger.warn('Job publish failed - will retry', {
      event: 'outbox_publish_failed',
      jobId: job.id,
      pickId: job.pick_id,
      attempts: newAttempts,
      error: truncatedError,
      nextAttemptAt: nextAttempt,
      backoffMs,
      cbState,
    });
  }

  /**
   * Fetch pick data by ID
   */
  private async fetchPickData(pickId: string): Promise<any> {
    const { data, error } = await this.supabase.from('picks').select('*').eq('id', pickId).single();

    if (error) {
      // Try unified_picks as fallback
      const { data: unifiedData, error: unifiedError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .eq('id', pickId)
        .single();

      if (unifiedError) {
        throw new Error(`Pick not found: ${pickId}`);
      }

      return unifiedData;
    }

    return data;
  }
}
