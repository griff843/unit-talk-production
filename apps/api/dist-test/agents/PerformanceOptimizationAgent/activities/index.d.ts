/**
 * PerformanceOptimizationAgent Temporal Activities
 *
 * Activity functions for system monitoring, bottleneck detection,
 * and automated performance optimization.
 */
export declare function monitorSystemPerformance(data: {
    components: string[];
    metricsWindow: number;
}): Promise<{
    success: boolean;
    metrics?: {
        [component: string]: {
            cpuUsage: number;
            memoryUsage: number;
            responseTime: number;
            throughput: number;
            errorRate: number;
            status: 'healthy' | 'warning' | 'critical';
        };
    };
}>;
export declare function detectBottlenecks(data: {
    systemMetrics: any;
    performanceThresholds: {
        responseTime: number;
        cpuUsage: number;
        memoryUsage: number;
        throughput: number;
    };
}): Promise<{
    success: boolean;
    bottlenecks?: Array<{
        component: string;
        type: 'cpu' | 'memory' | 'network' | 'database' | 'disk_io';
        severity: 'low' | 'medium' | 'high' | 'critical';
        impact: string;
        recommendation: string;
        estimatedImprovement: string;
    }>;
}>;
export declare function applyOptimization(data: {
    optimizationType: 'cache_tuning' | 'connection_pooling' | 'query_optimization' | 'resource_scaling';
    targetComponent: string;
    parameters: any;
}): Promise<{
    success: boolean;
    optimization?: {
        applied: boolean;
        estimatedImpact: string;
        rollbackPlan: string;
        verificationMetrics: string[];
        nextCheckTime: string;
    };
}>;
export declare function verifyOptimizationImpact(data: {
    optimizationId: string;
    beforeMetrics: any;
    afterMetrics: any;
    verificationMetrics: string[];
}): Promise<{
    success: boolean;
    verification?: {
        improvementAchieved: boolean;
        impactAnalysis: {
            [metric: string]: {
                before: number;
                after: number;
                improvement: number;
                improvementPercentage: number;
            };
        };
        overallScore: number;
        recommendation: 'keep' | 'rollback' | 'adjust';
        reasoning: string;
    };
}>;
export declare function generatePerformanceReport(data: {
    timeRange: string;
    components: string[];
}): Promise<{
    success: boolean;
    report?: {
        summary: {
            totalOptimizations: number;
            successfulOptimizations: number;
            averageImprovement: number;
            criticalIssues: number;
        };
        componentAnalysis: Array<{
            component: string;
            healthScore: number;
            trends: string[];
            recommendations: string[];
        }>;
        systemOverview: {
            overallHealth: number;
            performanceTrend: 'improving' | 'stable' | 'declining';
            nextActions: string[];
        };
    };
}>;
export declare function checkPerformanceOptimizationAgentHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
//# sourceMappingURL=index.d.ts.map