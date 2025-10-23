/**
 * Phase 9: Live Performance Tracker
 *
 * Real-time tracking of win rates, CLV performance, and statistical significance
 * for live testing validation of the syndicate-level ML betting system.
 */
import { EventEmitter } from 'events';
import { PerformanceTracker, LiveMetrics, HistoricalResults, CLVTracker, SignificanceTracker, LiveBet, CLVAggregateMetrics, DailyResult } from '../types';
export declare class LivePerformanceTracker extends EventEmitter implements PerformanceTracker {
    private logger;
    realTimeMetrics: LiveMetrics;
    historicalPerformance: HistoricalResults;
    clvTracking: CLVTracker;
    statisticalSignificance: SignificanceTracker;
    private sessionStartTime;
    private liveBets;
    private updateInterval;
    constructor();
    private initializeMetrics;
    private initializeSignificanceTest;
    private startRealTimeUpdates;
    private updateRealTimeMetrics;
    trackBet(bet: LiveBet): void;
    updateBetResult(betId: string, result: 'WIN' | 'LOSS' | 'PUSH', pnl: number): void;
    updateCLV(betId: string, closingLine: number, closingOdds: number): void;
    private calculateStreaks;
    private calculateAdvancedMetrics;
    private calculateProfessionalFeaturesAccuracy;
    private updateCLVMetrics;
    private calculateCLVValue;
    private oddsToImpliedProbability;
    private categorizeCLV;
    private updateStatisticalSignificance;
    private calculateWinRateSignificance;
    private calculateROISignificance;
    private calculateCLVSignificance;
    private isReadyForProduction;
    private calculateZTestPValue;
    private calculateTTestPValue;
    private normalCDF;
    private erf;
    private calculateConfidenceInterval;
    private calculateRequiredSampleSize;
    private calculateStatisticalPower;
    generateDailyReport(date: string): DailyResult;
    private calculateDayDrawdown;
    private calculateDaySharpeRatio;
    getCurrentMetrics(): LiveMetrics;
    getHistoricalPerformance(): HistoricalResults;
    getCLVMetrics(): CLVAggregateMetrics;
    getStatisticalSignificance(): SignificanceTracker;
    getPerformanceSummary(): {
        isPerformingWell: boolean;
        readyForProduction: boolean;
        keyMetrics: {
            winRate: number;
            roi: number;
            clv: number;
            sampleSize: number;
        };
        alerts: string[];
    };
    stop(): void;
}
//# sourceMappingURL=LivePerformanceTracker.d.ts.map