import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
interface SystemHealth {
    status: 'healthy' | 'degraded' | 'critical' | 'down';
    score: number;
    professional_score?: number;
    components: ComponentHealth[];
    bottlenecks: PerformanceBottleneck[];
    recommendations: OptimizationRecommendation[];
    lastUpdated: Date;
}
interface ComponentHealth {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, number>;
    lastCheck: Date;
    issues?: string[];
}
interface PerformanceBottleneck {
    id: string;
    type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'cache' | 'agent';
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    description: string;
    impact: number;
    detectedAt: Date;
    metrics: Record<string, number>;
    recommendations: string[];
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
export declare class PerformanceOptimizationAgent extends BaseAgent {
    private systemMonitor;
    private performanceOptimizer;
    private bottleneckDetector;
    private resourceManager;
    private performanceMetrics;
    private systemHealth;
    private activeBottlenecks;
    private optimizationHistory;
    private performanceBaseline;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    private collectSystemMetrics;
    private monitorComponentHealth;
    private detectBottlenecks;
    private generateOptimizationRecommendations;
    private applyAutomatedOptimizations;
    private updateResourcePredictions;
    private generatePerformanceReport;
    private determineOverallStatus;
    private sendBottleneckAlert;
    private logBottleneckResolution;
    private sendResourceWarning;
    private storeMetricsForTrendAnalysis;
    private getHistoricalMetrics;
    private analyzePerformanceTrends;
    private getResourcePredictions;
    private getAlertCount;
    private generateSummaryInsights;
    private loadPerformanceBaseline;
    private loadOptimizationHistory;
    private loadActiveBottlenecks;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<any>;
    getSystemHealth(): Promise<SystemHealth>;
    getActiveBottlenecks(): Promise<PerformanceBottleneck[]>;
    getOptimizationRecommendations(): Promise<OptimizationRecommendation[]>;
}
export {};
//# sourceMappingURL=index.d.ts.map