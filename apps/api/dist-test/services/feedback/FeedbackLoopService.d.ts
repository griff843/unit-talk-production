/**
 * Automated Feedback Loop Service
 * Uses CLV/ROI data to continuously optimize weights and features
 * This is what separates sharp systems from static models
 *
 * @module FeedbackLoopService
 */
import type { ScoringWeights } from '../../agents/ScoringAgent/scoring/gradingEngine';
export interface WeightAdjustment {
    feature: keyof ScoringWeights;
    oldWeight: number;
    newWeight: number;
    reason: string;
    clvImpact: number;
    confidence: number;
}
export interface BookPerformance {
    book: string;
    avgCLV: number;
    betCount: number;
    roi: number;
    reliability: number;
    weight: number;
    suggestedWeight: number;
}
export interface MarketPerformance {
    sport: string;
    market: string;
    avgCLV: number;
    betCount: number;
    confidence: number;
    edgeMultiplier: number;
}
export interface FeatureImportance {
    feature: keyof ScoringWeights;
    importance: number;
    clvCorrelation: number;
    shouldPrune: boolean;
}
export declare class FeedbackLoopService {
    private static instance;
    private logger;
    private gradingEngine;
    private readonly MIN_SAMPLE_SIZE;
    private readonly ADJUSTMENT_RATE;
    private readonly CLV_TARGET;
    private readonly PRUNE_THRESHOLD;
    private constructor();
    static getInstance(): FeedbackLoopService;
    /**
     * Main feedback loop - runs automatically
     * Should be scheduled to run every 6-24 hours
     */
    runFeedbackLoop(): Promise<{
        weightAdjustments: WeightAdjustment[];
        bookAdjustments: BookPerformance[];
        marketAdjustments: MarketPerformance[];
        prunedFeatures: string[];
    }>;
    /**
     * Analyze recent CLV performance by feature
     */
    private analyzeRecentCLV;
    /**
     * Calculate correlation between feature values and CLV
     */
    private calculateFeatureCLVCorrelation;
    /**
     * Adjust feature weights based on CLV performance
     */
    private adjustFeatureWeights;
    /**
     * Adjust sportsbook weights based on CLV performance
     */
    private adjustBookWeights;
    /**
     * Calculate reliability professional_score for a book
     */
    private calculateReliability;
    /**
     * Adjust market-specific confidence multipliers
     */
    private adjustMarketConfidence;
    /**
     * Prune underperforming features
     */
    private pruneFeatures;
    /**
     * Apply all adjustments to the system
     */
    private applyAdjustments;
    /**
     * Log feedback loop results for monitoring
     */
    private logFeedbackResults;
    /**
     * Get optimization history
     */
    getOptimizationHistory(days?: number): Promise<any[]>;
    /**
     * Manual trigger for immediate optimization
     */
    triggerOptimization(): Promise<any>;
}
export declare const feedbackLoopService: FeedbackLoopService;
//# sourceMappingURL=FeedbackLoopService.d.ts.map