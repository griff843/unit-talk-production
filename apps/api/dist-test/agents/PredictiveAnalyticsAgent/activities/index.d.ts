/**
 * PredictiveAnalyticsAgent Temporal Activities
 *
 * Activity functions for market forecasting, ML model management,
 * and predictive analytics workflows.
 */
export declare function generateMarketForecast(data: {
    market: string;
    timeframe: '1d' | '7d' | '30d';
    features: any[];
}): Promise<{
    success: boolean;
    forecast?: {
        predictions: Array<{
            date: string;
            prediction: number;
            confidence: number;
            factors: string[];
        }>;
        accuracy: number;
        modelUsed: string;
    };
}>;
export declare function trainPredictionModel(data: {
    modelType: 'regression' | 'classification' | 'time_series' | 'neural_network';
    trainingData: any[];
    features: string[];
    targetVariable: string;
}): Promise<{
    success: boolean;
    modelMetrics?: {
        accuracy: number;
        precision: number;
        recall: number;
        f1Score: number;
        crossValidationScore: number;
        featureImportance: Array<{
            feature: string;
            importance: number;
        }>;
    };
}>;
export declare function detectAnomalies(data: {
    timeSeriesData: Array<{
        timestamp: string;
        value: number;
        metadata?: any;
    }>;
    sensitivity: number;
}): Promise<{
    success: boolean;
    anomalies?: Array<{
        timestamp: string;
        value: number;
        anomalyScore: number;
        type: 'spike' | 'drop' | 'trend_change' | 'seasonal_deviation';
        explanation: string;
    }>;
}>;
export declare function updateModelEnsemble(data: {
    ensembleId: string;
    models: Array<{
        modelId: string;
        weight: number;
        performance: number;
    }>;
}): Promise<{
    success: boolean;
    ensembleMetrics?: {
        combinedAccuracy: number;
        consensusScore: number;
        diversityIndex: number;
        recommendedWeights: Array<{
            modelId: string;
            currentWeight: number;
            recommendedWeight: number;
        }>;
    };
}>;
export declare function checkPredictiveAnalyticsAgentHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
//# sourceMappingURL=index.d.ts.map