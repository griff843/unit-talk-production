/**
 * Professional Features Monitoring Dashboard
 * Real-time monitoring and analytics for all 8 professional features
 *
 * Provides comprehensive monitoring, alerting, and performance tracking
 * for the syndicate-level betting intelligence system.
 */
import { EventEmitter } from 'events';
export interface DashboardMetrics {
    systemHealth: {
        status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
        lastUpdate: string;
        uptime: number;
        operationalFeatures: number;
        totalFeatures: number;
    };
    features: {
        steamDetection: FeatureMetrics;
        closingLinePrediction: FeatureMetrics;
        optimalTiming: FeatureMetrics;
        lineShopping: FeatureMetrics;
        publicSharpSplit: FeatureMetrics;
        marketTiming: FeatureMetrics;
        injuryTiming: FeatureMetrics;
        crossMarketDiscrepancy: FeatureMetrics;
    };
    performance: {
        totalProcessed: number;
        avgProcessingTime: number;
        throughputPerMinute: number;
        errorRate: number;
        successRate: number;
        memoryUsage: number;
        cpuUsage: number;
    };
    clvMetrics: {
        avgCLV: number;
        positiveRate: number;
        totalBets: number;
        profitability: number;
        sharpeRatio: number;
        maxDrawdown: number;
        targetMet: boolean;
    };
    compliance: {
        overallCompliance: number;
        deviggingCompliance: number;
        clvTrackingCompliance: number;
        professionalGradingCompliance: number;
        kellyCriterionCompliance: number;
        rulesViolations: string[];
    };
    alerts: Alert[];
    timestamp: string;
}
export interface FeatureMetrics {
    name: string;
    enabled: boolean;
    operational: boolean;
    processed: number;
    successRate: number;
    avgProcessingTime: number;
    accuracy: number;
    confidence: number;
    lastError?: string;
    lastSuccess: string;
    health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}
export interface Alert {
    id: string;
    type: 'ERROR' | 'WARNING' | 'INFO';
    feature: string;
    message: string;
    timestamp: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    acknowledged: boolean;
    resolvedAt?: string;
}
export interface DashboardConfig {
    updateInterval: number;
    alertRetentionTime: number;
    metricsRetentionDays: number;
    alerting: {
        errorRateThreshold: number;
        processingTimeThreshold: number;
        clvThreshold: number;
        complianceThreshold: number;
    };
    notifications: {
        enabled: boolean;
        webhookUrl?: string;
        slackChannel?: string;
        emailRecipients: string[];
    };
}
export declare class ProfessionalFeaturesDashboard extends EventEmitter {
    private logger;
    private config;
    private metrics;
    private alerts;
    private metricsHistory;
    private startTime;
    private updateTimer?;
    constructor(config?: Partial<DashboardConfig>);
    /**
     * Initialize metrics structure
     */
    private initializeMetrics;
    /**
     * Create feature metrics template
     */
    private createFeatureMetrics;
    /**
     * Start monitoring with periodic updates
     */
    private startMonitoring;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Update all metrics
     */
    private updateMetrics;
    /**
     * Update system health metrics
     */
    private updateSystemHealth;
    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics;
    /**
     * Update CLV metrics
     */
    private updateCLVMetrics;
    /**
     * Update compliance metrics
     */
    private updateComplianceMetrics;
    /**
     * Check for alerts and create them
     */
    private checkAlerts;
    /**
     * Create a new alert
     */
    private createAlert;
    /**
     * Send notification for alert
     */
    private sendNotification;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): boolean;
    /**
     * Clean up old alerts
     */
    private cleanupOldAlerts;
    /**
     * Store metrics history
     */
    private storeMetricsHistory;
    /**
     * Update feature metrics
     */
    updateFeatureMetrics(featureName: keyof typeof this.metrics.features, update: Partial<FeatureMetrics>): void;
    /**
     * Record feature processing
     */
    recordProcessing(featureName: keyof typeof this.metrics.features, processingTime: number, success: boolean, confidence?: number): void;
    /**
     * Get current metrics
     */
    getMetrics(): DashboardMetrics;
    /**
     * Get metrics history
     */
    getMetricsHistory(hours?: number): DashboardMetrics[];
    /**
     * Get system status summary
     */
    getSystemStatus(): {
        status: string;
        uptime: string;
        performance: string;
        clv: string;
        compliance: string;
        alerts: number;
    };
    /**
     * Export metrics for external systems
     */
    exportMetrics(format?: 'json' | 'prometheus'): string;
    /**
     * Convert metrics to Prometheus format
     */
    private toPrometheusFormat;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<DashboardConfig>): void;
}
//# sourceMappingURL=ProfessionalFeaturesDashboard.d.ts.map