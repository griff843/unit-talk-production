/**
 * Feature Store Integration for Enhanced 45-Factor Scoring
 *
 * High-performance feature retrieval system optimized for sub-50ms response times
 * across 8K+ simultaneous prop evaluations. Implements intelligent caching,
 * connection pooling, and fallback mechanisms for maximum reliability.
 */
import { FeatureStoreService } from '../../../services/FeatureStoreService';
export interface EnhancedFeatures {
    lineHistory: LinePoint[];
    predictedClosingLine: number;
    marketData: MarketEfficiencyData;
    bettingData: BettingSplitData;
    volumeData: VolumePoint[];
    relatedMarkets: RelatedMarket[];
    steamData: SteamAnalysis;
    priceAction: PriceActionPoint[];
    timingData: TimingAnalysis;
    recentGames: GamePerformance[];
    roleData: RoleStabilityData;
    headToHead: HeadToHeadGame[];
    injuryData: InjuryAnalysis;
    restData: RestAnalysis;
    usageData: UsageAnalysis;
    seasonTrends: TrendPoint[];
    clutchData: ClutchAnalysis;
    propHistory: PropHistoryPoint[];
    situationalData: SituationalAnalysis;
    teamMatchup: TeamMatchupData;
    dvpData: DVPAnalysis;
    paceData: PaceAnalysis;
    gameScript: GameScriptAnalysis;
    venueData: VenueAnalysis;
    officialData: OfficialAnalysis;
    weatherData: WeatherAnalysis;
    venueAnalysis: VenueDetailedAnalysis;
    motivationData: MotivationalAnalysis;
    bookLines: BookLine[];
    portfolioData: PortfolioAnalysis;
    priceHistory: PricePoint[];
    liquidityData: LiquidityAnalysis;
    marketDepth: MarketDepthData;
    optionalityData: OptionValueData;
    modelOutputs: ModelOutput[];
    backtestData: BacktestAnalysis;
    uncertaintyData: UncertaintyAnalysis;
    temporalData: TemporalAnalysis;
    dataAccuracy: number;
    retrievalTimeMs: number;
    cacheHitRate: number;
    freshness: number;
    completeness: number;
}
interface LinePoint {
    timestamp: number;
    line: number;
    volume?: number;
    book?: string;
}
interface MarketEfficiencyData {
    efficiency: number;
    liquidity: number;
    volatility: number;
    arbitrageOpportunities: number;
}
interface BettingSplitData {
    publicPercent: number;
    sharpPercent: number;
    moneyPercent: number;
    ticketPercent: number;
    timestamp: number;
}
interface VolumePoint {
    timestamp: number;
    volume: number;
    direction: 'up' | 'down' | 'neutral';
}
interface RelatedMarket {
    propId: string;
    correlation: number;
    priceDiscrepancy: number;
    arbitrageValue: number;
}
interface SteamAnalysis {
    steamDetected: boolean;
    confidence: number;
    velocity: number;
    volume: number;
}
interface PriceActionPoint {
    timestamp: number;
    price: number;
    type: 'support' | 'resistance' | 'breakout' | 'breakdown';
}
interface TimingAnalysis {
    optimalWindow: {
        start: number;
        end: number;
    };
    currentTiming: number;
    valueDecay: number;
}
interface GamePerformance {
    gameId: string;
    date: string;
    performance: number;
    usage: number;
    efficiency: number;
    context: string;
}
interface RoleStabilityData {
    usageVariance: number;
    consistency: number;
    roleChanges: number;
    stabilityScore: number;
}
interface HeadToHeadGame {
    date: string;
    performance: number;
    context: string;
    result: 'hit' | 'miss';
}
interface InjuryAnalysis {
    severity: number;
    recency: number;
    impact: number;
    trend: string;
}
interface RestAnalysis {
    daysRest: number;
    recentWorkload: number;
    advantage: number;
}
interface UsageAnalysis {
    currentUsage: number;
    seasonAvg: number;
    opportunity: number;
    trend: number;
}
interface TrendPoint {
    date: string;
    performance: number;
    weight: number;
}
interface ClutchAnalysis {
    clutchPerformance: number;
    sampleSize: number;
    situations: string[];
}
interface PropHistoryPoint {
    date: string;
    statType: string;
    line: number;
    result: number;
    hit: boolean;
}
interface SituationalAnalysis {
    context: string;
    performance: number;
    sampleSize: number;
}
interface TeamMatchupData {
    rating: number;
    historicalAdvantage: number;
    styleMatchup: number;
}
interface DVPAnalysis {
    rating: number;
    rank: number;
    allowedAboveAverage: number;
}
interface PaceAnalysis {
    impact: number;
    teamPaces: {
        home: number;
        away: number;
    };
    projectedPace: number;
}
interface GameScriptAnalysis {
    favorability: number;
    projectedGameflow: string;
    scoringEnvironment: number;
}
interface VenueAnalysis {
    advantage: number;
    homeFieldEdge: number;
    splits: {
        home: number;
        away: number;
    };
}
interface OfficialAnalysis {
    impact: number;
    tendencies: Record<string, number>;
    historicalImpact: number;
}
interface WeatherAnalysis {
    severity: number;
    impact: number;
    conditions: Record<string, any>;
}
interface VenueDetailedAnalysis {
    advantage: number;
    factors: Record<string, number>;
    historical: Record<string, number>;
}
interface MotivationalAnalysis {
    level: number;
    factors: string[];
    impact: number;
}
interface BookLine {
    book: string;
    line: number;
    odds: number;
    timestamp: number;
}
interface PortfolioAnalysis {
    maxCorrelation: number;
    portfolioImpact: number;
    exposure: number;
    diversification: number;
}
interface PricePoint {
    timestamp: number;
    price: number;
    volume?: number;
}
interface LiquidityAnalysis {
    depth: number;
    spread: number;
    impact: number;
}
interface MarketDepthData {
    bidAskSpread: number;
    depth: number;
    liquidity: number;
}
interface OptionValueData {
    value: number;
    timeDecay: number;
    volatility: number;
}
interface ModelOutput {
    modelName: string;
    score: number;
    confidence: number;
    features: Record<string, number>;
}
interface BacktestAnalysis {
    accuracy: number;
    profitability: number;
    sharpeRatio: number;
    maxDrawdown: number;
}
interface UncertaintyAnalysis {
    confidenceWidth: number;
    intervalBounds: {
        lower: number;
        upper: number;
    };
    uncertainty: number;
}
interface TemporalAnalysis {
    recencyBias: number;
    timeDecay: number;
    seasonality: number;
}
export declare class FeatureStoreIntegration {
    private logger;
    private featureStore;
    private cache;
    private readonly DEFAULT_TTL;
    private readonly BATCH_SIZE;
    private readonly MAX_CACHE_SIZE;
    private connectionPool;
    constructor(featureStore: FeatureStoreService);
    /**
     * Get enhanced features for a prop with sub-50ms target performance
     */
    getEnhancedFeatures(propId: string, sport: string, playerId: string): Promise<EnhancedFeatures>;
    /**
     * Precompute and store features for batch processing
     */
    precomputeFeatures(propIds: string[], sport: string, priority?: 'high' | 'normal' | 'low'): Promise<{
        succeeded: number;
        failed: number;
        totalTimeMs: number;
    }>;
    /**
     * Check if features need refresh based on staleness
     */
    checkFreshness(propId: string, sport: string): Promise<{
        needsRefresh: boolean;
        staleness: number;
        lastUpdate: string;
    }>;
    /**
     * Invalidate cached features for material changes
     */
    invalidateFeatures(propId: string, changedFactors: string[]): void;
    private generateFeatureKeys;
    private batchGetFromCache;
    private batchFetchMissingFeatures;
    private fetchSingleFeature;
    private batchUpdateCache;
    private transformToEnhancedFeatures;
    private computeAndStoreFeatures;
    private simulateFeatureComputation;
    private getEntityType;
    private getDefaultFeatureValue;
    private getTTL;
    private getMaxStaleness;
    private getInvalidationKeys;
    private calculateFreshness;
    private calculateCompleteness;
    private getFeatureWeight;
    private getFeatureFreshness;
    private createFallbackFeatures;
    private evictOldestCacheEntries;
    private startCacheCleanup;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        memoryUsageMB: number;
    };
}
export {};
//# sourceMappingURL=FeatureStoreIntegration.d.ts.map