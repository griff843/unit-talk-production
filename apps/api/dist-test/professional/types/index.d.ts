/**
 * Professional Features Types
 * Phase 5: Syndicate-Level ML Betting System
 *
 * These types define the 8 professional features that separate
 * syndicate-level systems from amateur betting platforms.
 */
import type { ScoringFeatureSet } from '../../types/ScoringFeatureSet';
export interface ProfessionalFeatureSet extends ScoringFeatureSet {
    steamDetectionScore: number;
    closingLinePrediction: number;
    optimalTimingScore: number;
    lineShoppingEdge: number;
    publicVsSharpSplit: number;
    marketTimingAdvantage: number;
    injuryTimingEdge: number;
    crossMarketDiscrepancy: number;
    professionalGrade: 'SYNDICATE' | 'SHARP' | 'RECREATIONAL';
    confidence: number;
    expectedCLV: number;
    riskAdjustedEdge: number;
}
export interface SteamDetectionResult {
    steamDetected: boolean;
    steamScore: number;
    lineMovement: number;
    volumeCorrelation: number;
    timeToMove: number;
    sharpMoneyIndicators: {
        reverseLineMovement: boolean;
        volumeSpike: boolean;
        bookmakerReaction: boolean;
        crossBookConsensus: boolean;
    };
    steamHistory: SteamEvent[];
    recommendedAction: 'BET_IMMEDIATELY' | 'MONITOR' | 'AVOID';
}
export interface SteamEvent {
    timestamp: string;
    lineChange: number;
    volume: number;
    bookmaker: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export interface ClosingLinePredictionResult {
    predictedClosingLine: number;
    currentLine: number;
    expectedMovement: number;
    confidence: number;
    timeRemaining: number;
    historicalAccuracy: number;
    factors: {
        injuryNews: number;
        weatherForecast: number;
        marketDynamics: number;
        sharpAction: number;
        publicMoney: number;
    };
    optimalEntryWindow: {
        startTime: string;
        endTime: string;
        reasoning: string;
    };
}
export interface OptimalTimingResult {
    optimalTimingScore: number;
    hoursToGame: number;
    edgeDecayRate: number;
    currentEdge: number;
    projectedEdge: number;
    timingRecommendation: {
        action: 'BET_NOW' | 'WAIT' | 'MONITOR' | 'AVOID';
        reasoning: string;
        targetTime?: string;
        maxEdgeWindow: {
            start: string;
            end: string;
            expectedEdge: number;
        };
    };
    historicalPatterns: {
        avgEdgeAtHour: Record<number, number>;
        optimalBetTime: number;
        successRate: number;
    };
}
export interface LineShoppingResult {
    bestLine: number;
    bestBook: string;
    currentBook: string;
    currentLine: number;
    edgeImprovement: number;
    availableLines: BookLine[];
    arbitrageOpportunity?: ArbitrageOpportunity;
    recommendedBook: string;
    timing: {
        lineAvailability: number;
        executionSpeed: 'FAST' | 'MEDIUM' | 'SLOW';
        limitRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
}
export interface BookLine {
    bookmaker: string;
    line: number;
    odds: number;
    limit: number;
    availability: number;
    lastUpdated: string;
    reliability: number;
}
export interface ArbitrageOpportunity {
    guaranteed: boolean;
    profit: number;
    books: {
        book1: string;
        line1: number;
        book2: string;
        line2: number;
    };
    minStake: number;
    maxStake: number;
    timeWindow: number;
}
export interface PublicSharpSplitResult {
    publicBettingPercentage: number;
    sharpBettingPercentage: number;
    contrarianOpportunity: boolean;
    contrarianScore: number;
    historicalFadeSuccess: number;
    sharpMoneyIndicators: {
        reverseLineMovement: boolean;
        lowPublicHighSharp: boolean;
        professionalBettorActivity: boolean;
        syndicateSignals: boolean;
    };
    recommendation: {
        action: 'FADE_PUBLIC' | 'FOLLOW_SHARP' | 'NEUTRAL' | 'AVOID';
        confidence: number;
        reasoning: string;
    };
}
export interface MarketTimingResult {
    marketEfficiency: number;
    timingAdvantage: number;
    edgeDecay: {
        currentEdge: number;
        hourlyDecay: number;
        halfLife: number;
    };
    optimalEntry: {
        timing: string;
        expectedEdge: number;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    marketPredictions: {
        nextHour: number;
        next4Hours: number;
        closingEdge: number;
    };
}
export interface InjuryTimingResult {
    injuryTimingScore: number;
    newsBreakEdge: number;
    lineAdjustmentSpeed: number;
    newsSources: NewsSource[];
    injuryImpact: {
        playerImpact: number;
        teamImpact: number;
        marketReaction: number;
    };
    timingWindow: {
        newsBreakTime: string;
        lineAdjustmentTime: string;
        opportunityWindow: number;
        edgeValue: number;
    };
}
export interface NewsSource {
    source: string;
    reliability: number;
    speed: number;
    injuryType: string;
    impact: 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEASON_ENDING';
    lastUpdate: string;
}
export interface CrossMarketDiscrepancyResult {
    discrepancyScore: number;
    arbitrageOpportunities: CrossMarketArbitrage[];
    correlationInconsistencies: CorrelationInconsistency[];
    recommendedStrategy: {
        primaryBet: BetRecommendation;
        hedgeBets: BetRecommendation[];
        totalEdge: number;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    };
}
export interface CrossMarketArbitrage {
    market1: string;
    market2: string;
    correlation: number;
    actualCorrelation: number;
    discrepancy: number;
    opportunitySize: number;
    confidence: number;
    strategy: string;
}
export interface CorrelationInconsistency {
    prop1: string;
    prop2: string;
    expectedCorrelation: number;
    impliedCorrelation: number;
    discrepancySize: number;
    tradingOpportunity: boolean;
}
export interface BetRecommendation {
    market: string;
    side: 'OVER' | 'UNDER';
    line: number;
    odds: number;
    stake: number;
    expectedValue: number;
    book: string;
}
export interface ProfessionalFeatureConfig {
    steamDetection: {
        enabled: boolean;
        minLineMovement: number;
        timeWindow: number;
        volumeThreshold: number;
        confidence: number;
    };
    closingLinePrediction: {
        enabled: boolean;
        modelVersion: string;
        lookAheadHours: number;
        confidence: number;
        historicalDepth: number;
    };
    optimalTiming: {
        enabled: boolean;
        maxHoursBeforeGame: number;
        edgeDecayModel: 'LINEAR' | 'EXPONENTIAL' | 'LOGARITHMIC';
        confidence: number;
    };
    lineShopping: {
        enabled: boolean;
        books: string[];
        maxLatency: number;
        reliability: number;
    };
    publicSharpSplit: {
        enabled: boolean;
        contrarianThreshold: number;
        confidence: number;
        historicalDepth: number;
    };
    marketTiming: {
        enabled: boolean;
        efficiencyModel: string;
        confidence: number;
    };
    injuryTiming: {
        enabled: boolean;
        newsSources: string[];
        maxNewsAge: number;
        reliability: number;
    };
    crossMarketDiscrepancy: {
        enabled: boolean;
        correlationThreshold: number;
        arbitrageThreshold: number;
        maxRisk: number;
    };
}
export interface ProfessionalFeaturesResult {
    steamDetection: SteamDetectionResult;
    closingLinePrediction: ClosingLinePredictionResult;
    optimalTiming: OptimalTimingResult;
    lineShopping: LineShoppingResult;
    publicSharpSplit: PublicSharpSplitResult;
    marketTiming: MarketTimingResult;
    injuryTiming: InjuryTimingResult;
    crossMarketDiscrepancy: CrossMarketDiscrepancyResult;
    overallProfessionalScore: number;
    confidence: number;
    recommendedAction: 'BET' | 'MONITOR' | 'AVOID';
    riskAdjustedEdge: number;
    expectedCLV: number;
    kellyFraction: number;
    maxPosition: number;
    processingTime: number;
    version: string;
    timestamp: string;
    config: ProfessionalFeatureConfig;
}
export interface ProfessionalFeatureEngine {
    analyzeProp(prop: ScoringFeatureSet, config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult>;
    batchAnalyze(props: ScoringFeatureSet[], config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult[]>;
    detectSteam(prop: ScoringFeatureSet): Promise<SteamDetectionResult>;
    predictClosingLine(prop: ScoringFeatureSet): Promise<ClosingLinePredictionResult>;
    calculateOptimalTiming(prop: ScoringFeatureSet): Promise<OptimalTimingResult>;
    findLineShoppingEdge(prop: ScoringFeatureSet): Promise<LineShoppingResult>;
    analyzePublicSharpSplit(prop: ScoringFeatureSet): Promise<PublicSharpSplitResult>;
    calculateMarketTiming(prop: ScoringFeatureSet): Promise<MarketTimingResult>;
    detectInjuryTiming(prop: ScoringFeatureSet): Promise<InjuryTimingResult>;
    findCrossMarketDiscrepancy(prop: ScoringFeatureSet): Promise<CrossMarketDiscrepancyResult>;
    getHealthStatus(): Promise<EngineHealthStatus>;
    getPerformanceMetrics(): Promise<EnginePerformanceMetrics>;
    updateConfig(config: Partial<ProfessionalFeatureConfig>): void;
}
export interface EngineHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    features: Record<string, FeatureHealthStatus>;
    lastUpdate: string;
    issues: string[];
}
export interface FeatureHealthStatus {
    enabled: boolean;
    operational: boolean;
    latency: number;
    errorRate: number;
    lastError?: string;
}
export interface EnginePerformanceMetrics {
    totalProcessed: number;
    avgProcessingTime: number;
    successRate: number;
    clvPerformance: number;
    accuracy: Record<string, number>;
    throughput: number;
}
export * from './steam-detection';
export * from './closing-line-prediction';
export * from './optimal-timing';
export * from './line-shopping';
export * from './public-sharp-split';
export * from './market-timing';
export * from './injury-timing';
export * from './cross-market-discrepancy';
//# sourceMappingURL=index.d.ts.map