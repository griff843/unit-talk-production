
import express from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from './logging';
import { redis } from './redis';

// Collect default Node.js metrics
collectDefaultMetrics();

// Custom metrics
export const metrics = {
  httpRequests: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),

  httpDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),

  agentHealth: new Gauge({
    name: 'agent_health_status',
    help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
    labelNames: ['agent_name']
  }),

  agentOperations: new Counter({
    name: 'agent_operations_total',
    help: 'Total number of agent operations',
    labelNames: ['agent_name', 'operation', 'status']
  }),

  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type']
  }),

  cacheMisses: new Counter({
    name: 'cache_misses_total', 
    help: 'Total number of cache misses',
    labelNames: ['cache_type']
  })
};

export class MonitoringService {
  private app: express.Application;
  private port: number;

  constructor(port: number = 9090) {
    this.app = express();
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        redis: await redis.healthCheck()
      };

      res.json(health);
    });

    // Ready check endpoint
    this.app.get('/ready', async (req, res) => {
      const ready = {
        status: 'ready',
        services: {
          redis: await redis.healthCheck()
        }
      };

      const allReady = Object.values(ready.services).every(Boolean);
      res.status(allReady ? 200 : 503).json(ready);
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Monitoring service started on port ${this.port}`);
      console.log(`📊 Metrics: http://localhost:${this.port}/metrics`);
      console.log(`🏥 Health: http://localhost:${this.port}/health`);
      console.log(`✅ Ready: http://localhost:${this.port}/ready`);
    });
  }
}

export const monitoring = new MonitoringService();
