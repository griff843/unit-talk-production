import { Counter, Histogram, Gauge } from 'prom-client';
/**
 * PrometheusMetrics - Exposes recap metrics for monitoring
 * Provides comprehensive metrics for production monitoring
 */
export declare class PrometheusMetrics {
    private server?;
    private port;
    private recapsSentCounter;
    private recapsFailedCounter;
    private microRecapsCounter;
    private slashCommandsCounter;
    private notionSyncsCounter;
    private processingTimeHistogram;
    private activeRecapsGauge;
    private roiWatcherGauge;
    constructor(port?: number);
    /**
     * Initialize metrics server
     */
    initialize(): Promise<void>;
    /**
     * Increment recaps sent counter
     */
    incrementRecapsSent(period: string, type?: string): void;
    /**
     * Increment recaps failed counter
     */
    incrementRecapsFailed(period?: string, errorType?: string): void;
    /**
     * Increment micro-recaps counter
     */
    incrementMicroRecaps(trigger?: string): void;
    /**
     * Increment slash commands counter
     */
    incrementSlashCommands(command?: string, period?: string): void;
    /**
     * Increment Notion syncs counter
     */
    incrementNotionSyncs(period: string, status?: string): void;
    /**
     * Record processing time
     */
    recordProcessingTime(durationMs: number, period?: string, operation?: string): void;
    /**
     * Set active recaps gauge
     */
    setActiveRecaps(count: number, period: string): void;
    /**
     * Update ROI watcher state
     */
    updateRoiWatcherState(currentRoi: number, threshold: number, lastCheck: Date): void;
    /**
     * Get current metrics as JSON
     */
    getMetrics(): Promise<any>;
    /**
     * Reset all metrics (useful for testing)
     */
    resetMetrics(): void;
    /**
     * Get metrics summary for health checks
     */
    getMetricsSummary(): Promise<any>;
    /**
     * Helper to extract metric values
     */
    private getMetricValue;
    /**
     * Create custom metric
     */
    createCustomCounter(name: string, help: string, labelNames?: string[]): Counter<string>;
    /**
     * Create custom histogram
     */
    createCustomHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): Histogram<string>;
    /**
     * Create custom gauge
     */
    createCustomGauge(name: string, help: string, labelNames?: string[]): Gauge<string>;
    /**
     * Export metrics for external monitoring
     */
    exportMetrics(): Promise<string>;
    /**
     * Get server status
     */
    getServerStatus(): any;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=prometheusMetrics.d.ts.map