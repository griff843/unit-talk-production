/**
 * Performance Monitor for Syndicate-Grade Testing
 *
 * Provides comprehensive performance monitoring capabilities:
 * - Real-time metrics collection and analysis
 * - Performance baseline establishment
 * - Threshold monitoring and alerting
 * - Resource utilization tracking
 * - Performance regression detection
 * - Detailed performance reporting
 */
import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    timestamp: number;
    cpu: {
        usage: number;
        user: number;
        system: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    };
    eventLoop: {
        lag: number;
        utilization: number;
    };
    gc: {
        count: number;
        duration: number;
        type: string;
    }[];
    network: {
        requestCount: number;
        responseTime: number;
        errorRate: number;
    };
    database: {
        queryCount: number;
        queryTime: number;
        connectionCount: number;
    };
    custom: Record<string, any>;
}
export interface PerformanceThresholds {
    maxCPUUsage: number;
    maxMemoryUsage: number;
    maxEventLoopLag: number;
    maxGCDuration: number;
    maxResponseTime: number;
    maxErrorRate: number;
    maxDatabaseQueryTime: number;
}
export interface PerformanceBaseline {
    cpu: number;
    memory: number;
    eventLoopLag: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
}
export declare class PerformanceMonitor extends EventEmitter {
    private isMonitoring;
    private monitoringInterval?;
    private performanceObserver?;
    private metrics;
    private thresholds;
    private baseline?;
    private gcMetrics;
    private networkMetrics;
    private databaseMetrics;
    private customMetrics;
    constructor(thresholds?: Partial<PerformanceThresholds>);
    /**
     * Start performance monitoring
     */
    start(intervalMs?: number): void;
    /**
     * Stop performance monitoring
     */
    stop(): void;
    /**
     * Establish performance baseline
     */
    establishBaseline(durationMs?: number): Promise<PerformanceBaseline>;
    /**
     * Collect current performance metrics
     */
    private collectMetrics;
    /**
     * Collect a snapshot of current metrics
     */
    private collectMetricsSnapshot;
    /**
     * Check if metrics exceed thresholds
     */
    private checkThresholds;
    /**
     * Get performance summary
     */
    getPerformanceSummary(): any;
    /**
     * Get detailed performance report
     */
    generatePerformanceReport(): any;
    /**
     * Add custom metric
     */
    addCustomMetric(name: string, value: any): void;
    /**
     * Record network operation
     */
    recordNetworkOperation(responseTime: number, success: boolean): void;
    /**
     * Record database operation
     */
    recordDatabaseOperation(queryTime: number, success: boolean): void;
    /**
     * Clear collected metrics
     */
    clearMetrics(): void;
    private setupPerformanceObserver;
    private calculateCPUUsage;
    private measureEventLoopLag;
    private calculateEventLoopUtilization;
    private getRecentGCMetrics;
    private getNetworkMetrics;
    private getDatabaseMetrics;
    private getCustomMetrics;
    private calculateAverage;
    private generateRecommendations;
}
export default PerformanceMonitor;
//# sourceMappingURL=performance-monitor.d.ts.map