import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentStatus, AgentMetrics, HealthCheckResult } from './agent';
export declare abstract class BaseAgent {
    protected readonly supabase: SupabaseClient;
    protected readonly logger: ReturnType<typeof createLogger>;
    protected readonly config: AgentConfig;
    protected status: AgentStatus;
    protected metrics: AgentMetrics;
    protected healthCheckInterval?: NodeJS.Timeout;
    protected metricsInterval?: NodeJS.Timeout;
    constructor(dependencies: BaseAgentDependencies);
    protected abstract validateDependencies(): Promise<void>;
    protected abstract initializeResources(): Promise<void>;
    protected abstract process(): Promise<void>;
    protected abstract healthCheck(): Promise<HealthCheckResult>;
    protected abstract collectMetrics(): Promise<AgentMetrics>;
    protected runHealthCheck(): Promise<void>;
    protected runMetricsCollection(): Promise<void>;
    private recordHealth;
    private recordMetrics;
    start(): Promise<void>;
    stop(): Promise<void>;
    protected abstract cleanup(): Promise<void>;
}
export interface BaseAgentDependencies {
    supabase: SupabaseClient;
    logger?: ReturnType<typeof createLogger>;
    config: AgentConfig;
}
//# sourceMappingURL=BaseAgent.d.ts.map