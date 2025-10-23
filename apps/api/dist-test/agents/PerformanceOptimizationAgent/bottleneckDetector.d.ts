import { Logger } from '../../shared/logger/types';
interface PerformanceMetrics {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    database: number;
    cache: number;
    errorRate: number;
    throughput: number;
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
export declare class BottleneckDetector {
    private readonly logger;
    private thresholds;
    private detectionHistory;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    detectBottlenecks(metrics: PerformanceMetrics): Promise<PerformanceBottleneck[]>;
    private createBottleneck;
    private determineSeverity;
    private calculateImpact;
    private generateDescription;
    private generateRecommendations;
    private detectCompositeBottlenecks;
    private calculateSystemDegradationScore;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=bottleneckDetector.d.ts.map