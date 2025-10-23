import { ScoringFeatureSet } from '../../../types/ScoringFeatureSet';
import { EnhancedScoringResult } from './enhancedScoringEngine';
export interface ScoringWeights {
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
export interface ScoringConfig {
    name: string;
    version: string;
    weights: ScoringWeights;
    enabled: boolean;
    sport?: string;
    marketType?: string;
    minConfidence: number;
    maxRisk: number;
    description: string;
}
export interface ScoringResult {
    propId: string;
    finalScore: number;
    confidence: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    edgeScore: number;
    featureContributions: Record<string, number>;
    modelContributions: Record<string, number>;
    kellyFraction: number;
    positionSize: number;
    riskScore: number;
    correlationRisk: number;
    scenarioAnalysis: {
        bullCase: {
            score: number;
            probability: number;
        };
        baseCase: {
            score: number;
            probability: number;
        };
        bearCase: {
            score: number;
            probability: number;
        };
    };
    professionalInsights: {
        steamMoveDetected: boolean;
        predictedClosingLine: number;
        optimalBettingTime: string;
        bestAvailableLine: number;
        bestBook: string;
        publicBettingPercentage: number;
        sharpBettingPercentage: number;
        contrarianOpportunity: boolean;
        injuryTimingAdvantage: number;
        crossMarketArbitrage: number;
    };
    enhancedCapperAnalysis?: EnhancedScoringResult;
    deviggingResult?: {
        originalEdge: number;
        deviggedEdge: number;
        totalVig: number;
        fairOdds: number;
        trueValue: boolean;
    };
    dataQuality: number;
    modelAgreement: number;
    historicalAccuracy: number;
    timestamp: string;
    modelVersion: string;
    configUsed: string;
}
export declare class SyndicateGradingEngine {
    private mlModelManager;
    private featureEngineer;
    private riskManager;
    private performanceAnalyzer;
    private scoringConfigs;
    private activeConfig;
    private _performanceHistory;
    private lineMovementHistory;
    private bettingPercentages;
    private bookLines;
    private injuryNews;
    private crossMarketData;
    constructor();
    /**
     * Initialize Fortune 100 level scoring configurations
     */
    private initializeDefaultConfigs;
    /**
     * Grade a single prop with Fortune 100 level analysis
     * NOW INCLUDES: Professional devigging and CLV tracking
     */
    scoreProp(features: ScoringFeatureSet): Promise<ScoringResult>;
    /**
     * Convert new SportSpecificWeights format to legacy ScoringWeights format
     */
    private convertToLegacyWeights;
    /**
     * Get ML model predictions with ensemble scoring
     */
    private getMLPredictions;
    /**
     * Calculate composite professional_score with dynamic weight optimization
     */
    private calculateCompositeScore;
    /**
     * Calculate core scoring components
     */
    private calculateCoreScore;
    /**
     * Calculate market intelligence professional_score
     */
    private calculateMarketIntelligenceScore;
    /**
     * Calculate ML model professional_score
     */
    private calculateMLScore;
    /**
     * Calculate game context professional_score
     */
    private calculateContextScore;
    /**
     * Calculate risk-adjusted professional_score
     */
    private calculateRiskScore;
    /**
     * Assess comprehensive risk for the prop
     */
    private assessRisk;
    /**
     * Generate scenario analysis for the prop
     */
    private generateScenarioAnalysis;
    /**
     * Calculate feature contributions using SHAP-like methodology
     */
    private calculateFeatureContributions;
    /**
     * Determine tier and confidence based on professional_score and risk
     */
    private determineTierAndConfidence;
    /**
     * Calculate Kelly fraction for optimal position sizing
     */
    private calculateKellyFraction;
    /**
     * Get historical accuracy for similar props
     */
    private getHistoricalAccuracy;
    /**
     * Log performance for continuous improvement
     */
    private logPerformance;
    /**
     * Update scoring configuration
     */
    updateScoringConfig(configName: string, config: ScoringConfig): void;
    /**
     * Switch active scoring configuration
     */
    setActiveConfig(configName: string): void;
    /**
     * Get available scoring configurations
     */
    getAvailableConfigs(): string[];
    /**
     * Get current scoring configuration
     */
    getCurrentConfig(): ScoringConfig;
    /**
     * Optimize weights based on historical performance
     */
    optimizeWeights(timeframe?: string): Promise<ScoringWeights>;
    private getPerformanceData;
    private analyzeFeaturePerformance;
    private calculatePerformanceCorrelation;
    private initializePerformanceTracking;
    /**
     * Batch grade multiple props efficiently
     */
    scoreProps(propsList: ScoringFeatureSet[]): Promise<ScoringResult[]>;
    /**
     * Calculate all professional capper insights
     */
    private calculateProfessionalInsights;
    /**
     * Calculate professional capper professional_score contribution
     */
    private calculateProfessionalCapperScore;
    /**
     * 1. Real-time Steam Move Detection
     */
    private detectSteamMove;
    /**
     * 2. Closing Line Prediction
     */
    private predictClosingLine;
    /**
     * 3. Optimal Betting Time Calculation
     */
    private calculateOptimalBettingTime;
    /**
     * 4. Multi-book Line Shopping
     */
    private findBestAvailableLine;
    /**
     * 5. Public vs Sharp Betting Percentages
     */
    private getBettingPercentages;
    /**
     * 7. Injury Timing Edge
     */
    private calculateInjuryTimingAdvantage;
    /**
     * 8. Cross Market Discrepancy Detection
     */
    private calculateCrossMarketArbitrage;
    private calculateHoursToGame;
    private calculateLineTrend;
    /**
     * Update line movement data (called by external data feeds)
     */
    updateLineMovement(propId: string, line: number, volume?: number): void;
    /**
     * Update betting percentages (called by external data feeds)
     */
    updateBettingPercentages(propId: string, publicPercentage: number, sharpPercentage: number): void;
    /**
     * Update multi-book lines (called by external data feeds)
     */
    updateBookLines(propId: string, book: string, line: number, odds: number): void;
    /**
     * Add injury news timing (called by news feeds)
     */
    addInjuryNews(propId: string, severity: number, newsBreakTimestamp: number): void;
    /**
     * Add cross-market relationship (called during prop setup)
     */
    addCrossMarketRelationship(propId: string, relatedPropId: string, correlation: number): void;
    /**
     * Check if current time is within trade deadline window
     */
    private isTradeDeadlineWindow;
    /**
     * Devig odds - THE most critical method for sharp betting
     * No professional system works with raw, juiced lines
     */
    private devigOdds;
    /**
     * Start CLV tracking for this pick
     */
    private startCLVTracking;
    /**
     * Calculate model probability from features
     */
    private calculateModelProbability;
    /**
     * Calculate opposite odds for devigging
     */
    private calculateOppositeOdds;
    /**
     * Convert probability to American odds
     */
    private probToAmericanOdds;
    /**
     * Estimate vig from two odds
     */
    private estimateVig;
    /**
     * Trigger feedback loop (should be called periodically)
     */
    triggerFeedbackLoop(): Promise<void>;
}
//# sourceMappingURL=gradingEngine.d.ts.map