/**
 * CLV Tracking Validator
 * Ensures 50%+ positive CLV target is met across all professional features
 *
 * This validator continuously monitors CLV performance and ensures
 * the syndicate-level system maintains profitability standards.
 */
import { EventEmitter } from 'events';
export interface CLVTrackingResult {
    pickId: string;
    openingLine: number;
    betLine: number;
    closingLine: number;
    clv: number;
    clvPercentage: number;
    sport: string;
    market: string;
    timestamp: string;
    gameTime: string;
    outcome?: 'WIN' | 'LOSS' | 'PUSH';
    profit?: number;
    profitPercentage?: number;
}
export interface CLVValidationMetrics {
    totalTracks: number;
    positiveCLVCount: number;
    negativeCLVCount: number;
    pushCount: number;
    positiveCLVRate: number;
    avgCLV: number;
    medianCLV: number;
    profitableTrades: number;
    losingTrades: number;
    winRate: number;
    avgProfit: number;
    totalPnL: number;
    sharpeRatio: number;
    maxDrawdown: number;
    targetMet: boolean;
    targetExceeded: boolean;
    dataQuality: number;
    trackingAccuracy: number;
    reportingCompleteness: number;
    sportBreakdown: Record<string, SportCLVMetrics>;
    recentPerformance: {
        last24h: CLVPeriodMetrics;
        last7d: CLVPeriodMetrics;
        last30d: CLVPeriodMetrics;
    };
    lastUpdate: string;
}
export interface SportCLVMetrics {
    sport: string;
    totalTracks: number;
    positiveCLVRate: number;
    avgCLV: number;
    winRate: number;
    profitability: number;
    sampleSize: number;
}
export interface CLVPeriodMetrics {
    period: string;
    totalTracks: number;
    positiveCLVRate: number;
    avgCLV: number;
    winRate: number;
    profitability: number;
    trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
}
export interface CLVValidationConfig {
    targetPositiveRate: number;
    excellentPositiveRate: number;
    minSampleSize: number;
    validationInterval: number;
    dataRetentionDays: number;
    alertThresholds: {
        criticalCLVRate: number;
        warningCLVRate: number;
        poorProfitability: number;
    };
}
export declare class CLVTrackingValidator extends EventEmitter {
    private logger;
    private config;
    private clvResults;
    private validationTimer?;
    private startTime;
    constructor(config?: Partial<CLVValidationConfig>);
    /**
     * Start continuous validation
     */
    private startValidation;
    /**
     * Stop validation
     */
    stop(): void;
    /**
     * Add CLV tracking result
     */
    addCLVResult(result: CLVTrackingResult): void;
    /**
     * Perform comprehensive CLV validation
     */
    performValidation(): Promise<CLVValidationMetrics>;
    /**
     * Calculate comprehensive CLV metrics
     */
    private calculateCLVMetrics;
    /**
     * Create empty metrics structure
     */
    private createEmptyMetrics;
    /**
     * Calculate sport-specific breakdown
     */
    private calculateSportBreakdown;
    /**
     * Calculate recent performance trends
     */
    private calculateRecentPerformance;
    /**
     * Calculate metrics for a specific period
     */
    private calculatePeriodMetrics;
    /**
     * Create empty period metrics
     */
    private createEmptyPeriodMetrics;
    /**
     * Check for CLV alerts
     */
    private checkCLVAlerts;
    /**
     * Helper methods
     */
    private groupBySport;
    private filterByTime;
    private calculateMedian;
    private calculateSharpeRatio;
    private calculateMaxDrawdown;
    private calculateDataQuality;
    private calculateTrackingAccuracy;
    private cleanupOldData;
    /**
     * Get current metrics
     */
    getCurrentMetrics(): CLVValidationMetrics;
    /**
     * Check if target is currently met
     */
    isTargetMet(): boolean;
    /**
     * Get CLV results for analysis
     */
    getCLVResults(filters?: {
        sport?: string;
        dateRange?: {
            start: string;
            end: string;
        };
        minCLV?: number;
        maxCLV?: number;
    }): CLVTrackingResult[];
    /**
     * Generate CLV performance report
     */
    generateReport(): string;
}
//# sourceMappingURL=CLVTrackingValidator.d.ts.map