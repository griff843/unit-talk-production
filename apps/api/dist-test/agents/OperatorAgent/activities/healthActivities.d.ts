/**
 * Health Workflow Activities
 *
 * Implements the core activities for system health monitoring:
 * - Health snapshot query execution
 * - Job run logging and completion
 * - Incident creation with deduplication
 * - Command Center integration
 * - Alert dispatching
 */
export interface HealthSection {
    section: string;
    status: 'healthy' | 'warning' | 'degraded' | 'critical';
    count_recent: number;
    count_total: number;
    last_updated: string;
    details: Record<string, any>;
    thresholds: Record<string, number>;
    alerts: string[];
}
/**
 * Execute system_health_snapshot query with comprehensive error handling
 */
export declare function executeHealthSnapshot(): Promise<{
    success: boolean;
    healthData: HealthSection[];
    executionTime: number;
    queryTime: number;
}>;
/**
 * Log job run start with comprehensive metadata
 */
export declare function logJobRun(params: {
    agent: string;
    workflow: string;
    jobName: string;
    status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
    metadata: Record<string, any>;
    errorMessage?: string;
}): Promise<{
    jobId: string;
    logged: boolean;
}>;
/**
 * Complete job run with duration calculation and final metadata
 */
export declare function completeJobRun(params: {
    jobId: string;
    status: 'success' | 'failed' | 'timeout' | 'cancelled';
    metadata: Record<string, any>;
    errorMessage?: string;
}): Promise<{
    completed: boolean;
    duration: number;
}>;
/**
 * Create health incidents with idempotent deduplication
 */
export declare function createIncidents(params: {
    incidents: Array<{
        kind: string;
        severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
        details: Record<string, any>;
        section: string;
    }>;
}): Promise<{
    incidentsCreated: string[];
    duplicatesSkipped: string[];
    totalProcessed: number;
}>;
/**
 * Push health data to Command Center via API
 */
export declare function pushToCommandCenter(params: {
    healthData: HealthSection[];
    timestamp: string;
    executionMetrics: {
        totalSections: number;
        healthySections: number;
        degradedSections: number;
        criticalSections: number;
        totalIncidents: number;
    };
}): Promise<{
    pushed: boolean;
    endpoint: string;
    responseTime: number;
}>;
/**
 * Send health monitoring alerts via Discord/notification system
 */
export declare function sendHealthAlert(params: {
    alertType: 'health_check_complete' | 'critical_incidents' | 'system_degraded' | 'health_check_failed';
    message: string;
    details: object;
    priority: 'low' | 'medium' | 'high' | 'critical';
}): Promise<void>;
//# sourceMappingURL=healthActivities.d.ts.map