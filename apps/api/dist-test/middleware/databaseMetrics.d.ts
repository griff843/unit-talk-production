/**
 * Enhanced Supabase client with metrics and observability
 */
export declare class MetricsEnabledSupabaseClient {
    private client;
    private connectionPool;
    constructor(supabaseUrl: string, supabaseKey: string);
    /**
     * Execute query with comprehensive metrics tracking
     */
    from(table: string): Promise<any>;
    /**
     * Create metrics proxy for query operations
     */
    private createMetricsProxy;
    /**
     * Start connection pool monitoring
     */
    private startConnectionPoolMonitoring;
    /**
     * Sanitize query for logging (remove sensitive data)
     */
    private sanitizeQuery;
    /**
     * Get raw Supabase client for operations that don't need metrics
     */
    getRawClient(): import("@supabase/supabase-js").SupabaseClient<unknown, never, import("@supabase/supabase-js/dist/module/lib/types").GenericSchema>;
}
/**
 * External API performance tracking wrapper
 */
export declare class ExternalAPIMetrics {
    private static instance;
    static getInstance(): ExternalAPIMetrics;
    /**
     * Track external API call with comprehensive metrics
     */
    trackAPICall<T>(provider: string, endpoint: string, operation: () => Promise<T>, context?: Record<string, any>): Promise<T>;
    /**
     * Track multiple API calls with batch metrics
     */
    trackBatchAPICall<T>(provider: string, calls: Array<{
        endpoint: string;
        operation: () => Promise<T>;
        context?: Record<string, any>;
    }>): Promise<T[]>;
    /**
     * Classify error type for metrics
     */
    private classifyError;
    /**
     * Extract HTTP status code from error
     */
    private extractStatusCode;
}
/**
 * Create metrics-enabled Supabase client
 */
export declare function createMetricsEnabledSupabaseClient(supabaseUrl: string, supabaseKey: string): MetricsEnabledSupabaseClient;
//# sourceMappingURL=databaseMetrics.d.ts.map