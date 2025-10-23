import { AnalyticsConfig, PerformanceMetrics, SubscriberMetrics, MarketAnalysis, CompetitiveAnalysis } from '../types/analytics';
export declare class EnhancedAnalytics {
    private logger;
    private monitoring;
    constructor(_config: AnalyticsConfig);
    private initializeAnalytics;
    generatePerformanceAnalytics(): Promise<PerformanceMetrics>;
    private calculatePerformanceMetrics;
    generateSubscriberAnalytics(): Promise<SubscriberMetrics>;
    private calculateSubscriberMetrics;
    generateMarketAnalysis(): Promise<MarketAnalysis>;
    private calculateMarketAnalysis;
    generateCompetitiveAnalysis(): Promise<CompetitiveAnalysis>;
    private calculateCompetitiveAnalysis;
    generatePredictiveAnalytics(): Promise<any>;
    private calculatePredictions;
    private generateDailyAnalytics;
    private generateWeeklyAnalytics;
    private generateMonthlyAnalytics;
    private generateDailySummary;
    private generateWeeklySummary;
    private generateMonthlySummary;
    private identifyTrends;
    private storeAnalyticsReport;
    private getWeekNumber;
    getAnalyticsDashboard(): Promise<any>;
    private calculateKPIs;
}
//# sourceMappingURL=enhanced-analytics.d.ts.map