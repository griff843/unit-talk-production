/**
 * Closing Line Prediction Engine
 * Feature 2 of 8 Professional Capper Features
 *
 * ML-powered line closure forecasting using historical patterns
 * Predict final closing line from current line + time remaining
 * Account for injury news, weather, and market dynamics
 * Optimize entry timing for maximum CLV capture
 */
import type { ClosingLinePredictionEngine as IClosingLinePredictionEngine, ClosingLinePredictionConfig, ClosingLinePredictionInput, ClosingLinePredictionResult, ModelInfo, ModelValidationResult, BacktestResult, AccuracyMetrics, AccuracyFilters, PredictionPerformanceMetrics, EngineHealthStatus } from '../types/closing-line-prediction';
export declare class ClosingLinePredictionEngine implements IClosingLinePredictionEngine {
    private logger;
    private config;
    private metrics;
    private modelInfo;
    private predictionHistory;
    constructor(config?: Partial<ClosingLinePredictionConfig>);
    private initializeModel;
    private initializeMetrics;
    /**
     * Core closing line prediction
     */
    predictClosingLine(input: ClosingLinePredictionInput): Promise<ClosingLinePredictionResult>;
    /**
     * Batch predict multiple lines
     */
    batchPredictLines(inputs: ClosingLinePredictionInput[]): Promise<ClosingLinePredictionResult[]>;
    /**
     * Validate prediction input
     */
    private validateInput;
    /**
     * Analyze historical patterns
     */
    private analyzeHistoricalPatterns;
    /**
     * Analyze market dynamics
     */
    private analyzeMarketDynamics;
    /**
     * Analyze injury impact
     */
    private analyzeInjuryImpact;
    /**
     * Analyze weather impact
     */
    private analyzeWeatherImpact;
    /**
     * Analyze public sentiment
     */
    private analyzePublicSentiment;
    /**
     * Analyze sharp money patterns
     */
    private analyzeSharpMoney;
    /**
     * Run ML prediction (simplified implementation)
     */
    private runMLPrediction;
    /**
     * Calculate optimal timing for entry
     */
    private calculateOptimalTiming;
    /**
     * Estimate CLV potential
     */
    private estimateCLVPotential;
    /**
     * Assess prediction risks
     */
    private assessPredictionRisks;
    /**
     * Generate actionable recommendation
     */
    private generateRecommendation;
    /**
     * Get recommendation reasoning text
     */
    private getRecommendationReasoning;
    /**
     * Update performance metrics
     */
    private updateMetrics;
    updateModel(modelData: any): Promise<void>;
    getModelInfo(): ModelInfo;
    validateModel(): Promise<ModelValidationResult>;
    backtestModel(period: string): Promise<BacktestResult>;
    getHistoricalAccuracy(filters?: AccuracyFilters): Promise<AccuracyMetrics>;
    getPerformanceMetrics(): Promise<PredictionPerformanceMetrics>;
    checkHealth(): Promise<EngineHealthStatus>;
    updateConfig(config: Partial<ClosingLinePredictionConfig>): void;
    getConfig(): ClosingLinePredictionConfig;
}
//# sourceMappingURL=ClosingLinePredictionEngine.d.ts.map