import * as http from 'http';

import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a registry for all metrics
const register = new Registry();
collectDefaultMetrics({ register });

// Agent-specific Counters
export const ingestedCounter = new Counter({
  name: 'agent_ingested_total',
  help: 'Total number of props ingested',
  registers: [register],
});
export const skippedCounter = new Counter({
  name: 'agent_skipped_total',
  help: 'Total number of props skipped',
  registers: [register],
});
export const errorCounter = new Counter({
  name: 'agent_errors_total',
  help: 'Total number of ingestion errors',
  registers: [register],
});

// Example: Duration Histogram for ingestion process
export const durationHistogram = new Histogram({
  name: 'agent_ingestion_duration_seconds',
  help: 'Duration of ingestion agent run (seconds)',
  labelNames: ['phase'], // You can use .startTimer() with a phase label
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30], // Adjust buckets as needed
  registers: [register],
});

// Provider Gateway Metrics
export const externalApiCalls = new Counter({
  name: 'external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['provider', 'endpoint', 'status'],
  registers: [register],
});

export const externalApiDuration = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls',
  labelNames: ['provider', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const externalApiErrors = new Counter({
  name: 'external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['provider', 'endpoint', 'error_type'],
  registers: [register],
});

export const providerCacheHits = new Counter({
  name: 'provider_cache_hits_total',
  help: 'Total number of provider cache hits',
  labelNames: ['provider'],
  registers: [register],
});

export const providerCacheMisses = new Counter({
  name: 'provider_cache_misses_total',
  help: 'Total number of provider cache misses',
  labelNames: ['provider'],
  registers: [register],
});

export const providerCreditsUsed = new Counter({
  name: 'provider_credits_used_total',
  help: 'Total number of provider credits used',
  labelNames: ['provider'],
  registers: [register],
});

export const providerBudgetRemainingPercent = new Gauge({
  name: 'provider_budget_remaining_percent',
  help: 'Provider budget remaining percentage',
  labelNames: ['provider'],
  registers: [register],
});

export const providerCircuitBreakerState = new Gauge({
  name: 'provider_circuit_breaker_state',
  help: 'Provider circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['provider'],
  registers: [register],
});

// Canonical Mapping Metrics
export const canonicalMappingTotal = new Counter({
  name: 'canonical_mapping_total',
  help: 'Total number of canonical mappings',
  labelNames: ['entity_type', 'source', 'status'],
  registers: [register],
});

export const canonicalMappingConfidenceHistogram = new Histogram({
  name: 'canonical_mapping_confidence',
  help: 'Confidence distribution for canonical mappings',
  buckets: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0],
  registers: [register],
});

export const canonicalMappingMethodTotal = new Counter({
  name: 'canonical_mapping_method_total',
  help: 'Total mappings by method',
  labelNames: ['entity_type', 'method'],
  registers: [register],
});

export const canonicalMappingConflictsTotal = new Counter({
  name: 'canonical_mapping_conflicts_total',
  help: 'Total number of mapping conflicts',
  registers: [register],
});

export const canonicalEntityTotal = new Counter({
  name: 'canonical_entity_total',
  help: 'Total number of canonical entities',
  labelNames: ['entity_type'],
  registers: [register],
});

export const canonicalMappingDuration = new Histogram({
  name: 'canonical_mapping_duration_seconds',
  help: 'Duration of canonical mapping operations',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// CLV (Closing Line Value) Metrics
export const clvCoveragePercent = new Gauge({
  name: 'clv_coverage_percent',
  help: 'Percentage of picks with CLV tracking',
  registers: [register],
});

export const clvDistributionHistogram = new Histogram({
  name: 'clv_distribution',
  help: 'Distribution of CLV percentages',
  buckets: [-10, -5, -2, -1, 0, 1, 2, 5, 10],
  registers: [register],
});

export const clvBeatingClosingLineTotal = new Counter({
  name: 'clv_beating_closing_line_total',
  help: 'Total picks that beat the closing line',
  registers: [register],
});

export const clvClosingLineFetchTotal = new Counter({
  name: 'clv_closing_line_fetch_total',
  help: 'Total closing line fetch operations',
  labelNames: ['source', 'status'],
  registers: [register],
});

export const clvClosingLineFreshness = new Histogram({
  name: 'clv_closing_line_freshness_seconds',
  help: 'Freshness of closing line data (seconds since game end)',
  buckets: [60, 300, 600, 1800, 3600, 7200],
  registers: [register],
});

export const clvPendingUpdatesGauge = new Gauge({
  name: 'clv_pending_updates',
  help: 'Number of picks pending CLV updates',
  registers: [register],
});

export const clvAvgPercentage = new Gauge({
  name: 'clv_avg_percentage',
  help: 'Average CLV percentage across all picks',
  registers: [register],
});

// Dead Letter Queue Metrics
export const dlqMetrics = {
  enqueued: new Counter({
    name: 'dlq_enqueued_total',
    help: 'Total number of messages sent to DLQ',
    labelNames: ['queue', 'reason'],
    registers: [register],
  }),
  processed: new Counter({
    name: 'dlq_processed_total',
    help: 'Total number of DLQ messages processed',
    labelNames: ['queue', 'status'],
    registers: [register],
  }),
  retried: new Counter({
    name: 'dlq_retried_total',
    help: 'Total number of DLQ messages retried',
    labelNames: ['queue'],
    registers: [register],
  }),
  depth: new Gauge({
    name: 'dlq_depth',
    help: 'Current depth of DLQ',
    labelNames: ['queue'],
    registers: [register],
  }),
};

// Start the HTTP server for Prometheus scraping
export function startMetricsServer(port = 9000) {
  http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚦 Prometheus metrics server running at http://localhost:${port}/metrics`);
  });
}
