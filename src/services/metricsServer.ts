import http from 'http';
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';

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
