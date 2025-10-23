import { Logger } from '../../shared/logger/types';
export interface RetentionStrategyData {
    id: string;
    type: string;
    name: string;
    description: string;
    priority: number;
    effectiveness: number;
    cost: number;
    targetSegment: string[];
    urgency: 'low' | 'medium' | 'high' | 'critical';
    implementation: {
        channel: string;
        timing: string;
        personalization: boolean;
        followUp: boolean;
    };
    conditions: {
        minChurnRisk: number;
        maxChurnRisk: number;
        userSegments: string[];
        riskFactors: string[];
    };
    content: {
        subject?: string;
        message: string;
        template: string;
        variables: Record<string, any>;
    };
}
export declare class RetentionStrategy {
    private readonly logger;
    private strategies;
    private campaigns;
    private strategyPerformance;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    generateStrategies(userId: string, context: {
        churnRisk: number;
        riskFactors: string[];
        segment: string;
        lifetimeValue: number;
        urgency: 'low' | 'medium' | 'high' | 'critical';
    }): Promise<RetentionStrategyData[]>;
    createCampaign(userId: string, strategies: RetentionStrategyData[]): Promise<string>;
    executeStrategy(strategyId: string, userId: string, context: any): Promise<boolean>;
    measureEffectiveness(campaignId: string): Promise<any>;
    private loadRetentionStrategies;
    private loadCampaignHistory;
    private loadPerformanceMetrics;
    private findApplicableStrategies;
    private rankStrategies;
    private calculateStrategyScore;
    private selectOptimalStrategies;
    private personalizeStrategies;
    private executeEmailStrategy;
    private executeDiscountStrategy;
    private executeFeatureStrategy;
    private executeOutreachStrategy;
    private executeContentStrategy;
    private executeWinBackStrategy;
    private executeLoyaltyStrategy;
    private executeReactivationStrategy;
    private calculateROI;
    private generateRecommendations;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=retentionStrategy.d.ts.map