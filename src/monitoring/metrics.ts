import client from 'prom-client';
import express from 'express';
import { Logger } from '../utils/logger';

export interface MetricsConfig {
  port: number;
  path: string;
  interval: number;
}

export class Metrics {
  private static readonly registry = new client.Registry();
  private readonly logger: Logger;
  private server?: express.Express;
  private collectors: Map<string, client.Metric<string>> = new Map();

  constructor(
    private readonly name: string,
    private readonly config: MetricsConfig
  ) {
    this.logger = new Logger(`Metrics:${name}`);
  }

  public async initialize(): Promise<void> {
    // Initialize default metrics
    client.collectDefaultMetrics({
      prefix: `${this.name}_`,
      register: Metrics.registry,
      labels: { agent: this.name }
    });

    // Initialize custom metrics
    this.initializeCustomMetrics();

    // Start metrics server
    await this.startServer();
  }

  private initializeCustomMetrics(): void {
    // Operation metrics
    this.collectors.set('operations_total', new client.Counter({
      name: `${this.name}_operations_total`,
      help: 'Total number of operations processed',
      labelNames: ['operation', 'status'] as const,
      registers: [Metrics.registry]
    }));

    this.collectors.set('operation_duration_seconds', new client.Histogram({
      name: `${this.name}_operation_duration_seconds`,
      help: 'Duration of operations in seconds',
      labelNames: ['operation'] as const,
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [Metrics.registry]
    }));

    // Error metrics
    this.collectors.set('errors_total', new client.Counter({
      name: `${this.name}_errors_total`,
      help: 'Total number of errors',
      labelNames: ['operation', 'error_type'] as const,
      registers: [Metrics.registry]
    }));

    // Queue metrics
    this.collectors.set('queue_size', new client.Gauge({
      name: `${this.name}_queue_size`,
      help: 'Current size of the processing queue',
      labelNames: ['queue_type'] as const,
      registers: [Metrics.registry]
    }));

    // Resource metrics
    this.collectors.set('resource_usage', new client.Gauge({
      name: `${this.name}_resource_usage`,
      help: 'Resource usage metrics',
      labelNames: ['resource_type'] as const,
      registers: [Metrics.registry]
    }));

    // Business metrics
    this.collectors.set('business_metrics', new client.Gauge({
      name: `${this.name}_business_metrics`,
      help: 'Business-related metrics',
      labelNames: ['metric_type'] as const,
      registers: [Metrics.registry]
    }));
  }

  private async startServer(): Promise<void> {
    this.server = express();

    this.server.get(this.config.path, async (req, res) => {
      try {
        res.set('Content-Type', Metrics.registry.contentType);
        res.end(await Metrics.registry.metrics());
      } catch (error) {
        this.logger.error('Failed to serve metrics:', error);
        res.status(500).end();
      }
    });

    this.server.listen(this.config.port, () => {
      this.logger.info(`Metrics server listening on port ${this.config.port}`);
    });
  }

  // Operation tracking
  public trackOperation(operation: string, status: 'success' | 'failure'): void {
    const counter = this.collectors.get('operations_total') as client.Counter<string>;
    counter.labels(operation, status).inc();
  }

  public trackDuration(operation: string, durationMs: number): void {
    const histogram = this.collectors.get('operation_duration_seconds') as client.Histogram<string>;
    histogram.labels(operation).observe(durationMs / 1000);
  }

  // Error tracking
  public trackError(operation: string, errorType: string): void {
    const counter = this.collectors.get('errors_total') as client.Counter<string>;
    counter.labels(operation, errorType).inc();
  }

  // Queue tracking
  public setQueueSize(queueType: string, size: number): void {
    const gauge = this.collectors.get('queue_size') as client.Gauge<string>;
    gauge.labels(queueType).set(size);
  }

  // Resource tracking
  public setResourceUsage(resourceType: string, value: number): void {
    const gauge = this.collectors.get('resource_usage') as client.Gauge<string>;
    gauge.labels(resourceType).set(value);
  }

  // Business metrics
  public setBusinessMetric(metricType: string, value: number): void {
    const gauge = this.collectors.get('business_metrics') as client.Gauge<string>;
    gauge.labels(metricType).set(value);
  }

  // Custom metric registration
  public registerCustomMetric(
    name: string,
    help: string,
    type: 'counter' | 'gauge' | 'histogram',
    labelNames: string[] = []
  ): void {
    const metricName = `${this.name}_${name}`;
    
    let metric: client.Metric<string>;
    
    switch (type) {
      case 'counter':
        metric = new client.Counter({
          name: metricName,
          help,
          labelNames,
          registers: [Metrics.registry]
        });
        break;
      case 'gauge':
        metric = new client.Gauge({
          name: metricName,
          help,
          labelNames,
          registers: [Metrics.registry]
        });
        break;
      case 'histogram':
        metric = new client.Histogram({
          name: metricName,
          help,
          labelNames,
          buckets: [0.1, 0.5, 1, 2, 5, 10],
          registers: [Metrics.registry]
        });
        break;
    }

    this.collectors.set(name, metric);
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