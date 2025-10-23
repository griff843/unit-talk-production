/**
 * Risk Metrics Calculator
 *
 * Professional-grade risk metrics calculation engine implementing industry-standard
 * risk measures including VaR, Expected Shortfall, Sharpe ratio, and drawdown analysis.
 * Supports multiple methodologies and stress testing scenarios.
 */
import { Position, RiskProfile, RiskMetrics, VaRResult, ExpectedShortfallResult } from '../types';
export interface PerformanceData {
    date: string;
    portfolioValue: number;
    dailyReturn: number;
    positions: Position[];
}
export interface VaRCalculationOptions {
    confidenceLevel: number;
    timeHorizon: number;
    methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
    windowSize?: number;
    simulations?: number;
}
export declare class RiskMetricsCalculator {
    private logger;
    private riskProfile;
    private performanceHistory;
    private readonly MAX_HISTORY_DAYS;
    private metricsCache;
    private readonly CACHE_TTL;
    constructor(riskProfile: RiskProfile);
    /**
     * Calculate comprehensive risk metrics for portfolio
     */
    calculateComprehensiveMetrics(positions: Position[]): Promise<RiskMetrics>;
    /**
     * Calculate Value at Risk using specified methodology
     */
    calculateVaR(positions: Position[], options: VaRCalculationOptions): Promise<VaRResult>;
    /**
     * Calculate Expected Shortfall (Conditional VaR)
     */
    calculateExpectedShortfall(positions: Position[], options: VaRCalculationOptions): Promise<ExpectedShortfallResult>;
    /**
     * Calculate Sharpe ratio
     */
    calculateSharpeRatio(positions: Position[]): Promise<number>;
    /**
     * Calculate Sortino ratio (downside deviation only)
     */
    calculateSortinoRatio(positions: Position[]): Promise<number>;
    /**
     * Calculate Calmar ratio (return/max drawdown)
     */
    calculateCalmarRatio(positions: Position[]): Promise<number>;
    /**
     * Calculate maximum drawdown
     */
    calculateMaxDrawdown(positions: Position[]): Promise<number>;
    /**
     * Calculate current drawdown from peak
     */
    calculateCurrentDrawdown(positions: Position[]): Promise<number>;
    /**
     * Calculate average drawdown
     */
    private calculateAverageDrawdown;
    /**
     * Calculate risk-adjusted return
     */
    private calculateRiskAdjustedReturn;
    /**
     * Calculate Information ratio
     */
    private calculateInformationRatio;
    /**
     * Calculate Treynor ratio
     */
    private calculateTreynorRatio;
    /**
     * Run comprehensive stress tests
     */
    private runStressTests;
    /**
     * Calculate Historical VaR
     */
    private calculateHistoricalVaR;
    /**
     * Calculate Parametric VaR (assumes normal distribution)
     */
    private calculateParametricVaR;
    /**
     * Calculate Monte Carlo VaR
     */
    private calculateMonteCarloVaR;
    private calculatePortfolioValue;
    private getHistoricalReturns;
    private calculateStandardDeviation;
    private generateNormalRandom;
    private calculateSportExposures;
    private calculateLargestClusterExposure;
    private calculateVolatilityStressLoss;
    private generateCacheKey;
    private createFallbackVaR;
    private createFallbackMetrics;
    /**
     * Add performance data point
     */
    addPerformanceData(data: PerformanceData): void;
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile: RiskProfile): void;
    /**
     * Get calculation statistics
     */
    getCalculationStatistics(): any;
}
//# sourceMappingURL=RiskMetricsCalculator.d.ts.map