/**
 * Stress Testing Engine for Phase 6 Backtesting
 *
 * Validates system resilience under extreme market conditions and worst-case scenarios:
 * - Market crash scenarios (2008, COVID-19, etc.)
 * - Injury outbreak stress tests
 * - Black swan events simulation
 * - Extended losing streak analysis
 * - Model degradation scenarios
 * - High correlation event testing
 * - Extreme weather impact analysis
 * - Liquidity crisis simulation
 *
 * Ensures the 55%+ win rate target holds under adverse conditions and
 * validates risk management effectiveness during market stress.
 */
import { BetResult } from './PerformanceMetricsEngine';
export interface StressTestConfig {
    scenarios: {
        market_crash: boolean;
        injury_outbreak: boolean;
        black_swan_events: boolean;
        extended_losing_streaks: boolean;
        model_degradation: boolean;
        high_correlation_events: boolean;
        extreme_weather: boolean;
        liquidity_crisis: boolean;
    };
    parameters: {
        market_crash_severity: number;
        injury_outbreak_percentage: number;
        black_swan_frequency: number;
        max_losing_streak_length: number;
        model_degradation_rate: number;
        correlation_spike_level: number;
        extreme_weather_frequency: number;
        liquidity_reduction_factor: number;
    };
    thresholds: {
        minimum_win_rate_under_stress: number;
        maximum_drawdown_tolerance: number;
        minimum_sharpe_ratio_under_stress: number;
        maximum_recovery_time_days: number;
    };
    simulation: {
        monte_carlo_runs: number;
        bootstrap_samples: number;
        confidence_level: number;
        stress_duration_days: number;
    };
}
export interface StressTestScenario {
    scenario_name: string;
    description: string;
    severity_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    performance_under_stress: {
        win_rate: number;
        roi: number;
        sharpe_ratio: number;
        max_drawdown: number;
        recovery_time_days: number;
        var_95: number;
        tail_risk: number;
    };
    stress_impact: {
        performance_degradation: number;
        risk_increase: number;
        correlation_increase: number;
        liquidity_impact: number;
    };
    system_resilience: {
        passes_stress_test: boolean;
        critical_failures: string[];
        risk_mitigation_effectiveness: number;
        recovery_strength: number;
    };
    monte_carlo_results: {
        success_rate: number;
        worst_case_performance: number;
        best_case_performance: number;
        confidence_intervals: {
            win_rate_ci: [number, number];
            roi_ci: [number, number];
            drawdown_ci: [number, number];
        };
    };
}
export interface StressTestResult {
    scenario_results: StressTestScenario[];
    aggregate_analysis: {
        overall_stress_resistance: number;
        scenarios_passed: number;
        scenarios_failed: number;
        critical_failure_scenarios: string[];
    };
    system_stress_metrics: {
        stress_adjusted_win_rate: number;
        stress_adjusted_roi: number;
        stress_adjusted_sharpe: number;
        maximum_system_drawdown: number;
        longest_recovery_period: number;
        correlation_resilience: number;
    };
    black_swan_analysis: {
        black_swan_survival_rate: number;
        extreme_event_impact: number;
        tail_risk_adequacy: boolean;
        emergency_procedures_effectiveness: number;
    };
    model_robustness: {
        performance_stability_score: number;
        degradation_resistance: number;
        adaptation_capability: number;
        feature_reliability_under_stress: Record<string, number>;
    };
    risk_management_validation: {
        kelly_sizing_under_stress: number;
        position_sizing_effectiveness: number;
        stop_loss_trigger_accuracy: number;
        portfolio_rebalancing_effectiveness: number;
    };
    production_readiness: {
        stress_test_grade: 'A' | 'B' | 'C' | 'D' | 'F';
        ready_for_live_trading: boolean;
        recommended_risk_adjustments: string[];
        emergency_protocols_needed: string[];
    };
}
export declare class StressTestingEngine {
    private logger;
    constructor();
    /**
     * Main stress testing execution method
     */
    performComprehensiveStressTesting(bets: BetResult[], config: StressTestConfig): Promise<StressTestResult>;
    /**
     * Run individual stress test scenarios
     */
    private runStressTestScenarios;
    /**
     * Market Crash Scenario (2008/COVID-19 style market disruption)
     */
    private runMarketCrashScenario;
    /**
     * Injury Outbreak Scenario (Multiple key players injured)
     */
    private runInjuryOutbreakScenario;
    /**
     * Extended Losing Streak Scenario
     */
    private runExtendedLosingStreakScenario;
    /**
     * Calculate performance under stress conditions
     */
    private calculateStressPerformance;
    /**
     * Assess system resilience under stress
     */
    private assessSystemResilience;
    /**
     * Run Monte Carlo simulation for scenario
     */
    private runMonteCarloSimulation;
    private simulateMarketCrashImpact;
    private simulateInjuryOutbreakImpact;
    private simulateLosingStreak;
    private calculateDailyReturns;
    private calculateCumulativeReturns;
    private calculateSharpeRatio;
    private calculateMaxDrawdown;
    private calculateRecoveryTime;
    private calculateVaR;
    private calculateTailRisk;
    private bootstrapSample;
    private runBlackSwanScenario;
    private runModelDegradationScenario;
    private runHighCorrelationScenario;
    private runExtremeWeatherScenario;
    private runLiquidityCrisisScenario;
    private performAggregateStressAnalysis;
    private calculateSystemStressMetrics;
    private performBlackSwanAnalysis;
    private assessModelRobustness;
    private validateRiskManagementUnderStress;
    private assessProductionReadiness;
    private findMaxDrawdownIndex;
    private findRecoveryIndex;
}
//# sourceMappingURL=StressTestingEngine.d.ts.map