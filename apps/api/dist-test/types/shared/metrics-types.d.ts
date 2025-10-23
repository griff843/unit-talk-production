import { z } from 'zod';
export declare const MetricType: z.ZodEnum<["counter", "gauge", "histogram", "summary"]>;
export type MetricType = z.infer<typeof MetricType>;
export declare const HealthStatus: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
export type HealthStatus = z.infer<typeof HealthStatus>;
export declare const HealthCheckType: z.ZodEnum<["database", "api", "memory", "cpu", "disk", "network", "service", "custom"]>;
export type HealthCheckType = z.infer<typeof HealthCheckType>;
export declare const MetricValueSchema: z.ZodObject<{
    value: z.ZodNumber;
    timestamp: z.ZodString;
    labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    timestamp: string;
    labels?: Record<string, string> | undefined;
}, {
    value: number;
    timestamp: string;
    labels?: Record<string, string> | undefined;
}>;
export type MetricValue = z.infer<typeof MetricValueSchema>;
export declare const MetricDefinitionSchema: z.ZodObject<{
    name: z.ZodString;
    help: z.ZodString;
    type: z.ZodEnum<["counter", "gauge", "histogram", "summary"]>;
    labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "summary" | "gauge" | "counter" | "histogram";
    name: string;
    help: string;
    labels?: string[] | undefined;
}, {
    type: "summary" | "gauge" | "counter" | "histogram";
    name: string;
    help: string;
    labels?: string[] | undefined;
}>;
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;
export declare const MetricSchema: z.ZodObject<{
    definition: z.ZodObject<{
        name: z.ZodString;
        help: z.ZodString;
        type: z.ZodEnum<["counter", "gauge", "histogram", "summary"]>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "summary" | "gauge" | "counter" | "histogram";
        name: string;
        help: string;
        labels?: string[] | undefined;
    }, {
        type: "summary" | "gauge" | "counter" | "histogram";
        name: string;
        help: string;
        labels?: string[] | undefined;
    }>;
    values: z.ZodArray<z.ZodObject<{
        value: z.ZodNumber;
        timestamp: z.ZodString;
        labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        timestamp: string;
        labels?: Record<string, string> | undefined;
    }, {
        value: number;
        timestamp: string;
        labels?: Record<string, string> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    values: {
        value: number;
        timestamp: string;
        labels?: Record<string, string> | undefined;
    }[];
    definition: {
        type: "summary" | "gauge" | "counter" | "histogram";
        name: string;
        help: string;
        labels?: string[] | undefined;
    };
}, {
    values: {
        value: number;
        timestamp: string;
        labels?: Record<string, string> | undefined;
    }[];
    definition: {
        type: "summary" | "gauge" | "counter" | "histogram";
        name: string;
        help: string;
        labels?: string[] | undefined;
    };
}>;
export type Metric = z.infer<typeof MetricSchema>;
export declare const HealthCheckSchema: z.ZodObject<{
    type: z.ZodEnum<["database", "api", "memory", "cpu", "disk", "network", "service", "custom"]>;
    name: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    message: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
        definition: z.ZodObject<{
            name: z.ZodString;
            help: z.ZodString;
            type: z.ZodEnum<["counter", "gauge", "histogram", "summary"]>;
            labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        }, {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        }>;
        values: z.ZodArray<z.ZodObject<{
            value: z.ZodNumber;
            timestamp: z.ZodString;
            labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }, {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        values: {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }[];
        definition: {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        };
    }, {
        values: {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }[];
        definition: {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    name: string;
    message?: string | undefined;
    details?: Record<string, unknown> | undefined;
    metrics?: {
        values: {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }[];
        definition: {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        };
    }[] | undefined;
}, {
    type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    name: string;
    message?: string | undefined;
    details?: Record<string, unknown> | undefined;
    metrics?: {
        values: {
            value: number;
            timestamp: string;
            labels?: Record<string, string> | undefined;
        }[];
        definition: {
            type: "summary" | "gauge" | "counter" | "histogram";
            name: string;
            help: string;
            labels?: string[] | undefined;
        };
    }[] | undefined;
}>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;
export declare const HealthReportSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    timestamp: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["database", "api", "memory", "cpu", "disk", "network", "service", "custom"]>;
        name: z.ZodString;
        status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
        message: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
            definition: z.ZodObject<{
                name: z.ZodString;
                help: z.ZodString;
                type: z.ZodEnum<["counter", "gauge", "histogram", "summary"]>;
                labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            }, {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            }>;
            values: z.ZodArray<z.ZodObject<{
                value: z.ZodNumber;
                timestamp: z.ZodString;
                labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, "strip", z.ZodTypeAny, {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }, {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }, {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        name: string;
        message?: string | undefined;
        details?: Record<string, unknown> | undefined;
        metrics?: {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }[] | undefined;
    }, {
        type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        name: string;
        message?: string | undefined;
        details?: Record<string, unknown> | undefined;
        metrics?: {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }[] | undefined;
    }>, "many">;
    metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    checks: {
        type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        name: string;
        message?: string | undefined;
        details?: Record<string, unknown> | undefined;
        metrics?: {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }[] | undefined;
    }[];
    metrics?: Record<string, unknown> | undefined;
}, {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    checks: {
        type: "database" | "service" | "memory" | "custom" | "api" | "network" | "cpu" | "disk";
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        name: string;
        message?: string | undefined;
        details?: Record<string, unknown> | undefined;
        metrics?: {
            values: {
                value: number;
                timestamp: string;
                labels?: Record<string, string> | undefined;
            }[];
            definition: {
                type: "summary" | "gauge" | "counter" | "histogram";
                name: string;
                help: string;
                labels?: string[] | undefined;
            };
        }[] | undefined;
    }[];
    metrics?: Record<string, unknown> | undefined;
}>;
export type HealthReport = z.infer<typeof HealthReportSchema>;
export declare const BaseMetricsSchema: z.ZodObject<{
    timestamp: z.ZodString;
    agentName: z.ZodString;
    version: z.ZodString;
    uptime: z.ZodNumber;
    memory: z.ZodObject<{
        heapUsed: z.ZodNumber;
        heapTotal: z.ZodNumber;
        external: z.ZodNumber;
        rss: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        external: number;
        heapUsed: number;
        heapTotal: number;
        rss: number;
    }, {
        external: number;
        heapUsed: number;
        heapTotal: number;
        rss: number;
    }>;
    cpu: z.ZodObject<{
        user: z.ZodNumber;
        system: z.ZodNumber;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        system: number;
        user: number;
        percentage: number;
    }, {
        system: number;
        user: number;
        percentage: number;
    }>;
    operations: z.ZodObject<{
        total: z.ZodNumber;
        successful: z.ZodNumber;
        failed: z.ZodNumber;
        inProgress: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        total: number;
        successful: number;
        inProgress: number;
    }, {
        failed: number;
        total: number;
        successful: number;
        inProgress: number;
    }>;
    latency: z.ZodObject<{
        p50: z.ZodNumber;
        p90: z.ZodNumber;
        p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        p50: number;
        p90: number;
        p99: number;
    }, {
        p50: number;
        p90: number;
        p99: number;
    }>;
    errors: z.ZodObject<{
        count: z.ZodNumber;
        rate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        rate: number;
    }, {
        count: number;
        rate: number;
    }>;
    customMetrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    memory: {
        external: number;
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
    version: string;
    agentName: string;
    errors: {
        count: number;
        rate: number;
    };
    latency: {
        p50: number;
        p90: number;
        p99: number;
    };
    operations: {
        failed: number;
        total: number;
        successful: number;
        inProgress: number;
    };
    uptime: number;
    cpu: {
        system: number;
        user: number;
        percentage: number;
    };
    customMetrics?: Record<string, unknown> | undefined;
}, {
    timestamp: string;
    memory: {
        external: number;
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
    version: string;
    agentName: string;
    errors: {
        count: number;
        rate: number;
    };
    latency: {
        p50: number;
        p90: number;
        p99: number;
    };
    operations: {
        failed: number;
        total: number;
        successful: number;
        inProgress: number;
    };
    uptime: number;
    cpu: {
        system: number;
        user: number;
        percentage: number;
    };
    customMetrics?: Record<string, unknown> | undefined;
}>;
export type BaseMetrics = z.infer<typeof BaseMetricsSchema>;
export declare function validateMetric(data: unknown): Metric;
export declare function validateHealthCheck(data: unknown): HealthCheck;
export declare function validateHealthReport(data: unknown): HealthReport;
export declare function validateBaseMetrics(data: unknown): BaseMetrics;
export declare function createHealthCheck(type: HealthCheckType, name: string, status: HealthStatus, message?: string, details?: Record<string, unknown>): HealthCheck;
export declare function createMetric(name: string, help: string, type: MetricType, value: number, labels?: Record<string, string>): Metric;
export declare function createHealthReport(checks: HealthCheck[], metrics?: Record<string, unknown>): HealthReport;
export declare function metricToPrometheusFormat(metric: Metric): string;
export declare class MetricValidationError extends Error {
    zodError: z.ZodError;
    constructor(message: string, zodError: z.ZodError);
}
export declare class HealthCheckValidationError extends Error {
    zodError: z.ZodError;
    constructor(message: string, zodError: z.ZodError);
}
//# sourceMappingURL=metrics-types.d.ts.map