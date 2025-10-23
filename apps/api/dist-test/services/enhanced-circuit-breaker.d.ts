import { EventEmitter } from 'events';
export interface ServiceConfig {
    name: string;
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxRequests: number;
    timeoutMs: number;
    retryAttempts: number;
    backoffMultiplier: number;
    circuitBreakerEnabled: boolean;
}
export interface ServiceMetrics {
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    timeoutRequests: number;
    circuitBreakerTrips: number;
    averageResponseTime: number;
    recentErrors: Array<{
        timestamp: number;
        error: string;
        type: 'timeout' | 'error' | 'rejection';
    }>;
}
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface ServiceStatus {
    name: string;
    state: CircuitState;
    metrics: ServiceMetrics;
    config: ServiceConfig;
    lastStateChange: number;
    nextRetryTime?: number;
}
/**
 * Enhanced Circuit Breaker for external service calls
 * Features:
 * - Per-service circuit breaker state
 * - Configurable failure thresholds and timeouts
 * - Half-open state for gradual recovery
 * - Comprehensive metrics and monitoring
 * - Event emission for monitoring systems
 * - Retry logic with exponential backoff
 * - Health check integration
 */
export declare class EnhancedCircuitBreaker extends EventEmitter {
    private services;
    private defaultConfig;
    constructor(defaultConfig?: Partial<ServiceConfig>);
    /**
     * Register a service with custom configuration
     */
    registerService(serviceName: string, config?: Partial<ServiceConfig>): void;
    /**
     * Execute a service call with circuit breaker protection
     */
    executeCall<T>(serviceName: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    /**
     * Execute operation with retry logic and circuit breaker protection
     */
    private executeWithRetry;
    /**
     * Check if a service call should be blocked
     */
    private shouldBlockCall;
    /**
     * Record successful operation
     */
    private recordSuccess;
    /**
     * Record failed operation
     */
    private recordFailure;
    /**
     * Check if circuit should be opened
     */
    private shouldOpenCircuit;
    /**
     * Open the circuit breaker
     */
    private openCircuit;
    /**
     * Transition to half-open state
     */
    private halfOpenCircuit;
    /**
     * Close the circuit breaker
     */
    private closeCircuit;
    /**
     * Get or create service status
     */
    private getOrCreateService;
    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay;
    /**
     * Get count of recent failures (last 5 minutes)
     */
    private getRecentFailureCount;
    /**
     * Get count of recent requests (estimated)
     */
    private getRecentRequestCount;
    /**
     * Clean up old error records
     */
    private cleanupOldErrors;
    /**
     * Get status of all services
     */
    getAllServiceStatus(): ServiceStatus[];
    /**
     * Get status of specific service
     */
    getServiceStatus(serviceName: string): ServiceStatus | null;
    /**
     * Reset service circuit breaker
     */
    resetService(serviceName: string): void;
    /**
     * Health check for circuit breaker system
     */
    getHealthStatus(): {
        healthy: boolean;
        services: Array<{
            name: string;
            state: CircuitState;
            healthy: boolean;
            failureRate: number;
        }>;
    };
}
export declare const circuitBreaker: EnhancedCircuitBreaker;
export declare const withCircuitBreaker: {
    openai: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) => Promise<T>;
    discord: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) => Promise<T>;
    supabase: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) => Promise<T>;
    redis: <T>(operation: () => Promise<T>, fallback?: () => Promise<T>) => Promise<T>;
};
export declare function CircuitBreakerProtected(serviceName: string): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => void;
//# sourceMappingURL=enhanced-circuit-breaker.d.ts.map