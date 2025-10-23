/**
 * Health Monitoring System
 * Real-time system health checks and monitoring
 */
interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: HealthCheck[];
    uptime: number;
    version: string;
}
interface HealthCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    responseTime: number;
    message?: string;
    details?: any;
}
export declare class HealthMonitor {
    private static instance;
    private startTime;
    private checks;
    constructor();
    static getInstance(): HealthMonitor;
    private registerDefaultChecks;
    performHealthCheck(): Promise<HealthStatus>;
    registerCustomCheck(name: string, checkFn: () => Promise<HealthCheck>): void;
    startPeriodicChecks(intervalMs?: number): Promise<void>;
}
export declare class PerformanceMonitor {
    private static metrics;
    static recordMetric(name: string, value: number): void;
    static getMetricStats(name: string): {
        avg: number;
        min: number;
        max: number;
        count: number;
    } | null;
    static getAllMetrics(): Record<string, any>;
    static clearMetrics(): void;
}
export declare const performanceMiddleware: (req: any, res: any, next: any) => void;
export declare class ErrorTracker {
    private static errors;
    static trackError(error: any, context?: any): void;
    static getRecentErrors(limit?: number): Array<any>;
    static getErrorStats(): {
        total: number;
        recent: number;
    };
    static clearErrors(): void;
}
declare const _default: {
    HealthMonitor: typeof HealthMonitor;
    PerformanceMonitor: typeof PerformanceMonitor;
    ErrorTracker: typeof ErrorTracker;
    performanceMiddleware: (req: any, res: any, next: any) => void;
};
export default _default;
//# sourceMappingURL=health.d.ts.map