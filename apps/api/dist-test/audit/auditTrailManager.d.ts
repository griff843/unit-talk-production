/**
 * Audit Trail Manager with Fallback Mechanisms
 * Ensures comprehensive audit logging with multiple fallback strategies
 * Production-ready compliance and security audit system
 */
export interface AuditEvent {
    id: string;
    timestamp: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    correlationId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security';
}
export interface AuditConfig {
    enableDatabase: boolean;
    enableFileSystem: boolean;
    enableRemoteLogging: boolean;
    fileSystemPath: string;
    maxRetries: number;
    retryDelayMs: number;
    batchSize: number;
    flushIntervalMs: number;
}
export declare class AuditTrailManager {
    private config;
    private supabase;
    private pendingEvents;
    private flushTimer?;
    private isShuttingDown;
    constructor(supabase: any, config?: Partial<AuditConfig>);
    /**
     * Log an audit event with multiple fallback mechanisms
     */
    logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<boolean>;
    /**
     * Log event with multiple fallback strategies
     */
    private logEventWithFallbacks;
    /**
     * Log to database with retry logic
     */
    private logToDatabase;
    /**
     * Log to file system (reliable fallback)
     */
    private logToFileSystem;
    /**
     * Log to remote service (if configured)
     */
    private logToRemoteService;
    /**
     * Emergency file logging when all else fails
     */
    private emergencyFileLogging;
    /**
     * Flush pending events in batches
     */
    private flushPendingEvents;
    /**
     * Start periodic flush timer
     */
    private startPeriodicFlush;
    /**
     * Graceful shutdown with final flush
     */
    private gracefulShutdown;
    /**
     * Generate unique event ID
     */
    private generateEventId;
    /**
     * Get date string for log file naming
     */
    private getDateString;
    /**
     * Delay utility for retry logic
     */
    private delay;
    /**
     * Get audit statistics
     */
    getAuditStatistics(): Promise<{
        pendingEvents: number;
        isHealthy: boolean;
        lastFlush: string;
    }>;
}
export declare function initializeAuditTrail(supabase: any, config?: Partial<AuditConfig>): AuditTrailManager;
export declare function getAuditTrail(): AuditTrailManager | null;
//# sourceMappingURL=auditTrailManager.d.ts.map