export interface SystemHealthResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: Array<{
        name: string;
        status: 'passed' | 'failed';
        error?: string;
    }>;
    metrics: Record<string, number>;
}
export interface LiveGameUpdate {
    gameId: string;
    league: string;
    status: 'live' | 'completed' | 'scheduled';
    timestamp: string;
}
export interface QuotaStatus {
    provider: string;
    used: number;
    limit: number;
    resetTime: string;
    percentage: number;
}
export interface LiveGameMonitorResult {
    totalGames: number;
    liveGames: number;
    leagues: string[];
    status: 'active' | 'inactive';
    timestamp: string;
}
/**
 * SYNDICATE SCHEDULER WORKFLOW
 * Main data ingestion and processing workflow (1 minute intervals)
 */
export declare function syndicateSchedulerWorkflow(): Promise<void>;
/**
 * LIVE GAME DETECTOR WORKFLOW
 * Continuously monitors for live games and adjusts system mode
 */
export declare function liveGameDetectorWorkflow(): Promise<void>;
/**
 * QUOTA MONITORING WORKFLOW
 * Monitors API quotas and activates fallbacks
 */
export declare function quotaMonitoringWorkflow(): Promise<void>;
/**
 * HEALTH MONITORING WORKFLOW
 * System health and performance monitoring
 */
export declare function healthMonitoringWorkflow(): Promise<void>;
/**
 * LEAGUE SCHEDULE WORKFLOW
 * Generic league-specific scheduling and peak hours management
 */
export declare function createLeagueScheduleWorkflow(league: string): Promise<() => Promise<void>>;
export declare function nflScheduleWorkflow(): Promise<void>;
export declare function nbaScheduleWorkflow(): Promise<void>;
export declare function mlbScheduleWorkflow(): Promise<void>;
export declare function nhlScheduleWorkflow(): Promise<void>;
export declare function ncaafScheduleWorkflow(): Promise<void>;
export declare function ncaabScheduleWorkflow(): Promise<void>;
export declare function wnbaScheduleWorkflow(): Promise<void>;
//# sourceMappingURL=support-workflows.d.ts.map