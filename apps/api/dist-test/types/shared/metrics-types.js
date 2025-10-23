"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckValidationError = exports.MetricValidationError = exports.BaseMetricsSchema = exports.HealthReportSchema = exports.HealthCheckSchema = exports.MetricSchema = exports.MetricDefinitionSchema = exports.MetricValueSchema = exports.HealthCheckType = exports.HealthStatus = exports.MetricType = void 0;
exports.validateMetric = validateMetric;
exports.validateHealthCheck = validateHealthCheck;
exports.validateHealthReport = validateHealthReport;
exports.validateBaseMetrics = validateBaseMetrics;
exports.createHealthCheck = createHealthCheck;
exports.createMetric = createMetric;
exports.createHealthReport = createHealthReport;
exports.metricToPrometheusFormat = metricToPrometheusFormat;
const zod_1 = require("zod");
// --- Enums ---
exports.MetricType = zod_1.z.enum([
    'counter',
    'gauge',
    'histogram',
    'summary'
]);
exports.HealthStatus = zod_1.z.enum([
    'healthy',
    'degraded',
    'unhealthy'
]);
exports.HealthCheckType = zod_1.z.enum([
    'database',
    'api',
    'memory',
    'cpu',
    'disk',
    'network',
    'service',
    'custom'
]);
// --- Schemas ---
exports.MetricValueSchema = zod_1.z.object({
    value: zod_1.z.number(),
    timestamp: zod_1.z.string(),
    labels: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional()
});
exports.MetricDefinitionSchema = zod_1.z.object({
    name: zod_1.z.string(),
    help: zod_1.z.string(),
    type: exports.MetricType,
    labels: zod_1.z.array(zod_1.z.string()).optional()
});
exports.MetricSchema = zod_1.z.object({
    definition: exports.MetricDefinitionSchema,
    values: zod_1.z.array(exports.MetricValueSchema)
});
exports.HealthCheckSchema = zod_1.z.object({
    type: exports.HealthCheckType,
    name: zod_1.z.string(),
    status: exports.HealthStatus,
    message: zod_1.z.string().optional(),
    timestamp: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    metrics: zod_1.z.array(exports.MetricSchema).optional()
});
exports.HealthReportSchema = zod_1.z.object({
    status: exports.HealthStatus,
    timestamp: zod_1.z.string(),
    checks: zod_1.z.array(exports.HealthCheckSchema),
    metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.BaseMetricsSchema = zod_1.z.object({
    timestamp: zod_1.z.string(),
    agentName: zod_1.z.string(),
    version: zod_1.z.string(),
    uptime: zod_1.z.number(),
    memory: zod_1.z.object({
        heapUsed: zod_1.z.number(),
        heapTotal: zod_1.z.number(),
        external: zod_1.z.number(),
        rss: zod_1.z.number()
    }),
    cpu: zod_1.z.object({
        user: zod_1.z.number(),
        system: zod_1.z.number(),
        percentage: zod_1.z.number()
    }),
    operations: zod_1.z.object({
        total: zod_1.z.number(),
        successful: zod_1.z.number(),
        failed: zod_1.z.number(),
        inProgress: zod_1.z.number()
    }),
    latency: zod_1.z.object({
        p50: zod_1.z.number(),
        p90: zod_1.z.number(),
        p99: zod_1.z.number()
    }),
    errors: zod_1.z.object({
        count: zod_1.z.number(),
        rate: zod_1.z.number()
    }),
    customMetrics: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
// --- Validation Functions ---
function validateMetric(data) {
    return exports.MetricSchema.parse(data);
}
function validateHealthCheck(data) {
    return exports.HealthCheckSchema.parse(data);
}
function validateHealthReport(data) {
    return exports.HealthReportSchema.parse(data);
}
function validateBaseMetrics(data) {
    return exports.BaseMetricsSchema.parse(data);
}
// --- Helper Functions ---
function createHealthCheck(type, name, status, message, details) {
    return validateHealthCheck({
        type,
        name,
        status,
        message,
        timestamp: new Date().toISOString(),
        details
    });
}
function createMetric(name, help, type, value, labels) {
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
function createHealthReport(checks, metrics) {
    const status = determineOverallStatus(checks);
    return validateHealthReport({
        status,
        timestamp: new Date().toISOString(),
        checks,
        metrics
    });
}
function determineOverallStatus(checks) {
    if (checks.some(check => check.status === 'unhealthy')) {
        return 'unhealthy';
    }
    if (checks.some(check => check.status === 'degraded')) {
        return 'degraded';
    }
    return 'healthy';
}
// --- Prometheus Helpers ---
function metricToPrometheusFormat(metric) {
    const { definition, values } = metric;
    const lines = [];
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
class MetricValidationError extends Error {
    constructor(message, zodError) {
        super(message);
        this.zodError = zodError;
        this.name = 'MetricValidationError';
    }
}
exports.MetricValidationError = MetricValidationError;
class HealthCheckValidationError extends Error {
    constructor(message, zodError) {
        super(message);
        this.zodError = zodError;
        this.name = 'HealthCheckValidationError';
    }
}
exports.HealthCheckValidationError = HealthCheckValidationError;
