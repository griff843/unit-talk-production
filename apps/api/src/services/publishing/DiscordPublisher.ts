/**
 * Discord Publisher Service
 *
 * Handles Discord message publishing with:
 * - DLQ integration for permanent failures
 * - Rate limiting (channel and global)
 * - Retry logic with exponential backoff
 * - Comprehensive observability
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { Client, TextChannel, ThreadChannel, EmbedBuilder, RESTJSONErrorCodes } from 'discord.js';
import { Logger } from '../../shared/logger/types';
import { DeadLetterQueueService } from '../DeadLetterQueueService';
import { PublishingMetrics } from '../../monitoring/PublishingMetrics';
import { RateLimiter } from './RateLimiter';
import { DiscordTemplates, PickContext, GradedPickContext, RecapContext, MessageType } from './DiscordTemplates';

export interface PublishRequest {
  pickId: string;
  tenantId: string;
  channelId: string;
  threadId?: string;
  messageType: MessageType;
  context: PickContext | GradedPickContext | RecapContext;

  // Metadata for observability
  traceId?: string;
  source: string; // 'legacy' | 'canonical' | 'professional'

  // Retry tracking
  attemptNumber?: number;
  maxAttempts?: number;
}

export interface PublishResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  shouldRetry?: boolean;
}

/**
 * Discord Publisher with DLQ integration
 */
export class DiscordPublisher {
  private client: Client | null = null;
  private logger: Logger;
  private dlqService: DeadLetterQueueService | null;
  private metrics: PublishingMetrics | null;
  private channelRateLimiter: RateLimiter;
  private globalRateLimiter: RateLimiter;

  constructor(
    client: Client | null,
    logger: Logger,
    dlqService: DeadLetterQueueService | null,
    metrics: PublishingMetrics | null,
    channelRateLimiter: RateLimiter,
    globalRateLimiter: RateLimiter
  ) {
    this.client = client;
    this.logger = logger;
    this.dlqService = dlqService;
    this.metrics = metrics;
    this.channelRateLimiter = channelRateLimiter;
    this.globalRateLimiter = globalRateLimiter;
  }

  /**
   * Publish a message to Discord
   */
  async publish(request: PublishRequest): Promise<PublishResult> {
    const startTime = Date.now();
    const endTimer = this.metrics?.startPublishTimer(request.channelId, request.messageType);

    try {
      // Log publish attempt with full context
      this.logger.info('Publishing to Discord', {
        pickId: request.pickId,
        tenantId: request.tenantId,
        channelId: request.channelId,
        threadId: request.threadId,
        messageType: request.messageType,
        source: request.source,
        traceId: request.traceId,
        attemptNumber: request.attemptNumber || 1,
        canonicalPlayerId: (request.context as PickContext).canonicalPlayerId,
        canonicalGameId: (request.context as PickContext).canonicalGameId,
      });

      // Check if Discord client is available
      if (!this.client || !this.client.isReady()) {
        const error = 'Discord client not available or not ready';
        this.logger.error(error, { pickId: request.pickId });
        return {
          success: false,
          error,
          errorCode: 'CLIENT_NOT_READY',
          shouldRetry: true,
        };
      }

      // Apply rate limiting (wait for tokens)
      await this.applyRateLimiting(request.channelId);

      // Get channel
      const channel = await this.getChannel(request.channelId, request.threadId);
      if (!channel) {
        const error = 'Channel not found';
        this.logger.error(error, { pickId: request.pickId, channelId: request.channelId });
        return {
          success: false,
          error,
          errorCode: 'CHANNEL_NOT_FOUND',
          shouldRetry: false, // Don't retry if channel doesn't exist
        };
      }

      // Render message embed
      const embed = this.renderEmbed(request.messageType, request.context);

      // Send message to Discord
      const apiTimer = this.metrics?.startDiscordApiTimer('POST', '/channels/:id/messages');
      const message = await channel.send({ embeds: [embed] });
      apiTimer?.();

      // Record success metrics
      this.metrics?.recordPublishSuccess(request.channelId, request.messageType, request.source);
      this.metrics?.recordDiscordApiCall('POST', '/channels/:id/messages');
      endTimer?.();

      this.logger.info('Successfully published to Discord', {
        pickId: request.pickId,
        messageId: message.id,
        channelId: request.channelId,
        processingTimeMs: Date.now() - startTime,
        traceId: request.traceId,
      });

      return {
        success: true,
        messageId: message.id,
      };

    } catch (error: any) {
      endTimer?.();

      // Determine error type and retry strategy
      const errorCode = error.code || error.status || 'UNKNOWN';
      const errorMessage = error.message || String(error);
      const shouldRetry = this.shouldRetryError(errorCode);

      this.logger.error('Failed to publish to Discord', {
        pickId: request.pickId,
        error: errorMessage,
        errorCode,
        shouldRetry,
        attemptNumber: request.attemptNumber || 1,
        traceId: request.traceId,
      });

      // Record failure metrics
      this.metrics?.recordPublishFailure(
        request.channelId,
        request.messageType,
        errorCode,
        request.source
      );

      if (errorCode !== 'RATE_LIMITED') {
        this.metrics?.recordDiscordApiError(errorCode, 'POST');
      }

      // If max attempts reached and DLQ available, route to DLQ
      if (!shouldRetry || (request.attemptNumber && request.attemptNumber >= (request.maxAttempts || 3))) {
        await this.routeToDLQ(request, errorMessage, errorCode);
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
        shouldRetry,
      };
    }
  }

