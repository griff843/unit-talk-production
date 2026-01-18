/**
 * Discord Publishing Worker
 *
 * Polls the pick_publish table and publishes messages to Discord with:
 * - DLQ integration for permanent failures
 * - Rate limiting
 * - Exponential backoff retry
 * - Comprehensive observability
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { BaseAgent } from '../agents/BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../agents/BaseAgent/types';
import { withCircuitBreaker, circuitBreaker } from '../services/enhanced-circuit-breaker';
import { Logger } from '../shared/logger/types';
import { DeadLetterQueueService } from '../services/DeadLetterQueueService';
import { PublishingMetrics } from '../monitoring/PublishingMetrics';
import { RateLimiterFactory } from '../services/publishing/RateLimiter';
import { DiscordPublisher, PublishRequest } from '../services/publishing/DiscordPublisher';
import { PickContext } from '../services/publishing/DiscordTemplates';
import { dlqMetrics } from '../services/metricsServer';

interface DiscordPublishingWorkerConfig extends BaseAgentConfig {
  batchSize: number;
  processingInterval: number;
  maxRetries: number;
  enableDiscordPublishing: boolean;
}

interface DiscordPublishingWorkerMetrics extends BaseMetrics {
  publishRecordsProcessed: number;
  publishRecordsFailed: number;
  publishRecordsSkipped: number;
  avgProcessingTime: number;
  rateLimitHits: number;
  dlqRouted: number;
}

interface PublishRecord {
  id: string;
  pick_id: string;
  tenant_id: string;
  status: 'pending' | 'sent' | 'failed';
  channel: 'DISCORD' | 'CANARY' | 'WEBHOOK' | 'EMAIL';
  discord_channel_id: string;
  thread_id?: string;
  message_type: 'new_pick' | 'graded_pick' | 'daily_recap' | 'weekly_recap';
  metadata?: any;
  external_message_id?: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  created_at: string;
  sent_at?: string;
  failed_at?: string;
  error_message?: string;
}

export class DiscordPublishingWorker extends BaseAgent {
  private isProcessing = false;
  private workerMetrics: DiscordPublishingWorkerMetrics;
  private batchSize: number;
  private processingInterval: number;
  private maxRetries: number;
  private enableDiscordPublishing: boolean;
  private dlqService: DeadLetterQueueService | null = null;
  private publishingMetrics: PublishingMetrics | null = null;
  private discordClient: Client | null = null;
  private discordPublisher: DiscordPublisher | null = null;

  constructor(config: DiscordPublishingWorkerConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.batchSize = config.batchSize || 10;
    this.processingInterval = config.processingInterval || 5000;
    this.maxRetries = config.maxRetries || 3;
    this.enableDiscordPublishing = config.enableDiscordPublishing !== false;

    // Initialize DLQ service
    if (this.hasSupabase()) {
      this.dlqService = new DeadLetterQueueService(
        this.requireSupabase(),
        this.logger,
        // @ts-ignore - dlqMetrics type compatibility (prometheus metrics)
        dlqMetrics || undefined
      );
    }

    // Initialize publishing metrics
    this.publishingMetrics = null; // TODO: Initialize PublishingMetrics when implemented

    // Initialize worker metrics
    this.workerMetrics = {
      ...this.metrics,
      publishRecordsProcessed: 0,
      publishRecordsFailed: 0,
      publishRecordsSkipped: 0,
      avgProcessingTime: 0,
      errorCount: 0,
      successCount: 0,
      rateLimitHits: 0,
      dlqRouted: 0,
    };

    // Initialize Discord client and publisher
    if (this.enableDiscordPublishing) {
      this.initializeDiscordClient();
    }
  }

  protected async initialize(): Promise<void> {
    this.logger.info('📨 DiscordPublishingWorker initializing...');

    // Register circuit breaker for Supabase
    circuitBreaker.registerService('supabase-publish', {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      timeoutMs: 10000,
      retryAttempts: 3,
    });

    // Register circuit breaker for Discord API
    circuitBreaker.registerService('discord-api', {
      failureThreshold: 3,
      resetTimeoutMs: 60000,
      timeoutMs: 30000,
      retryAttempts: 2,
    });

    // Verify pick_publish table exists
    try {
      await withCircuitBreaker.supabase(async () => {
        if (this.hasSupabase()) {
          const { error } = await this.requireSupabase()
            .from('pick_publish')
            .select('count')
            .limit(1);

          if (error) {
            throw new Error(`pick_publish table not accessible: ${error.message}`);
          }
        }
      }, async () => {
        this.logger.warn('⚠️ pick_publish table health check failed');
      });
    } catch (error) {
      this.logger.warn('⚠️ pick_publish table verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Initialize Discord client
    if (this.enableDiscordPublishing && this.discordClient) {
      await this.initializeDiscordConnection();
    }
  }

  /**
   * Initialize Discord client
   */
  private initializeDiscordClient(): void {
    const discordToken = process.env.DISCORD_TOKEN;
    if (!discordToken) {
      this.logger.warn('⚠️ DISCORD_TOKEN not set, Discord publishing disabled');
      this.enableDiscordPublishing = false;
      return;
    }

    this.discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    // Create rate limiters
    const channelRateLimiter = RateLimiterFactory.createDiscordChannelLimiter(this.logger);
    const globalRateLimiter = RateLimiterFactory.createDiscordGlobalLimiter(this.logger);

    // Create Discord publisher
    this.discordPublisher = new DiscordPublisher(
      this.discordClient,
      this.logger,
      this.dlqService,
      this.publishingMetrics,
      channelRateLimiter,
      globalRateLimiter
    );

    this.logger.info('Discord client initialized');
  }

  /**
   * Connect to Discord
   */
  private async initializeDiscordConnection(): Promise<void> {
    if (!this.discordClient) return;

    try {
      await this.discordClient.login(process.env.DISCORD_TOKEN);
      this.logger.info('✅ Discord client connected');
    } catch (error) {
      this.logger.error('Failed to connect to Discord', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.enableDiscordPublishing = false;
    }
  }

  protected async process(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      await this.processPublishRecords();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process pending publish records from pick_publish table
   */
  private async processPublishRecords(): Promise<void> {
    const records = await this.fetchPendingPublishRecords();

    if (records.length === 0) {
      return;
    }

    this.logger.info(`📨 Processing ${records.length} pending publish records`);

    // Process records with concurrency control
    const batches = this.chunkArray(records, this.batchSize);

    for (const batch of batches) {
      const promises = batch.map(record => this.processPublishRecord(record));
      await Promise.allSettled(promises);
    }

    // Update outbox metrics
    this.updateOutboxMetrics();
  }

  /**
   * Fetch pending publish records from pick_publish table
   */
  private async fetchPendingPublishRecords(): Promise<PublishRecord[]> {
    return await withCircuitBreaker.supabase(
      async () => {
        if (!this.hasSupabase()) throw new Error('Supabase not available');

        const { data, error } = await this.requireSupabase()
          .from('pick_publish')
          .select('*')
          .eq('status', 'pending')
          .lte('next_attempt_at', new Date().toISOString())
          .filter('attempts', 'lt', 'max_attempts')
          .order('created_at', { ascending: true })
          .limit(this.batchSize);

        if (error) {
          throw new Error(`Failed to fetch publish records: ${error.message}`);
        }

        return data || [];
      },
      async () => {
        this.logger.warn('⚠️ Supabase circuit breaker open, skipping publish record fetch');
        return [];
      }
    );
  }

  /**
   * Process a single publish record
   */
  private async processPublishRecord(record: PublishRecord): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing publish record', {
        recordId: record.id,
        pickId: record.pick_id,
        messageType: record.message_type,
        attempts: record.attempts,
      });

      // Mark as processing (increment attempts)
      await this.markRecordAsProcessing(record);

      // Skip if Discord publishing is disabled
      if (!this.enableDiscordPublishing || !this.discordPublisher) {
        this.logger.warn('Discord publishing disabled, skipping record', {
          recordId: record.id,
        });
        await this.markRecordAsSkipped(record);
        this.workerMetrics.publishRecordsSkipped++;
        return;
      }

      // Check for duplicate (idempotency check via external_message_id)
      if (record.external_message_id) {
        this.logger.info('Record already published (idempotency check)', {
          recordId: record.id,
          externalMessageId: record.external_message_id,
        });
        await this.markRecordAsSent(record, record.external_message_id);
        return;
      }

      // Build publish request
      const publishRequest: PublishRequest = {
        pickId: record.pick_id,
        tenantId: record.tenant_id,
        channelId: record.discord_channel_id,
        threadId: record.thread_id,
        messageType: record.message_type,
        context: this.extractContext(record),
        traceId: record.metadata?.traceId || `pub-${record.id}`,
        source: record.metadata?.source || 'outbox',
        attemptNumber: record.attempts + 1,
        maxAttempts: record.max_attempts,
      };

      // Publish to Discord
      const result = await this.discordPublisher.publish(publishRequest);

      if (result.success && result.messageId) {
        // Mark as sent
        await this.markRecordAsSent(record, result.messageId);
        this.workerMetrics.publishRecordsProcessed++;
        this.workerMetrics.successCount++;
        this.publishingMetrics?.recordOutboxProcessed('success');

        const processingTime = Date.now() - startTime;
        this.workerMetrics.avgProcessingTime =
          (this.workerMetrics.avgProcessingTime + processingTime) / 2;

        this.logger.info('✅ Publish record processed successfully', {
          recordId: record.id,
          messageId: result.messageId,
          processingTimeMs: processingTime,
        });
      } else {
        // Handle failure
        await this.handlePublishFailure(record, result.error || 'Unknown error', result.errorCode, result.shouldRetry || false);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.handlePublishFailure(
        record,
        error instanceof Error ? error.message : String(error),
        'UNEXPECTED_ERROR',
        true
      );
    }
  }

  /**
   * Extract pick context from publish record metadata
   */
  private extractContext(record: PublishRecord): PickContext {
    // This would typically fetch from the picks table
    // For now, we'll use metadata if available
    return record.metadata?.context || {
      pickId: record.pick_id,
      tenantId: record.tenant_id,
      playerName: record.metadata?.playerName || 'Unknown Player',
      sport: record.metadata?.sport || 'unknown',
      statType: record.metadata?.statType || 'unknown',
      line: record.metadata?.line || 0,
      pickSide: record.metadata?.pickSide || 'over',
      odds: record.metadata?.odds || '-110',
      units: record.metadata?.units || 1,
      capper: record.metadata?.capper || 'Unknown',
      timestamp: new Date(record.created_at),
      source: record.metadata?.source || 'outbox',
    };
  }

  /**
   * Mark record as processing (increment attempts)
   */
  private async markRecordAsProcessing(record: PublishRecord): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('pick_publish')
      .update({
        attempts: record.attempts + 1,
        next_attempt_at: this.calculateNextAttempt(record.attempts + 1).toISOString(),
      })
      .eq('id', record.id);
  }

  /**
   * Mark record as sent
   */
  private async markRecordAsSent(record: PublishRecord, messageId: string): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('pick_publish')
      .update({
        status: 'sent',
        external_message_id: messageId,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', record.id);
  }

  /**
   * Mark record as skipped
   */
  private async markRecordAsSkipped(record: PublishRecord): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('pick_publish')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: 'Discord publishing disabled',
      })
      .eq('id', record.id);
  }

  /**
   * Handle publish failure
   */
  private async handlePublishFailure(
    record: PublishRecord,
    errorMessage: string,
    errorCode: string | undefined,
    shouldRetry: boolean
  ): Promise<void> {
    this.workerMetrics.publishRecordsFailed++;
    this.workerMetrics.errorCount++;

    const attemptNumber = record.attempts + 1;
    const maxAttemptsReached = attemptNumber >= record.max_attempts;

    if (shouldRetry && !maxAttemptsReached) {
      // Schedule retry with exponential backoff
      const nextAttempt = this.calculateNextAttempt(attemptNumber);

      if (this.hasSupabase()) {
        await this.requireSupabase()
          .from('pick_publish')
          .update({
            next_attempt_at: nextAttempt.toISOString(),
            error_message: errorMessage,
          })
          .eq('id', record.id);
      }

      this.publishingMetrics?.recordOutboxProcessed('failure');

      this.logger.warn('Publish failed, will retry', {
        recordId: record.id,
        attempts: attemptNumber,
        maxAttempts: record.max_attempts,
        nextAttempt: nextAttempt.toISOString(),
        error: errorMessage,
      });
    } else {
      // Mark as permanently failed
      if (this.hasSupabase()) {
        await this.requireSupabase()
          .from('pick_publish')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', record.id);
      }

      this.workerMetrics.dlqRouted++;

      this.logger.error('Publish permanently failed', {
        recordId: record.id,
        attempts: attemptNumber,
        error: errorMessage,
        errorCode,
      });

      // Note: DLQ routing is handled by DiscordPublisher.publish()
    }
  }

  /**
   * Calculate next attempt time with exponential backoff
   * 1min, 5min, 15min
   */
  private calculateNextAttempt(attemptNumber: number): Date {
    const backoffMinutes = Math.pow(3, attemptNumber); // 3^1 = 3min, 3^2 = 9min, 3^3 = 27min
    return new Date(Date.now() + backoffMinutes * 60 * 1000);
  }

  /**
   * Update outbox metrics (pending count and oldest age)
   */
  private async updateOutboxMetrics(): Promise<void> {
    if (!this.publishingMetrics || !this.hasSupabase()) return;

    try {
      // Get pending count
      const { data: countData, error: countError } = await this.requireSupabase()
        .from('pick_publish')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!countError && countData) {
        this.publishingMetrics.setOutboxPending(countData.length);
      }

      // Get oldest pending record
      const { data: oldestData, error: oldestError } = await this.requireSupabase()
        .from('pick_publish')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!oldestError && oldestData) {
        const ageSeconds = Math.floor(
          (Date.now() - new Date(oldestData.created_at).getTime()) / 1000
        );
        this.publishingMetrics.setOutboxOldestAge(ageSeconds);
      }
    } catch (error) {
      this.logger.warn('Failed to update outbox metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.workerMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    // Check Supabase connectivity
    try {
      if (this.hasSupabase()) {
        await this.requireSupabase().from('pick_publish').select('count').limit(1);
        checks.push({ service: 'supabase-publish', status: 'healthy' });
      } else {
        checks.push({ service: 'supabase-publish', status: 'unhealthy', error: 'Client not available' });
      }
    } catch (error) {
      checks.push({
        service: 'supabase-publish',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check Discord connectivity
    try {
      if (this.discordClient && this.discordClient.isReady()) {
        checks.push({ service: 'discord-api', status: 'healthy' });
      } else {
        checks.push({
          service: 'discord-api',
          status: this.enableDiscordPublishing ? 'unhealthy' : 'disabled',
          error: this.enableDiscordPublishing ? 'Client not ready' : 'Publishing disabled',
        });
      }
    } catch (error) {
      checks.push({
        service: 'discord-api',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const healthyServices = checks.filter(check => check.status === 'healthy').length;
    const totalServices = checks.filter(check => check.status !== 'disabled').length;
    const healthPercentage = totalServices > 0 ? healthyServices / totalServices : 0;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthPercentage >= 1.0) {
      overallStatus = 'healthy';
    } else if (healthPercentage >= 0.5) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.workerMetrics,
        processing: {
          isProcessing: this.isProcessing,
          batchSize: this.batchSize,
          processingInterval: this.processingInterval,
          discordPublishingEnabled: this.enableDiscordPublishing,
        },
      },
    };
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 DiscordPublishingWorker cleanup initiated...');

    // Stop processing
    this.isProcessing = false;

    // Disconnect Discord client
    if (this.discordClient) {
      await this.discordClient.destroy();
      this.logger.info('Discord client disconnected');
    }

    this.logger.info('🧹 DiscordPublishingWorker cleanup complete');
  }
}
