export enum MetricType {
  Counter = 'counter',
  Gauge = 'gauge',
  Histogram = 'histogram',
}

export interface Labels {
  [key: string]: string | number | boolean;
}

export interface MetricValue {
  type: MetricType;
  value: number | number[];
  labels?: Labels;
  timestamp: number;
}

export interface MetricsConfig {
  prefix: string;
  interval?: number;
  exportPath?: string;
  labels?: Labels;
  histogramBuckets?: number[];
}

export interface MetricsExporter {
  export(): string;
  reset(): void;
}

export interface Timer {
  start(): void;
  stop(): number;
  duration(): number;
}

export interface MetricsCollector {
  incrementCounter(name: string, value?: number, labels?: Labels): void;
  setGauge(name: string, value: number, labels?: Labels): void;
  observeHistogram(name: string, value: number, labels?: Labels): void;
  getMetric(name: string, type: MetricType, labels?: Labels): MetricValue | undefined;
  getAllMetrics(): Record<string, MetricValue>;
  resetMetrics(): void;
  exportMetrics(): string;
  measureDuration<T>(name: string, operation: () => Promise<T>, labels?: Labels): Promise<T>;
}

// Agent-specific metrics
export interface AgentMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastRunAt?: Date;
  processingTimeMs: number;
  memoryUsageMb: number;
}

export interface AnalyticsMetrics extends AgentMetrics {
  capperCount: number;
  avgROI: number;
  profitableCappers: number;
  activeStreaks: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
}

export interface DatabaseMetrics {
  queryCount: number;
  errorCount: number;
  avgResponseTimeMs: number;
  connectionErrors: number;
  activeConnections: number;
  poolSize: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  heapUsage: number;
  uptime: number;
  activeHandles: number;
  activeRequests: number;
} 