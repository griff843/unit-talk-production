import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
/**
 * FeatureBuilderAgent
 *
 * Computes 45+ professional betting factors from HOT tier data
 * and writes to WARM tier (features_daily_agg) for fast lookups.
 *
 * Runs hourly or on material changes (line moves, injuries).
 *
 * Factor Categories:
 * - Market Intelligence (10 factors): Steam, CLV, sharp money
 * - Player Performance (10 factors): Form, averages, volatility
 * - Matchup Analysis (10 factors): DVP, H2H, venue, pace
 * - Meta Factors (10 factors): Injury, weather, motivation
 * - Timing Optimization (5+ factors): Optimal windows, decay
 */
export declare class FeatureBuilderAgent extends BaseAgent {
    private featureMetrics;
    private computationQueue;
    private processingBatch;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    private fetchPropsNeedingComputation;
    private batchComputeFeatures;
    private computeFeaturesForProp;
    private computeMarketFactors;
    private computePlayerFactors;
    private computeMatchupFactors;
    private computeMetaFactors;
    private computeTimingFactors;
    private detectSteam;
    private predictCLV;
    private detectSharpMoney;
    private detectPublicFade;
    private calculateLineShoppingEdge;
    private calculateMarketTiming;
    private detectCrossMarketDiscrepancy;
    private calculateBookDisagreement;
    private detectVolumeImbalance;
    private projectClosingLine;
    private calculateRecentForm;
    private calculateAverages;
    private calculateVolatility;
    private calculateUsageRate;
    private calculateTargetShare;
    private getDefaultMarketFactors;
    private getDefaultPlayerFactors;
    private aggregateFactorScores;
    private calculateConfidence;
    private detectMaterialChanges;
    private handleMaterialChanges;
    private writeToFeatureStore;
    private cacheComputedFeatures;
    private subscribeToMaterialChanges;
    private isMaterialChange;
    private loadFeatureMetrics;
    private updateFeatureMetrics;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<any>;
    private calculateDVP;
    private getDVPRank;
    private getDVPPercentile;
    private calculateH2H;
    private calculateVenueAdvantage;
    private calculatePaceImpact;
    private calculateStyleMatchup;
    private calculateRestAdvantage;
    private calculateTravelFatigue;
    private calculateAltitudeImpact;
    private calculateInjuryImpact;
    private calculateWeatherImpact;
    private calculateMotivation;
    private calculateScheduleSpot;
    private calculateRefereeImpact;
    private calculatePublicBias;
    private isPrimetime;
    private isRevengeGame;
    private isDivisionRival;
    private isPlayoffs;
    private getGameTime;
    private calculateOptimalWindow;
    private calculateLineVelocity;
    private calculateMarketEfficiency;
    private calculateExpectedCLV;
    private calculateTimeDecay;
}
//# sourceMappingURL=index.d.ts.map