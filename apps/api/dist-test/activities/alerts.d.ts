/**
 * ALERT ACTIVITIES
 * Core activities for sending alerts to Discord, Notion, email, and SMS
 */
export declare function sendDiscordAlert(params: {
    message: string;
    channel: 'approved' | 'operator';
    priority: 'critical' | 'high' | 'normal';
    metadata?: any;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendOperatorAlert(params: {
    type: 'workflow_failure' | 'quota_warning' | 'fallback_trigger' | 'system_error';
    message: string;
    severity: 'critical' | 'high' | 'normal';
    metadata?: any;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendApprovedPicksAlert(params: {
    picks: any[];
    cycleCount: number;
    totalPicks: number;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendQuotaWarning(params: {
    provider: string;
    currentUsage: number;
    limit: number;
    percentage: number;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendFallbackTrigger(params: {
    primaryProvider: string;
    fallbackProvider: string;
    reason: string;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendWorkflowFailure(params: {
    workflowName: string;
    error: string;
    cycleCount: number;
}): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function sendWeeklyReport(params: {
    report: any;
    webhook?: string;
}): Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=alerts.d.ts.map