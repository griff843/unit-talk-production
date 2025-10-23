import { ActivityResult, ApiQuotaResult, MaintenanceResult } from '../shared/activity-results';
interface BaseParams {
    agentId: string;
    timestamp?: string;
}
export interface OperatorAgentActivities {
    updateLiveGameStatus(params: BaseParams & {
        liveGames: any[];
        totalCount: number;
        leaguesWithLiveGames: string[];
    }): Promise<ActivityResult>;
    ensureLiveMode(params: BaseParams & {
        reason: string;
        games: any[];
    }): Promise<ActivityResult>;
    ensureOffPeakMode(params: BaseParams & {
        reason: string;
    }): Promise<ActivityResult>;
    monitorAPIQuota(params: BaseParams & {
        provider: string;
        currentUsage: number;
        limit: number;
    }): Promise<ApiQuotaResult>;
    getHourlyApiUsage(params: BaseParams & {
        provider: string;
        hour: number;
    }): Promise<ActivityResult<number>>;
    activateFallbackMode(params: BaseParams & {
        primary: string;
        fallbacks: string[];
        reason: string;
    }): Promise<ActivityResult>;
    logQuotaStatus(params: BaseParams & {
        providers: Array<{
            name: string;
            hourlyLimit: number;
            hourlyUsed: number;
            remainingCalls: number;
            resetTime: string;
            status: 'healthy' | 'warning' | 'critical';
        }>;
    }): Promise<ActivityResult>;
    checkDatabaseHealth(): Promise<ActivityResult<any>>;
    checkApiEndpoints(params: BaseParams & {
        endpoints: string[];
    }): Promise<ActivityResult<any[]>>;
    getWorkflowMetrics(params: BaseParams & {
        timeWindow: number;
    }): Promise<ActivityResult<any>>;
    getSystemMetrics(): Promise<ActivityResult<any>>;
    logHealthStatus(params: BaseParams & {
        healthScore: number;
        dbHealth: any;
        apiHealth: any[];
        workflowMetrics: any;
        systemMetrics: any;
    }): Promise<ActivityResult>;
    checkLeagueSeason(params: BaseParams & {
        league: string;
        season: string;
        currentDate: string;
    }): Promise<ActivityResult<boolean>>;
    enablePeakMonitoring(params: BaseParams & {
        league: string;
        reason: string;
    }): Promise<ActivityResult>;
    enableStandardMonitoring(params: BaseParams & {
        league: string;
        reason: string;
    }): Promise<ActivityResult>;
    cleanupOldLogs(params: BaseParams & {
        retentionDays: number;
    }): Promise<MaintenanceResult>;
    cleanupOldMetrics(params: BaseParams & {
        retentionDays: number;
    }): Promise<MaintenanceResult>;
    cleanupOldRawProps(params: BaseParams & {
        retentionDays: number;
    }): Promise<MaintenanceResult>;
    optimizeDatabase(): Promise<MaintenanceResult>;
    generateDailySummary(params: BaseParams & {
        date: string;
    }): Promise<ActivityResult>;
    generateWeeklyReport(params: BaseParams & {
        startDate: string;
        endDate: string;
        includeMetrics: string[];
    }): Promise<ActivityResult<any>>;
    createNotionReport(params: BaseParams & {
        report: any;
        type: string;
    }): Promise<ActivityResult>;
    logCriticalAlert(params: BaseParams & {
        type: string;
        message: string;
    }): Promise<ActivityResult>;
    handleIngestionFailures(params: BaseParams & {
        failures: Array<{
            propId: string;
            reason: string;
        }>;
    }): Promise<ActivityResult>;
    logPerformanceWarning(params: BaseParams & {
        cycleTime: number;
        maxCycleTime: number;
    }): Promise<ActivityResult>;
    handleCriticalError(params: BaseParams & {
        errorMessage: string;
    }): Promise<ActivityResult>;
    logFallbackActivation(params: BaseParams & {
        league: string;
        primaryError: string;
        fallbackError: string;
    }): Promise<ActivityResult>;
}
export {};
//# sourceMappingURL=operator.d.ts.map