import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
export interface AdvancedPerformanceMetrics {
    totalPicks: number;
    winRate: number;
    roi: number;
    totalProfit: number;
    avgStake: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    valueAtRisk: number;
    expectedShortfall: number;
    tierPerformance: Record<string, {
        count: number;
        winRate: number;
        roi: number;
        avgConfidence: number;
        profitFactor: number;
    }>;
    sportPerformance: Record<string, {
        count: number;
        winRate: number;
        roi: number;
        bestTier: string;
        worstTier: string;
    }>;
    marketPerformance: Record<string, {
        count: number;
        winRate: number;
        roi: number;
        avgOdds: number;
        profitability: number;
    }>;
    monthlyPerformance: Array<{
        month: string;
        picks: number;
        winRate: number;
        roi: number;
        profit: number;
    }>;
    weeklyPerformance: Array<{
        week: string;
        picks: number;
        winRate: number;
        roi: number;
        profit: number;
    }>;
    streakAnalysis: {
        longestWinStreak: number;
        longestLoseStreak: number;
        currentStreak: {
            type: 'win' | 'loss';
            count: number;
        };
        avgWinStreak: number;
        avgLoseStreak: number;
    };
    oddsAnalysis: {
        favoritePerformance: {
            winRate: number;
            roi: number;
            count: number;
        };
        underdogPerformance: {
            winRate: number;
            roi: number;
            count: number;
        };
        sweetSpot: {
            oddsRange: string;
            winRate: number;
            roi: number;
        };
    };
    confidenceAnalysis: {
        highConfidence: {
            winRate: number;
            roi: number;
            count: number;
        };
        mediumConfidence: {
            winRate: number;
            roi: number;
            count: number;
        };
        lowConfidence: {
            winRate: number;
            roi: number;
            count: number;
        };
    };
    modelAccuracy: {
        neuralNetwork: number;
        gradientBoosting: number;
        randomForest: number;
        ensemble: number;
        overallAgreement: number;
    };
    topFeatures: Array<{
        feature: string;
        importance: number;
        correlation: number;
        performance: number;
    }>;
    projectedPerformance: {
        nextMonth: {
            expectedROI: number;
            confidence: number;
        };
        nextQuarter: {
            expectedROI: number;
            confidence: number;
        };
        riskAdjustedTargets: {
            conservative: number;
            moderate: number;
            aggressive: number;
        };
    };
}
export interface BacktestResult {
    period: {
        start: string;
        end: string;
    };
    metrics: AdvancedPerformanceMetrics;
    recommendations: string[];
    riskAlerts: Array<{
        type: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        message: string;
        recommendation: string;
    }>;
    optimizationSuggestions: Array<{
        category: string;
        suggestion: string;
        expectedImprovement: number;
        implementationDifficulty: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
}
/**
 * Fortune 100 Advanced Performance Analytics System
 * Comprehensive backtesting, performance tracking, and predictive analytics
 */
export declare class AdvancedBacktestingSystem {
    private results;
    private performanceHistory;
    constructor();
    /**
     * Run comprehensive Fortune 100 level backtest
     */
    runAdvancedBacktest(historicalData: Array<{
        features: GradingFeatureSet;
        actualOutcome: number;
        actualProfit: number;
    }>, gradingEngine: any): Promise<BacktestResult>;
    /**
     * Calculate comprehensive advanced metrics
     */
    private calculateAdvancedMetrics;
    /**
     * Calculate tier-based performance
     */
    private calculateTierPerformance;
    /**
     * Calculate sport-based performance
     */
    private calculateSportPerformance;
    /**
     * Calculate market type performance
     */
    private calculateMarketPerformance;
    /**
     * Calculate monthly performance
     */
    private calculateMonthlyPerformance;
    /**
     * Calculate weekly performance
     */
    private calculateWeeklyPerformance;
    private calculateVolatility;
    private calculateSortinoRatio;
    private calculateMaxDrawdown;
    private calculateVaR;
    private calculateCVaR;
    private calculateStreakAnalysis;
    private calculateOddsAnalysis;
    private calculateConfidenceAnalysis;
    private calculateModelAccuracy;
    private calculateFeatureAttribution;
    private analyzeFeaturePerformance;
    private calculateCorrelation;
    private calculateProjectedPerformance;
    private calculateROI;
    private calculateTrend;
    private generateRecommendations;
    private identifyRiskAlerts;
    private generateOptimizationSuggestions;
    private groupBy;
    private getWeekNumber;
    /**
     * Get performance history
     */
    getPerformanceHistory(): Map<string, AdvancedPerformanceMetrics>;
    /**
     * Export results for external analysis
     */
    exportResults(): any[];
}
//# sourceMappingURL=advancedBacktesting.d.ts.map