/**
 * Syndicate-Level Business Intelligence & Analytics Dashboard
 * Phase 10: Executive-Grade Analytics and Competitive Intelligence
 *
 * Provides comprehensive business intelligence for syndicate operations
 * Tracks P&L attribution, competitive analysis, and predictive analytics
 * Generates executive reports with ROI projections and market positioning
 */
import { EventEmitter } from 'events';
interface BusinessMetrics {
    revenue: {
        daily: number;
        weekly: number;
        monthly: number;
        quarterly: number;
        yearToDate: number;
    };
    profitability: {
        grossMargin: number;
        operatingMargin: number;
        netMargin: number;
        roi: number;
        sharpeRatio: number;
    };
    growth: {
        revenueGrowth: number;
        volumeGrowth: number;
        marketShare: number;
        customerAcquisition: number;
    };
    risk: {
        maxDrawdown: number;
        valueAtRisk: number;
        portfolioVolatility: number;
        correlationRisk: number;
    };
}
interface CompetitiveAnalysis {
    marketPosition: number;
    competitorComparison: {
        winRate: {
            us: number;
            competitor: number;
            industry: number;
        };
        volume: {
            us: number;
            competitor: number;
            industry: number;
        };
        roi: {
            us: number;
            competitor: number;
            industry: number;
        };
    };
    marketTrends: {
        trend: string;
        impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        confidence: number;
    }[];
    opportunities: {
        opportunity: string;
        potentialValue: number;
        timeframe: string;
        difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
    }[];
}
interface PredictiveAnalytics {
    bankrollProjection: {
        thirtyDays: number;
        ninetyDays: number;
        oneYear: number;
        confidence: number;
    };
    seasonalTrends: {
        sport: string;
        expectedPerformance: number;
        seasonality: number;
        recommendation: string;
    }[];
    riskForecasting: {
        expectedDrawdown: number;
        probabilityOfLoss: number;
        optimalBetSizing: number;
    };
    marketOpportunities: {
        sport: string;
        expectedEdge: number;
        confidenceLevel: number;
        recommendedAllocation: number;
    }[];
}
export declare class SyndicateAnalyticsDashboard extends EventEmitter {
    private redis;
    private dbPool;
    private analyticsCache;
    private reportingInterval;
    constructor();
    private initializeAnalytics;
    /**
     * Generate comprehensive executive dashboard
     */
    generateExecutiveDashboard(): Promise<{
        businessMetrics: BusinessMetrics;
        competitiveAnalysis: CompetitiveAnalysis;
        predictiveAnalytics: PredictiveAnalytics;
        keyInsights: string[];
        recommendations: string[];
    }>;
    /**
     * Calculate comprehensive business metrics
     */
    private calculateBusinessMetrics;
    /**
     * Generate competitive analysis against industry benchmarks
     */
    private generateCompetitiveAnalysis;
    /**
     * Generate predictive analytics and forecasting
     */
    private generatePredictiveAnalytics;
    /**
     * Generate key insights using AI-powered analysis
     */
    private generateKeyInsights;
    /**
     * Generate strategic recommendations
     */
    private generateRecommendations;
    /**
     * Generate automated executive reports
     */
    generateExecutiveReport(format: 'PDF' | 'EXCEL' | 'JSON'): Promise<Buffer | object>;
    private generatePDFReport;
    private generateExcelReport;
    /**
     * Real-time analytics processing
     */
    private startRealTimeAnalytics;
    private updateRealTimeMetrics;
    private checkPerformanceAlerts;
    /**
     * Schedule automated reports
     */
    private scheduleAutomatedReports;
    private sendDailyReport;
    private sendWeeklyReport;
    private calculateMaxDrawdown;
    private calculateVaR;
    private calculateGrowthRate;
    private calculateCorrelationRisk;
    private calculateMarketPosition;
    private getOurCurrentMetrics;
    private getHistoricalPerformanceData;
    private analyzeSeasonalPatterns;
    private projectBankrollGrowth;
    private analyzeSeasonalTrend;
    private generateRiskForecast;
    private identifyMarketOpportunities;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare const syndicateAnalytics: SyndicateAnalyticsDashboard;
export {};
//# sourceMappingURL=SyndicateAnalyticsDashboard.d.ts.map