import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ErrorHandler } from '../utils/errorHandling';
import { Logger } from '../utils/logger';
export type AgentStatus = 'idle' | 'healthy' | 'unhealthy' | 'degraded';
export declare const AgentStatusSchema: z.ZodEnum<["idle", "healthy", "unhealthy", "degraded"]>;
export declare function isValidAgentStatus(status: unknown): status is AgentStatus;
export interface AgentConfig {
    name: string;
    enabled: boolean;
    healthCheckInterval?: number;
    metricsConfig?: {
        interval: number;
        prefix: string;
    };
}
export interface AgentMetrics {
    agentName: string;
    status: AgentStatus;
    successCount: number;
    warningCount: number;
    errorCount: number;
    timestamp: string;
    [key: string]: unknown;
}
export interface HealthCheckResult {
    status: AgentStatus;
    timestamp: string;
    details?: {
        errors: string[];
        warnings: string[];
        info: Record<string, unknown>;
    };
}
export interface AgentCommand {
    type: string;
    payload: unknown;
    timestamp?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}
export interface AgentError {
    message: string;
    code: string;
    stack?: string;
    context?: Record<string, unknown>;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}
export interface AgentTaskInput {
    command: AgentCommand;
    metadata?: Record<string, unknown>;
}
export interface AgentHealthReport {
    agentName: string;
    status: AgentStatus;
    details?: {
        errors: string[];
        warnings: string[];
        info: Record<string, unknown>;
    };
    timestamp: string;
}
export interface BaseAgentDependencies {
    supabase: SupabaseClient;
    config: AgentConfig;
    errorHandler?: ErrorHandler;
    logger?: Logger;
}
export declare const agentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    enabled: z.ZodBoolean;
    healthCheckInterval: z.ZodOptional<z.ZodNumber>;
    metricsConfig: z.ZodOptional<z.ZodObject<{
        interval: z.ZodNumber;
        prefix: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        interval: number;
        prefix: string;
    }, {
        interval: number;
        prefix: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    healthCheckInterval?: number | undefined;
    metricsConfig?: {
        interval: number;
        prefix: string;
    } | undefined;
}, {
    name: string;
    enabled: boolean;
    healthCheckInterval?: number | undefined;
    metricsConfig?: {
        interval: number;
        prefix: string;
    } | undefined;
}>;
export declare const healthCheckResultSchema: z.ZodObject<{
    status: z.ZodEnum<["idle", "healthy", "unhealthy", "degraded"]>;
    timestamp: z.ZodString;
    details: z.ZodOptional<z.ZodObject<{
        errors: z.ZodArray<z.ZodString, "many">;
        warnings: z.ZodArray<z.ZodString, "many">;
        info: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        info: Record<string, any>;
        errors: string[];
        warnings: string[];
    }, {
        info: Record<string, any>;
        errors: string[];
        warnings: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy" | "degraded" | "idle";
    timestamp: string;
    details?: {
        info: Record<string, any>;
        errors: string[];
        warnings: string[];
    } | undefined;
}, {
    status: "healthy" | "unhealthy" | "degraded" | "idle";
    timestamp: string;
    details?: {
        info: Record<string, any>;
        errors: string[];
        warnings: string[];
    } | undefined;
}>;
export declare const agentMetricsSchema: z.ZodObject<{
    agentName: z.ZodString;
    status: z.ZodEnum<["idle", "healthy", "unhealthy", "degraded"]>;
    successCount: z.ZodNumber;
    warningCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodAny, z.objectOutputType<{
    agentName: z.ZodString;
    status: z.ZodEnum<["idle", "healthy", "unhealthy", "degraded"]>;
    successCount: z.ZodNumber;
    warningCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    timestamp: z.ZodString;
}, z.ZodAny, "strip">, z.objectInputType<{
    agentName: z.ZodString;
    status: z.ZodEnum<["idle", "healthy", "unhealthy", "degraded"]>;
    successCount: z.ZodNumber;
    warningCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    timestamp: z.ZodString;
}, z.ZodAny, "strip">>;
export interface FeedAgentConfig {
    name: string;
}
//# sourceMappingURL=agent.d.ts.map