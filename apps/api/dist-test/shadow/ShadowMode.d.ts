/**
 * Shadow Mode Service
 * Enables full grading → promotion → monitoring flow without public posting
 * All promotions are logged to shadow tables for testing and analysis
 */
export interface ShadowPick {
    rawPropId?: string;
    unifiedPickId?: string;
    sport: string;
    market: string;
    player: string;
    team?: string;
    book?: string;
    oddsOpen?: number;
    oddsNow?: number;
    line?: number;
    eventTime?: Date;
    tier?: string;
    confidence?: number;
    professionalScore?: number;
    deviggedWinProb?: number;
    deviggedEdge?: number;
    clvPct?: number;
    kellyFraction?: number;
    risk?: number;
    chaosMuted?: boolean;
    steamMuted?: boolean;
    isInstant?: boolean;
    groupKey?: string;
}
export type ShadowAction = 'instant' | 'queued-10am' | 'rejected-gate' | 'rejected-recheck';
export interface ShadowMetricsSnapshot {
    window: '7d' | '30d' | 'lifetime';
    sport?: string;
    postedEv?: number;
    positiveCLVRate?: number;
    avgCLV?: number;
    hitRate?: number;
    roi?: number;
    sharpe?: number;
    kellyEfficiency?: number;
    maxDrawdown?: number;
    picksCount?: number;
    completedPicks?: number;
    winRate?: number;
    avgOdds?: number;
    profitFactor?: number;
}
export declare class ShadowModeService {
    private static instance;
    private logger;
    private discordClient;
    private shadowChannelId;
    private cleanupInterval;
    private constructor();
    static getInstance(): ShadowModeService;
    /**
     * Initialize shadow mode service
     */
    private initializeService;
    /**
     * Check if shadow mode is enabled
     */
    isShadowMode(): boolean;
    /**
     * Get maximum days to keep shadow data
     */
    private getMaxDays;
    /**
     * Write a pick decision to shadow tables
     */
    shadowWritePick(pick: ShadowPick, decidedAction: ShadowAction, reasons?: string[]): Promise<void>;
    /**
     * Publish a preview to the private shadow channel
     */
    shadowPublishPreview(embed: any): Promise<void>;
    /**
     * Create a shadow-prefixed embed
     */
    private createShadowEmbed;
    /**
     * Format shadow metrics for display
     */
    private formatShadowMetrics;
    /**
     * Write metrics snapshot to shadow tables
     */
    shadowWriteMetrics(snapshot: ShadowMetricsSnapshot): Promise<void>;
    /**
     * Record a recheck result in shadow mode
     */
    shadowWriteRecheck(shadowPickId: string, recheckType: string, validationStatus: string, action: string, metrics: {
        evAtRecheck?: number;
        clvAtRecheck?: number;
        oddsMovement?: number;
    }): Promise<void>;
    /**
     * Record an alert in shadow mode
     */
    shadowWriteAlert(shadowPickId: string, alertType: string, severity: string, message: string, data?: any): Promise<void>;
    /**
     * Clean up old shadow data
     */
    cleanupOldShadow(maxDays?: number): Promise<void>;
    /**
     * Schedule daily cleanup
     */
    private scheduleCleanup;
    /**
     * Initialize Discord client for shadow previews
     */
    private initializeDiscordClient;
    /**
     * Get shadow statistics
     */
    getShadowStats(window?: '1d' | '7d' | '30d'): Promise<{
        totalPicks: number;
        byAction: Record<string, number>;
        bySport: Record<string, number>;
        byTier: Record<string, number>;
        rejectionReasons: Record<string, number>;
    }>;
    /**
     * Check if a specific feature should be disabled in shadow mode
     */
    shouldSkipPublicAction(actionType: 'publish' | 'alert' | 'webhook'): boolean;
    /**
     * Cleanup on service shutdown
     */
    cleanup(): void;
}
export declare const shadowMode: ShadowModeService;
export declare const isShadowMode: () => boolean;
export declare const shadowWritePick: (pick: ShadowPick, action: ShadowAction, reasons?: string[]) => Promise<void>;
export declare const shadowPublishPreview: (embed: any) => Promise<void>;
export declare const shadowWriteMetrics: (snapshot: ShadowMetricsSnapshot) => Promise<void>;
export declare const cleanupOldShadow: (maxDays?: number) => Promise<void>;
//# sourceMappingURL=ShadowMode.d.ts.map