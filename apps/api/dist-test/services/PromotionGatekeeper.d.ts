/**
 * Promotion Gatekeeper Service
 * Manages pick promotion through Instant vs 10am lanes with comprehensive validation
 */
export interface PromotionGate {
    gateId: string;
    name: string;
    type: 'instant' | 'scheduled' | 'manual';
    requirements: GateRequirements;
    enabled: boolean;
    priority: number;
}
export interface GateRequirements {
    minTier: 'S' | 'A' | 'B' | 'C';
    minConfidence: number;
    minProfessionalScore: number;
    minExpectedValue: number;
    minCLVThreshold: number;
    maxNegativeCLV: number;
    requiresSteam: boolean;
    minSteamStrength: number;
    maxReverseSteam: number;
    maxCorrelation: number;
    maxPortfolioExposure: number;
    maxSingleGameExposure: number;
    minTimeBeforeGame: number;
    maxTimeBeforeGame: number;
}
export interface PromotionDecision {
    approved: boolean;
    lane: 'instant' | '10am' | 'hold' | 'reject';
    gateResults: GateResult[];
    reasoning: string;
    scheduledTime?: Date;
    riskScore: number;
    confidence: number;
    estimatedImpact: number;
}
export interface GateResult {
    gateId: string;
    gateName: string;
    passed: boolean;
    score: number;
    threshold: number;
    impact: 'blocking' | 'warning' | 'informational';
    message: string;
}
export interface PickForPromotion {
    id: string;
    propId: string;
    tier: string;
    confidence: number;
    professionalScore: number;
    expectedValue: number;
    clvTracking?: {
        initialOdds: number;
        currentOdds: number;
        clvBps: number;
    };
    steamData?: {
        strength: number;
        direction: 'for' | 'against';
        volume: number;
    };
    gameTime: Date;
    sport: string;
    correlatedPicks: string[];
    portfolioExposure: number;
}
declare class PromotionGatekeeper {
    private static instance;
    private logger;
    private gates;
    private readonly DEFAULT_GATES;
    private constructor();
    static getInstance(): PromotionGatekeeper;
    /**
     * Initialize default gates
     */
    private initializeGates;
    /**
     * Main promotion decision engine
     */
    evaluatePromotion(pick: PickForPromotion): Promise<PromotionDecision>;
    /**
     * Evaluate single gate against pick
     */
    private evaluateGate;
    /**
     * Make final promotion decision
     */
    private makePromotionDecision;
    /**
     * Get tier numeric professional_score
     */
    private getTierScore;
    /**
     * Determine gate impact level
     */
    private getGateImpact;
    /**
     * Generate human-readable gate message
     */
    private generateGateMessage;
    /**
     * Calculate risk contribution from gate result
     */
    private calculateRiskContribution;
    /**
     * Get next 10am scheduled slot
     */
    private getNext10amSlot;
    /**
     * Calculate estimated impact
     */
    private calculateEstimatedImpact;
    /**
     * Generate decision reasoning
     */
    private generateDecisionReasoning;
    /**
     * Store promotion decision for audit trail
     */
    private storePromotionDecision;
    /**
     * Get gate configuration
     */
    getGate(gateId: string): PromotionGate | undefined;
    /**
     * Update gate configuration
     */
    updateGate(gateId: string, updates: Partial<PromotionGate>): boolean;
    /**
     * Get all gate configurations
     */
    getAllGates(): PromotionGate[];
    /**
     * Get promotion statistics
     */
    getPromotionStats(timeframe?: 'day' | 'week' | 'month'): Promise<{
        totalEvaluated: number;
        approved: number;
        rejected: number;
        instant: number;
        scheduled: number;
        avgRiskScore: number;
        avgConfidence: number;
        topGates: Array<{
            gateId: string;
            passRate: number;
        }>;
    }>;
    /**
     * Extract rejection reasons from gate results for shadow logging
     */
    private extractReasons;
    /**
     * Generate group key for pick batching
     */
    private generateGroupKey;
}
export declare const promotionGatekeeper: PromotionGatekeeper;
export {};
//# sourceMappingURL=PromotionGatekeeper.d.ts.map