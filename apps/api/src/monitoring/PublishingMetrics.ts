/**
 * Publishing Metrics - Prometheus Metrics for Discord Publishing
 *
 * Comprehensive metrics for monitoring Discord publishing operations,
 * rate limiting, and DLQ integration.
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface PublishingMetricsConfig {
  registry: Registry;
  prefix?: string;
}

export class PublishingMetrics {
  private static instance: PublishingMetrics;
  private readonly registry: Registry;
  private readonly prefix: string;

  // Publishing success/failure metrics
  private readonly publishSuccessCounter: Counter<string>;
  private readonly publishFailureCounter: Counter<string>;
  private readonly publishDuration: Histogram<string>;

  // Rate limiting metrics
  private readonly rateLimitedCounter: Counter<string>;
  private readonly rateLimitWaitDuration: Histogram<string>;

  // Outbox processing metrics
  private readonly outboxProcessedCounter: Counter<string>;
  private readonly outboxPendingGauge: Gauge<string>;
  private readonly outboxAgeGauge: Gauge<string>;

  // Discord API metrics
  private readonly discordApiCallsCounter: Counter<string>;
  private readonly discordApiErrorsCounter: Counter<string>;
  private readonly discordApiLatency: Histogram<string>;

  // DLQ metrics
  private readonly publishingDLQCounter: Counter<string>;

  private constructor(config: PublishingMetricsConfig) {
    this.registry = config.registry;
    this.prefix = config.prefix || 'discord_publish_';

    // Initialize metrics
    this.publishSuccessCounter = new Counter({
      name: `${this.prefix}success_total`,
      help: 'Total number of successful Discord publishes',
      labelNames: ['channel', 'message_type', 'source'],
      registers: [this.registry],
    });

    this.publishFailureCounter = new Counter({
      name: `${this.prefix}failure_total`,
      help: 'Total number of failed Discord publish attempts',
      labelNames: ['channel', 'message_type', 'error_type', 'source'],
      registers: [this.registry],
    });

    this.publishDuration = new Histogram({
      name: `${this.prefix}duration_seconds`,
      help: 'Duration of Discord publish operations',
      labelNames: ['channel', 'message_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.rateLimitedCounter = new Counter({
      name: `${this.prefix}rate_limited_total`,
      help: 'Total number of times Discord publishing was rate limited',
      labelNames: ['channel', 'limiter_type'],
      registers: [this.registry],
    });

    this.rateLimitWaitDuration = new Histogram({
      name: `${this.prefix}rate_limit_wait_seconds`,
      help: 'Duration spent waiting for rate limit tokens',
      labelNames: ['channel'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.outboxProcessedCounter = new Counter({
      name: `${this.prefix}outbox_processed_total`,
      help: 'Total number of outbox records processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.outboxPendingGauge = new Gauge({
      name: `${this.prefix}outbox_pending`,
      help: 'Number of pending publish records in outbox',
      registers: [this.registry],
    });

    this.outboxAgeGauge = new Gauge({
      name: `${this.prefix}outbox_oldest_age_seconds`,
      help: 'Age of oldest pending publish record in seconds',
      registers: [this.registry],
    });

    this.discordApiCallsCounter = new Counter({
      name: `${this.prefix}api_calls_total`,
      help: 'Total number of Discord API calls',
      labelNames: ['method', 'endpoint'],
      registers: [this.registry],
    });

    this.discordApiErrorsCounter = new Counter({
      name: `${this.prefix}api_errors_total`,
      help: 'Total number of Discord API errors',
      labelNames: ['error_code', 'method'],
      registers: [this.registry],
    });

    this.discordApiLatency = new Histogram({
      name: `${this.prefix}api_latency_seconds`,
      help: 'Discord API call latency',
      labelNames: ['method', 'endpoint'],
      buckets: [0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.publishingDLQCounter = new Counter({
      name: `${this.prefix}dlq_routed_total`,
      help: 'Total number of failed publishes routed to DLQ',
      labelNames: ['error_type', 'channel'],
      registers: [this.registry],
    });
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(config?: PublishingMetricsConfig): PublishingMetrics {
    if (!PublishingMetrics.instance) {
      if (!config) {
        throw new Error('PublishingMetrics must be initialized with config on first call');
      }
      PublishingMetrics.instance = new PublishingMetrics(config);
    }
    return PublishingMetrics.instance;
  }

  /**
   * Record successful publish
   */
  public recordPublishSuccess(
    channel: string,
    messageType: string,
    source: string
  ): void {
    this.publishSuccessCounter.labels(channel, messageType, source).inc();
  }

  /**
   * Record failed publish
   */
  public recordPublishFailure(
    channel: string,
    messageType: string,
    errorType: string,
    source: string
  ): void {
    this.publishFailureCounter.labels(channel, messageType, errorType, source).inc();
  }

  /**
   * Start publish duration timer
   */
  public startPublishTimer(channel: string, messageType: string): () => void {
    return this.publishDuration.labels(channel, messageType).startTimer();
  }

  /**
   * Record rate limiting event
   */
  public recordRateLimited(channel: string, limiterType: string): void {
    this.rateLimitedCounter.labels(channel, limiterType).inc();
  }

  /**
   * Record rate limit wait duration
   */
  public recordRateLimitWait(channel: string, durationSeconds: number): void {
    this.rateLimitWaitDuration.labels(channel).observe(durationSeconds);
  }

  /**
   * Record outbox processing
   */
  public recordOutboxProcessed(status: 'success' | 'failure' | 'rate_limited'): void {
    this.outboxProcessedCounter.labels(status).inc();
  }

  /**
   * Update outbox pending count
   */
  public setOutboxPending(count: number): void {
    this.outboxPendingGauge.set(count);
  }

  /**
   * Update oldest outbox record age
   */
  public setOutboxOldestAge(ageSeconds: number): void {
    this.outboxAgeGauge.set(ageSeconds);
  }

  /**
   * Record Discord API call
   */
  public recordDiscordApiCall(method: string, endpoint: string): void {
    this.discordApiCallsCounter.labels(method, endpoint).inc();
  }

  /**
   * Record Discord API error
   */
  public recordDiscordApiError(errorCode: string, method: string): void {
    this.discordApiErrorsCounter.labels(errorCode, method).inc();
  }

  /**
   * Start Discord API latency timer
   */
  public startDiscordApiTimer(method: string, endpoint: string): () => void {
    return this.discordApiLatency.labels(method, endpoint).startTimer();
  }

  /**
   * Record publish routed to DLQ
   */
  public recordDLQRouted(errorType: string, channel: string): void {
    this.publishingDLQCounter.labels(errorType, channel).inc();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    this.publishSuccessCounter.reset();
    this.publishFailureCounter.reset();
    this.publishDuration.reset();
    this.rateLimitedCounter.reset();
    this.rateLimitWaitDuration.reset();
    this.outboxProcessedCounter.reset();
    this.outboxPendingGauge.reset();
    this.outboxAgeGauge.reset();
    this.discordApiCallsCounter.reset();
    this.discordApiErrorsCounter.reset();
    this.discordApiLatency.reset();
    this.publishingDLQCounter.reset();
  }
}
