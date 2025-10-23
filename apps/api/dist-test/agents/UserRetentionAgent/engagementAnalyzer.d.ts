import { Logger } from '../../shared/logger/types';
interface EngagementTrends {
    currentScore: number;
    previousScore: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: number;
    weeklyTrend: number[];
    monthlyAverage: number;
    seasonalPattern: Record<string, number>;
    predictedNext: number;
}
interface EngagementAnalysis {
    score: number;
    trends: EngagementTrends;
    lastInteraction: Date;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
    strengths: string[];
    weaknesses: string[];
    interventionNeeded: boolean;
}
export declare class EngagementAnalyzer {
    private readonly logger;
    private userEngagementData;
    private engagementModels;
    private benchmarkMetrics;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    analyzeUser(userId: string): Promise<EngagementAnalysis>;
    getCurrentEngagement(userId: string): Promise<any>;
    getEngagementTrends(userIds: string[]): Promise<Map<string, EngagementTrends>>;
    generateEngagementInsights(): Promise<any>;
    private collectEngagementMetrics;
    private collectSessionMetrics;
    private collectInteractionMetrics;
    private collectContentMetrics;
    private collectBehaviorMetrics;
    private calculateEngagementScore;
    private calculateSessionScore;
    private calculateInteractionScore;
    private calculateContentScore;
    private calculateBehaviorScore;
    private calculateTrends;
    private determineTrend;
    private analyzeTrends;
    private assessRiskLevel;
    private generateRecommendations;
    private identifyStrengthsWeaknesses;
    private getDefaultAnalysis;
    private getLastActivity;
    private getRecentSessions;
    private getActiveFeatures;
    private getQuickEngagementScore;
    private getLastInteractionTime;
    private getHistoricalEngagementData;
    private calculateAverage;
    private calculateSeasonalPattern;
    private predictNextScore;
    private calculateAverageEngagement;
    private getEngagementDistribution;
    private analyzeTrendPatterns;
    private analyzeRiskDistribution;
    private identifyEngagementDrivers;
    private generateSystemRecommendations;
    private compareToBenchmarks;
    private cacheEngagementAnalysis;
    private loadEngagementModels;
    private loadBenchmarkMetrics;
    private loadUserEngagementHistory;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=engagementAnalyzer.d.ts.map