/**
 * Graceful Shutdown Manager
 * Ensures clean shutdown of all services, connections, and resources
 * Prevents data corruption during deployments and restarts
 */
export interface ShutdownHandler {
    name: string;
    handler: () => Promise<void>;
    timeout: number;
    priority: number;
}
export interface ShutdownConfig {
    gracePeriodMs: number;
    forceExitTimeoutMs: number;
    enableHealthCheckDuringShutdown: boolean;
}
export declare class GracefulShutdownManager {
    private handlers;
    private isShuttingDown;
    private shutdownStartTime;
    private config;
    constructor(config?: Partial<ShutdownConfig>);
    /**
     * Register a shutdown handler
     */
    registerHandler(handler: ShutdownHandler): void;
    /**
     * Register multiple handlers at once
     */
    registerHandlers(handlers: ShutdownHandler[]): void;
    /**
     * Check if system is shutting down
     */
    isShutdownInProgress(): boolean;
    /**
     * Get shutdown progress information
     */
    getShutdownProgress(): {
        isShuttingDown: boolean;
        elapsedMs: number;
        remainingMs: number;
        handlersRemaining: number;
    };
    /**
     * Setup signal handlers for graceful shutdown
     */
    private setupSignalHandlers;
    /**
     * Initiate graceful shutdown
     */
    private initiateShutdown;
    /**
     * Execute all shutdown handlers
     */
    private executeShutdownHandlers;
    /**
     * Create standard shutdown handlers for common services
     */
    static createStandardHandlers(): ShutdownHandler[];
    /**
     * Health check endpoint for load balancers during shutdown
     */
    getHealthStatus(): {
        status: 'healthy' | 'shutting_down' | 'unhealthy';
        shutdownProgress?: ReturnType<GracefulShutdownManager['getShutdownProgress']>;
    };
}
export declare function initializeGracefulShutdown(config?: Partial<ShutdownConfig>): GracefulShutdownManager;
export declare function getGracefulShutdown(): GracefulShutdownManager | null;
//# sourceMappingURL=gracefulShutdown.d.ts.map