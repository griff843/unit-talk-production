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

// Start the HTTP server for Prometheus scraping
export function startMetricsServer(port = 9000) {
  http
    .createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } else {
        res.writeHead(404);
        res.end();
      }
    })
    .listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`🚦 Prometheus metrics server running at http://localhost:${port}/metrics`);
    });
}
