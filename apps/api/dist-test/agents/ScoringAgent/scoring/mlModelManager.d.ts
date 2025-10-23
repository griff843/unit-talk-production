import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
export interface MLModelResult {
    score: number;
    professional_score?: number;
    confidence: number;
    featureImportance?: Record<string, number>;
}
export interface EnsembleResult extends MLModelResult {
    modelContributions: Record<string, number>;
    agreement: number;
}
/**
 * ML Model Manager for Fortune 100 Syndicate Level
 * Manages ensemble of ML models for advanced prop scoring
 */
export declare class MLModelManager {
    private modelVersions;
    private modelCache;
    constructor();
    /**
     * Initialize ML models
     */
    private initializeModels;
    /**
     * Score with Neural Network model
     */
    scoreWithNeuralNetwork(features: GradingFeatureSet): Promise<MLModelResult>;
    /**
     * Score with Gradient Boosting model
     */
    scoreWithGradientBoosting(features: GradingFeatureSet): Promise<MLModelResult>;
    /**
     * Score with Random Forest model
     */
    scoreWithRandomForest(features: GradingFeatureSet): Promise<MLModelResult>;
    /**
     * Score with Ensemble model
     */
    scoreWithEnsemble(features: GradingFeatureSet): Promise<EnsembleResult>;
    /**
     * Calculate base professional_score from features with safe mathematical operations
     */
    calculateBaseScore(features: GradingFeatureSet): number;
    /**
     * Apply Neural Network specific logic
     */
    private applyNeuralNetworkLogic;
    /**
     * Apply Gradient Boosting specific logic
     */
    private applyGradientBoostingLogic;
    /**
     * Apply Random Forest specific logic
     */
    private applyRandomForestLogic;
    /**
     * Calculate feature importance for a specific model
     */
    private calculateFeatureImportance;
    /**
     * Combine feature importance from multiple models
     */
    private combineFeatureImportance;
    /**
     * 🆕 GET DYNAMIC ENSEMBLE WEIGHTS - Sport-Specific Optimization (September 5, 2025)
     * Optimizes ML model weights based on sport characteristics for maximum accuracy
     */
    private getDynamicEnsembleWeights;
    /**
     * 🆕 LOG DYNAMIC WEIGHTS - Performance Tracking (September 5, 2025)
     * Tracks which sport-specific weights are being used for monitoring
     */
    private logDynamicWeights;
    /**
     * 🆕 GET ENSEMBLE PERFORMANCE METRICS - Analysis Tool (September 5, 2025)
     * Provides performance metrics for different sports and model combinations
     */
    getEnsemblePerformanceMetrics(): Record<string, any>;
    /**
     * Get model version
     */
    getModelVersion(): string;
    /**
     * Update model version
     */
    updateModelVersion(modelName: string, version: string): void;
    /**
     * Get all model versions
     */
    getModelVersions(): Record<string, string>;
    private initializeCache;
    private cleanupCache;
}
//# sourceMappingURL=mlModelManager.d.ts.map