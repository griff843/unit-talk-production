/**
 * Auto Re-check Service
 * Automated 5-15 minute pre-post game validation with real-time monitoring
 */
export interface RecheckSchedule {
    pickId: string;
    gameTime: Date;
    preGameChecks: RecheckPoint[];
    postGameChecks: RecheckPoint[];
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    lastCheck: Date | null;
    nextCheck: Date | null;
}
export interface RecheckPoint {
    id: string;
    type: 'pre_game' | 'post_game';
    scheduledTime: Date;
    actualTime?: Date;
    minutesBeforeGame: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    validationResults?: ValidationSnapshot;
    oddsMovement?: OddsMovementData;
    actionTaken?: RecheckAction;
}
export interface ValidationSnapshot {
    timestamp: Date;
    pickStatus: 'valid' | 'warning' | 'invalid' | 'cancelled';
    promotionValidation: {
        stillQualifies: boolean;
        gateResults: any[];
        riskScore: number;
    };
    sTierValidation?: {
        meetsStandards: boolean;
        violations: any[];
        recommendedTier?: string;
    };
    portfolioValidation: {
        withinLimits: boolean;
        correlationRisk: string;
        positionSizeAdjustment?: number;
    };
    marketValidation: {
        liquidityAdequate: boolean;
        steamDirection: 'for' | 'against' | 'neutral';
        sharpMoneyFlow: number;
    };
}
export interface OddsMovementData {
    timestamp: Date;
    initialOdds: number;
    currentOdds: number;
    movementBps: number;
    movementDirection: 'favorable' | 'unfavorable' | 'neutral';
    volume: number;
    steamStrength: number;
    clvImpact: number;
    marketDepth: number;
}
export interface RecheckAction {
    type: 'maintain' | 'adjust_size' | 'tier_change' | 'cancel' | 'republish';
    reason: string;
    changes: {
        oldTier?: string;
        newTier?: string;
        oldSize?: number;
        newSize?: number;
        statusChange?: string;
    };
    confidence: number;
    riskImpact: number;
}
declare class AutoRecheckService {
    private static instance;
    private logger;
    private activeSchedules;
    private readonly DEFAULT_RECHECK_INTERVALS;
    private constructor();
    static getInstance(): AutoRecheckService;
    /**
     * Initialize the auto re-check service
     */
    private initializeService;
    /**
     * Schedule auto re-checks for a new pick
     */
    scheduleRecheckForPick(pick: any): Promise<RecheckSchedule>;
    /**
     * Main monitoring loop
     */
    private startMonitoringLoop;
    /**
     * Process all scheduled re-checks that are due
     */
    private processScheduledRechecks;
    /**
     * Execute a single re-check point
     */
    private executeRecheckPoint;
    /**
     * Perform comprehensive validation
     */
    private performValidation;
    /**
     * Validate current market conditions
     */
    private validateMarketConditions;
    /**
     * Get current odds movement data
     */
    private getOddsMovementData;
    /**
     * Determine what action to take based on validation results
     */
    private determineRecheckAction;
    /**
     * Execute the determined action
     */
    private executeRecheckAction;
    /**
     * Helper methods
     */
    private calculateOddsMovementBps;
    private getNextCheckTime;
    private isScheduleComplete;
    private getCurrentPickData;
    private loadActiveSchedules;
    private storeRecheckSchedule;
    private updateRecheckSchedule;
    private triggerRepublication;
    /**
     * Get recheck statistics
     */
    getRecheckStats(_timeframe?: 'day' | 'week' | 'month'): Promise<{
        totalSchedules: number;
        activeSchedules: number;
        completedChecks: number;
        actionsKnown: Record<string, number>;
        avgCheckTime: number;
        successRate: number;
    }>;
}
export declare const autoRecheckService: AutoRecheckService;
export {};
//# sourceMappingURL=AutoRecheckService.d.ts.map