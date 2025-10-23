/**
 * PromotionWorkflow - Professional Pick Promotion Engine
 *
 * Applies strict tier criteria to move scored candidates into unified_picks
 * with sophisticated risk management and portfolio optimization.
 *
 * Tier Criteria:
 * - S-tier: Score >= 85, Edge >= 8%, Kelly >= 0.03, Confidence >= 85% (Elite)
 * - A-tier: Score >= 75, Edge >= 5%, Kelly >= 0.02, Confidence >= 80% (Strong)
 * - B-tier: Score >= 65, Edge >= 3%, Kelly >= 0.01, Confidence >= 75% (Good)
 * - C-tier: Score >= 55, Edge >= 1%, Kelly >= 0.005, Confidence >= 70% (Marginal)
 *
 * Risk Management:
 * - Portfolio correlation limits
 * - Exposure limits per game/player/sport
 * - Kelly criterion position sizing
 * - Dynamic risk adjustment
 */
export declare function PromotionWorkflow(params: {
    minGrade?: 'S' | 'A' | 'B' | 'C';
    minScore?: number;
    minEdge?: number;
    minKellyFraction?: number;
    batchSize?: number;
    portfolioConstraints?: {
        maxExposurePerGame?: number;
        maxExposurePerPlayer?: number;
        maxExposurePerSport?: number;
        maxCorrelationRisk?: number;
        maxPortfolioKelly?: number;
    };
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    candidatesProcessed: number;
    promotedCount: number;
    rejectedCount: number;
    tierDistribution: Record<string, number>;
    portfolioMetrics: {
        totalExposure: number;
        totalKelly: number;
        correlationScore: number;
        diversificationIndex: number;
    };
    alerts: Array<{
        type: string;
        message: string;
        count: number;
    }>;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled PromotionWorkflow - Runs every 15 minutes for continuous promotion
 *
 * Optimized for real-time pick promotion supporting:
 * - S/A tier immediate promotion for time-sensitive opportunities
 * - B/C tier batch promotion with risk management
 * - Portfolio optimization and correlation management
 * - Risk-adjusted position sizing
 */
export declare function ScheduledPromotionWorkflow(): Promise<void>;
/**
 * Express PromotionWorkflow - Triggered by high-grade scoring completions
 *
 * Fast promotion for time-critical scenarios:
 * - S/A tier picks requiring immediate promotion
 * - Steam moves needing rapid position entry
 * - Breaking news opportunities
 */
export declare function ExpressPromotionWorkflow(params: {
    propIds: string[];
    priority: 'normal' | 'high' | 'critical';
    minTier?: 'S' | 'A' | 'B';
}): Promise<void>;
//# sourceMappingURL=PromotionWorkflow.d.ts.map