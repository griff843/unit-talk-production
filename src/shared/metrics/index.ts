import { MetricsConfig, MetricType, MetricValue, Labels } from './types';
import { Logger } from '../logger';

export class Metrics {
  private metrics: Map<string, MetricValue>;
  private logger: Logger;

  constructor(
    private readonly prefix: string,
    private readonly config: MetricsConfig
  ) {
    this.metrics = new Map();
    this.logger = new Logger('metrics');
  }

  // Counter methods
  incrementCounter(name: string, value: number = 1, labels?: Labels): void {
    const key = this.getMetricKey(name, MetricType.Counter, labels);
    const current = (this.metrics.get(key)?.value as number) || 0;
    this.metrics.set(key, {
      type: MetricType.Counter,
      value: current + value,
      labels,
      timestamp: Date.now(),
    });
  }

  // Gauge methods
  setGauge(name: string, value: number, labels?: Labels): void {
    const key = this.getMetricKey(name, MetricType.Gauge, labels);
    this.metrics.set(key, {
      type: MetricType.Gauge,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  // Histogram methods
  observeHistogram(name: string, value: number, labels?: Labels): void {
    const key = this.getMetricKey(name, MetricType.Histogram, labels);
    const current = this.metrics.get(key)?.value as number[] || [];
    current.push(value);
    this.metrics.set(key, {
      type: MetricType.Histogram,
      value: current,
      labels,
      timestamp: Date.now(),
    });
  }

  // Get metrics
  getMetric(name: string, type: MetricType, labels?: Labels): MetricValue | undefined {
    const key = this.getMetricKey(name, type, labels);
    return this.metrics.get(key);
  }

  // Get all metrics
  getAllMetrics(): Record<string, MetricValue> {
    return Object.fromEntries(this.metrics);
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics.clear();
  }

  // Export metrics in Prometheus format
  exportMetrics(): string {
    let output = '';

    for (const [key, metric] of this.metrics) {
      const { type, value, labels, timestamp } = metric;
      const name = this.getMetricName(key);
      const labelString = this.formatLabels(labels);

      switch (type) {
        case MetricType.Counter:
          output += `# TYPE ${name} counter\n`;
          output += `${name}${labelString} ${value} ${timestamp}\n`;
          break;

        case MetricType.Gauge:
          output += `# TYPE ${name} gauge\n`;
          output += `${name}${labelString} ${value} ${timestamp}\n`;
          break;

        case MetricType.Histogram:
          output += `# TYPE ${name} histogram\n`;
          const values = value as number[];
          const sum = values.reduce((a, b) => a + b, 0);
          const count = values.length;
          output += `${name}_sum${labelString} ${sum} ${timestamp}\n`;
          output += `${name}_count${labelString} ${count} ${timestamp}\n`;
          break;
      }
    }

    return output;
  }

  // Timer utility
  async measureDuration<T>(
    name: string,
    operation: () => Promise<T>,
    labels?: Labels
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.observeHistogram(name, duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.observeHistogram(`${name}_error`, duration, labels);
      throw error;
    }
  }

  // Private helper methods
  private getMetricKey(name: string, type: MetricType, labels?: Labels): string {
    const baseKey = `${this.prefix}_${name}_${type}`;
    return labels ? `${baseKey}${JSON.stringify(labels)}` : baseKey;
  }

  private getMetricName(key: string): string {
    return key.split('{')[0];
  }

  private formatLabels(labels?: Labels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const labelStrings = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `{${labelStrings}}`;
  }
}

// Export types
export * from './types'; 