import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgentActivities, ActivityParams } from '../../types/activities';
import { HealthCheckResult } from '../../types/agent';
import { AgentStatus } from '../../types/shared';
import { ErrorHandler } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
interface AgentTaskInput {
    command: any;
}
interface ActivityResult {
    success: boolean;
    data?: any;
    error?: Error;
}
export declare function runHealthCheck(): Promise<HealthCheckResult>;
export declare function collectMetrics(): Promise<{
    timestamp: Date;
    metrics: Record<string, number>;
}>;
export declare function handleCommand(input: AgentTaskInput): Promise<void>;
export declare function initialize(): Promise<void>;
export declare function cleanup(): Promise<void>;
export declare abstract class BaseAgentActivitiesImpl implements BaseAgentActivities {
    protected readonly name: string;
    protected readonly supabase: SupabaseClient;
    protected readonly logger: Logger;
    protected readonly errorHandler: ErrorHandler;
    protected status: AgentStatus;
    constructor(name: string, supabase: SupabaseClient);
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    checkHealth(): Promise<HealthCheckResult>;
    reportStatus(): Promise<AgentStatus>;
    handleError(error: Error, context: string): Promise<void>;
    protected abstract validateDependencies(): Promise<void>;
    protected abstract initializeResources(): Promise<void>;
    protected executeActivity<T>(activityName: string, params: ActivityParams, operation: () => Promise<T>): Promise<ActivityResult>;
    healthCheck(_params: ActivityParams): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Array<{
            name: string;
            status: 'pass' | 'fail';
            message?: string;
        }>;
    }>;
    collectMetrics(_params: ActivityParams): Promise<{
        timestamp: Date;
        metrics: Record<string, number>;
    }>;
    logActivity(params: {
        level: 'info' | 'warn' | 'error';
        message: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
}
export {};
//# sourceMappingURL=activities.d.ts.map