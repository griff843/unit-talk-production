/**
 * Rate Limiter Service - Token Bucket Implementation
 *
 * Implements token bucket pattern for Discord publishing rate limiting.
 * Discord limits: 5 messages per 5 seconds per channel
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { Logger } from '../../shared/logger/types';

export interface RateLimiterConfig {
  tokensPerInterval: number; // Number of tokens to add per interval
  intervalMs: number; // Interval in milliseconds
  maxTokens: number; // Maximum bucket capacity
}

export interface BucketState {
  tokens: number;
  lastRefill: number;
}

/**
 * Token bucket rate limiter
 * Thread-safe via in-memory token tracking per key
 */
export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private config: RateLimiterConfig;
  private logger: Logger;

  constructor(
    config: RateLimiterConfig,
    logger: Logger
  ) {
    this.config = config;
    this.logger = logger;

    // Start bucket refill loop
    this.startRefillLoop();
  }

  /**
   * Try to consume a token from the bucket
   * Returns true if token was available, false if rate limited
   */
  async tryConsume(key: string, tokens: number = 1): Promise<boolean> {
    const bucket = this.getBucket(key);
    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.logger.debug('Rate limiter: token consumed', {
        key,
        tokensConsumed: tokens,
        tokensRemaining: bucket.tokens,
      });
      return true;
    }

    this.logger.warn('Rate limiter: rate limited', {
      key,
      tokensRequested: tokens,
      tokensAvailable: bucket.tokens,
    });
    return false;
  }

  /**
   * Wait until tokens are available
   * Returns when tokens can be consumed
   */
  async waitForToken(key: string, tokens: number = 1): Promise<void> {
    const bucket = this.getBucket(key);
    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return;
    }

    // Calculate wait time
    const tokensNeeded = tokens - bucket.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.config.tokensPerInterval);
    const waitMs = intervalsNeeded * this.config.intervalMs;

    this.logger.info('Rate limiter: waiting for tokens', {
      key,
      tokensNeeded,
      waitMs,
    });

    await new Promise(resolve => setTimeout(resolve, waitMs));

    // Try again after waiting
    return this.waitForToken(key, tokens);
  }

  /**
   * Get remaining tokens for a key
   */
  getRemainingTokens(key: string): number {
    const bucket = this.getBucket(key);
    this.refillBucket(bucket);
    return bucket.tokens;
  }

  /**
   * Reset bucket for a key (useful for testing)
   */
  reset(key: string): void {
    this.buckets.delete(key);
    this.logger.debug('Rate limiter: bucket reset', { key });
  }

  /**
   * Reset all buckets
   */
  resetAll(): void {
    this.buckets.clear();
    this.logger.debug('Rate limiter: all buckets reset');
  }

  /**
   * Get or create bucket for key
   */
  private getBucket(key: string): BucketState {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.config.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: BucketState): void {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const intervalsPassed = Math.floor(elapsedMs / this.config.intervalMs);

    if (intervalsPassed > 0) {
      const tokensToAdd = intervalsPassed * this.config.tokensPerInterval;
      bucket.tokens = Math.min(
        this.config.maxTokens,
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
    }
  }

  /**
   * Background loop to refill buckets periodically
   */
  private startRefillLoop(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        const elapsedMs = now - bucket.lastRefill;
        const intervalsPassed = Math.floor(elapsedMs / this.config.intervalMs);

        if (intervalsPassed > 0) {
          const tokensToAdd = intervalsPassed * this.config.tokensPerInterval;
          bucket.tokens = Math.min(
            this.config.maxTokens,
            bucket.tokens + tokensToAdd
          );
          bucket.lastRefill = now;
        }
      }
    }, this.config.intervalMs);
  }
}

/**
 * Factory for creating rate limiters with common configurations
 */
export class RateLimiterFactory {
  /**
   * Create Discord channel rate limiter
   * Discord limit: 5 messages per 5 seconds per channel
   */
  static createDiscordChannelLimiter(logger: Logger): RateLimiter {
    return new RateLimiter(
      {
        tokensPerInterval: 5, // 5 tokens per interval
        intervalMs: 5000, // 5 seconds
        maxTokens: 10, // Allow burst of 10 messages
      },
      logger
    );
  }

  /**
   * Create Discord global rate limiter
   * Discord global limit: 50 messages per second
   */
  static createDiscordGlobalLimiter(logger: Logger): RateLimiter {
    return new RateLimiter(
      {
        tokensPerInterval: 50,
        intervalMs: 1000, // 1 second
        maxTokens: 100,
      },
      logger
    );
  }

  /**
   * Create custom rate limiter
   */
  static create(config: RateLimiterConfig, logger: Logger): RateLimiter {
    return new RateLimiter(config, logger);
  }
}
