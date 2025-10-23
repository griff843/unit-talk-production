export interface AdaptiveConfig {
    evaluationInterval: number;
    triggerCheckInterval: number;
    adaptationWindow: number;
    trainingWindow: number;
    evaluationWindow: number;
    minSamplesForEvaluation: number;
    minSamplesForAdaptation: number;
    minSamplesPerBin: number;
    accuracyThreshold: number;
    profitLossThreshold: number;
    maxTimeBetweenAdaptations: number;
    maxHistorySize: number;
}
export interface ModelPerformance {
    predictionId?: string;
    timestamp: number;
    input: any;
    prediction: number;
    confidence: number;
    actualResult: number | null;
    accuracy: number | null;
    profitLoss: number | null;
}
export interface AdaptationTrigger {
    type: 'accuracy_degradation' | 'profit_loss' | 'time_based';
    severity: 'low' | 'medium' | 'high';
    currentValue: number;
    threshold: number;
    description: string;
}
export interface ModelUpdate {
    type: 'comprehensive_retraining' | 'feature_engineering_update' | 'risk_adjustment' | 'incremental_update';
    parameters: any;
    confidence: number;
    timestamp: number;
    triggers: AdaptationTrigger[];
}
export interface PerformancePatterns {
    sportPerformance: Map<string, {
        correct: number;
        total: number;
    }>;
    marketPerformance: Map<string, {
        correct: number;
        total: number;
    }>;
    confidencePerformance: Map<string, {
        correct: number;
        total: number;
    }>;
    timeOfDayPerformance: Map<string, {
        correct: number;
        total: number;
    }>;
}
export interface AdaptationStrategy {
    type: string;
    parameters: any;
    confidence: number;
}
export interface FeatureUpdate {
    newFeatures: NewFeature[];
    featureWeights: Map<string, number>;
}
export interface NewFeature {
    name: string;
    type: 'numerical' | 'categorical';
    calculation: number | string;
}
export interface RiskAdjustment {
    riskThresholds: Map<string, number>;
    positionSizing: Map<string, number>;
}
export interface ModelRetraining {
    learningRate: number;
    epochs: number;
    batchSize: number;
    focusAreas: string[];
}
export interface IncrementalUpdate {
    learningRate: number;
    epochs: number;
    batchSize: number;
}
export interface AdaptationMetrics {
    adaptationCount: number;
    lastAdaptation: number;
    performanceHistorySize: number;
    averageAccuracy: number;
    averageProfitLoss: number;
    adaptationFrequency: number;
}
export interface ModelHealth {
    status: 'healthy' | 'degraded' | 'critical';
    accuracy: number;
    confidence: number;
    lastAdaptation: number;
    adaptationCount: number;
    performanceTrend: 'improving' | 'stable' | 'declining';
}
//# sourceMappingURL=adaptive-ml.d.ts.map