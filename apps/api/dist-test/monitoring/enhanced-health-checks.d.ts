export interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    error?: string;
    metadata?: Record<string, any>;
    critical: boolean;
    lastCheck: string;
}
export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    checks: HealthCheck[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        critical_failures: number;
    };
    performance: {
        memory_usage_mb: number;
        cpu_usage_percent?: number;
        response_time_avg_ms: number;
    };
}
export interface DependencyConfig {
    name: string;
    critical: boolean;
    timeout: number;
    checkInterval: number;
    healthCheckFn: () => Promise<{
        healthy: boolean;
        responseTime?: number;
        error?: string;
        metadata?: Record<string, any>;
    }>;
}
/**
 * Enhanced health check system with dependency validation,
 * circuit breaker integration, and comprehensive monitoring
 */
export declare class EnhancedHealthChecker {
    private dependencies;
    private lastResults;
    private checkIntervals;
    private systemStartTime;
    constructor();
    /**
     * Register core system dependencies
     */
    private registerCoreDependencies;
    /**
     * Register a new dependency for health checking
     */
    registerDependency(config: DependencyConfig): void;
    /**
     * Check health of a specific dependency
     */
    checkDependency(name: string): Promise<HealthCheck | null>;
    /**
     * Get comprehensive system health status
     */
    getSystemHealth(): Promise<SystemHealth>;
    /**
     * Get health status for a specific dependency
     */
    getDependencyHealth(name: string): HealthCheck | null;
    /**
     * Start periodic health checks for all dependencies
     */
    private startPeriodicChecks;
    /**
     * Stop all periodic health checks
     */
    stopPeriodicChecks(): void;
    /**
     * Get health check summary for logging/monitoring
     */
    getHealthSummary(): {
        status: string;
        healthy_dependencies: string[];
        unhealthy_dependencies: string[];
        critical_issues: string[];
    };
    /**
     * Reset health status for a specific dependency
     */
    resetDependency(name: string): void;
    /**
     * Update dependency configuration
     */
    updateDependencyConfig(name: string, updates: Partial<DependencyConfig>): void;
}
export declare const healthChecker: EnhancedHealthChecker;
export declare const healthCheckMiddleware: (req: any, res: any, next: any) => Promise<void>;
export declare const handleHealthCheck: (_req: any, res: any) => Promise<void>;
//# sourceMappingURL=enhanced-health-checks.d.ts.map