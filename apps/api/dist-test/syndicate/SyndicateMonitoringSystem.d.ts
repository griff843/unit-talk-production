/**
 * Syndicate-Level Enterprise Monitoring System
 * Phase 10: Comprehensive 24/7 Monitoring with SLO Tracking
 *
 * Provides Fortune 100-grade monitoring for syndicate betting operations
 * Tracks 30+ KPIs with automated incident response and escalation
 * Maintains 99.9% uptime during market hours
 */
import { EventEmitter } from 'events';
export declare class SyndicateMonitoringSystem extends EventEmitter {
    private redis;
    private dbPool;
    private metrics;
    private alerts;
    private incidents;
    private sloTargets;
    private emailClient;
    private monitoringInterval;
    private readonly ESCALATION_TIMES;
    constructor();
    private initializeMonitoring;
    private initializePrometheusMetrics;
    private initializeEmailClient;
    /**
     * Start continuous 24/7 monitoring of all syndicate operations
     */
    private startContinuousMonitoring;
    /**
     * Collect comprehensive metrics from all system components
     */
    private collectAndEvaluateMetrics;
    private collectBusinessMetrics;
    private collectSystemHealthMetrics;
    private collectRiskMetrics;
    /**
     * Evaluate all metrics against SLO targets and create alerts
     */
    private evaluateMetricThresholds;
    /**
     * Create and manage alerts with automatic escalation
     */
    private createAlert;
    /**
     * Create incident with automatic assignment and escalation
     */
    private createIncident;
    /**
     * Check for incident escalation based on time and severity
     */
    private checkIncidentEscalation;
    private escalateIncident;
    /**
     * SLO Evaluation and Error Budget Tracking
     */
    private evaluateSLOs;
    private calculateSLOCompliance;
    /**
     * Generate comprehensive performance reports
     */
    private generateWeeklyReport;
    private checkDatabaseHealth;
    private checkRedisHealth;
    private checkAPIHealth;
    private checkWorkerHealth;
    private measureAPILatency;
    private checkDataFreshness;
    private calculateErrorRate;
    private getAllCurrentMetrics;
    private sendImmediateNotification;
    private sendDiscordAlert;
    private sendEmailAlert;
    private sendPagerDutyAlert;
    private assignIncident;
    private persistIncident;
    private notifyEscalationTarget;
    private generatePerformanceReport;
    private sendWeeklyReport;
    private updateBusinessMetrics;
    private updateSystemHealthMetrics;
    private updateRiskMetrics;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare const syndicateMonitoring: SyndicateMonitoringSystem;
//# sourceMappingURL=SyndicateMonitoringSystem.d.ts.map