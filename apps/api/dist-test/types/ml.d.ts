export interface FeatureSet {
    id: string;
    features: {
        [key: string]: number | string;
    };
    metadata: {
        timestamp: string;
        source: string;
    };
}
export interface PredictionResult {
    id: string;
    featureSetId: string;
    prediction: number;
    confidence: number;
    metadata: {
        modelVersion: string;
        timestamp: string;
        cached: boolean;
    };
}
export interface ModelConfig {
    name: string;
    version: string;
    type: 'classification' | 'regression';
    hyperparameters: {
        [key: string]: number | string | boolean;
    };
    features: {
        name: string;
        type: 'numeric' | 'categorical';
        preprocessing?: string[];
    }[];
}
export interface ModelMetrics {
    id: string;
    modelId: string;
    timestamp: string;
    metrics: {
        accuracy?: number;
        precision?: number;
        recall?: number;
        f1Score?: number;
        mse?: number;
        rmse?: number;
        mae?: number;
    };
    confusionMatrix?: {
        truePositives: number;
        trueNegatives: number;
        falsePositives: number;
        falseNegatives: number;
    };
    featureImportance?: {
        [key: string]: number;
    };
    validationMetrics?: {
        [key: string]: number;
    };
}
export interface ModelPerformance {
    modelId: string;
    period: string;
    metrics: ModelMetrics;
    predictions: number;
    accuracy: number;
    profitLoss?: number;
}
export interface HistoricalFeatures {
    playerId: string;
    gameId: string;
    features: {
        last5Games: number[];
        last10Games: number[];
        seasonAverage: number;
        homeAwayAverage: number;
        vsOpponentAverage: number;
        recentForm: number;
        consistency: number;
    };
}
export interface MarketFeatures {
    propId: string;
    features: {
        lineMovement: number;
        publicBettingPercentage: number;
        sharpMoney: boolean;
        steamMove: boolean;
        reverseLineMovement: boolean;
        closingLineValue: number;
    };
}
export interface ContextFeatures {
    gameId: string;
    features: {
        gameImportance: number;
        restDays: number;
        travelDistance: number;
        altitude: number;
        weather?: {
            temperature: number;
            windSpeed: number;
            precipitation: number;
        };
        injuries: string[];
        narratives: string[];
    };
}
export interface FeatureMetadata {
    featureSetId: string;
    createdAt: string;
    updatedAt: string;
    source: string;
    version: string;
    quality: number;
    completeness: number;
}
export interface TrainingConfig {
    modelType: string;
    features: string[];
    targetVariable: string;
    trainTestSplit: number;
    validationStrategy: 'holdout' | 'kfold' | 'timeseries';
    hyperparameters: {
        [key: string]: any;
    };
    preprocessing: {
        scaling?: 'standard' | 'minmax' | 'robust';
        encoding?: 'onehot' | 'label' | 'target';
        imputation?: 'mean' | 'median' | 'mode' | 'forward' | 'backward';
    };
}
export interface PipelineConfig {
    caching: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
    };
    preprocessing: {
        scaling: boolean;
        encoding: boolean;
        featureSelection: boolean;
    };
    postprocessing: {
        calibration: boolean;
        ensembling: boolean;
    };
    monitoring: {
        enabled: boolean;
        metrics: string[];
        alerts: {
            accuracy: number;
            latency: number;
        };
    };
}
//# sourceMappingURL=ml.d.ts.map