import { z } from 'zod';

// --- Enums ---
export const MetricType = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary'
]);
export type MetricType = z.infer<typeof MetricType>;

export const HealthStatus = z.enum([
  'healthy',
  'degraded',
  'unhealthy'
]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const HealthCheckType = z.enum([
  'database',
  'api',
  'memory',
  'cpu',
  'disk',
  'network',
  'service',
  'custom'
]);
export type HealthCheckType = z.infer<typeof HealthCheckType>;

// --- Schemas ---
export const MetricValueSchema = z.object({
  value: z.number(),
  timestamp: z.string(),
  labels: z.record(z.string(), z.string()).optional()
});

export type MetricValue = z.infer<typeof MetricValueSchema>;

export const MetricDefinitionSchema = z.object({
  name: z.string(),
  help: z.string(),
  type: MetricType,
  labels: z.array(z.string()).optional()
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const MetricSchema = z.object({
  definition: MetricDefinitionSchema,
  values: z.array(MetricValueSchema)
});

export type Metric = z.infer<typeof MetricSchema>;

export const HealthCheckSchema = z.object({
  type: HealthCheckType,
  name: z.string(),
  status: HealthStatus,
  message: z.string().optional(),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  metrics: z.array(MetricSchema).optional()
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

export const HealthReportSchema = z.object({
  status: HealthStatus,
  timestamp: z.string(),
  checks: z.array(HealthCheckSchema),
  metrics: z.record(z.string(), z.unknown()).optional()
});

export type HealthReport = z.infer<typeof HealthReportSchema>;

export const BaseMetricsSchema = z.object({
  timestamp: z.string(),
  agentName: z.string(),
  version: z.string(),
  uptime: z.number(),
  memory: z.object({
    heapUsed: z.number(),
    heapTotal: z.number(),
    external: z.number(),
    rss: z.number()
  }),
  cpu: z.object({
    user: z.number(),
    system: z.number(),
    percentage: z.number()
  }),
  operations: z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number(),
    inProgress: z.number()
  }),
  latency: z.object({
    p50: z.number(),
    p90: z.number(),
    p99: z.number()
  }),
  errors: z.object({
    count: z.number(),
    rate: z.number()
  }),
  customMetrics: z.record(z.string(), z.unknown()).optional()
});

export type BaseMetrics = z.infer<typeof BaseMetricsSchema>;

// --- Validation Functions ---
export function validateMetric(data: unknown): Metric {
  return MetricSchema.parse(data);
}

export function validateHealthCheck(data: unknown): HealthCheck {
  return HealthCheckSchema.parse(data);
}

export function validateHealthReport(data: unknown): HealthReport {
  return HealthReportSchema.parse(data);
}

export function validateBaseMetrics(data: unknown): BaseMetrics {
  return BaseMetricsSchema.parse(data);
}

// --- Helper Functions ---
export function createHealthCheck(
  type: HealthCheckType,
  name: string,
  status: HealthStatus,
  message?: string,
  details?: Record<string, unknown>
): HealthCheck {
  return validateHealthCheck({
    type,
    name,
    status,
    message,
    timestamp: new Date().toISOString(),
    details
  });
}

export function createMetric(
  name: string,
  help: string,
  type: MetricType,
  value: number,
  labels?: Record<string, string>
): Metric {
  return validateMetric({
    definition: {
      name,
      help,
      type,
      labels: labels ? Object.keys(labels) : undefined
    },
    values: [{
      value,
      timestamp: new Date().toISOString(),
      labels
    }]
  });
}

export function createHealthReport(
  checks: HealthCheck[],
  metrics?: Record<string, unknown>
): HealthReport {
  const status = determineOverallStatus(checks);
  return validateHealthReport({
    status,
    timestamp: new Date().toISOString(),
    checks,
    metrics
  });
}

function determineOverallStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some(check => check.status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (checks.some(check => check.status === 'degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

// --- Prometheus Helpers ---
export function metricToPrometheusFormat(metric: Metric): string {
  const { definition, values } = metric;
  const lines: string[] = [];

  // Add HELP comment
  lines.push(`# HELP ${definition.name} ${definition.help}`);
  // Add TYPE comment
  lines.push(`# TYPE ${definition.name} ${definition.type}`);

  // Add metric values
  for (const value of values) {
    const labels = value.labels
      ? `{${Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')}}`
      : '';
    lines.push(`${definition.name}${labels} ${value.value} ${Date.parse(value.timestamp)}`);
  }

  return lines.join('\n');
}

// --- Error Types ---
export class MetricValidationError extends Error {
  constructor(message: string, public zodError: z.ZodError) {
    super(message);
    this.name = 'MetricValidationError';
  }
}

export class HealthCheckValidationError extends Error {
  constructor(message: string, public zodError: z.ZodError) {
    super(message);
    this.name = 'HealthCheckValidationError';
  }
} 