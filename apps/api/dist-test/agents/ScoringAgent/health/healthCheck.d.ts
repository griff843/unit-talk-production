import { SupabaseClient } from '@supabase/supabase-js';
import { PerformanceTracker } from '../tracking/performanceTracker';
interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
        database: ComponentHealth;
        config: ComponentHealth;
        metrics: ComponentHealth;
        performance: ComponentHealth;
    };
    last_check: string;
    version: string;
}
interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency_ms?: number;
    last_success?: string;
    error?: string;
}
export declare class HealthChecker {
    private supabase;
    private performanceTracker;
    private static instance;
    private lastStatus;
    private readonly version;
    private constructor();
    static getInstance(supabase: SupabaseClient, performanceTracker: PerformanceTracker): HealthChecker;
    private setupHealthCheck;
    check(): Promise<HealthStatus>;
    private checkDatabase;
    private checkMetrics;
    private checkPerformance;
    private determineOverallStatus;
    getLastStatus(): HealthStatus | undefined;
}
export {};
//# sourceMappingURL=healthCheck.d.ts.map