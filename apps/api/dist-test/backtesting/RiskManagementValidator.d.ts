/**
 * Risk Management Validation Framework for Phase 6 Backtesting
 *
 * Validates risk management systems against historical data:
 * - Kelly Criterion sizing accuracy and optimal implementation
 * - Portfolio correlation limits and diversification effectiveness
 * - Concentration risk management (single game, sport, player limits)
 * - Variance analysis and bankroll stability validation
 * - Tail risk metrics (VaR, CVaR) and stress testing
 * - Maximum drawdown tolerance and recovery analysis
 * - Risk-adjusted returns optimization
 */
import { BetResult } from './PerformanceMetricsEngine';
export interface RiskManagementConfig {
    max_kelly_fraction: number;
    kelly_multiplier: number;
    min_kelly_threshold: number;
    max_single_game_exposure: number;
    max_sport_exposure: number;
    max_player_exposure: number;
    max_daily_bets: number;
    max_correlation_threshold: number;
    diversification_minimum: number;
    max_drawdown_threshold: number;
    stop_loss_threshold: number;
    min_sharpe_ratio: number;
    max_var_95: number;
    max_cvar_95: number;
    initial_bankroll: number;
    bankroll_fractions: number[];
    rebalancing_frequency_days: number;
}
export interface RiskValidationResult {
    kelly_sizing: {
        average_kelly_used: number;
        optimal_kelly_achieved: boolean;
        sizing_accuracy_score: number;
        oversizing_violations: number;
        undersizing_missed_opportunities: number;
        kelly_calibration_error: number;
    };
    concentration_risk: {
        max_single_game_exposure_observed: number;
        max_sport_exposure_observed: number;
        max_player_exposure_observed: number;
        concentration_violations: number;
        herfindahl_index: number;
        diversification_effectiveness: number;
    };
    correlation_analysis: {
        max_daily_correlation: number;
        average_correlation: number;
        correlation_violations: number;
        diversification_ratio: number;
        portfolio_concentration: number;
    };
    drawdown_analysis: {
        max_drawdown_observed: number;
        drawdown_threshold_breaches: number;
        average_recovery_time_days: number;
        drawdown_frequency: number;
        worst_drawdown_period: string;
        recovery_factor: number;
    };
    variance_analysis: {
        realized_variance: number;
        expected_variance: number;
        variance_efficiency_ratio: number;
        stability_score: number;
        volatility_clustering: number;
    };
    tail_risk: {
        var_95: number;
        var_99: number;
        cvar_95: number;
        cvar_99: number;
        tail_ratio: number;
        extreme_loss_frequency: number;
        max_consecutive_losses: number;
    };
    risk_adjusted_performance: {
        sharpe_ratio: number;
        sortino_ratio: number;
        calmar_ratio: number;
        information_ratio: number;
        treynor_ratio: number;
        jensen_alpha: number;
    };
    stress_test_results: {
        worst_month_performance: number;
        worst_week_performance: number;
        black_swan_events: number;
        stress_test_survival: boolean;
        maximum_system_stress: number;
    };
    overall_risk_score: number;
    risk_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    passes_risk_validation: boolean;
    critical_risk_issues: string[];
    recommendations: string[];
}
export interface PortfolioState {
    date: string;
    active_bets: BetResult[];
    total_exposure: number;
    sport_exposures: Record<string, number>;
    player_exposures: Record<string, number>;
    correlation_matrix: Record<string, Record<string, number>>;
    current_drawdown: number;
    bankroll: number;
    var_95: number;
}
export declare class RiskManagementValidator {
    private logger;
    constructor();
    /**
     * Main risk management validation method
     */
    validateRiskManagement(bets: BetResult[], config: RiskManagementConfig): Promise<RiskValidationResult>;
    /**
     * Validate Kelly Criterion sizing implementation
     */
    private validateKellySizing;
    /**
     * Validate concentration risk limits
     */
    private validateConcentrationRisk;
    /**
     * Validate correlation limits and portfolio diversification
     */
    private validateCorrelationLimits;
    /**
     * Validate drawdown limits and recovery analysis
     */
    private validateDrawdownLimits;
    /**
     * Validate variance control and stability
     */
    private validateVarianceControl;
    /**
     * Validate tail risk metrics
     */
    private validateTailRisk;
    private calculateOptimalKelly;
    private buildDailyPortfolios;
    private calculateGameExposures;
    private calculateSportExposures;
    private calculatePlayerExposures;
    private calculateDailyReturns;
    private calculateCumulativeReturns;
    private calculateDrawdownSeries;
    private calculateRecoveryPeriods;
    private calculateVariance;
    private calculateExpectedVariance;
    private calculateStabilityScore;
    private calculateVolatilityClustering;
    private calculateVaR;
    private calculateCVaR;
    private calculateLossStreaks;
    private calculateHerfindahlIndex;
    private calculateDiversificationEffectiveness;
    private calculateCorrelationMatrix;
    private extractCorrelations;
    private calculateDiversificationRatio;
    private calculatePortfolioConcentration;
    private getDateRange;
    private getDateFromIndex;
    private groupBetsByDate;
    private calculateRiskAdjustedMetrics;
    private performStressTesting;
    private calculateOverallRiskScore;
}
//# sourceMappingURL=RiskManagementValidator.d.ts.map