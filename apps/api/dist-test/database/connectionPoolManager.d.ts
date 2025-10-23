/**
 * Advanced Connection Pool Manager
 * Optimizes database connections for high-performance production workloads
 * Implements dynamic scaling, health monitoring, and performance optimization
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface ConnectionPoolConfig {
    minConnections: number;
    maxConnections: number;
    acquireTimeoutMs: number;
    idleTimeoutMs: number;
    healthCheckIntervalMs: number;
    maxRetries: number;
    retryDelayMs: number;
    enableMetrics: boolean;
    enableAutoScaling: boolean;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
}
export interface ConnectionMetrics {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTimeMs: number;
    peakConnections: number;
    lastHealthCheck: string;
}
export declare class ConnectionPoolManager {
    private config;
    private connections;
    private waitingQueue;
    private metrics;
    private healthCheckTimer?;
    private metricsTimer?;
    private isShuttingDown;
    constructor(config?: Partial<ConnectionPoolConfig>);
    /**
     * Initialize the connection pool
     */
    private initialize;
    /**
     * Acquire a connection from the pool
     */
    acquireConnection(): Promise<SupabaseClient>;
    /**
     * Release a connection back to the pool
     */
    releaseConnection(client: SupabaseClient): void;
    /**
     * Create a new connection
     */
    private createConnection;
    /**
     * Find available connection
     */
    private findAvailableConnection;
    /**
     * Find connection by client
     */
    private findConnectionByClient;
    /**
     * Wait for available connection
     */
    private waitForConnection;
    /**
     * Update connection metrics
     */
    private updateMetrics;
    /**
     * Perform auto-scaling based on usage patterns
     */
    private performAutoScaling;
    /**
     * Scale down idle connections
     */
    private scaleDownConnections;
    /**
     * Update average response time
     */
    private updateAvgResponseTime;
    /**
     * Start health monitoring
     */
    private startHealthMonitoring;
    /**
     * Perform health check on all connections
     */
    private performHealthCheck;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Log current metrics
     */
    private logMetrics;
    /**
     * Get current metrics
     */
    getMetrics(): ConnectionMetrics;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare function initializeConnectionPool(config?: Partial<ConnectionPoolConfig>): ConnectionPoolManager;
export declare function getConnectionPool(): ConnectionPoolManager | null;
//# sourceMappingURL=connectionPoolManager.d.ts.map