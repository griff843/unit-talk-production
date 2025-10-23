/**
 * DiscordAlertRouter - Routes different alert types to appropriate Discord channels
 *
 * Channel Routing Strategy:
 * - Individual Pick Posts: Capper dedicated threads
 * - Alert Notifications: Dedicated alerts channel (hedge, middle, injury, steam)
 * - System Errors: System alerts thread
 */
export declare class DiscordAlertRouter {
    /**
     * Route alert to appropriate Discord channel based on alert type
     */
    static routeAlert(alertType: AlertType, alertData: AlertData): Promise<void>;
    /**
     * Determine which Discord channel to use based on alert type
     */
    private static getChannelForAlertType;
    /**
     * Send alert to specific Discord channel
     */
    private static sendToChannel;
    /**
     * Create basic fallback embed if enhanced formatting fails
     */
    private static createBasicFallbackEmbed;
    /**
     * Get alert title based on type
     */
    private static getAlertTitle;
    /**
     * Get alert color based on type
     */
    private static getAlertColor;
    /**
     * Send system alert (fallback for routing failures)
     */
    private static sendToSystemAlerts;
}
export type AlertType = 'hedge_opportunity' | 'middle_opportunity' | 'injury_impact' | 'steam_move' | 'line_movement' | 'stale_line' | 'pick_post' | 'system_error' | 'processing_error';
export interface AlertData {
    pickId: string;
    capper: string;
    sport: string;
    selection: string;
    odds: string;
    units?: number;
    confidence?: number;
    systemGrade?: string;
    pickType?: string;
    isLive?: boolean;
    hedgeDetails?: string;
    expectedProfit?: string;
    middleSetup?: string;
    potentialWin?: string;
    injuryDetails?: string;
    impact?: string;
    steamDetails?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=DiscordAlertRouter.d.ts.map