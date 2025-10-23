import { z } from 'zod';
export declare const AgentStatusEnum: z.ZodEnum<["idle", "ready", "running", "error", "stopped"]>;
export type AgentStatus = z.infer<typeof AgentStatusEnum>;
export declare const SeverityEnum: z.ZodEnum<["low", "medium", "high", "critical"]>;
export type Severity = z.infer<typeof SeverityEnum>;
export declare const TimestampedSchema: z.ZodObject<{
    created_at: z.ZodString;
    updated_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    updated_at?: string | undefined;
}, {
    created_at: string;
    updated_at?: string | undefined;
}>;
export declare const IdentifiableSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const MetadataSchema: z.ZodObject<{
    version: z.ZodString;
    environment: z.ZodEnum<["development", "staging", "production"]>;
    agent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: string;
    agent: string;
    environment: "development" | "production" | "staging";
}, {
    version: string;
    agent: string;
    environment: "development" | "production" | "staging";
}>;
export declare const BaseEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    timestamp: z.ZodString;
    source: z.ZodString;
    metadata: z.ZodObject<{
        version: z.ZodString;
        environment: z.ZodEnum<["development", "staging", "production"]>;
        agent: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
        agent: string;
        environment: "development" | "production" | "staging";
    }, {
        version: string;
        agent: string;
        environment: "development" | "production" | "staging";
    }>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    metadata: {
        version: string;
        agent: string;
        environment: "development" | "production" | "staging";
    };
    id: string;
    source: string;
}, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    metadata: {
        version: string;
        agent: string;
        environment: "development" | "production" | "staging";
    };
    id: string;
    source: string;
}>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export declare const AgentConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    enabled: z.ZodBoolean;
    retryConfig: z.ZodObject<{
        maxAttempts: z.ZodNumber;
        backoffMs: z.ZodNumber;
        maxBackoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        backoffMs: number;
        maxBackoffMs: number;
        maxAttempts: number;
    }, {
        backoffMs: number;
        maxBackoffMs: number;
        maxAttempts: number;
    }>;
    alertConfig: z.ZodObject<{
        enabled: z.ZodBoolean;
        thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
        channels: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        channels: string[];
        thresholds: Record<string, number>;
    }, {
        enabled: boolean;
        channels: string[];
        thresholds: Record<string, number>;
    }>;
    metricsConfig: z.ZodObject<{
        port: z.ZodNumber;
        path: z.ZodString;
        interval: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        path: string;
        port: number;
        interval: number;
    }, {
        path: string;
        port: number;
        interval: number;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    version: string;
    id: string;
    metricsConfig: {
        path: string;
        port: number;
        interval: number;
    };
    alertConfig: {
        enabled: boolean;
        channels: string[];
        thresholds: Record<string, number>;
    };
    retryConfig: {
        backoffMs: number;
        maxBackoffMs: number;
        maxAttempts: number;
    };
}, {
    name: string;
    enabled: boolean;
    version: string;
    id: string;
    metricsConfig: {
        path: string;
        port: number;
        interval: number;
    };
    alertConfig: {
        enabled: boolean;
        channels: string[];
        thresholds: Record<string, number>;
    };
    retryConfig: {
        backoffMs: number;
        maxBackoffMs: number;
        maxAttempts: number;
    };
}>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export declare const HealthStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    components: z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
        message: z.ZodOptional<z.ZodString>;
        lastCheck: z.ZodString;
        metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        status: "healthy" | "unhealthy" | "degraded";
        lastCheck: string;
        message?: string | undefined;
        metrics?: Record<string, unknown> | undefined;
    }, {
        status: "healthy" | "unhealthy" | "degraded";
        lastCheck: string;
        message?: string | undefined;
        metrics?: Record<string, unknown> | undefined;
    }>>;
    timestamp: z.ZodString;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    version: string;
    components: Record<string, {
        status: "healthy" | "unhealthy" | "degraded";
        lastCheck: string;
        message?: string | undefined;
        metrics?: Record<string, unknown> | undefined;
    }>;
}, {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    version: string;
    components: Record<string, {
        status: "healthy" | "unhealthy" | "degraded";
        lastCheck: string;
        message?: string | undefined;
        metrics?: Record<string, unknown> | undefined;
    }>;
}>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export declare function validateEvent<T extends z.ZodType>(schema: T, data: unknown): z.infer<T>;
export declare function validateConfig(config: unknown): AgentConfig;
export declare function validateHealth(health: unknown): HealthStatus;
//# sourceMappingURL=index.d.ts.map