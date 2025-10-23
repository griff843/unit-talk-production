/**
 * Rolling Metrics Watcher Service
 * Tracks Posted EV, Positive CLV%, Hit%, ROI with 7/30/lifetime rolling windows
 * Includes auto-learning feedback loops for performance optimization
 */
export interface MetricsWindow {
    window: '7d' | '30d' | 'lifetime';
    startDate: Date;
    endDate: Date;
    totalPicks: number;
    completedPicks: number;
    metrics: WindowMetrics;
}
export interface WindowMetrics {
    postedEV: number;
    actualEV: number;
    evDeviation: number;
    positiveCLVPercentage: number;
    averageCLV: number;
    clvCapture: number;
    hitPercentage: number;
    hitByTier: Record<string, number>;
    hitBySport: Record<string, number>;
    roi: number;
    roiByTier: Record<string, number>;
    roiBySport: Record<string, number>;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    kellyAtRisk: number;
    kellyEfficiency: number;
    kellyRegret: number;
}
export interface SportMetrics {
    sport: string;
    windows: MetricsWindow[];
    trends: TrendAnalysis;
    adjustments: LearningAdjustment[];
}
export interface TrendAnalysis {
    evTrend: 'improving' | 'declining' | 'stable';
    clvTrend: 'improving' | 'declining' | 'stable';
    roiTrend: 'improving' | 'declining' | 'stable';
    confidence: number;
    momentum: number;
    volatility: number;
}
export interface LearningAdjustment {
    timestamp: Date;
    sport: string;
    adjustmentType: 'threshold' | 'weight' | 'filter' | 'sizing';
    parameter: string;
    oldValue: number;
    newValue: number;
    reason: string;
    expectedImpact: number;
    actualImpact?: number;
}
export interface PerformanceAlert {
    id: string;
    timestamp: Date;
    severity: 'info' | 'warning' | 'critical';
    type: 'underperformance' | 'overperformance' | 'anomaly' | 'threshold_breach';
    metric: string;
    window: '7d' | '30d' | 'lifetime';
    sport?: string;
    message: string;
    recommendedAction?: string;
    autoAdjustmentApplied?: boolean;
}
declare class RollingMetricsService {
    private static instance;
    private logger;
    private metricsCache;
    private updateInterval;
    private readonly LEARNING_CONFIG;
    private readonly ALERT_THRESHOLDS;
    private constructor();
    static getInstance(): RollingMetricsService;
    /**
     * Initialize the metrics service
     */
    private initializeService;
    /**
     * Start continuous metrics monitoring
     */
    private startMetricsMonitoring;
    /**
     * Calculate metrics for a specific window
     */
    calculateMetricsForWindow(window: '7d' | '30d' | 'lifetime', sport?: string): Promise<MetricsWindow>;
    /**
     * Calculate detailed metrics for a set of picks
     */
    private calculateWindowMetrics;
    /**
     * Calculate EV metrics
     */
    private calculateEVMetrics;
    /**
     * Calculate CLV metrics
     */
    private calculateCLVMetrics;
    /**
     * Calculate hit rate metrics
     */
    private calculateHitMetrics;
    /**
     * Calculate ROI metrics
     */
    private calculateROIMetrics;
    /**
     * Calculate risk metrics
     */
    private calculateRiskMetrics;
    /**
     * Calculate Kelly metrics
     */
    private calculateKellyMetrics;
    /**
     * Run auto-learning cycle
     */
    private runLearningCycle;
    /**
     * Analyze and adjust sport-specific parameters
     */
    private analyzeSportPerformance;
    /**
     * Analyze trend between two metric windows
     */
    private analyzeTrend;
    /**
     * Create EV adjustment
     */
    private createEVAdjustment;
    /**
     * Create CLV adjustment
     */
    private createCLVAdjustment;
    /**
     * Create Kelly sizing adjustment
     */
    private createKellyAdjustment;
    /**
     * Apply an adjustment
     */
    private applyAdjustment;
    /**
     * Apply global adjustments based on overall performance
     */
    private applyGlobalAdjustments;
    /**
     * Check for performance alerts
     */
    private checkPerformanceAlerts;
    /**
     * Generate performance alert
     */
    private generatePerformanceAlert;
    /**
     * Helper methods
     */
    private getWindowStartDate;
    private getPicksForWindow;
    private getActiveSports;
    private loadHistoricalMetrics;
    private updateAllMetrics;
    private storeMetrics;
    private getTrendDirection;
    private getEmptyMetrics;
    /**
     * Public API methods
     */
    getMetrics(window: '7d' | '30d' | 'lifetime'): Promise<MetricsWindow>;
    getSportMetrics(sport: string): Promise<SportMetrics>;
    getPerformanceSummary(): Promise<{
        current: MetricsWindow;
        trends: TrendAnalysis;
        alerts: PerformanceAlert[];
        recommendations: string[];
    }>;
    private generateRecommendations;
}
export declare const rollingMetricsService: RollingMetricsService;
export {};
//# sourceMappingURL=RollingMetricsService.d.ts.map