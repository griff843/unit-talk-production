import { GradingResult } from './gradingEngine';
export interface BetResult {
    id: string;
    sport: string;
    marketType: string;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    actualOdds: number;
    positionSize: number;
    result: number;
    profit: number;
    confidence: number;
    expectedValue: number;
    timestamp: string;
    modelUsed: string;
}
export interface PerformanceMetrics {
    totalBets: number;
    winRate: number;
    roi: number;
    totalProfit: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    avgStake: number;
    bestTier: string;
    worstTier: string;
    recentForm: number;
    byTier?: Record<string, {
        count: number;
        winRate: number;
        roi: number;
    }>;
    bySport?: Record<string, {
        count: number;
        winRate: number;
        roi: number;
    }>;
    byMarket?: Record<string, {
        count: number;
        winRate: number;
        roi: number;
    }>;
}
/**
 * Fortune 100 Performance Analytics System
 * Tracks and analyzes grading performance with advanced metrics
 */
export declare class PerformanceAnalyzer {
    private betHistory;
    private performanceCache;
    private lastCacheUpdate;
    constructor();
    /**
     * Record a bet result for performance tracking
     */
    recordBetResult(betResult: BetResult): Promise<void>;
    /**
     * Get comprehensive performance metrics
     */
    getPerformanceMetrics(timeframe?: 'all' | '30d' | '7d'): Promise<PerformanceMetrics>;
    /**
     * Get historical accuracy for model validation
     */
    getHistoricalAccuracy(modelType?: string): Promise<{
        overall: number;
        byTier: Record<string, number>;
        byConfidence: Record<string, number>;
        trend: Array<{
            date: string;
            accuracy: number;
        }>;
    }>;
    /**
     * Log grading performance for continuous improvement
     */
    logGradingPerformance(gradingResult: GradingResult, actualOutcome: number, actualProfit: number, sport?: string, marketType?: string, odds?: number): Promise<void>;
    /**
     * Get performance comparison between different models/strategies
     */
    getModelComparison(): Promise<Record<string, PerformanceMetrics>>;
    /**
     * Export performance data for external analysis
     */
    exportPerformanceData(): BetResult[];
    /**
     * Clear performance history (use with caution)
     */
    clearHistory(): void;
    private calculateVolatility;
    private calculateMaxDrawdown;
    private calculateProfitFactor;
    private analyzeTierPerformance;
    private calculateAccuracyTrend;
    private calculateMetricsForBets;
    private analyzeSportPerformance;
    private analyzeMarketPerformance;
    private getDefaultMetrics;
    private groupBy;
}
//# sourceMappingURL=performanceAnalyzer.d.ts.map