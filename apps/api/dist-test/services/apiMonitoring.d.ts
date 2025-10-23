export interface ApiHealthStatus {
    provider: string;
    status: 'healthy' | 'degraded' | 'failed' | 'expired';
    lastSuccess: Date | null;
    lastFailure: Date | null;
    errorMessage?: string;
    httpStatus?: number;
    responseTime?: number;
    consecutiveFailures: number;
    dataFreshness?: {
        lastUpdate: Date;
        expectedUpdateInterval: number;
        isStale: boolean;
    };
}
export interface DataIngestionAlert {
    id: string;
    alertType: 'api_key_expired' | 'connection_failed' | 'data_stale' | 'quota_exceeded' | 'provider_down';
    provider: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: Record<string, any>;
    triggeredAt: Date;
    resolved: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
}
declare class ApiMonitoringService {
    private logger;
    private alertThresholds;
    private providerConfigs;
    constructor();
    /**
     * Monitor API health and detect issues
     */
    checkApiHealth(provider: string, apiKey?: string): Promise<ApiHealthStatus>;
    /**
     * Test API connection with proper error detection
     */
    private testApiConnection;
    /**
     * Check data freshness based on last ingestion
     */
    private checkDataFreshness;
    /**
     * Trigger alert and store in database
     */
    private triggerAlert;
    /**
     * Send real-time notification to Command Center
     */
    private sendCommandCenterNotification;
    /**
     * Update health metrics in database
     */
    private updateHealthMetrics;
    /**
     * Get latest health status from database
     */
    private getLatestHealthStatus;
    /**
     * Monitor all configured APIs
     */
    monitorAllApis(): Promise<Record<string, ApiHealthStatus>>;
    /**
     * Get active alerts for Command Center dashboard
     */
    getActiveAlerts(): Promise<DataIngestionAlert[]>;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
    /**
     * Resolve alert
     */
    resolveAlert(alertId: string, resolvedBy: string): Promise<void>;
}
export declare const apiMonitoringService: ApiMonitoringService;
export {};
//# sourceMappingURL=apiMonitoring.d.ts.map