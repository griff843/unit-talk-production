/**
 * @fileoverview Ops Digest Scheduler
 *
 * Generates weekly ops digests with:
 * - Scheduled execution (Monday 9:00 AM America/New_York)
 * - Incident summary aggregation
 * - SLO health reporting
 * - Discord notification
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsDigestScheduler
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { makeLogger } from '../../utils/logger';

import { OpsDigestData } from './OpsDiscordEmbedBuilder';
import { getOpsDiscordSender } from './OpsDiscordSender';

const logger = makeLogger('OpsDigestScheduler');

// ============================================================================
// Types
// ============================================================================

interface OpsDigestConfig {
  enabled: boolean;
  channelId: string;
  environment: string;
  commandCenterUrl: string;
  cronSchedule: string; // cron expression
  timezone: string;
}

interface DigestGenerationResult {
  success: boolean;
  digestId?: string;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): OpsDigestConfig {
  return {
    enabled: process.env.OPS_DIGEST_ENABLED === 'true',
    channelId: process.env.OPS_DIGEST_CHANNEL_ID || process.env.OPS_DISCORD_CHANNEL_ID || '',
    environment: process.env.NODE_ENV || 'development',
    commandCenterUrl: process.env.COMMAND_CENTER_URL || 'http://localhost:3004',
    cronSchedule: process.env.OPS_DIGEST_CRON || '0 9 * * 1', // Monday 9 AM
    timezone: process.env.OPS_DIGEST_TIMEZONE || 'America/New_York',
  };
}

// ============================================================================
// OpsDigestScheduler Class
// ============================================================================

export class OpsDigestScheduler {
  private supabase: SupabaseClient;
  private config: OpsDigestConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(supabaseUrl: string, supabaseServiceKey: string, config?: Partial<OpsDigestConfig>) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = { ...getDefaultConfig(), ...config };

    logger.info('OpsDigestScheduler initialized', {
      enabled: this.config.enabled,
      timezone: this.config.timezone,
      cronSchedule: this.config.cronSchedule,
    });
  }

  /**
   * Start the digest scheduler
   * Uses simple interval checking for the weekly schedule
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('OpsDigestScheduler is disabled');
      return;
    }

    logger.info('Starting OpsDigestScheduler');

    // Check every hour if it's time to run the digest
    this.intervalId = setInterval(
      () => {
        this.checkAndRunDigest();
      },
      60 * 60 * 1000
    ); // 1 hour

    // Initial check
    this.checkAndRunDigest();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('OpsDigestScheduler stopped');
    }
  }

  /**
   * Check if it's time to run digest
   */
  private async checkAndRunDigest(): Promise<void> {
    const now = new Date();

    // Get current time in target timezone
    const tzTime = new Date(now.toLocaleString('en-US', { timeZone: this.config.timezone }));
    const dayOfWeek = tzTime.getDay(); // 0 = Sunday, 1 = Monday
    const hour = tzTime.getHours();

    // Check if it's Monday 9 AM (or whenever scheduled)
    // Parse cron: "0 9 * * 1" means minute 0, hour 9, any day, any month, Monday (1)
    const [_minute, cronHour, _dayOfMonth, _month, cronDayOfWeek] =
      this.config.cronSchedule.split(' ');
    const targetHour = parseInt(cronHour, 10);
    const targetDay = parseInt(cronDayOfWeek, 10);

    if (dayOfWeek === targetDay && hour === targetHour) {
      // Check if we already ran today
      const alreadyRan = await this.checkAlreadyRanToday();
      if (!alreadyRan) {
        logger.info('Scheduled digest time reached, generating weekly digest');
        await this.generateAndSendDigest();
      }
    }
  }

  /**
   * Check if digest already ran today
   */
  private async checkAlreadyRanToday(): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('ops.digest_history')
      .select('id')
      .gte('generated_at', today.toISOString())
      .limit(1);

    if (error) {
      logger.warn('Failed to check digest history', { error: error.message });
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Generate and send weekly digest
   */
  async generateAndSendDigest(): Promise<DigestGenerationResult> {
    const correlationId = uuidv4();

    logger.info('Generating weekly ops digest', { correlationId });

    try {
      // Calculate period (last 7 days)
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 7);

      // Get digest data from database
      const digestData = await this.fetchDigestData(
        periodStart.toISOString(),
        periodEnd.toISOString()
      );

      if (!digestData) {
        return { success: false, error: 'Failed to fetch digest data' };
      }

      // Record digest generation
      const digestId = await this.recordDigest(digestData, correlationId);

      // Send to Discord
      const sender = getOpsDiscordSender();
      const result = await sender.sendDigestNotification(
        digestData,
        this.config.channelId,
        correlationId,
        this.config.environment,
        this.config.commandCenterUrl
      );

      if (result.success) {
        // Update digest record with message ID
        await this.updateDigestMessageId(digestId, result.messageId || '');

        logger.info('Weekly digest sent successfully', {
          correlationId,
          digestId,
          messageId: result.messageId,
        });

        return {
          success: true,
          digestId,
          messageId: result.messageId,
        };
      } else {
        logger.error('Failed to send digest to Discord', {
          correlationId,
          error: result.error,
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate weekly digest', {
        correlationId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Fetch digest data from database
   */
  private async fetchDigestData(
    periodStart: string,
    periodEnd: string
  ): Promise<OpsDigestData | null> {
    const { data, error } = await this.supabase.rpc('get_weekly_digest_data', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (error) {
      logger.error('Failed to fetch digest data', { error: error.message });
      return null;
    }

    if (!data || !data[0]) {
      // Return empty digest if no data
      return {
        periodStart,
        periodEnd,
        incidentCounts: {
          total: 0,
          critical: 0,
          warning: 0,
          open: 0,
          acknowledged: 0,
          resolved: 0,
        },
        topNoisySlos: [],
        timingMetrics: {
          avg_time_to_ack_minutes: null,
          avg_time_to_resolve_minutes: null,
          median_time_to_ack_minutes: null,
          median_time_to_resolve_minutes: null,
        },
        evaluationHealth: {
          total_evaluations: 0,
          successful_evaluations: 0,
          error_rate: 0,
        },
        sloHealthSummary: [],
      };
    }

    return data[0] as OpsDigestData;
  }

  /**
   * Record digest in history
   */
  private async recordDigest(digest: OpsDigestData, correlationId: string): Promise<string> {
    const digestId = uuidv4();

    const { error } = await this.supabase.from('ops.digest_history').insert({
      id: digestId,
      period_start: digest.periodStart,
      period_end: digest.periodEnd,
      digest_data: digest,
      correlation_id: correlationId,
      generated_at: new Date().toISOString(),
    });

    if (error) {
      logger.warn('Failed to record digest in history', { error: error.message });
    }

    return digestId;
  }

  /**
   * Update digest with Discord message ID
   */
  private async updateDigestMessageId(digestId: string, messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ops.digest_history')
      .update({
        discord_message_id: messageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', digestId);

    if (error) {
      logger.warn('Failed to update digest message ID', { error: error.message });
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualDigest(): Promise<DigestGenerationResult> {
    logger.info('Manual digest generation triggered');
    return this.generateAndSendDigest();
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<{
    enabled: boolean;
    lastDigest: { generatedAt: string; sentAt: string | null } | null;
    nextScheduled: string;
    config: Partial<OpsDigestConfig>;
  }> {
    // Get last digest
    const { data: lastDigestData } = await this.supabase
      .from('ops.digest_history')
      .select('generated_at, sent_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate next scheduled time
    const nextScheduled = this.calculateNextScheduledTime();

    return {
      enabled: this.config.enabled,
      lastDigest: lastDigestData
        ? {
            generatedAt: lastDigestData.generated_at,
            sentAt: lastDigestData.sent_at,
          }
        : null,
      nextScheduled,
      config: {
        cronSchedule: this.config.cronSchedule,
        timezone: this.config.timezone,
        environment: this.config.environment,
      },
    };
  }

  /**
   * Calculate next scheduled execution time
   */
  private calculateNextScheduledTime(): string {
    const now = new Date();
    const [_minute, cronHour, _dayOfMonth, _month, cronDayOfWeek] =
      this.config.cronSchedule.split(' ');
    const targetHour = parseInt(cronHour, 10);
    const targetDay = parseInt(cronDayOfWeek, 10);

    // Find next occurrence
    const next = new Date(now);
    next.setHours(targetHour, 0, 0, 0);

    // Move to next target day
    while (next.getDay() !== targetDay || next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }
}

// ============================================================================
// Factory
// ============================================================================

let schedulerInstance: OpsDigestScheduler | null = null;

export function getOpsDigestScheduler(): OpsDigestScheduler {
  if (!schedulerInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for OpsDigestScheduler');
    }

    schedulerInstance = new OpsDigestScheduler(supabaseUrl, supabaseKey);
  }

  return schedulerInstance;
}

export function createOpsDigestScheduler(
  supabaseUrl: string,
  supabaseServiceKey: string,
  config?: Partial<OpsDigestConfig>
): OpsDigestScheduler {
  return new OpsDigestScheduler(supabaseUrl, supabaseServiceKey, config);
}
