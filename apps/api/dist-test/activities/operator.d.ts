/**
 * OPERATOR ACTIVITIES
 * Activities for system monitoring, health checks, and operator notifications
 */
export declare function logUSPError(params: {
    uspType: string;
    error: string;
    cycleCount: number;
}): Promise<{
    success: boolean;
}>;
export declare function monitorAPIQuota(params: {
    provider: string;
    currentUsage: number;
    limit: number;
}): Promise<{
    success: boolean;
    shouldFallback: boolean;
    percentage: number;
}>;
export declare function checkSystemHealth(params: {
    cycleCount: number;
    components: string[];
}): Promise<{
    success: boolean;
    healthScore: number;
    issues: string[];
}>;
export declare function detectLiveGames(params: {
    leagues: string[];
}): Promise<{
    success: boolean;
    liveGames: any[];
    errors: string[];
}>;
export declare function logWorkflowMetrics(params: {
    workflowName: string;
    duration: number;
    success: boolean;
    cycleCount: number;
    metadata?: any;
}): Promise<{
    success: boolean;
}>;
/**
 * Grading error logging activity for scoring workflow error handling
 */
export declare function logGradingError(params: {
    error: string;
    leagues: string[];
    cycleCount: number;
}): Promise<void>;
/**
 * General error logging activity for workflow error handling
 */
export declare function logError(params: {
    error: string;
    timestamp: string;
    context?: Record<string, unknown>;
}): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=operator.d.ts.map