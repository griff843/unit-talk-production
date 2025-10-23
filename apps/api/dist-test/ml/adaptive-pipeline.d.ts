import { AdaptiveConfig } from '../types/adaptive-ml';
import { CachedMLPipeline } from './cached-pipeline';
export declare class AdaptiveMLPipeline extends CachedMLPipeline {
    private logger;
    private monitoring;
    private config;
    private performanceHistory;
    private lastAdaptation;
    private adaptationCount;
    constructor(config: AdaptiveConfig);
    private initializeAdaptation;
    predict(input: any): Promise<any>;
    private trackPrediction;
    updateResult(predictionId: string, actualResult: any, profitLoss: number): Promise<void>;
    private evaluatePerformance;
    private calculateConfidenceAccuracy;
    private getConfidenceBin;
    private checkAdaptationTriggers;
    private identifyAdaptationTriggers;
    private triggerAdaptation;
    private generateModelUpdate;
    private analyzePerformancePatterns;
    private generateAdaptationStrategy;
    private identifyWeakAreas;
    private generateNewFeatures;
    private adjustFeatureWeights;
    private adjustRiskThresholds;
    private adjustPositionSizing;
    private applyModelUpdate;
    private retrainModel;
    private updateFeatures;
    private updateRiskParameters;
    private incrementalUpdate;
    getAdaptationStats(): any;
}
//# sourceMappingURL=adaptive-pipeline.d.ts.map