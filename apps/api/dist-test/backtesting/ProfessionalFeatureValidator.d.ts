/**
 * Professional Feature Backtesting Validator for Phase 6
 *
 * Validates the effectiveness of all 8 professional capper features against historical data:
 * 1. Steam Detection - Real-time steam move detection with volume correlation
 * 2. Closing Line Prediction - ML-powered line closure forecasting
 * 3. Optimal Timing - Hour-to-game edge calculation for maximum value
 * 4. Line Shopping Edge - Multi-book best line identification
 * 5. Public vs Sharp Split - Contrarian opportunity detection
 * 6. Market Timing Advantage - Time-decay edge modeling
 * 7. Injury Timing Edge - News break vs line adjustment timing
 * 8. Cross Market Discrepancy - Related prop arbitrage detection
 *
 * Tests each feature independently and in combination to measure:
 * - Individual feature impact on win rate and ROI
 * - Feature combination synergies
 * - Statistical significance of improvements
 * - Contribution to overall edge generation
 */
import { BetResult } from './PerformanceMetricsEngine';
export interface ProfessionalFeatureConfig {
    features: {
        steam_detection: boolean;
        closing_line_prediction: boolean;
        optimal_timing: boolean;
        line_shopping_edge: boolean;
        public_vs_sharp_split: boolean;
        market_timing_advantage: boolean;
        injury_timing_edge: boolean;
        cross_market_discrepancy: boolean;
    };
    thresholds: {
        steam_detection_threshold: number;
        closing_line_confidence_threshold: number;
        optimal_timing_edge_threshold: number;
        line_shopping_minimum_edge: number;
        public_split_threshold: number;
        market_timing_minimum_advantage: number;
        injury_timing_window_hours: number;
        cross_market_minimum_discrepancy: number;
    };
    validation: {
        minimum_sample_size: number;
        significance_threshold: number;
        bootstrap_samples: number;
        holdout_percentage: number;
    };
}
export interface FeatureImpactAnalysis {
    feature_name: string;
    enabled_performance: {
        sample_size: number;
        win_rate: number;
        roi: number;
        avg_confidence: number;
        avg_edge: number;
        sharpe_ratio: number;
    };
    disabled_performance: {
        sample_size: number;
        win_rate: number;
        roi: number;
        avg_confidence: number;
        avg_edge: number;
        sharpe_ratio: number;
    };
    impact_metrics: {
        win_rate_improvement: number;
        roi_improvement: number;
        confidence_improvement: number;
        edge_improvement: number;
        sharpe_improvement: number;
        statistical_significance: number;
        p_value: number;
        effect_size: number;
    };
    feature_insights: {
        trigger_frequency: number;
        false_positive_rate: number;
        precision: number;
        recall: number;
        optimal_threshold: number;
        feature_correlation: Record<string, number>;
    };
    roi_attribution: {
        direct_contribution: number;
        interaction_effects: number;
        total_contribution: number;
        contribution_percentage: number;
    };
}
export interface CombinationAnalysis {
    combination_name: string;
    features_included: string[];
    performance: {
        sample_size: number;
        win_rate: number;
        roi: number;
        sharpe_ratio: number;
        max_drawdown: number;
    };
    synergy_analysis: {
        expected_performance: number;
        actual_performance: number;
        synergy_effect: number;
        interaction_strength: number;
    };
    feature_weights: Record<string, number>;
    optimal_feature_combination: boolean;
}
export interface ProfessionalFeatureValidationResult {
    individual_features: FeatureImpactAnalysis[];
    feature_combinations: CombinationAnalysis[];
    professional_system: {
        all_features_enabled: {
            win_rate: number;
            roi: number;
            sharpe_ratio: number;
            sample_size: number;
        };
        baseline_performance: {
            win_rate: number;
            roi: number;
            sharpe_ratio: number;
            sample_size: number;
        };
        professional_system_improvement: {
            win_rate_lift: number;
            roi_lift: number;
            sharpe_lift: number;
            total_edge_generated: number;
        };
    };
    feature_ranking: {
        by_win_rate_impact: string[];
        by_roi_impact: string[];
        by_sharpe_impact: string[];
        by_statistical_significance: string[];
        composite_ranking: string[];
    };
    statistical_validation: {
        overall_significance: number;
        multiple_testing_correction: number;
        bonferroni_adjusted_p_values: Record<string, number>;
        false_discovery_rate: number;
    };
    recommendations: {
        features_to_enable: string[];
        features_to_disable: string[];
        threshold_adjustments: Record<string, number>;
        expected_production_performance: {
            win_rate: number;
            roi: number;
            confidence_interval: [number, number];
        };
    };
    validation_summary: {
        professional_features_validated: boolean;
        target_improvement_achieved: boolean;
        minimum_statistical_significance_met: boolean;
        ready_for_production: boolean;
        critical_issues: string[];
    };
}
export declare class ProfessionalFeatureValidator {
    private logger;
    constructor();
    /**
     * Main professional feature validation method
     */
    validateProfessionalFeatures(bets: BetResult[], config: ProfessionalFeatureConfig): Promise<ProfessionalFeatureValidationResult>;
    /**
     * Validate each professional feature individually
     */
    private validateIndividualFeatures;
    /**
     * Analyze feature combinations for synergistic effects
     */
    private analyzeFeatureCombinations;
    /**
     * Compare professional system performance vs baseline
     */
    private compareProfessionalSystemPerformance;
    /**
     * Split bets based on whether a specific feature was triggered
     */
    private splitBetsByFeature;
    /**
     * Simulate feature trigger based on bet characteristics
     */
    private simulateFeatureTrigger;
    /**
     * Calculate performance metrics for a feature subset
     */
    private calculateFeaturePerformance;
    /**
     * Calculate impact metrics between enabled and disabled performance
     */
    private calculateImpactMetrics;
    private calculateFeatureInsights;
    private calculateROIAttribution;
    private analyzeCombination;
    private calculateSystemPerformance;
    private calculateSharpeRatio;
    private calculateDailyReturns;
    private calculateStandardDeviation;
    private calculateTTestSignificance;
    private calculateEffectSize;
    private normalCDF;
    private filterBetsWithProfessionalFeatures;
    private filterBetsWithoutProfessionalFeatures;
    private calculateTotalEdgeGenerated;
    private rankFeaturesByImportance;
    private performStatisticalValidation;
    private generateProductionRecommendations;
    private generateValidationSummary;
}
//# sourceMappingURL=ProfessionalFeatureValidator.d.ts.map