import { Logger } from '../../shared/logger/types';
interface UserSegment {
    id: string;
    name: string;
    description: string;
    criteria: SegmentCriteria;
    userIds: string[];
    characteristics: SegmentCharacteristics;
    retentionStrategy: string;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}
interface SegmentCriteria {
    churnRisk: {
        min: number;
        max: number;
    };
    lifetimeValue: {
        min: number;
        max: number;
    };
    engagementScore: {
        min: number;
        max: number;
    };
    daysSinceLastInteraction: {
        max: number;
    };
    riskFactors: string[];
    behaviorPatterns: string[];
    subscriptionTier?: string[];
    experienceLevel?: string[];
}
interface SegmentCharacteristics {
    averageChurnRisk: number;
    averageLifetimeValue: number;
    averageEngagementScore: number;
    commonRiskFactors: string[];
    retentionRate: number;
    conversionPotential: number;
    interventionSuccess: number;
}
interface UserProfile {
    userId: string;
    churnRisk: number;
    lifetimeValue: number;
    engagementScore: number;
    daysSinceLastInteraction: number;
    riskFactors: string[];
}
export declare class UserSegmentation {
    private readonly logger;
    private segments;
    private userSegmentMapping;
    private segmentPerformance;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    segmentUsers(userProfiles: UserProfile[]): Promise<UserSegment[]>;
    getUserSegment(userId: string): Promise<UserSegment | null>;
    getSegmentAnalytics(): Promise<any>;
    optimizeSegmentation(userProfiles: UserProfile[]): Promise<void>;
    private createDefaultSegments;
    private loadSegmentHistory;
    private loadPerformanceData;
    private assignUserToSegment;
    private calculateSegmentFit;
    private updateSegmentCharacteristics;
    private calculateAverage;
    private findCommonRiskFactors;
    private calculateConversionPotential;
    private createDynamicSegments;
    private clusterUsers;
    private calculateDistance;
    private createDynamicSegment;
    private generateSegmentName;
    private determineRetentionStrategy;
    private calculateSegmentPriority;
    private cacheSegmentationResults;
    private analyzeSegmentPerformance;
    private refineSegmentCriteria;
    private createTargetedSegments;
    private identifyMostEffectiveStrategies;
    private analyzeSegmentTrends;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=userSegmentation.d.ts.map