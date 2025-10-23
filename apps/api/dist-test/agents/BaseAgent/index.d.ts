import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';
import { HealthCheck } from '../../monitoring/enhanced-health-checks';
import { BaseAgentConfig, BaseMetrics, BaseAgentDependencies, AgentStatus, Logger, ErrorHandler } from './types';
export type { BaseAgentConfig, BaseAgentDependencies } from './types';
export { createBaseAgentConfig } from './config';
export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
    timestamp?: string;
}
/**
 * Production-grade BaseAgent with enhanced lifecycle management
 * Combines the robustness of the main repo with the clean architecture of the droid repo
 */
export declare abstract class BaseAgent extends EventEmitter {
    protected readonly config: BaseAgentConfig;
    protected readonly deps: BaseAgentDependencies;
    protected get supabase(): SupabaseClient | undefined;
    protected get logger(): Logger;
    protected get errorHandler(): ErrorHandler | undefined;
    private status;
    protected metrics: BaseMetrics;
    private healthCheckInterval?;
    private metricsInterval?;
    protected processLoopActive: boolean;
    constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies);
    protected abstract initialize(): Promise<void>;
    protected abstract process(): Promise<void>;
    protected abstract cleanup(): Promise<void>;
    protected abstract checkHealth(): Promise<HealthCheckResult>;
    getEnhancedHealth(): Promise<{
        agent: HealthCheckResult;
        dependencies: HealthCheck[];
        overall: 'healthy' | 'degraded' | 'unhealthy';
    }>;
    protected abstract collectMetrics(): Promise<BaseMetrics>;
    private registerAgentHealthCheck;
    start(): Promise<void>;
    stop(): Promise<void>;
    run(): Promise<void>;
    private runHealthCheck;
    private runMetricsCollection;
    private recordHealth;
    private recordMetrics;
    getStatus(): AgentStatus;
    getMetrics(): BaseMetrics;
    getConfig(): BaseAgentConfig;
    protected requireSupabase(): SupabaseClient;
    protected hasSupabase(): boolean;
    getTraceId(): string | undefined;
    getSpanId(): string | undefined;
    addTraceEvent(name: string, attributes?: Record<string, any>): void;
    addTraceTags(tags: Record<string, any>): void;
    protected traceOperation<T>(operation: string, fn: () => Promise<T>, tags?: Record<string, any>): Promise<T>;
}
//# sourceMappingURL=index.d.ts.map