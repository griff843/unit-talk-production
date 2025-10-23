/**
 * Professional Features Integration Layer
 * Integrates all 8 Professional Features with ScoringAgent
 *
 * This layer connects the professional betting features to the existing
 * ScoringAgent system, ensuring all picks receive syndicate-level analysis.
 */
import { EventEmitter } from 'events';
import type { ScoringFeatureSet } from '../../../types/ScoringFeatureSet';
import type { ProfessionalFeaturesResult, ProfessionalFeatureConfig, ProfessionalFeatureEngine } from '../../../professional/types';
import type { SteamDetectionResult } from '../../../professional/types/steam-detection';
import type { ClosingLinePredictionResult } from '../../../professional/types/closing-line-prediction';
export interface ProfessionalIntegrationConfig {
    enabledFeatures: string[];
    parallelProcessing: boolean;
    maxProcessingTime: number;
    cacheResults: boolean;
    cacheTTL: number;
    minConfidenceThreshold: number;
    requireAllFeatures: boolean;
    fallbackToBasicScoring: boolean;
    professionalWeights: {
        steamDetection: number;
        closingLinePrediction: number;
        optimalTiming: number;
        lineShopping: number;
        publicSharpSplit: number;
        marketTiming: number;
        injuryTiming: number;
        crossMarketDiscrepancy: number;
    };
}
export interface ProfessionalScoringResult {
    originalScore: number;
    originalTier: string;
    originalConfidence: number;
    professionalScore: number;
    professionalTier: 'SYNDICATE' | 'SHARP' | 'RECREATIONAL';
    professionalConfidence: number;
    features: {
        steamDetection?: SteamDetectionResult;
        closingLinePrediction?: ClosingLinePredictionResult;
        optimalTiming?: any;
        lineShopping?: any;
        publicSharpSplit?: any;
        marketTiming?: any;
        injuryTiming?: any;
        crossMarketDiscrepancy?: any;
    };
    overallProfessionalScore: number;
    syndicateLevelEdge: number;
    riskAdjustedScore: number;
    expectedCLV: number;
    kellyFraction: number;
    recommendation: 'BET_IMMEDIATELY' | 'MONITOR_FOR_ENTRY' | 'WAIT_FOR_OPTIMAL' | 'AVOID';
    reasoning: string;
    urgency: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
    processingTime: number;
    featuresProcessed: string[];
    warnings: string[];
    errors: string[];
}
export declare class ProfessionalFeaturesIntegration extends EventEmitter implements ProfessionalFeatureEngine {
    private logger;
    private config;
    private resultCache;
    private steamEngine;
    private closingLineEngine;
    constructor(config?: Partial<ProfessionalIntegrationConfig>);
    private initializeEngines;
    /**
     * Main integration method - enhance existing scoring with professional features
     */
    enhanceScoringWithProfessionalFeatures(featureSet: ScoringFeatureSet, originalScoringResult: any): Promise<ProfessionalScoringResult>;
    /**
     * Process all enabled professional features
     */
    private processAllProfessionalFeatures;
    /**
     * Process Steam Detection feature
     */
    private processSteamDetection;
    /**
     * Process Closing Line Prediction feature
     */
    private processClosingLinePrediction;
    /**
     * Calculate professional enhancement over basic scoring
     */
    private calculateProfessionalEnhancement;
    /**
     * Calculate syndicate-level edge from professional features
     */
    private calculateSyndicateEdge;
    /**
     * Calculate risk factor from professional features
     */
    private calculateRiskFactor;
    /**
     * Calculate expected CLV from professional features
     */
    private calculateExpectedCLV;
    /**
     * Generate professional recommendation
     */
    private generateProfessionalRecommendation;
    /**
     * Create fallback result when professional features fail
     */
    private createFallbackResult;
    private generateMockLineHistory;
    private generateMockVolumeHistory;
    private calculateHoursUntilGame;
    analyzeProp(prop: ScoringFeatureSet, config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult>;
    batchAnalyze(props: ScoringFeatureSet[], config?: Partial<ProfessionalFeatureConfig>): Promise<ProfessionalFeaturesResult[]>;
    detectSteam(prop: ScoringFeatureSet): Promise<import("../../../professional/types").SteamAnalysisResult>;
    predictClosingLine(prop: ScoringFeatureSet): Promise<ClosingLinePredictionResult>;
    calculateOptimalTiming(prop: ScoringFeatureSet): Promise<null>;
    findLineShoppingEdge(prop: ScoringFeatureSet): Promise<null>;
    analyzePublicSharpSplit(prop: ScoringFeatureSet): Promise<null>;
    calculateMarketTiming(prop: ScoringFeatureSet): Promise<null>;
    detectInjuryTiming(prop: ScoringFeatureSet): Promise<null>;
    findCrossMarketDiscrepancy(prop: ScoringFeatureSet): Promise<null>;
    getHealthStatus(): Promise<{
        status: "HEALTHY";
        features: {};
        lastUpdate: string;
        issues: never[];
    }>;
    getPerformanceMetrics(): Promise<{
        totalProcessed: number;
        avgProcessingTime: number;
        successRate: number;
        clvPerformance: number;
        accuracy: {};
        throughput: number;
    }>;
    updateConfig(config: Partial<ProfessionalFeatureConfig>): void;
    private convertToSteamInput;
    private convertToClosingLineInput;
}
//# sourceMappingURL=ProfessionalFeaturesIntegration.d.ts.map