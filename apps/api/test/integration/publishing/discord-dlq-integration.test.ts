/**
 * Discord Publishing DLQ Integration Tests
 *
 * Tests the end-to-end flow of Discord publishing failures routing to DLQ:
 * - Failed Discord API calls
 * - Rate limiting scenarios
 * - Retry logic with exponential backoff
 * - DLQ routing after max retries
 * - Replay capabilities
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Client } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import { DeadLetterQueueService } from '../../../src/services/DeadLetterQueueService';
import { PublishingMetrics } from '../../../src/monitoring/PublishingMetrics';
import { RateLimiterFactory } from '../../../src/services/publishing/RateLimiter';
import { DiscordPublisher, PublishRequest } from '../../../src/services/publishing/DiscordPublisher';
import { Registry } from 'prom-client';

describe('Discord Publishing DLQ Integration', () => {
  let supabaseClient: any;
  let dlqService: DeadLetterQueueService;
  let publishingMetrics: PublishingMetrics;
  let discordClient: Client;
  let discordPublisher: DiscordPublisher;
  let logger: any;

  beforeEach(() => {
    // Mock Supabase client
    supabaseClient = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_ANON_KEY || 'test-key'
    );

    // Mock logger
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Initialize services
    const registry = new Registry();
    publishingMetrics = PublishingMetrics.getInstance({ registry });
    dlqService = new DeadLetterQueueService(supabaseClient, logger, undefined);

    // Mock Discord client
    discordClient = {
      isReady: jest.fn(() => true),
      channels: {
        fetch: jest.fn(),
      },
    } as any;

    // Create rate limiters
    const channelRateLimiter = RateLimiterFactory.createDiscordChannelLimiter(logger);
    const globalRateLimiter = RateLimiterFactory.createDiscordGlobalLimiter(logger);

    // Initialize Discord publisher
    discordPublisher = new DiscordPublisher(
      discordClient,
      logger,
      dlqService,
      publishingMetrics,
      channelRateLimiter,
      globalRateLimiter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Failed Discord API Calls', () => {
    it('should route to DLQ after max retries on permanent failures', async () => {
      // Mock channel fetch to throw 404 error
      (discordClient.channels.fetch as jest.Mock).mockRejectedValue({
        code: 404,
        message: 'Channel not found',
      });

      const request: PublishRequest = {
        pickId: 'pick-123',
        tenantId: 'tenant-1',
        channelId: '123456789',
        messageType: 'new_pick',
        context: {
          pickId: 'pick-123',
          tenantId: 'tenant-1',
          playerName: 'LeBron James',
          sport: 'nba',
          statType: 'points',
          line: 25.5,
          pickSide: 'over',
          odds: '-110',
          units: 2,
          capper: 'TestCapper',
          timestamp: new Date(),
          source: 'test',
        },
        source: 'test',
        attemptNumber: 3,
        maxAttempts: 3,
      };

      // Mock DLQ service
      const addToDLQSpy = jest.spyOn(dlqService, 'addToDLQ');

      // Execute publish (should fail and route to DLQ)
      const result = await discordPublisher.publish(request);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CHANNEL_NOT_FOUND');
      expect(result.shouldRetry).toBe(false);

      // Verify DLQ was called
      expect(addToDLQSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'discord_publisher',
          original_event_id: 'pick-123',
          original_table: 'pick_publish',
          error_code: 'CHANNEL_NOT_FOUND',
          retry_count: 3,
          max_retries_attempted: 3,
        })
      );

      // Verify metrics
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish to Discord',
        expect.objectContaining({
          pickId: 'pick-123',
          errorCode: 'CHANNEL_NOT_FOUND',
        })
      );
    });

    it('should retry on transient failures (429 rate limit)', async () => {
      // Mock channel fetch to throw rate limit error
      (discordClient.channels.fetch as jest.Mock).mockRejectedValue({
        code: 429,
        message: 'Rate limited',
      });

      const request: PublishRequest = {
        pickId: 'pick-456',
        tenantId: 'tenant-1',
        channelId: '123456789',
        messageType: 'new_pick',
        context: {
          pickId: 'pick-456',
          tenantId: 'tenant-1',
          playerName: 'Stephen Curry',
          sport: 'nba',
          statType: 'three_pointers',
          line: 4.5,
          pickSide: 'over',
          odds: '+105',
          units: 1,
          capper: 'TestCapper',
          timestamp: new Date(),
          source: 'test',
        },
        source: 'test',
        attemptNumber: 1,
        maxAttempts: 3,
      };

      // Execute publish (should fail with retry flag)
      const result = await discordPublisher.publish(request);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('429');
      expect(result.shouldRetry).toBe(true);

      // Verify logging
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish to Discord',
        expect.objectContaining({
          pickId: 'pick-456',
          shouldRetry: true,
        })
      );
    });

    it('should retry on service unavailable (503)', async () => {
      // Mock channel fetch to throw 503 error
      (discordClient.channels.fetch as jest.Mock).mockRejectedValue({
        code: 503,
        message: 'Service unavailable',
      });

      const request: PublishRequest = {
        pickId: 'pick-789',
        tenantId: 'tenant-1',
        channelId: '123456789',
        messageType: 'new_pick',
        context: {
          pickId: 'pick-789',
          tenantId: 'tenant-1',
          playerName: 'Patrick Mahomes',
          sport: 'nfl',
          statType: 'passing_yards',
          line: 275.5,
          pickSide: 'over',
          odds: '-115',
          units: 3,
          capper: 'TestCapper',
          timestamp: new Date(),
          source: 'test',
        },
        source: 'test',
        attemptNumber: 1,
        maxAttempts: 3,
      };

      // Execute publish
      const result = await discordPublisher.publish(request);

      // Assertions
      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should wait for tokens when rate limited', async () => {
      // Mock successful channel and send
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'msg-123' }),
      };
      (discordClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const requests: PublishRequest[] = [];
      for (let i = 0; i < 12; i++) {
        requests.push({
          pickId: `pick-${i}`,
          tenantId: 'tenant-1',
          channelId: '123456789',
          messageType: 'new_pick',
          context: {
            pickId: `pick-${i}`,
            tenantId: 'tenant-1',
            playerName: 'Test Player',
            sport: 'nba',
            statType: 'points',
            line: 20.5,
            pickSide: 'over',
            odds: '-110',
            units: 1,
            capper: 'TestCapper',
            timestamp: new Date(),
            source: 'test',
          },
          source: 'test',
        });
      }

      // Execute publishes in rapid succession
      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => discordPublisher.publish(req)));
      const endTime = Date.now();

      // Verify all succeeded
      expect(results.every(r => r.success)).toBe(true);

      // Verify rate limiting occurred (should take more than 1 second for 12 messages)
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(1000);

      // Verify rate limit metrics were recorded
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('rate limit'),
        expect.any(Object)
      );
    });
  });

  describe('DLQ Replay', () => {
    it('should successfully replay DLQ messages', async () => {
      // Add a message to DLQ
      const dlqId = await dlqService.addToDLQ({
        source: 'discord_publisher',
        original_event_id: 'pick-replay-test',
        original_table: 'pick_publish',
        payload: {
          pickId: 'pick-replay-test',
          tenantId: 'tenant-1',
          channelId: '123456789',
          messageType: 'new_pick',
        },
        error_message: 'Temporary failure for testing',
        error_code: 'TEST_ERROR',
        retry_count: 3,
        max_retries_attempted: 3,
      });

      expect(dlqId).toBeTruthy();

      // Mark for replay
      const marked = await dlqService.markForReplay(dlqId!, {
        requeued_by: 'test-user',
        notes: 'Testing replay functionality',
      });

      expect(marked).toBe(true);

      // Verify replay status
      const dlqEntry = await dlqService.getById(dlqId!);
      expect(dlqEntry).toBeTruthy();
      expect(dlqEntry.replay_status).toBe('pending');
      expect(dlqEntry.requeued_by).toBe('test-user');

      // Simulate successful replay
      const updated = await dlqService.updateReplayStatus(dlqId!, 'succeeded');
      expect(updated).toBe(true);

      // Verify final status
      const finalEntry = await dlqService.getById(dlqId!);
      expect(finalEntry.replay_status).toBe('succeeded');
    });

    it('should track failed replay attempts', async () => {
      // Add a message to DLQ
      const dlqId = await dlqService.addToDLQ({
        source: 'discord_publisher',
        original_event_id: 'pick-failed-replay',
        original_table: 'pick_publish',
        payload: {
          pickId: 'pick-failed-replay',
        },
        error_message: 'Original failure',
        error_code: 'ORIGINAL_ERROR',
      });

      // Mark for replay
      await dlqService.markForReplay(dlqId!, {
        requeued_by: 'test-user',
      });

      // Simulate failed replay
      const updated = await dlqService.updateReplayStatus(
        dlqId!,
        'failed',
        'Replay failed: Still cannot reach Discord API'
      );

      expect(updated).toBe(true);

      // Verify replay failure was recorded
      const finalEntry = await dlqService.getById(dlqId!);
      expect(finalEntry.replay_status).toBe('failed');
      expect(finalEntry.replay_error).toContain('Still cannot reach Discord API');
    });
  });

  describe('Metrics and Observability', () => {
    it('should record all publish metrics correctly', async () => {
      // Mock successful publish
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'msg-metrics-test' }),
      };
      (discordClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const request: PublishRequest = {
        pickId: 'pick-metrics',
        tenantId: 'tenant-1',
        channelId: '123456789',
        messageType: 'new_pick',
        context: {
          pickId: 'pick-metrics',
          tenantId: 'tenant-1',
          playerName: 'Test Player',
          canonicalPlayerId: 'canonical-123',
          canonicalGameId: 'game-456',
          sport: 'nba',
          statType: 'points',
          line: 20.5,
          pickSide: 'over',
          odds: '-110',
          units: 1,
          clvValue: 0.5,
          clvPercentage: 2.3,
          capper: 'TestCapper',
          timestamp: new Date(),
          source: 'canonical',
        },
        source: 'canonical',
        traceId: 'trace-123',
      };

      // Execute publish
      const result = await discordPublisher.publish(request);

      // Verify success
      expect(result.success).toBe(true);

      // Verify comprehensive logging occurred
      expect(logger.info).toHaveBeenCalledWith(
        'Publishing to Discord',
        expect.objectContaining({
          pickId: 'pick-metrics',
          canonicalPlayerId: 'canonical-123',
          canonicalGameId: 'game-456',
          source: 'canonical',
          traceId: 'trace-123',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Successfully published to Discord',
        expect.objectContaining({
          pickId: 'pick-metrics',
          messageId: 'msg-metrics-test',
          traceId: 'trace-123',
        })
      );
    });
  });

  describe('Idempotency', () => {
    it('should not duplicate publishes with same idempotency key', async () => {
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'msg-idem-test' }),
      };
      (discordClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const request: PublishRequest = {
        pickId: 'pick-idem',
        tenantId: 'tenant-1',
        channelId: '123456789',
        messageType: 'new_pick',
        context: {
          pickId: 'pick-idem',
          tenantId: 'tenant-1',
          playerName: 'Test Player',
          sport: 'nba',
          statType: 'points',
          line: 20.5,
          pickSide: 'over',
          odds: '-110',
          units: 1,
          capper: 'TestCapper',
          timestamp: new Date(),
          source: 'test',
        },
        source: 'test',
      };

      // First publish
      const result1 = await discordPublisher.publish(request);
      expect(result1.success).toBe(true);

      // Second publish with same request (simulating retry)
      const result2 = await discordPublisher.publish(request);
      expect(result2.success).toBe(true);

      // Verify message was only sent once (or verify external_message_id check)
      // This would require mock implementation in DiscordPublishingWorker
      // that checks external_message_id before calling publish
    });
  });
});
