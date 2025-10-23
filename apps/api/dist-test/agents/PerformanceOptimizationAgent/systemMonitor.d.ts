import { Logger } from '../../shared/logger/types';
interface SystemMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
        cores: number;
    };
    memory: {
        usage: number;
        total: number;
        free: number;
        used: number;
    };
    disk: {
        usage: number;
        total: number;
        free: number;
        used: number;
    };
    network: {
        latency: number;
        bytesIn: number;
        bytesOut: number;
    };
    database: {
        avgQueryTime: number;
        activeConnections: number;
        queryCount: number;
    };
    cache: {
        hitRate: number;
        memoryUsage: number;
        keyCount: number;
    };
    application: {
        errorRate: number;
        throughput: number;
        responseTime: number;
    };
}
interface HealthCheck {
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, number>;
    issues?: string[];
}
export declare class SystemMonitor {
    private readonly logger;
    private metricsHistory;
    private lastCollectionTime;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    collectMetrics(): Promise<SystemMetrics>;
    checkDatabaseHealth(): Promise<HealthCheck>;
    checkCacheHealth(): Promise<HealthCheck>;
    checkAgentHealth(): Promise<HealthCheck>;
    checkNetworkHealth(): Promise<HealthCheck>;
    checkStorageHealth(): Promise<HealthCheck>;
    private getCpuMetrics;
    private getMemoryMetrics;
    private getDiskMetrics;
    private getDiskUsage;
    private getNetworkMetrics;
    private getDatabaseMetrics;
    private getCacheMetrics;
    private getApplicationMetrics;
    private loadMetricsHistory;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=systemMonitor.d.ts.map