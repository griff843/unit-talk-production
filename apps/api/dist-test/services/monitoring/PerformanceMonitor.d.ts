/**
 * Performance Monitoring Functions
 * Real-time system health and performance tracking
 */
export declare class PerformanceMonitor {
    private static instance;
    private metricsInterval;
    private constructor();
    static getInstance(): PerformanceMonitor;
    startMonitoring(intervalMinutes?: number): void;
    stopMonitoring(): void;
    private collectAndStoreMetrics;
    private checkAlertThresholds;
    getDashboardData(hours?: number): Promise<{
        metrics: any[] | null;
        alerts: any[] | null;
    }>;
}
export declare const performanceMonitor: PerformanceMonitor;
//# sourceMappingURL=PerformanceMonitor.d.ts.map