  /**
   * Apply rate limiting before sending message
   */
  private async applyRateLimiting(channelId: string): Promise<void> {
    const startTime = Date.now();

    // Check channel-specific rate limit
    const channelAllowed = await this.channelRateLimiter.tryConsume(channelId);
    if (!channelAllowed) {
      this.metrics?.recordRateLimited(channelId, 'channel');
      this.logger.info('Channel rate limit hit, waiting for tokens', { channelId });
      await this.channelRateLimiter.waitForToken(channelId);
    }

    // Check global rate limit
    const globalAllowed = await this.globalRateLimiter.tryConsume('global');
    if (!globalAllowed) {
      this.metrics?.recordRateLimited(channelId, 'global');
      this.logger.info('Global rate limit hit, waiting for tokens', { channelId });
      await this.globalRateLimiter.waitForToken('global');
    }

    const waitTime = (Date.now() - startTime) / 1000;
    if (waitTime > 0.1) {
      this.metrics?.recordRateLimitWait(channelId, waitTime);
      this.logger.debug('Rate limit wait completed', {
        channelId,
        waitTimeSeconds: waitTime,
      });
    }
  }

  /**
   * Get Discord channel (supports both regular channels and threads)
   */
  private async getChannel(channelId: string, threadId?: string): Promise<TextChannel | ThreadChannel | null> {
    if (!this.client) return null;

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) return null;

      // If thread ID specified, fetch the thread
      if (threadId && (channel instanceof TextChannel)) {
        const thread = await channel.threads.fetch(threadId);
        return thread || null;
      }

      if (channel instanceof TextChannel || channel instanceof ThreadChannel) {
        return channel;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to fetch Discord channel', {
        channelId,
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Render embed for message type
   */
  private renderEmbed(messageType: MessageType, context: any): EmbedBuilder {
    switch (messageType) {
      case 'new_pick':
        return DiscordTemplates.renderNewPick(context as PickContext);
      case 'graded_pick':
        return DiscordTemplates.renderGradedPick(context as GradedPickContext);
      case 'daily_recap':
      case 'weekly_recap':
        return DiscordTemplates.renderDailyRecap(context as RecapContext);
      default:
        this.logger.warn('Unknown message type, using default template', { messageType });
        return DiscordTemplates.renderNewPick(context as PickContext);
    }
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetryError(errorCode: string | number): boolean {
    // Don't retry client errors (4xx except rate limit)
    if (typeof errorCode === 'number' && errorCode >= 400 && errorCode < 500) {
      // Retry rate limits
      if (errorCode === 429) return true;
      // Retry server unavailable
      if (errorCode === 503) return true;
      // Don't retry other 4xx errors
      return false;
    }

    // Retry on specific Discord error codes
    const retryableCodes = [
      429, // Rate limited
      500, // Internal server error
      503, // Service unavailable
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'CLIENT_NOT_READY',
    ];

    return retryableCodes.includes(errorCode as any);
  }

  /**
   * Route failed publish to DLQ
   */
  private async routeToDLQ(request: PublishRequest, errorMessage: string, errorCode: string): Promise<void> {
    if (!this.dlqService) {
      this.logger.warn('DLQ service not available, cannot route failed publish', {
        pickId: request.pickId,
      });
      return;
    }

    try {
      const dlqId = await this.dlqService.addToDLQ({
        source: 'discord_publisher',
        original_event_id: request.pickId,
        original_table: 'pick_publish',
        payload: {
          pickId: request.pickId,
          tenantId: request.tenantId,
          channelId: request.channelId,
          threadId: request.threadId,
          messageType: request.messageType,
          context: request.context,
        },
        error_message: errorMessage,
        error_code: errorCode,
        retry_count: request.attemptNumber || 1,
        max_retries_attempted: request.maxAttempts || 3,
        metadata: {
          traceId: request.traceId,
          source: request.source,
          canonicalPlayerId: (request.context as PickContext).canonicalPlayerId,
          canonicalGameId: (request.context as PickContext).canonicalGameId,
        },
      });

      this.metrics?.recordDLQRouted(errorCode, request.channelId);

      this.logger.info('Failed publish routed to DLQ', {
        pickId: request.pickId,
        dlqId,
        errorCode,
        traceId: request.traceId,
      });
    } catch (dlqError) {
      this.logger.error('Failed to route publish to DLQ', {
        pickId: request.pickId,
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
    }
  }
}
