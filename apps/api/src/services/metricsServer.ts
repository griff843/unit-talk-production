import * as http from 'http';

import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';
import { FeatureStoreMetrics } from './metrics/featureStoreMetrics';

// Create a registry for all metrics
const register = new Registry();
collectDefaultMetrics({ register });

// ==============================================
// HTTP & API METRICS
// ==============================================

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Current number of active HTTP connections',
  registers: [register],
});

// ==============================================
// DATABASE METRICS
// ==============================================

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Current number of active database connections',
  registers: [register],
});

export const dbConnectionsIdle = new Gauge({
  name: 'db_connections_idle',
  help: 'Current number of idle database connections',
  registers: [register],
});

export const dbOperationsTotal = new Counter({
  name: 'db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

// ==============================================
// EXTERNAL API METRICS
// ==============================================

export const externalApiCalls = new Counter({
  name: 'external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['provider', 'endpoint', 'status_code'],
  registers: [register],
});

export const externalApiDuration = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['provider', 'endpoint', 'status_code'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const externalApiErrors = new Counter({
  name: 'external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['provider', 'error_type'],
  registers: [register],
});

// ==============================================
// AGENT SYSTEM METRICS
// ==============================================

// Agent-specific Counters
export const ingestedCounter = new Counter({
  name: 'agent_ingested_total',
  help: 'Total number of props ingested',
  labelNames: ['agent_type'],
  registers: [register],
});

export const skippedCounter = new Counter({
  name: 'agent_skipped_total',
  help: 'Total number of props skipped',
  labelNames: ['agent_type', 'reason'],
  registers: [register],
});

export const errorCounter = new Counter({
  name: 'agent_errors_total',
  help: 'Total number of ingestion errors',
  labelNames: ['agent_type', 'error_type'],
  registers: [register],
});

export const durationHistogram = new Histogram({
  name: 'agent_ingestion_duration_seconds',
  help: 'Duration of ingestion agent run (seconds)',
  labelNames: ['agent_type', 'phase'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const agentHealthStatus = new Gauge({
  name: 'agent_health_status',
  help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
  labelNames: ['agent_name', 'agent_type'],
  registers: [register],
});

export const picksProcessed = new Counter({
  name: 'picks_processed_total',
  help: 'Total number of picks processed',
  labelNames: ['status', 'capper', 'sport'],
  registers: [register],
});

export const picksGraded = new Counter({
  name: 'picks_graded_total',
  help: 'Total number of picks graded',
  labelNames: ['result', 'capper', 'sport'],
  registers: [register],
});

// ==============================================
// BUSINESS METRICS
// ==============================================

export const userActions = new Counter({
  name: 'user_actions_total',
  help: 'Total number of user actions',
  labelNames: ['action_type', 'user_tier'],
  registers: [register],
});

export const contestEntries = new Counter({
  name: 'contest_entries_total',
  help: 'Total number of contest entries',
  labelNames: ['contest_type', 'entry_fee_tier'],
  registers: [register],
});

export const alertsSent = new Counter({
  name: 'alerts_sent_total',
  help: 'Total number of alerts sent',
  labelNames: ['alert_type', 'channel'],
  registers: [register],
});

// Feature store metric family
export const featureMetrics = new FeatureStoreMetrics(register);

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
