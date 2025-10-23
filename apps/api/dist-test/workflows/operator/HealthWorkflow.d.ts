/**
 * HealthWorkflow - Comprehensive System Health Monitoring
 *
 * Integrates system_health_snapshot view into daily operations by:
 * - Querying health status across 8 key system sections
 * - Creating incidents for threshold violations
 * - Logging all executions to agent_job_runs
 * - Pushing real-time health data to Command Center
 * - Providing resilient monitoring with retry logic
 *
 * Health Sections Monitored:
 * - HOT_PROPS: Real-time prop ingestion status
 * - WARM_FEATURES: Feature computation pipeline
 * - AGENT_JOBS: Agent workflow execution health
 * - RECAP_RUNS: Daily recap generation status
 * - ALERTS: Alert latency and processing
 * - SYSTEM_PERFORMANCE: CPU, memory, disk metrics
 * - DATABASE_HEALTH: DB connections and performance
 * - API_ENDPOINTS: API response times and availability
 */
export declare function HealthWorkflow(params: {
    maxRetries?: number;
    alertThresholds?: {
        criticalIncidentCount?: number;
        degradedSectionCount?: number;
        maxExecutionTime?: number;
    };
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    executionId: string;
    healthSummary: {
        totalSections: number;
        healthySections: number;
        degradedSections: number;
        criticalSections: number;
        sectionsWithAlerts: string[];
    };
    incidents: {
        created: string[];
        skipped: string[];
        total: number;
    };
    performance: {
        executionTime: number;
        queryTime: number;
        commandCenterPush: boolean;
    };
    errors: string[];
}>;
/**
 * Scheduled HealthWorkflow - Runs every 15 minutes for continuous monitoring
 *
 * Optimized for regular system health checks with:
 * - Standard alert thresholds for production use
 * - Automatic incident creation and Command Center integration
 * - Comprehensive logging and performance monitoring
 */
export declare function ScheduledHealthWorkflow(): Promise<void>;
/**
 * Express HealthWorkflow - Triggered by system events for rapid health assessment
 *
 * Fast health check for incident response:
 * - Reduced retry attempts for speed
 * - Lower alert thresholds for proactive detection
 * - Priority routing to Command Center
 */
export declare function ExpressHealthWorkflow(params: {
    triggerEvent?: string;
    priority: 'normal' | 'high' | 'critical';
    focusSections?: string[];
}): Promise<void>;
//# sourceMappingURL=HealthWorkflow.d.ts.map