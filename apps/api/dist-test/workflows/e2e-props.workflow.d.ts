interface WorkflowSummary {
    cycleCount: number;
    leagues: string[];
    totalPropsIngested: number;
    totalPropsScored: number;
    totalPropsPromoted: number;
    uspResults: any[];
    errors: string[];
    duration: number;
}
/**
 * MAIN E2E PROP PROCESSING WORKFLOW
 * Handles the complete prop lifecycle from ingestion to alerts
 */
export declare function e2ePropsWorkflow(params: {
    leagues: string[];
    cycleCount: number;
    isLiveMode: boolean;
}): Promise<{
    success: boolean;
    summary: WorkflowSummary;
}>;
/**
 * LIVE GAME MONITORING WORKFLOW
 * Monitors for live games and triggers appropriate responses
 */
export declare function liveGameMonitoringWorkflow(params: {
    leagues: string[];
    cycleCount: number;
}): Promise<{
    success: boolean;
    liveGames: any[];
}>;
/**
 * API QUOTA MONITORING WORKFLOW
 * Monitors API usage and triggers fallbacks when needed
 */
export declare function apiQuotaMonitoringWorkflow(params: {
    providers: string[];
    cycleCount: number;
}): Promise<{
    success: boolean;
    quotaStatus: any[];
}>;
export {};
//# sourceMappingURL=e2e-props.workflow.d.ts.map