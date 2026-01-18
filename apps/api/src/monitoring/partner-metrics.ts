/**
 * Partner API Prometheus Metrics
 * Phase 14: Observability for partner API performance
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { createLogger } from '../utils/logger';

const logger = createLogger('PartnerMetrics');

// Create metrics registry
const register = new Registry();

// ===============================================================================
// Request Metrics
// ===============================================================================

export const partnerApiRequestsTotal = new Counter({
  name: 'partner_api_requests_total',
  help: 'Total number of partner API requests',
  labelNames: ['partner_id', 'partner_tier', 'endpoint', 'method', 'status'],
  registers: [register],
});

export const partnerApiErrorsTotal = new Counter({
  name: 'partner_api_errors_total',
  help: 'Total number of partner API errors',
  labelNames: ['partner_id', 'partner_tier', 'endpoint', 'error_type'],
  registers: [register],
});

export const partnerApiRequestDuration = new Histogram({
  name: 'partner_api_request_duration_seconds',
  help: 'Partner API request duration in seconds',
  labelNames: ['partner_id', 'partner_tier', 'endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// ===============================================================================
// Authentication Metrics
// ===============================================================================

export const partnerAuthAttemptsTotal = new Counter({
  name: 'partner_auth_attempts_total',
  help: 'Total number of partner authentication attempts',
  labelNames: ['result', 'reason'],
  registers: [register],
});

export const partnerApiKeysActive = new Gauge({
  name: 'partner_api_keys_active',
  help: 'Number of active partner API keys',
  labelNames: ['partner_tier'],
  registers: [register],
});

// ===============================================================================
// Rate Limiting Metrics
// ===============================================================================

export const partnerRateLimitExceeded = new Counter({
  name: 'partner_rate_limit_exceeded_total',
  help: 'Total number of rate limit violations',
  labelNames: ['partner_id', 'partner_tier', 'window'],
  registers: [register],
});

export const partnerQuotaExceeded = new Counter({
  name: 'partner_quota_exceeded_total',
  help: 'Total number of quota violations',
  labelNames: ['partner_id', 'partner_tier'],
  registers: [register],
});

export const partnerQuotaUsage = new Gauge({
  name: 'partner_quota_usage_percentage',
  help: 'Current quota usage as percentage',
  labelNames: ['partner_id', 'partner_tier'],
  registers: [register],
});

// ===============================================================================
// Webhook Metrics
// ===============================================================================

export const partnerWebhooksActive = new Gauge({
  name: 'partner_webhooks_active',
  help: 'Number of active partner webhooks',
  labelNames: ['partner_id'],
  registers: [register],
});

export const partnerWebhookDeliveriesTotal = new Counter({
  name: 'partner_webhook_deliveries_total',
  help: 'Total number of webhook delivery attempts',
  labelNames: ['partner_id', 'event_type', 'status'],
  registers: [register],
});

export const partnerWebhookDeliveryDuration = new Histogram({
  name: 'partner_webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration in seconds',
  labelNames: ['partner_id', 'event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const partnerWebhookRetriesTotal = new Counter({
  name: 'partner_webhook_retries_total',
  help: 'Total number of webhook retry attempts',
  labelNames: ['partner_id', 'event_type', 'attempt_number'],
  registers: [register],
});

// ===============================================================================
// Business Metrics
// ===============================================================================

export const partnerPicksCreated = new Counter({
  name: 'partner_picks_created_total',
  help: 'Total number of picks created by partners',
  labelNames: ['partner_id', 'partner_tier', 'sport'],
  registers: [register],
});

export const partnerMarketQueries = new Counter({
  name: 'partner_market_queries_total',
  help: 'Total number of market data queries',
  labelNames: ['partner_id', 'partner_tier', 'sport'],
  registers: [register],
});

export const partnerStatsQueries = new Counter({
  name: 'partner_stats_queries_total',
  help: 'Total number of stats queries',
  labelNames: ['partner_id', 'partner_tier'],
  registers: [register],
});

// ===============================================================================
// Latency Targets
// ===============================================================================

export const partnerApiLatencyP95 = new Gauge({
  name: 'partner_api_latency_p95_seconds',
  help: 'P95 latency for partner API endpoints',
  labelNames: ['endpoint'],
  registers: [register],
});

export const partnerApiLatencyP99 = new Gauge({
  name: 'partner_api_latency_p99_seconds',
  help: 'P99 latency for partner API endpoints',
  labelNames: ['endpoint'],
  registers: [register],
});

// ===============================================================================
// Error Rate Metrics
// ===============================================================================

export const partnerApiErrorRate = new Gauge({
  name: 'partner_api_error_rate',
  help: 'Partner API error rate (errors per second)',
  labelNames: ['endpoint'],
  registers: [register],
});

// ===============================================================================
// Helper Functions
// ===============================================================================

/**
 * Record API request metrics
 */
