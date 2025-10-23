/**
 * UserRetentionAgent Temporal Activities
 *
 * Activity functions for churn prediction, user segmentation,
 * and retention strategy optimization.
 */
export declare function predictChurnRisk(data: {
    userId: string;
    userMetrics: {
        daysSinceLastLogin: number;
        engagementScore: number;
        winRate: number;
        subscriptionTier: string;
    };
}): Promise<{
    success: boolean;
    churnRisk?: {
        probability: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        factors: string[];
        recommendations: string[];
    };
}>;
export declare function segmentUsers(data: {
    segmentationType: 'engagement' | 'value' | 'risk' | 'lifecycle';
    userIds: string[];
}): Promise<{
    success: boolean;
    segments?: {
        [segmentName: string]: {
            userIds: string[];
            characteristics: string[];
            retentionStrategy: string;
        };
    };
}>;
export declare function generateRetentionStrategy(data: {
    userId: string;
    userProfile: any;
    churnRisk: number;
    segment: string;
}): Promise<{
    success: boolean;
    strategy?: {
        interventions: Array<{
            type: string;
            priority: number;
            timing: string;
            content: string;
        }>;
        metrics: string[];
        expectedOutcome: string;
    };
}>;
export declare function trackEngagementMetrics(data: {
    userId: string;
    activityType: string;
    metadata: any;
}): Promise<{
    success: boolean;
    engagementScore?: number;
    trends?: any;
}>;
export declare function checkUserRetentionAgentHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
//# sourceMappingURL=index.d.ts.map