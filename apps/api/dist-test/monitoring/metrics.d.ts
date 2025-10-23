export interface MetricsConfig {
    port: number;
    path: string;
    interval: number;
}
export declare class Metrics {
    private static instance;
    private readonly registry;
    private readonly logger;
    private readonly metrics;
    private readonly collectors;
    private server?;
    private readonly standardMetrics;
    private constructor();
    static getInstance(): Metrics;
    private initializeStandardMetrics;
    private initializeCustomMetrics;
    private registerMetric;
    initialize(): Promise<void>;
    private startServer;
    trackOperation(operation: string, status: 'success' | 'failure'): void;
    trackDuration(operation: string, durationMs: number): void;
    trackError(operation: string, errorType: string): void;
    setQueueSize(queueType: string, size: number): void;
    setResourceUsage(resourceType: string, value: number): void;
    setBusinessMetric(metricType: string, value: number): void;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=metrics.d.ts.map