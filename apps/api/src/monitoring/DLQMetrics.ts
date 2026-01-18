/**
 * Dead Letter Queue (DLQ) Prometheus Metrics
 *
 * Comprehensive metrics for monitoring DLQ operations, health, and performance.
 * Follows Unit Talk's Prometheus metrics patterns for consistency.
 *
 * Phase 1 Modernization - DLQ Observability
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface DLQMetricsConfig {
  registry: Registry;
  prefix?: string;
}

export class DLQMetrics {
  private static instance: DLQMetrics;
  private readonly registry: Registry;
  private readonly prefix: string;

  // Core DLQ Metrics
  private readonly messagesFailedCounter: Counter<string>;
  private readonly messagesInDLQGauge: Gauge<string>;
  private readonly messagesRequeuedCounter: Counter<string>;
  private readonly replaySuccessCounter: Counter<string>;
  private readonly replayFailureCounter: Counter<string>;

  // Performance Metrics
  private readonly dlqOperationDuration: Histogram<string>;
  private readonly retryAttemptsHistogram: Histogram<string>;

  // Source-specific Metrics
  private readonly dlqEventsBySource: Gauge<string>;
  private readonly dlqOldestEventAge: Gauge<string>;

  private constructor(config: DLQMetricsConfig) {
    this.registry = config.registry;
    this.prefix = config.prefix || 'dlq_';

    // Initialize metrics
    this.messagesFailedCounter = new Counter({
      name: `${this.prefix}messages_failed_total`,
      help: 'Total number of messages that failed and were routed to DLQ',
      labelNames: ['source', 'error_type'],
      registers: [this.registry],
    });

    this.messagesInDLQGauge = new Gauge({
      name: `${this.prefix}messages_in_dlq`,
      help: 'Current number of messages in DLQ awaiting manual intervention',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.messagesRequeuedCounter = new Counter({
      name: `${this.prefix}messages_requeued_total`,
      help: 'Total number of DLQ messages marked for replay',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.replaySuccessCounter = new Counter({
      name: `${this.prefix}replay_success_total`,
      help: 'Total number of successful DLQ message replays',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.replayFailureCounter = new Counter({
      name: `${this.prefix}replay_failure_total`,
      help: 'Total number of failed DLQ message replay attempts',
      labelNames: ['source', 'error_type'],
      registers: [this.registry],
    });

    this.dlqOperationDuration = new Histogram({
      name: `${this.prefix}operation_duration_seconds`,
      help: 'Duration of DLQ operations',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.retryAttemptsHistogram = new Histogram({
      name: `${this.prefix}retry_attempts`,
      help: 'Distribution of retry attempts before DLQ routing',
      labelNames: ['source'],
      buckets: [1, 2, 3, 4, 5, 10, 20],
      registers: [this.registry],
    });

    this.dlqEventsBySource = new Gauge({
      name: `${this.prefix}events_by_source`,
      help: 'Number of pending DLQ events by source',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.dlqOldestEventAge = new Gauge({
      name: `${this.prefix}oldest_event_age_seconds`,
      help: 'Age of the oldest pending DLQ event in seconds',
      labelNames: ['source'],
      registers: [this.registry],
    });
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(config?: DLQMetricsConfig): DLQMetrics {
    if (!DLQMetrics.instance) {
      if (!config) {
        throw new Error('DLQMetrics must be initialized with config on first call');
      }
      DLQMetrics.instance = new DLQMetrics(config);
    }
    return DLQMetrics.instance;
  }

  /**
   * Record a message being routed to DLQ
   */
  public recordMessageFailed(source: string, errorType: string, retryCount: number): void {
    this.messagesFailedCounter.labels(source, errorType).inc();
    this.retryAttemptsHistogram.labels(source).observe(retryCount);
  }

  /**
   * Update the current DLQ depth for a source
   */
  public setMessagesInDLQ(source: string, count: number): void {
    this.messagesInDLQGauge.labels(source).set(count);
    this.dlqEventsBySource.labels(source).set(count);
  }

  /**
   * Record a message being marked for replay
   */
  public recordMessageRequeued(source: string): void {
    this.messagesRequeuedCounter.labels(source).inc();
  }

  /**
   * Record a successful replay
   */
  public recordReplaySuccess(source: string): void {
    this.replaySuccessCounter.labels(source).inc();
  }

  /**
   * Record a failed replay attempt
   */
  public recordReplayFailure(source: string, errorType: string): void {
    this.replayFailureCounter.labels(source, errorType).inc();
  }

  /**
   * Record the duration of a DLQ operation
   */
  public recordOperationDuration(operation: string, durationSeconds: number): void {
    this.dlqOperationDuration.labels(operation).observe(durationSeconds);
  }

  /**
   * Update the age of the oldest event for a source
   */
  public setOldestEventAge(source: string, ageSeconds: number): void {
    this.dlqOldestEventAge.labels(source).set(ageSeconds);
  }

  /**
   * Time a DLQ operation
   */
  public startTimer(operation: string): () => void {
    const end = this.dlqOperationDuration.labels(operation).startTimer();
    return end;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    this.messagesFailedCounter.reset();
    this.messagesInDLQGauge.reset();
    this.messagesRequeuedCounter.reset();
    this.replaySuccessCounter.reset();
    this.replayFailureCounter.reset();
    this.dlqOperationDuration.reset();
    this.retryAttemptsHistogram.reset();
    this.dlqEventsBySource.reset();
    this.dlqOldestEventAge.reset();
  }
}
