import { z } from 'zod';
import { Logger } from '../../shared/logger/types';
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
    timestamp?: string;
}
export type HealthCheckResult = HealthStatus;
export interface BaseMetrics {
    agentName: string;
    errorCount: number;
    successCount: number;
    warningCount: number;
    processingTimeMs: number;
    memoryUsageMb: number;
    port?: number;
    enabled?: boolean;
    interval?: number;
    endpoint?: string;
}
export type AgentMetrics = BaseMetrics;
export interface HealthConfig {
    enabled?: boolean;
    interval?: number;
    timeout?: number;
    checkDb?: boolean;
    checkExternal?: boolean;
    endpoint?: string;
}
export interface RetryConfig {
    enabled?: boolean;
    maxRetries?: number;
    maxAttempts?: number;
    backoffMs?: number;
    backoff?: number;
    maxBackoffMs?: number;
    exponential?: boolean;
    jitter?: boolean;
}
export interface MetricsConfig {
    enabled?: boolean;
    interval?: number;
    port?: number;
    endpoint?: string;
}
export interface BaseAgentConfig {
    name: string;
    version?: string;
    enabled?: boolean;
    logLevel?: 'info' | 'warn' | 'error' | 'debug';
    schedule?: 'disabled' | 'enabled' | 'manual';
    metrics?: MetricsConfig;
    health?: HealthConfig;
    retry?: RetryConfig;
}
export interface BaseAgentDependencies {
    logger: Logger;
    supabase?: any;
    errorHandler?: ErrorHandler;
}
export type AgentStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error' | 'degraded';
export interface ErrorHandler {
    handleError(error: Error, context?: Record<string, unknown>): void;
}
export declare const BaseAgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    logLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<["debug", "info", "warn", "error"]>>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        port: z.ZodOptional<z.ZodNumber>;
        endpoint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        port?: number | undefined;
        endpoint?: string | undefined;
    }, {
        port?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        checkDb: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        checkExternal: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        endpoint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        enabled: boolean;
        interval: number;
        checkDb: boolean;
        checkExternal: boolean;
        endpoint?: string | undefined;
    }, {
        timeout?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
        checkDb?: boolean | undefined;
        checkExternal?: boolean | undefined;
    }>>;
    retry: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        maxRetries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        backoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        maxBackoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        exponential: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        jitter: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
        exponential: boolean;
        jitter: boolean;
    }, {
        enabled?: boolean | undefined;
        maxRetries?: number | undefined;
        backoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        exponential?: boolean | undefined;
        jitter?: boolean | undefined;
    }>>;
    schedule: z.ZodDefault<z.ZodOptional<z.ZodEnum<["disabled", "enabled", "manual"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    version: string;
    logLevel: "error" | "warn" | "info" | "debug";
    schedule: "disabled" | "enabled" | "manual";
    metrics?: {
        enabled: boolean;
        interval: number;
        port?: number | undefined;
        endpoint?: string | undefined;
    } | undefined;
    health?: {
        timeout: number;
        enabled: boolean;
        interval: number;
        checkDb: boolean;
        checkExternal: boolean;
        endpoint?: string | undefined;
    } | undefined;
    retry?: {
        enabled: boolean;
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
        exponential: boolean;
        jitter: boolean;
    } | undefined;
}, {
    name: string;
    enabled?: boolean | undefined;
    version?: string | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        port?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
    } | undefined;
    health?: {
        timeout?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
        checkDb?: boolean | undefined;
        checkExternal?: boolean | undefined;
    } | undefined;
    retry?: {
        enabled?: boolean | undefined;
        maxRetries?: number | undefined;
        backoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        exponential?: boolean | undefined;
        jitter?: boolean | undefined;
    } | undefined;
    schedule?: "disabled" | "enabled" | "manual" | undefined;
}>;
export { Logger };
//# sourceMappingURL=types.d.ts.map