import { Registry, Counter, Gauge, Histogram } from 'prom-client';
import express from 'express';
import { Logger } from '../utils/logger';

export interface MetricsConfig {
  port: number;
  path: string;
  interval: number;
}

export class Metrics {
  private static instance: Metrics;
  private readonly registry: Registry;
  private readonly logger: Logger;
  private readonly metrics: Map<string, any> = new Map();
  private readonly collectors: Map<string, any> = new Map();
  private server?: express.Express;

  // Standard metrics that all agents should track
  private readonly standardMetrics = {
    activityExecutions: {
      name: 'activity_executions_total',
      help: 'Total number of activity executions',
      labelNames: ['agent', 'activity', 'status'] as const
    },
    activityDuration: {
      name: 'activity_duration_seconds',
      help: 'Duration of activity executions',
      labelNames: ['agent', 'activity'] as const,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    },
    errorCount: {
      name: 'error_count_total',
      help: 'Total number of errors',
      labelNames: ['agent', 'error_type'] as const
    },
    healthStatus: {
      name: 'health_status',
      help: 'Current health status (1 for healthy, 0 for unhealthy)',
      labelNames: ['agent'] as const
    },
    lastActivityTimestamp: {
      name: 'last_activity_timestamp',
      help: 'Timestamp of last activity execution',
      labelNames: ['agent', 'activity'] as const
    }
  };

  private constructor() {
    this.registry = new Registry();
    this.logger = new Logger('Metrics');
    this.initializeStandardMetrics();
    this.initializeCustomMetrics();
  }

  public static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  private initializeStandardMetrics(): void {
    try {
      this.registerMetric('activityExecutions', new Counter(this.standardMetrics.activityExecutions));
      this.registerMetric('activityDuration', new Histogram(this.standardMetrics.activityDuration));
      this.registerMetric('errorCount', new Counter(this.standardMetrics.errorCount));
      this.registerMetric('healthStatus', new Gauge(this.standardMetrics.healthStatus));
      this.registerMetric('lastActivityTimestamp', new Gauge(this.standardMetrics.lastActivityTimestamp));

      this.registry.setDefaultLabels({ app: 'unit-talk' });
      this.logger.info('Standard metrics initialized');
    } catch (error) {
      this.logger.error('Failed to initialize standard metrics:', error);
      throw error;
    }
  }

  private initializeCustomMetrics(): void {
    // Operation metrics
    this.collectors.set('operations_total', new Counter({
      name: 'operations_total',
      help: 'Total number of operations processed',
      labelNames: ['operation', 'status'],
      registers: [this.registry]
    }));

    this.collectors.set('operation_duration_seconds', new Histogram({
      name: 'operation_duration_seconds',
      help: 'Duration of operations in seconds',
      labelNames: ['operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    }));

    this.collectors.set('errors_total', new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['operation', 'error_type'],
      registers: [this.registry]
    }));

    this.collectors.set('queue_size', new Gauge({
      name: 'queue_size',
      help: 'Current size of the processing queue',
      labelNames: ['queue_type'],
      registers: [this.registry]
    }));

    this.collectors.set('resource_usage', new Gauge({
      name: 'resource_usage',
      help: 'Resource usage metrics',
      labelNames: ['resource_type'],
      registers: [this.registry]
    }));

    this.collectors.set('business_metrics', new Gauge({
      name: 'business_metrics',
      help: 'Business-related metrics',
      labelNames: ['metric_type'],
      registers: [this.registry]
    }));
  }

  private registerMetric(name: string, metric: any): void {
    this.metrics.set(name, metric);
    this.registry.registerMetric(metric);
  }

  public async initialize(): Promise<void> {
    await this.startServer();
  }

  private async startServer(): Promise<void> {
    this.server = express();

    this.server.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      } catch (error) {
        this.logger.error('Failed to serve metrics:', error);
        res.status(500).end();
      }
    });

    this.server.listen(9100, () => {
      this.logger.info('Metrics server listening on port 9100');
    });
  }

  public trackOperation(operation: string, status: 'success' | 'failure'): void {
    const counter = this.collectors.get('operations_total') as Counter<string>;
    counter.labels(operation, status).inc();
  }

  public trackDuration(operation: string, durationMs: number): void {
    const histogram = this.collectors.get('operation_duration_seconds') as Histogram<string>;
    histogram.labels(operation).observe(durationMs / 1000);
  }

  public trackError(operation: string, errorType: string): void {
    const counter = this.collectors.get('errors_total') as Counter<string>;
    counter.labels(operation, errorType).inc();
  }

  public setQueueSize(queueType: string, size: number): void {
    const gauge = this.collectors.get('queue_size') as Gauge<string>;
    gauge.labels(queueType).set(size);
  }

  public setResourceUsage(resourceType: string, value: number): void {
    const gauge = this.collectors.get('resource_usage') as Gauge<string>;
    gauge.labels(resourceType).set(value);
  }

  public setBusinessMetric(metricType: string, value: number): void {
    const gauge = this.collectors.get('business_metrics') as Gauge<string>;
    gauge.labels(metricType).set(value);
  }

  public async shutdown(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}
