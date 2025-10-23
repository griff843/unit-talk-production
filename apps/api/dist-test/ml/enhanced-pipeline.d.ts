import { FeatureSet, PredictionResult } from '../types/ml';
export interface PipelineConfig {
    caching: {
        enabled: boolean;
        ttl: number;
    };
    preprocessing: {
        enabled: boolean;
        steps: string[];
    };
    postprocessing: {
        enabled: boolean;
        steps: string[];
    };
    monitoring: {
        enabled: boolean;
        metrics: string[];
    };
}
export declare class EnhancedMLPipeline {
    private config;
    private models;
    constructor(config: PipelineConfig);
    predict(features: FeatureSet): Promise<PredictionResult>;
    private checkCache;
    private preprocess;
    private getPrediction;
    private aggregatePredictions;
    private postprocess;
    private cacheResult;
    private trackMetrics;
}
//# sourceMappingURL=enhanced-pipeline.d.ts.map