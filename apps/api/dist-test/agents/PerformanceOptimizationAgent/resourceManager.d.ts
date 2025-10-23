import { Logger } from '../../shared/logger/types';
interface ResourcePrediction {
    resource: string;
    currentUsage: number;
    predictedUsage: number;
    timeHorizon: number;
    confidence: number;
    warningThreshold: number;
    criticalThreshold: number;
}
interface PredictionContext {
    currentMetrics: any;
    historicalData: any[];
    timeHorizons: number[];
}
interface ResourceTrend {
    resource: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number;
    confidence: number;
    lastUpdated: Date;
}
export declare class ResourceManager {
    private readonly logger;
    private resourceTrends;
    private predictionHistory;
    private resourceThresholds;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    generatePredictions(context: PredictionContext): Promise<ResourcePrediction[]>;
    private predictResourceUsage;
    private getCurrentResourceUsage;
    private calculateResourceTrend;
    private calculateLinearRegression;
    private calculatePredictionConfidence;
    assessResourceHealth(): Promise<Record<string, 'healthy' | 'warning' | 'critical'>>;
    getResourceTrends(): Promise<ResourceTrend[]>;
    optimizeResourceAllocation(_constraints: any): Promise<Record<string, number>>;
    private updatePredictionHistory;
    private loadResourceTrends;
    private loadPredictionHistory;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=resourceManager.d.ts.map