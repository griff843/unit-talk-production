/**
 * Performance Metrics Engine for Phase 6 Backtesting
 *
 * Calculates comprehensive performance metrics for validating the 55%+ win rate target:
 * - Win Rate Analysis (overall, by sport, by confidence tier)
 * - ROI Calculation with Kelly sizing
 * - Sharpe Ratio (risk-adjusted returns)
 * - Maximum Drawdown analysis
 * - CLV Performance tracking
 * - Statistical significance testing
 * - Portfolio correlation analysis
 * - Tail risk metrics (VaR, CVaR)
 */
export interface BetResult {
    id: string;
    date: string;
    sport: string;
    player_name: string;
    stat_type: string;
    line: number;
    predicted_side: 'over' | 'under';
    odds: number;
    stake: number;
    actual_value: number;
    won: boolean;
    payout: number;
    profit: number;
    confidence: number;
    tier: string;
    kelly_fraction: number;
    clv: number;
    processing_time_ms: number;
}
export interface DetailedPerformanceMetrics {
    total_bets: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_stake: number;
    total_payout: number;
    total_profit: number;
    roi: number;
    profit_factor: number;
    expectancy: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    max_drawdown_duration_days: number;
    volatility: number;
    downside_deviation: number;
    clv_positive_count: number;
    clv_negative_count: number;
    clv_positive_rate: number;
    avg_clv: number;
    cumulative_clv: number;
    avg_kelly_fraction: number;
    kelly_sizing_accuracy: number;
    optimal_vs_actual_sizing: number;
    avg_confidence: number;
    confidence_calibration: number;
    tier_distribution: Record<string, number>;
    daily_returns: number[];
    cumulative_returns: number[];
    rolling_win_rates: number[];
    drawdown_series: number[];
    standard_error: number;
    confidence_interval_95: [number, number];
    t_statistic: number;
    p_value: number;
    statistical_significance: boolean;
}
export interface SportSpecificMetrics {
    [sport: string]: {
        performance: DetailedPerformanceMetrics;
        seasonal_breakdown: Record<string, DetailedPerformanceMetrics>;
        best_performing_months: string[];
        worst_performing_months: string[];
        market_type_performance: Record<string, DetailedPerformanceMetrics>;
    };
}
export interface ConfidenceTierMetrics {
    [tier: string]: {
        performance: DetailedPerformanceMetrics;
        confidence_range: [number, number];
        optimal_kelly_range: [number, number];
        contribution_to_profit: number;
        volume_percentage: number;
    };
}
export interface RiskAnalysisMetrics {
    portfolio_beta: number;
    portfolio_alpha: number;
    information_ratio: number;
    tracking_error: number;
    daily_correlation_matrix: Record<string, Record<string, number>>;
    max_daily_correlation: number;
    avg_correlation: number;
    diversification_ratio: number;
    max_single_game_exposure: number;
    max_sport_exposure: number;
    max_player_exposure: number;
    concentration_hhi: number;
    var_95: number;
    var_99: number;
    cvar_95: number;
    cvar_99: number;
    max_consecutive_losses: number;
    max_consecutive_wins: number;
    avg_drawdown: number;
    drawdown_frequency: number;
    recovery_factor: number;
    pain_index: number;
    ulcer_index: number;
}
export interface TimeSeriesMetrics {
    date: string;
    bets_placed: number;
    win_rate: number;
    daily_roi: number;
    cumulative_roi: number;
    daily_profit: number;
    cumulative_profit: number;
    drawdown: number;
    rolling_sharpe_30d: number;
    clv_achievement: number;
    avg_confidence: number;
    kelly_sizing: number;
}
export declare class PerformanceMetricsEngine {
    private logger;
    constructor();
    /**
     * Calculate comprehensive performance metrics
     */
    calculateOverallPerformance(bets: BetResult[]): DetailedPerformanceMetrics;
    /**
     * Calculate sport-specific performance metrics
     */
    calculateSportSpecificMetrics(bets: BetResult[]): SportSpecificMetrics;
    /**
     * Calculate confidence tier performance metrics
     */
    calculateConfidenceTierMetrics(bets: BetResult[]): ConfidenceTierMetrics;
    /**
     * Calculate comprehensive risk analysis metrics
     */
    calculateRiskAnalysisMetrics(bets: BetResult[]): RiskAnalysisMetrics;
    /**
     * Generate time series metrics for visualization
     */
    generateTimeSeriesMetrics(bets: BetResult[]): TimeSeriesMetrics[];
    private calculateDailyReturns;
    private calculateCumulativeReturns;
    private calculateSharpeRatio;
    private calculateSortinoRatio;
    private calculateMaxDrawdown;
    private calculateVolatility;
    private calculateDownsideDeviation;
    private calculateStatisticalSignificance;
    private groupBetsByDate;
    private groupBetsBySport;
    private groupBetsByTier;
    private normalCDF;
    private erf;
    private calculateKellySizingAccuracy;
    private calculateOptimalVsActualSizing;
    private calculateConfidenceCalibration;
    private calculateTierDistribution;
    private calculateRollingWinRates;
    private calculateDrawdownSeries;
    private calculateSeasonalBreakdown;
    private calculateMarketTypePerformance;
    private calculatePortfolioBeta;
    private calculatePortfolioAlpha;
    private calculateInformationRatio;
    private calculateTrackingError;
    private calculateCorrelationAnalysis;
    private calculateConcentrationRisk;
    private calculateTailRisk;
    private calculateDrawdownAnalysis;
    private calculateRollingSharpe;
}
//# sourceMappingURL=PerformanceMetricsEngine.d.ts.map