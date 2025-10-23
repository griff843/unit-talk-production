/**
 * Phase 6 Comprehensive Backtesting Engine
 *
 * Validates the 55%+ win rate target on historical data using rigorous
 * statistical methods and time-series validation to prevent look-ahead bias.
 *
 * Features:
 * - Historical data validation with 142K+ settled props
 * - Time-series cross-validation with rolling windows
 * - Comprehensive performance metrics (win rate, ROI, Sharpe, CLV)
 * - Professional feature validation and contribution analysis
 * - Risk management validation (Kelly, correlation, drawdown)
 * - Stress testing and worst-case scenario analysis
 * - Statistical significance testing with bootstrap analysis
 */
export interface BacktestConfig {
    startDate: string;
    endDate: string;
    sports: string[];
    minSamplesPerSport: number;
    crossValidationFolds: number;
    holdoutPercentage: number;
    rollingWindowMonths: number;
    testWindowMonths: number;
    targetWinRate: number;
    targetROI: number;
    maxDrawdown: number;
    minSharpeRatio: number;
    minCLVPositiveRate: number;
    bootstrapSamples: number;
    confidenceLevel: number;
    testIndividualModels: boolean;
    testEnsembleOnly: boolean;
    testProfessionalFeatures: boolean;
}
export interface BacktestResult {
    overall_performance: {
        total_bets: number;
        wins: number;
        losses: number;
        win_rate: number;
        roi: number;
        sharpe_ratio: number;
        max_drawdown: number;
        clv_positive_rate: number;
        avg_clv: number;
        total_profit: number;
        profit_factor: number;
        expectancy: number;
    };
    by_sport: Record<string, SportPerformance>;
    by_confidence: Record<string, ConfidencePerformance>;
    professional_features: ProfessionalFeatureMetrics;
    risk_metrics: RiskAnalysis;
    time_series: TimeSeriesResults[];
    statistical_validation: StatisticalValidation;
    cross_validation: CrossValidationResults;
    bootstrap_analysis: BootstrapResults;
    model_comparison: ModelComparisonResults;
}
export interface SportPerformance {
    total_bets: number;
    win_rate: number;
    roi: number;
    sharpe_ratio: number;
    max_drawdown: number;
    clv_positive_rate: number;
    avg_confidence: number;
    best_performing_tier: string;
    seasonal_performance: Record<string, number>;
}
export interface ConfidencePerformance {
    total_bets: number;
    win_rate: number;
    roi: number;
    avg_confidence: number;
    kelly_fraction_avg: number;
    profit_contribution: number;
}
export interface ProfessionalFeatureMetrics {
    steam_detection: FeatureImpact;
    closing_line_prediction: FeatureImpact;
    optimal_timing: FeatureImpact;
    line_shopping_edge: FeatureImpact;
    public_vs_sharp_split: FeatureImpact;
    market_timing_advantage: FeatureImpact;
    injury_timing_edge: FeatureImpact;
    cross_market_discrepancy: FeatureImpact;
    combined_feature_impact: number;
}
export interface FeatureImpact {
    enabled_win_rate: number;
    disabled_win_rate: number;
    impact_magnitude: number;
    statistical_significance: number;
    contribution_to_roi: number;
}
export interface RiskAnalysis {
    kelly_sizing_accuracy: number;
    correlation_analysis: CorrelationAnalysis;
    variance_analysis: VarianceAnalysis;
    concentration_risk: ConcentrationRisk;
    tail_risk_metrics: TailRiskMetrics;
}
export interface CorrelationAnalysis {
    max_daily_correlation: number;
    avg_portfolio_correlation: number;
    correlation_violations: number;
    diversification_ratio: number;
}
export interface VarianceAnalysis {
    bet_variance: number;
    portfolio_variance: number;
    variance_vs_expected: number;
    bankroll_stability: number;
}
export interface ConcentrationRisk {
    max_single_game_exposure: number;
    max_sport_exposure: number;
    max_player_exposure: number;
    concentration_violations: number;
}
export interface TailRiskMetrics {
    var_95: number;
    cvar_95: number;
    max_consecutive_losses: number;
    recovery_time_days: number;
}
export interface TimeSeriesResults {
    date: string;
    cumulative_roi: number;
    rolling_win_rate: number;
    drawdown: number;
    bets_placed: number;
    kelly_sizing: number;
    clv_achievement: number;
}
export interface StatisticalValidation {
    win_rate_confidence_interval: [number, number];
    roi_confidence_interval: [number, number];
    statistical_significance: number;
    p_value: number;
    effect_size: number;
    power_analysis: number;
}
export interface CrossValidationResults {
    fold_results: FoldResult[];
    avg_cv_score: number;
    cv_score_std: number;
    stability_metric: number;
    generalization_gap: number;
}
export interface FoldResult {
    fold_number: number;
    train_period: string;
    test_period: string;
    win_rate: number;
    roi: number;
    sample_size: number;
}
export interface BootstrapResults {
    bootstrap_win_rates: number[];
    bootstrap_rois: number[];
    win_rate_ci_lower: number;
    win_rate_ci_upper: number;
    roi_ci_lower: number;
    roi_ci_upper: number;
    probability_target_achieved: number;
}
export interface ModelComparisonResults {
    individual_models: Record<string, ModelPerformance>;
    ensemble_performance: ModelPerformance;
    ensemble_improvement: number;
    best_individual_model: string;
}
export interface ModelPerformance {
    win_rate: number;
    roi: number;
    sharpe_ratio: number;
    sample_size: number;
    feature_importance: Record<string, number>;
}
export declare class BacktestingEngine {
    private logger;
    private scoringAgent;
    private professionalProcessor;
    constructor();
    /**
     * Main backtesting execution method
     */
    runComprehensiveBacktest(config: BacktestConfig): Promise<BacktestResult>;
    /**
     * Load historical settled props data
     */
    private loadHistoricalData;
    /**
     * Create time-series splits for cross-validation
     */
    private createTimeSeriesSplits;
    /**
     * Group data by month for time-series validation
     */
    private groupDataByMonth;
    /**
     * Perform cross-validation with rolling windows
     */
    private performCrossValidation;
    /**
     * Get date range string for a dataset
     */
    private getDateRange;
    /**
     * Calculate fold-specific metrics
     */
    private calculateFoldMetrics;
    /**
     * Score props for backtesting (simplified version)
     */
    private scorePropsForBacktest;
    /**
     * Convert prop to ScoringFeatureSet format
     */
    private convertPropToFeatureSet;
    /**
     * Determine if a bet won based on actual outcome
     */
    private determineWin;
    /**
     * Calculate Kelly stake size
     */
    private calculateKellyStake;
    /**
     * Calculate standard deviation
     */
    private calculateStandardDeviation;
    /**
     * Placeholder methods - to be implemented in following steps
     */
    private performHoldoutTesting;
    private performBootstrapAnalysis;
    private validateProfessionalFeatures;
    private validateRiskManagement;
    private performStressTesting;
    private compareModels;
    /**
     * Validate if success criteria are met
     */
    private validateSuccessCriteria;
}
//# sourceMappingURL=BacktestingEngine.d.ts.map