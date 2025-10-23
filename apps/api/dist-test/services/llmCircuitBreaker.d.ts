interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    dailyTokenQuota: number;
    maxConcurrentRequests: number;
    timeoutMs: number;
}
interface CircuitBreakerMetrics {
    failures: number;
    lastFailure: number;
    dailyTokens: number;
    lastReset: number;
    concurrentRequests: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
}
interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    metrics: CircuitBreakerMetrics;
    config: CircuitBreakerConfig;
    lastStateChange: number;
}
export declare class LLMCircuitBreaker {
    private static instance;
    private state;
    private requestQueue;
    private processingQueue;
    private constructor();
    static getInstance(config?: Partial<CircuitBreakerConfig>): LLMCircuitBreaker;
    getState(): CircuitBreakerState;
    executeRequest<T>(request: () => Promise<T>, tokenEstimate: number, fallback?: () => Promise<T>): Promise<T>;
    private queueRequest;
    private processQueue;
    private handleFailure;
    private openCircuit;
    private closeCircuit;
    private handleOpenCircuit;
    private handleQuotaExceeded;
    private resetDailyTokens;
}
export {};
//# sourceMappingURL=llmCircuitBreaker.d.ts.map