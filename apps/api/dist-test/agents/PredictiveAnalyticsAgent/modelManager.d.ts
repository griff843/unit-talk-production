import { Logger } from '../../shared/logger/types';
interface MLModel {
    modelId: string;
    name: string;
    type: 'classification' | 'regression' | 'time_series' | 'ensemble' | 'neural_network';
    version: string;
    status: 'training' | 'deployed' | 'deprecated' | 'failed';
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    features: string[];
    hyperparameters: Record<string, any>;
    trainedOn: Date;
    lastUpdated: Date;
    datasetSize: number;
    validationScore: number;
    productionMetrics: ModelMetrics;
}
interface ModelMetrics {
    predictions: number;
    correctPredictions: number;
    averageConfidence: number;
    latency: number;
    errorRate: number;
    drift: number;
    lastEvaluated: Date;
}
interface ModelPerformance {
    modelId: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    roc_auc: number;
    calibration: number;
    lastUpdated: Date;
    sampleSize: number;
    performanceTrend: 'improving' | 'declining' | 'stable';
}
export declare class ModelManager {
    private readonly logger;
    private models;
    private trainingJobs;
    private modelEvaluations;
    private autoMLConfig;
    private modelRegistry;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    identifyModelsForUpdate(): Promise<string[]>;
    updateModel(modelId: string): Promise<boolean>;
    checkRetrainingNeeds(): Promise<string[]>;
    retrainModels(modelIds: string[]): Promise<boolean[]>;
    getAllModels(): Promise<MLModel[]>;
    calculateModelPerformance(modelId: string): Promise<ModelPerformance>;
    deployNewModel(name: string, type: MLModel['type'], features: string[], hyperparameters: Record<string, any>): Promise<string>;
    runAutoML(features: string[], targetVariable: string, problemType: 'classification' | 'regression'): Promise<string>;
    private evaluateRetrainingNeed;
    private retrainModel;
    private getTrainingData;
    private optimizeHyperparameters;
    private createTrainingJob;
    private executeTraining;
    private generateLearningCurve;
    private generateFeatureImportance;
    private deployUpdatedModel;
    private getRecentPerformanceMetrics;
    private getHistoricalPerformanceMetrics;
    private calculatePerformanceTrend;
    private calculateROCAUC;
    private calculateCalibration;
    private runHyperparameterOptimization;
    private storeModelInRegistry;
    private loadExistingModels;
    private loadTrainingJobs;
    private loadModelEvaluations;
    private initializeDefaultModels;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=modelManager.d.ts.map