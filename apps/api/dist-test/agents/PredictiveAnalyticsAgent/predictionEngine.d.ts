import { Logger } from '../../shared/logger/types';
interface MarketContext {
    id: string;
    gameId: string;
    betType: string;
    status: 'active' | 'suspended' | 'closed';
    timeToEvent: number;
    currentOdds: number;
    volume: number;
    liquidity: number;
}
interface PredictionResult {
    predictionId: string;
    marketId: string;
    gameId: string;
    betType: string;
    predictedOutcome: PredictedOutcome;
    confidence: number;
    expectedAccuracy: number;
    modelUsed: string;
    modelEnsemble: ModelContribution[];
    dataQuality: number;
    timeHorizon: number;
    uncertaintyBounds: UncertaintyBounds;
    featureImportance: Record<string, number>;
    createdAt: Date;
    expiresAt: Date;
}
interface PredictedOutcome {
    winProbability: number;
    expectedValue: number;
    oddsRange: {
        min: number;
        max: number;
    };
    volatility: number;
    marketDirection: 'bullish' | 'bearish' | 'neutral';
    supportLevel: number;
    resistanceLevel: number;
    momentum: number;
    fairOdds: number;
    edgePercentage: number;
}
interface ModelContribution {
    modelId: string;
    prediction: number;
    confidence: number;
    weight: number;
    accuracy: number;
    latency: number;
}
interface UncertaintyBounds {
    lower: number;
    upper: number;
    standardError: number;
    confidenceInterval: number;
    predictionInterval: number;
}
interface PredictionMetrics {
    totalPredictions: number;
    averageConfidence: number;
    averageAccuracy: number;
    calibrationScore: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    averageEdge: number;
    modelPerformance: Map<string, ModelPerformanceMetrics>;
}
interface ModelPerformanceMetrics {
    modelId: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
    calibration: number;
    sharpness: number;
    resolution: number;
    totalPredictions: number;
    lastEvaluated: Date;
}
export declare class PredictionEngine {
    private readonly logger;
    private ensembleConfig;
    private calibrationData;
    private predictionHistory;
    private modelPerformance;
    private confidenceThresholds;
    private featureScalers;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    generatePrediction(market: MarketContext): Promise<PredictionResult | null>;
    validatePrediction(predictionId: string, actualOutcome: any): Promise<{
        accuracy: number;
        calibration: number;
        sharpness: number;
    }>;
    getEnsemblePerformance(): Promise<PredictionMetrics>;
    private prepareFeatures;
    private validatePredictionRequest;
    private selectModels;
    private generateEnsemblePredictions;
    private generateModelPrediction;
    private calculateBaselineProbability;
    private getModelVariation;
    private getContextualAdjustment;
    private aggregatePredictions;
    private weightedAverage;
    private stackingAggregation;
    private votingAggregation;
    private bayesianAggregation;
    private determineMarketDirection;
    private calculateUncertaintyBounds;
    private applyCalibration;
    private calculateFeatureImportance;
    private calculateContributionVariance;
    private calculateOverallConfidence;
    private getEnsembleDescription;
    private assessDataQuality;
    private estimateAccuracy;
    private getBidAskSpread;
    private getMarketDepth;
    private getOrderFlow;
    private getPriceMomentum;
    private getVolatility;
    private getTrendStrength;
    private encodeMarketType;
    private getCorrelationRisk;
    private getConcentrationRisk;
    private getLiquidityRisk;
    private getRecencyScore;
    private getModelConfidence;
    private calculateSupport;
    private calculateResistance;
    private calculateMomentum;
    private calculateAccuracy;
    private calculateSharpness;
    private updateCalibrationData;
    private createEmptyCalibrationData;
    private calculateCalibrationBins;
    private calculateCalibration;
    private updateModelPerformance;
    private getPredictionById;
    private getDefaultMetrics;
    private storePrediction;
    private updatePredictionMetrics;
    private loadEnsembleConfiguration;
    private loadCalibrationData;
    private loadPredictionHistory;
    private loadModelPerformance;
    private initializeFeatureScalers;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=predictionEngine.d.ts.map