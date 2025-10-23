/**
 * Centralized scoring weights types for all sports
 * Ensures type safety and eliminates magic numbers
 */
export interface CoreScoringWeights {
    expectedValue: number;
    lineMovement: number;
    matchupRating: number;
    playerForm: number;
    injuryImpact: number;
    weatherImpact: number;
    marketIntelligence: number;
    sharpMoney: number;
    volumeProfile: number;
    closingLineValue: number;
    steamDetection: number;
    closingLinePrediction: number;
    optimalTiming: number;
    lineShoppingEdge: number;
    publicVsSharpSplit: number;
    marketTimingAdvantage: number;
    injuryTimingEdge: number;
    crossMarketDiscrepancy: number;
    playerFatigue: number;
    venueAdvantage: number;
    refereeImpact: number;
    paceImpact: number;
    motivationalFactors: number;
    correlationRisk: number;
    volatility: number;
    portfolioImpact: number;
    neuralNetwork: number;
    gradientBoosting: number;
    randomForest: number;
    ensemble: number;
}
export interface EnhancedScoringWeights {
    handednessSplits: number;
    recentTrendAnalysis: number;
    headToHeadHistory: number;
    rosterStabilityScore: number;
    bullpenQualityScore: number;
    advancedSplitAnalysis: number;
    last3Weight: number;
    last7Weight: number;
    last15Weight: number;
    last30Weight: number;
    enhancedWeight: number;
}
export interface SportSpecificWeights extends CoreScoringWeights, EnhancedScoringWeights {
    sport: string;
    version: string;
    description: string;
    lastUpdated: string;
    sportSpecificFactors?: Record<string, number>;
}
export interface TierThresholds {
    S_TIER: {
        minScore: number;
        minEdge: number;
        maxRisk: number;
        minPositionSize: number;
    };
    A_TIER: {
        minScore: number;
        minEdge: number;
        maxRisk: number;
        minPositionSize: number;
    };
    B_TIER: {
        minScore: number;
        maxRisk: number;
        minPositionSize: number;
    };
    C_TIER: {
        minScore: number;
        maxRisk: number;
        minPositionSize: number;
    };
    D_TIER: {
        description: string;
    };
}
export interface RiskManagementConfig {
    maxPositionSize: number;
    kellyMultiplier: number;
    maxDrawdown: number;
    maxCorrelation: number;
    minSharpeRatio: number;
    maxExposurePerSport: number;
    maxExposurePerPlayer: number;
    maxDailyRisk: number;
    stopLossThreshold: number;
    maxVaR: number;
    maxCVaR: number;
}
export interface ScoringConfig {
    weights: SportSpecificWeights;
    tiers: TierThresholds;
    risk: RiskManagementConfig;
}
export declare function validateWeights(weights: CoreScoringWeights & EnhancedScoringWeights): boolean;
//# sourceMappingURL=types.d.ts.map