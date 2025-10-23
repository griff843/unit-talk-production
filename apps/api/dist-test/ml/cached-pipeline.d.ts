import { FeatureSet, PredictionResult } from '../types/ml';
import { MLPredictionCache } from '../cache/enhanced-cache';
export declare class CachedMLPipeline {
    private cache;
    private ttl;
    constructor(cache: MLPredictionCache, ttl?: number);
    predict(features: FeatureSet): Promise<PredictionResult>;
    private getPrediction;
}
//# sourceMappingURL=cached-pipeline.d.ts.map