import { AdvancedPerformanceMetrics } from '../agents/ScoringAgent/scoring/advancedBacktesting';
export interface DashboardData {
    livePerformance: {
        todayPicks: number;
        todayWinRate: number;
        todayROI: number;
        todayProfit: number;
        activePicks: number;
        pendingResults: number;
    };
    currentPicks: Array<{
        id: string;
        sport: string;
        player: string;
        marketType: string;
        line: number;
        odds: number;
        tier: 'S' | 'A' | 'B' | 'C' | 'D';
        confidence: number;
        edgeScore: number;
        positionSize: number;
        expectedValue: number;
        gameTime: string;
        status: 'PENDING' | 'WON' | 'LOST' | 'PUSH';
        actualResult?: number;
        profit?: number;
    }>;
    performance: {
        overall: AdvancedPerformanceMetrics;
        last7Days: AdvancedPerformanceMetrics;
        last30Days: AdvancedPerformanceMetrics;
        thisMonth: AdvancedPerformanceMetrics;
    };
    tierAnalysis: {
        distribution: Record<string, number>;
        performance: Record<string, {
            count: number;
            winRate: number;
            roi: number;
            avgConfidence: number;
            profitFactor: number;
        }>;
    };
    sportAnalysis: {
        distribution: Record<string, number>;
        performance: Record<string, {
            count: number;
            winRate: number;
            roi: number;
            bestTier: string;
            recentForm: number;
        }>;
    };
    marketAnalysis: {
        distribution: Record<string, number>;
        performance: Record<string, {
            count: number;
            winRate: number;
            roi: number;
            avgOdds: number;
            profitability: number;
        }>;
    };
    riskMetrics: {
        currentExposure: number;
        maxDrawdown: number;
        valueAtRisk: number;
        sharpeRatio: number;
        correlationRisk: number;
        portfolioRisk: number;
        riskAlerts: Array<{
            type: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            message: string;
            timestamp: string;
        }>;
    };
    charts: {
        profitChart: Array<{
            date: string;
            profit: number;
            cumulative: number;
        }>;
        winRateChart: Array<{
            date: string;
            winRate: number;
            picks: number;
        }>;
        tierChart: Array<{
            tier: string;
            count: number;
            winRate: number;
            roi: number;
        }>;
        sportChart: Array<{
            sport: string;
            count: number;
            winRate: number;
            roi: number;
        }>;
        confidenceChart: Array<{
            range: string;
            count: number;
            winRate: number;
            roi: number;
        }>;
        oddsChart: Array<{
            range: string;
            count: number;
            winRate: number;
            roi: number;
        }>;
    };
    streaks: {
        current: {
            type: 'win' | 'loss';
            count: number;
        };
        longestWin: number;
        longestLoss: number;
        recentTrend: 'UP' | 'DOWN' | 'STABLE';
        momentum: number;
    };
    topPerformers: {
        players: Array<{
            name: string;
            sport: string;
            picks: number;
            winRate: number;
            roi: number;
            profit: number;
        }>;
        sports: Array<{
            sport: string;
            picks: number;
            winRate: number;
            roi: number;
            profit: number;
        }>;
        markets: Array<{
            marketType: string;
            picks: number;
            winRate: number;
            roi: number;
            profit: number;
        }>;
    };
    alerts: Array<{
        id: string;
        type: 'PERFORMANCE' | 'RISK' | 'OPPORTUNITY' | 'SYSTEM';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        title: string;
        message: string;
        timestamp: string;
        actionRequired: boolean;
        recommendation?: string;
    }>;
    systemStatus: {
        lastUpdate: string;
        dataFreshness: number;
        systemHealth: 'HEALTHY' | 'WARNING' | 'ERROR';
        activeModels: string[];
        processingQueue: number;
        uptime: string;
    };
}
/**
 * Fortune 100 Dashboard API System
 * Provides comprehensive real-time data for subscriber and operator dashboards
 */
export declare class DashboardAPI {
    private cachedData;
    private lastUpdate;
    private updateInterval;
    constructor();
    /**
     * Get comprehensive dashboard data
     */
    getDashboardData(_timeframe?: '24h' | '7d' | '30d' | 'all'): Promise<DashboardData>;
    /**
     * Get real-time performance data
     */
    getLivePerformance(): Promise<DashboardData['livePerformance']>;
    /**
     * Get current active picks
     */
    getCurrentPicks(): Promise<DashboardData['currentPicks']>;
    /**
     * Get tier analysis data
     */
    getTierAnalysis(): Promise<DashboardData['tierAnalysis']>;
    /**
     * Get sport analysis data
     */
    getSportAnalysis(): Promise<DashboardData['sportAnalysis']>;
    /**
     * Get risk metrics
     */
    getRiskMetrics(): Promise<DashboardData['riskMetrics']>;
    /**
     * Get chart data for visualizations
     */
    getChartData(): Promise<DashboardData['charts']>;
    /**
     * Get streak and trend data
     */
    getStreakData(): Promise<DashboardData['streaks']>;
    /**
     * Get top performers
     */
    getTopPerformers(): Promise<DashboardData['topPerformers']>;
    /**
     * Get system alerts
     */
    getAlerts(): Promise<DashboardData['alerts']>;
    /**
     * Get system status
     */
    getSystemStatus(): Promise<DashboardData['systemStatus']>;
    /**
     * Refresh dashboard data cache
     */
    private refreshDashboardData;
    /**
     * Check if cache should be refreshed
     */
    private shouldRefreshCache;
    /**
     * Start automatic cache updates
     */
    private startAutoUpdate;
    /**
     * Generate default dashboard data
     */
    private generateDefaultDashboardData;
    private generateProfitChartData;
    private generateWinRateChartData;
    private generateTierChartData;
    private generateSportChartData;
    private generateConfidenceChartData;
    private generateOddsChartData;
    private generatePerformanceMetrics;
    /**
     * Get filtered dashboard data based on criteria
     */
    getFilteredData(filters: {
        sport?: string;
        tier?: string;
        timeframe?: string;
        minConfidence?: number;
    }): Promise<Partial<DashboardData>>;
    /**
     * Export dashboard data for external use
     */
    exportData(format?: 'json' | 'csv'): Promise<string>;
}
//# sourceMappingURL=dashboardAPI.d.ts.map