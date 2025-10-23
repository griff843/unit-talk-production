interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
}
interface CircuitState {
    failures: number;
    lastFailure: number | null;
    isOpen: boolean;
}
export declare class CircuitBreaker {
    private states;
    private config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    private getOrCreateState;
    isOpen(activityName: string): boolean;
    recordSuccess(activityName: string): void;
    recordFailure(activityName: string): void;
    reset(activityName: string): void;
    getState(activityName: string): CircuitState;
}
export {};
//# sourceMappingURL=circuitBreaker.d.ts.map