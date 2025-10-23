/**
 * Publish Guard
 * Routes publishing decisions through shadow mode or live publishing
 * Provides central control point for shadow mode integration
 */
export interface PromotionDecision {
    approved: boolean;
    lane: 'instant' | 'scheduled' | 'rejected';
    reasons: string[];
    pick: any;
    gateResults?: any[];
    riskScore?: number;
}
export interface PublishOptions {
    embed?: any;
    tier?: string;
    isInstant?: boolean;
    groupKey?: string;
    notifyChannels?: string[];
}
declare class PublishGuardService {
    private static instance;
    private logger;
    private constructor();
    static getInstance(): PublishGuardService;
    /**
     * Central publish decision point with shadow mode routing
     */
    handlePromotionDecision(decision: PromotionDecision, options?: PublishOptions): Promise<{
        published: boolean;
        shadowLogged: boolean;
        channelsNotified: string[];
    }>;
    /**
     * Handle shadow mode publishing
     */
    private handleShadowMode;
    /**
     * Handle normal mode publishing
     */
    private handleNormalMode;
    /**
     * Prepare shadow pick data from decision
     */
    private prepareShadowPick;
    /**
     * Map decision lane to shadow action
     */
    private mapToShadowAction;
    /**
     * Ensure pick is not marked as published in shadow mode
     */
    private ensureShadowPickNotPublished;
    /**
     * Publish to actual channels (normal mode only)
     */
    private publishToChannels;
    /**
     * Handle recheck decision in shadow or normal mode
     */
    handleRecheckDecision(pickId: string, recheckType: string, validationStatus: 'valid' | 'warning' | 'invalid' | 'cancelled', action: string, metrics?: any): Promise<void>;
    /**
     * Handle alert decision in shadow or normal mode
     */
    handleAlertDecision(pickId: string, alertType: string, severity: string, message: string, data?: any): Promise<void>;
    /**
     * Check if public actions should be skipped
     */
    shouldSkipPublicAction(actionType: 'publish' | 'alert' | 'webhook'): boolean;
    /**
     * Get publish guard statistics
     */
    getPublishStats(): Promise<{
        mode: 'shadow' | 'normal';
        shadowStats?: any;
    }>;
}
export declare const publishGuard: PublishGuardService;
export {};
//# sourceMappingURL=PublishGuard.d.ts.map