export function recordApiRequest(
  partnerId: string,
  partnerTier: string,
  endpoint: string,
  method: string,
  status: number,
  durationSeconds: number
): void {
  partnerApiRequestsTotal.inc({
    partner_id: partnerId,
    partner_tier: partnerTier,
    endpoint,
    method,
    status: status.toString(),
  });

  partnerApiRequestDuration.observe(
    {
      partner_id: partnerId,
      partner_tier: partnerTier,
      endpoint,
      method,
    },
    durationSeconds
  );
}

/**
 * Record API error
 */
export function recordApiError(
  partnerId: string,
  partnerTier: string,
  endpoint: string,
  errorType: string
): void {
  partnerApiErrorsTotal.inc({
    partner_id: partnerId,
    partner_tier: partnerTier,
    endpoint,
    error_type: errorType,
  });
}

/**
 * Record authentication attempt
 */
export function recordAuthAttempt(result: 'success' | 'failure', reason: string): void {
  partnerAuthAttemptsTotal.inc({ result, reason });
}

/**
 * Record rate limit violation
 */
export function recordRateLimitViolation(
  partnerId: string,
  partnerTier: string,
  window: 'minute' | 'hour' | 'day'
): void {
  partnerRateLimitExceeded.inc({
    partner_id: partnerId,
    partner_tier: partnerTier,
    window,
  });
}

/**
 * Record quota violation
 */
export function recordQuotaViolation(partnerId: string, partnerTier: string): void {
  partnerQuotaExceeded.inc({
    partner_id: partnerId,
    partner_tier: partnerTier,
  });
}

/**
 * Update quota usage percentage
 */
export function updateQuotaUsage(
  partnerId: string,
  partnerTier: string,
  usagePercentage: number
): void {
  partnerQuotaUsage.set(
    {
      partner_id: partnerId,
      partner_tier: partnerTier,
    },
    usagePercentage
  );
}

/**
 * Record webhook delivery
 */
export function recordWebhookDelivery(
  partnerId: string,
  eventType: string,
  status: 'success' | 'failed' | 'retrying',
  durationSeconds?: number
): void {
  partnerWebhookDeliveriesTotal.inc({
    partner_id: partnerId,
    event_type: eventType,
    status,
  });

  if (durationSeconds !== undefined) {
    partnerWebhookDeliveryDuration.observe(
      {
        partner_id: partnerId,
        event_type: eventType,
      },
      durationSeconds
    );
  }
}

/**
 * Record webhook retry
 */
export function recordWebhookRetry(
  partnerId: string,
  eventType: string,
  attemptNumber: number
): void {
  partnerWebhookRetriesTotal.inc({
    partner_id: partnerId,
    event_type: eventType,
    attempt_number: attemptNumber.toString(),
  });
}

/**
 * Record pick creation
 */
export function recordPickCreation(
  partnerId: string,
  partnerTier: string,
  sport: string
): void {
  partnerPicksCreated.inc({
    partner_id: partnerId,
    partner_tier: partnerTier,
    sport,
  });
}

/**
 * Get all metrics in Prometheus format
 */
export async function getPartnerMetrics(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error) {
    logger.error('Failed to generate partner metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    return '# Error generating metrics\n';
  }
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

// Export registry for testing
export { register as metricsRegistry };
