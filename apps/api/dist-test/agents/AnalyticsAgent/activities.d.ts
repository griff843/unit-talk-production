export interface ActivityParams {
    [key: string]: any;
}
export interface ActivityResult {
    success: boolean;
    data?: any;
    error?: string;
}
/**
 * AnalyticsAgentActivitiesImpl provides activity-oriented methods for the AnalyticsAgent
 * This class serves as an intermediary to interact with the AnalyticsAgent instance
 */
export declare class AnalyticsAgentActivitiesImpl {
    private agent;
    constructor(config: any, deps: any);
    /**
     * Initialize the analytics agent
     */
    initialize(): Promise<void>;
    /**
     * Cleanup the analytics agent
     */
    cleanup(): Promise<void>;
    /**
     * Check the health of the analytics agent
     */
    checkHealth(): Promise<any>;
    /**
     * Collect metrics from the analytics agent
     */
    collectMetrics(): Promise<any>;
    /**
     * Handle a command for the analytics agent
     */
    handleCommand(command: any): Promise<ActivityResult>;
    /**
     * Run analysis activity
     */
    runAnalysis(_params: ActivityParams): Promise<ActivityResult>;
    /**
     * Generate report activity (placeholder implementation)
     */
    generateReport(_params: ActivityParams): Promise<ActivityResult>;
    /**
     * Export data activity (placeholder implementation)
     */
    exportData(_params: ActivityParams): Promise<ActivityResult>;
}
//# sourceMappingURL=activities.d.ts.map