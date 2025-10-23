/**
 * =============================================================================
 * SLO MONITORING SERVICE - Fortune 100 Grade Implementation
 * =============================================================================
 *
 * Comprehensive Service Level Objective (SLO) monitoring system that provides:
 * - Real-time SLO tracking and violation detection
 * - Error budget management with burn rate calculations
 * - Automated incident creation on SLO violations
 * - Historical SLO performance analytics
 * - Integration with external alerting systems
 *
 * Key Features:
 * - Sub-second alert latency monitoring (P99 < 1s)
 * - Rescore freshness tracking (< 5 min staleness)
 * - Missed tick rate monitoring (< 0.1% daily)
 * - Archive lag detection (< 24h unarchived)
 * - Feature store freshness (< 1h computation lag)
 * - Grading throughput monitoring (≥ 1000 props/min peak)
 * - System availability tracking (≥ 99.9% monthly)
 * - Data pipeline health monitoring (≥ 99.8% success)
 */
import { EventEmitter } from 'events';
interface SLOMetrics {
    alert_latency_p99: number;
    rescore_freshness_minutes: number;
    missed_tick_rate: number;
    archiver_lag_hours: number;
    feature_store_lag_minutes: number;
    grading_throughput_per_minute: number;
    system_availability_percentage: number;
    data_pipeline_success_rate: number;
}
interface ErrorBudget {
    slo_name: string;
    budget_remaining: number;
    burn_rate: number;
    time_to_exhaustion_hours: number;
    alert_threshold_breached: boolean;
}
export declare class SLOMonitoringService extends EventEmitter {
    private logger;
    private metrics;
    private isRunning;
    private monitoringInterval?;
    private sloDefinitions;
    private readonly CRITICAL_SLOS;
    constructor();
    /**
     * Start SLO monitoring service
     */
    start(): Promise<void>;
    /**
     * Stop SLO monitoring service
     */
    stop(): Promise<void>;
    /**
     * Load SLO definitions from database
     */
    private loadSLODefinitions;
    /**
     * Initialize critical SLOs required for production
     */
    private initializeCriticalSLOs;
    /**
     * Ensure SLO definition exists in database
     */
    private ensureSLODefinition;
    /**
     * Start periodic SLO monitoring
     */
    private startPeriodicMonitoring;
    /**
     * Evaluate all active SLOs
     */
    evaluateAllSLOs(): Promise<void>;
    /**
     * Evaluate a single SLO
     */
    private evaluateSLO;
    /**
     * Determine if threshold is breached
     */
    private isThresholdBreached;
    /**
     * Determine breach severity
     */
    private determineBreachSeverity;
    /**
     * Calculate error budget metrics
     */
    private calculateErrorBudget;
    /**
     * Record SLO measurement in database
     */
    private recordMeasurement;
    /**
     * Handle SLO violation - create incident and send alerts
     */
    private handleSLOViolation;
    /**
     * Get current SLO metrics for dashboard
     */
    getCurrentSLOMetrics(): Promise<SLOMetrics>;
    /**
     * Get error budget status for all SLOs
     */
    getErrorBudgets(): Promise<ErrorBudget[]>;
    /**
     * Get SLO violation history
     */
    getSLOViolationHistory(hours?: number): Promise<any[]>;
    /**
     * Get service health status
     */
    isHealthy(): boolean;
    /**
     * Get comprehensive service status
     */
    getStatus(): any;
}
export default SLOMonitoringService;
//# sourceMappingURL=SLOMonitoringService.d.ts.map