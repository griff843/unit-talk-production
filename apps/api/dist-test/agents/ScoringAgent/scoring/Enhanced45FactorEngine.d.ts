/**
 * Enhanced 45-Factor Scoring Engine
 *
 * World-class scoring system that rivals the best betting syndicates.
 * Implements 45 distinct factors across Market, Player, Matchup, Price, and Meta categories.
 * Designed for processing 8K+ simultaneous props with sub-50ms feature retrieval.
 */
import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
import { FeatureStoreIntegration } from './FeatureStoreIntegration';
import { MaterialChangeDetector } from './MaterialChangeDetector';
export interface Enhanced45FactorResult {
    totalScore: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    confidence: number;
    kellyFraction: number;
    marketScore: number;
    playerScore: number;
    matchupScore: number;
    priceScore: number;
    metaScore: number;
    factorScores: Record<string, number>;
    factorWeights: Record<string, number>;
    riskAdjustedScore: number;
    expectedValue: number;
    sharpeRatio: number;
    maxDrawdown: number;
    processingTimeMs: number;
    featuresRetrievedMs: number;
    modelAgreement: number;
    dataQuality: number;
    timestamp: string;
    version: string;
    configUsed: string;
}
export interface Factor45Config {
    marketFactors: {
        expectedValueDevigged: number;
        lineMovementVelocity: number;
        closingLineValue: number;
        marketEfficiency: number;
        publicVsSharpSplit: number;
        volumeProfile: number;
        crossMarketArbitrage: number;
        steamDetection: number;
        marketResistance: number;
        optimalTiming: number;
    };
    playerFactors: {
        playerForm: number;
        roleStability: number;
        matchupHistory: number;
        injuryImpact: number;
        fatigueLevel: number;
        usageRate: number;
        performanceTrends: number;
        clutchFactor: number;
        propSpecificTendencies: number;
        situationalPerformance: number;
    };
    matchupFactors: {
        teamVsTeam: number;
        defenseVsPosition: number;
        paceImpact: number;
        gameScript: number;
        homeAwaysplits: number;
        refereeTendencies: number;
        weatherImpact: number;
        venueFactors: number;
        restAdvantage: number;
        motivationalFactors: number;
    };
    priceFactors: {
        lineShoppingEdge: number;
        kellyFraction: number;
        riskAdjustedReturn: number;
        correlationRisk: number;
        portfolioImpact: number;
        volatilityScore: number;
        liquidityPremium: number;
        marketTiming: number;
        bidAskSpread: number;
        optionValue: number;
    };
    metaFactors: {
        dataQuality: number;
        modelAgreement: number;
        historicalAccuracy: number;
        confidenceInterval: number;
        recencyBiasAdjustment: number;
    };
}
export declare class Enhanced45FactorEngine {
    private logger;
    private featureStore;
    private changeDetector;
    private defaultConfig;
    constructor(featureStore: FeatureStoreIntegration, changeDetector: MaterialChangeDetector);
    /**
     * Calculate comprehensive 45-factor score for a prop
     */
    calculate45FactorScore(features: GradingFeatureSet, config?: Partial<Factor45Config>): Promise<Enhanced45FactorResult>;
    /**
     * Calculate Market Factors (10 factors)
     */
    private calculateMarketFactors;
    /**
     * Calculate Player Factors (10 factors)
     */
    private calculatePlayerFactors;
    /**
     * Calculate Matchup Factors (10 factors)
     */
    private calculateMatchupFactors;
    /**
     * Calculate Price Factors (10 factors)
     */
    private calculatePriceFactors;
    /**
     * Calculate Meta Factors (5 factors)
     */
    private calculateMetaFactors;
    private calculateDeviggedEV;
    private calculateLineVelocity;
    private calculateCLV;
    private calculateMarketEfficiency;
    private calculateBettingSplit;
    private calculateVolumeProfile;
    private calculateCrossMarketOpportunity;
    private calculateSteamScore;
    private calculateMarketResistance;
    private calculateOptimalTiming;
    private calculatePlayerForm;
    private calculateRoleStability;
    private calculateMatchupHistory;
    private calculateInjuryImpact;
    private calculateFatigueLevel;
    private calculateUsageRate;
    private calculatePerformanceTrends;
    private calculateClutchFactor;
    private calculatePropTendencies;
    private calculateSituationalPerformance;
    private calculateTeamMatchup;
    private calculateDVP;
    private calculatePaceImpact;
    private calculateGameScript;
    private calculateVenueSplits;
    private calculateRefereImpact;
    private calculateWeatherImpact;
    private calculateVenueFactors;
    private calculateRestAdvantage;
    private calculateMotivation;
    private calculateLineShoppingEdge;
    private calculateKellyOptimal;
    private calculateRiskAdjustedReturn;
    private calculateCorrelationRisk;
    private calculatePortfolioImpact;
    private calculateVolatility;
    private calculateLiquidityPremium;
    private calculateMarketTimingValue;
    private calculateBidAskImpact;
    private calculateOptionValue;
    private calculateDataQuality;
    private calculateModelAgreement;
    private calculateHistoricalAccuracy;
    private calculateConfidenceInterval;
    private calculateRecencyAdjustment;
    private mergeConfig;
    private getFlattenedWeights;
    private determineTier;
    private calculateConfidence;
    private calculateKellyFraction;
    private applyRiskAdjustments;
    private calculateExpectedValue;
    private calculateSharpeRatio;
    private estimateMaxDrawdown;
    private calculateHoursToGame;
    private calculateTrend;
    private calculateStandardDeviation;
    private calculateVariance;
    private oddsToProb;
    private createFallbackResult;
    /**
     * Process batch of props for high throughput
     */
    batchProcess45Factor(propsList: GradingFeatureSet[], config?: Partial<Factor45Config>): Promise<Enhanced45FactorResult[]>;
}
//# sourceMappingURL=Enhanced45FactorEngine.d.ts.map