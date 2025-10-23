/**
 * Phase 9: Financial Reports System
 *
 * Comprehensive real money P&L tracking, transaction cost analysis,
 * performance attribution, and financial reporting for live testing validation.
 */
import { EventEmitter } from 'events';
import { FinancialReports, RealTimePnL, TransactionCostAnalysis, PerformanceAttribution, RiskReport, LiveBet } from '../types';
export declare class FinancialReportsSystem extends EventEmitter implements FinancialReports {
    private logger;
    realTimePnL: RealTimePnL;
    transactionCosts: TransactionCostAnalysis;
    attribution: PerformanceAttribution;
    riskReports: RiskReport[];
    private betPnLHistory;
    private dailyPnL;
    private transactionHistory;
    private benchmarkData;
    private reportingInterval;
    constructor(initialBankroll?: number);
    private initializeFinancialReports;
    private startReportingUpdates;
    trackBetPlacement(bet: LiveBet, transactionCosts?: TransactionCosts): void;
    updateBetResult(betId: string, result: 'WIN' | 'LOSS' | 'PUSH', payout: number, clv?: number): void;
    private recordTransactionCosts;
    private updateRealTimePnL;
    private calculatePeriodPnL;
    private calculateRiskAdjustedMetrics;
    private calculateMaxDrawdown;
    private calculateBetaAlpha;
    private updatePnLByCategory;
    private updateTransactionCosts;
    private updateCostOptimization;
    private analyzeBookCosts;
    private getTimingRecommendations;
    private updatePerformanceAttribution;
    private calculateFeatureAttribution;
    private calculateTimingAttribution;
    private getTimeSlot;
    private calculateKellyAttribution;
    private calculateLineShoppingAttribution;
    private calculateProfessionalFeaturesAttribution;
    private generateAttributionExplanations;
    generateRiskReport(date?: string): RiskReport;
    private calculatePortfolioVolatility;
    private calculateCorrelationRisk;
    private calculateConcentrationRisk;
    private calculateExposureUtilization;
    private calculateKellyCompliance;
    private calculateDiversificationScore;
    private generateRiskRecommendations;
    private calculateDaysSinceStart;
    getFinancialSummary(): {
        totalPnL: number;
        roi: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        totalBets: number;
        avgBetSize: number;
        transactionCosts: number;
    };
    exportPnLData(format?: 'json' | 'csv'): string;
    private exportToCSV;
    stop(): void;
}
interface TransactionCosts {
    commission: number;
    spread: number;
    slippage: number;
    other: number;
}
export {};
//# sourceMappingURL=FinancialReportsSystem.d.ts.map