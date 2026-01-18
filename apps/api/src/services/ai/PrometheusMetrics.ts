/**
 * AI Assist Prometheus Metrics
 * Phase 12: Observability and monitoring for AI services
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { logger } from '../../shared/logger';

export class AIPrometheusMetrics {
  // Counters
  private requestsTotal: Counter<string>;
  private tokensUsedTotal: Counter<string>;
  private costDollarsTotal: Counter<string>;
  private errorsTotal: Counter<string>;
  private cacheHitsTotal: Counter<string>;
  private cacheMissesTotal: Counter<string>;

  // Histograms
  private requestLatencySeconds: Histogram<string>;
  private tokensPerRequest: Histogram<string>;

  // Gauges
  private activeRequests: Gauge<string>;
  private circuitBreakerState: Gauge<string>;
  private quotaUsage: Gauge<string>;

  // Registry
  private registry: Registry;

  constructor(port: number = 3002) {
    this.registry = new Registry();

    // Initialize counters
    this.requestsTotal = new Counter({
      name: 'ai_assist_requests_total',
      help: 'Total number of AI assist requests',
      labelNames: ['assistant_type', 'provider', 'model', 'status'],
      registers: [this.registry],
    });

    this.tokensUsedTotal = new Counter({
      name: 'ai_assist_tokens_used_total',
      help: 'Total number of tokens consumed',
      labelNames: ['provider', 'model', 'token_type'],
      registers: [this.registry],
    });

    this.costDollarsTotal = new Counter({
      name: 'ai_assist_cost_dollars_total',
      help: 'Total cost in dollars for AI requests',
      labelNames: ['provider', 'model'],
      registers: [this.registry],
    });

    this.errorsTotal = new Counter({
      name: 'ai_assist_errors_total',
      help: 'Total number of AI request errors',
      labelNames: ['provider', 'error_type'],
      registers: [this.registry],
    });

    this.cacheHitsTotal = new Counter({
      name: 'ai_assist_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['assistant_type'],
      registers: [this.registry],
    });

    this.cacheMissesTotal = new Counter({
      name: 'ai_assist_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['assistant_type'],
      registers: [this.registry],
    });

    // Initialize histograms
    this.requestLatencySeconds = new Histogram({
      name: 'ai_assist_request_latency_seconds',
      help: 'AI request latency in seconds',
      labelNames: ['assistant_type', 'provider', 'model'],
      buckets: [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10],
      registers: [this.registry],
    });

    this.tokensPerRequest = new Histogram({
      name: 'ai_assist_tokens_per_request',
      help: 'Distribution of tokens per request',
      labelNames: ['provider', 'model'],
      buckets: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
      registers: [this.registry],
    });

    // Initialize gauges
    this.activeRequests = new Gauge({
      name: 'ai_assist_active_requests',
      help: 'Number of currently active AI requests',
      labelNames: ['provider'],
      registers: [this.registry],
    });

    this.circuitBreakerState = new Gauge({
      name: 'ai_assist_circuit_breaker_state',
      help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['provider'],
      registers: [this.registry],
    });

    this.quotaUsage = new Gauge({
      name: 'ai_assist_quota_usage_percent',
      help: 'Percentage of monthly quota used',
      labelNames: ['user_id', 'user_tier'],
      registers: [this.registry],
    });

    logger.info('AI Prometheus metrics initialized', { port });
  }

  /**
   * Record AI request
   */
  recordRequest(params: {
    assistantType: string;
    provider: string;
    model: string;
    status: 'success' | 'failure';
    latencyMs: number;
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost?: number;
  }): void {
    const { assistantType, provider, model, status, latencyMs, tokensUsed, cost } = params;

    // Record request
    this.requestsTotal.inc({
      assistant_type: assistantType,
      provider,
      model,
      status,
    });

    // Record latency
    this.requestLatencySeconds.observe(
      {
        assistant_type: assistantType,
        provider,
        model,
      },
      latencyMs / 1000 // Convert to seconds
    );

    // Record tokens if provided
    if (tokensUsed) {
      this.tokensUsedTotal.inc(
        { provider, model, token_type: 'prompt' },
        tokensUsed.prompt
      );

      this.tokensUsedTotal.inc(
        { provider, model, token_type: 'completion' },
        tokensUsed.completion
      );

      this.tokensPerRequest.observe(
        { provider, model },
        tokensUsed.total
      );
    }

    // Record cost if provided
    if (cost !== undefined) {
      this.costDollarsTotal.inc({ provider, model }, cost);
    }
  }

  /**
   * Record error
   */
  recordError(params: {
    provider: string;
    errorType: string;
  }): void {
    this.errorsTotal.inc({
      provider: params.provider,
      error_type: params.errorType,
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(assistantType: string): void {
    this.cacheHitsTotal.inc({ assistant_type: assistantType });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(assistantType: string): void {
    this.cacheMissesTotal.inc({ assistant_type: assistantType });
  }

  /**
   * Set active requests gauge
   */
  setActiveRequests(provider: string, count: number): void {
    this.activeRequests.set({ provider }, count);
  }

  /**
   * Increment active requests
   */
  incrementActiveRequests(provider: string): void {
    this.activeRequests.inc({ provider });
  }

  /**
   * Decrement active requests
   */
  decrementActiveRequests(provider: string): void {
    this.activeRequests.dec({ provider });
  }

  /**
   * Set circuit breaker state
   * 0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN
   */
  setCircuitBreakerState(provider: string, state: 'CLOSED' | 'HALF_OPEN' | 'OPEN'): void {
    const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    this.circuitBreakerState.set({ provider }, stateValue);
  }

  /**
   * Set quota usage for a user
   */
  setQuotaUsage(userId: string, userTier: string, percentageUsed: number): void {
    this.quotaUsage.set(
      { user_id: userId, user_tier: userTier },
      percentageUsed
    );
  }

  /**
   * Get metrics for export
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics summary for logging/debugging
   */
  async getMetricsSummary(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();

    const summary: any = {
      requests: {},
      tokens: {},
      cost: {},
      latency: {},
      errors: {},
      cache: {},
      activeRequests: {},
      circuitBreakers: {},
    };

    for (const metric of metrics) {
      switch (metric.name) {
        case 'ai_assist_requests_total':
          summary.requests = metric.values;
          break;
        case 'ai_assist_tokens_used_total':
          summary.tokens = metric.values;
          break;
        case 'ai_assist_cost_dollars_total':
          summary.cost = metric.values;
          break;
        case 'ai_assist_request_latency_seconds':
          summary.latency = metric.values;
          break;
        case 'ai_assist_errors_total':
          summary.errors = metric.values;
          break;
        case 'ai_assist_cache_hits_total':
        case 'ai_assist_cache_misses_total':
          summary.cache[metric.name] = metric.values;
          break;
        case 'ai_assist_active_requests':
          summary.activeRequests = metric.values;
          break;
        case 'ai_assist_circuit_breaker_state':
          summary.circuitBreakers = metric.values;
          break;
      }
    }

    return summary;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.registry.clear();
    logger.info('AI Prometheus metrics reset');
  }

  /**
   * Get registry for integration with Express
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

// Singleton instance
let metricsInstance: AIPrometheusMetrics | null = null;

export function getAIMetrics(port?: number): AIPrometheusMetrics {
  if (!metricsInstance) {
    metricsInstance = new AIPrometheusMetrics(port);
  }
  return metricsInstance;
}

export function resetAIMetrics(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
  metricsInstance = null;
}
