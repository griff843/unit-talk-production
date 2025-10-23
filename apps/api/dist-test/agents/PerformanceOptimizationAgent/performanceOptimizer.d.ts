import { Logger } from '../../shared/logger/types';
interface OptimizationContext {
    metrics: any;
    bottlenecks: any[];
    systemHealth: any;
    baseline: Record<string, number>;
}
interface OptimizationRecommendation {
    id: string;
    type: 'resource' | 'configuration' | 'scaling' | 'caching' | 'query' | 'code';
    priority: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    title: string;
    description: string;
    expectedImpact: number;
    implementationCost: 'low' | 'medium' | 'high';
    actions: OptimizationAction[];
    estimatedTimeToImplement: number;
    metrics: Record<string, number>;
}
interface OptimizationAction {
    action: string;
    parameters: Record<string, any>;
    automated: boolean;
    safetyRating: number;
}
interface OptimizationResult {
    recommendationId: string;
    status: 'applied' | 'failed' | 'pending' | 'skipped';
    appliedAt?: Date;
    impact?: number;
    beforeMetrics: Record<string, number>;
    afterMetrics?: Record<string, number>;
    notes?: string;
}
export declare class PerformanceOptimizer {
    private readonly logger;
    private optimizationTemplates;
    private appliedOptimizations;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    generateRecommendations(context: OptimizationContext): Promise<OptimizationRecommendation[]>;
    applyOptimization(recommendation: OptimizationRecommendation): Promise<OptimizationResult>;
    private createCpuOptimizationRecommendation;
    private createMemoryOptimizationRecommendation;
    private createDatabaseOptimizationRecommendation;
    private createCacheOptimizationRecommendation;
    private createNetworkOptimizationRecommendation;
    private createErrorRateOptimizationRecommendation;
    private createBottleneckRecommendation;
    private executeOptimizationAction;
    private optimizeWorkerProcesses;
    private forceGarbageCollection;
    private optimizeConnectionPool;
    private optimizeCacheKeys;
    private enhanceErrorHandling;
    private captureCurrentMetrics;
    private calculateOptimizationImpact;
    private loadOptimizationTemplates;
    private loadAppliedOptimizations;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=performanceOptimizer.d.ts.map