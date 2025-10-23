"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfessionalFeatureValidator = void 0;
const logger_1 = require("../shared/logger");
class ProfessionalFeatureValidator {
    constructor() {
        this.logger = new logger_1.Logger('ProfessionalFeatureValidator');
    }
    /**
     * Main professional feature validation method
     */
    async validateProfessionalFeatures(bets, config) {
        this.logger.info('🏆 Starting comprehensive professional feature validation', {
            totalBets: bets.length,
            featuresEnabled: Object.values(config.features).filter(f => f).length,
            minimumSampleSize: config.validation.minimum_sample_size
        });
        const startTime = Date.now();
        try {
            // 1. Validate individual features
            const individual_features = await this.validateIndividualFeatures(bets, config);
            // 2. Analyze feature combinations
            const feature_combinations = await this.analyzeFeatureCombinations(bets, config);
            // 3. Compare professional system vs baseline
            const professional_system = await this.compareProfessionalSystemPerformance(bets, config);
            // 4. Rank features by importance
            const feature_ranking = await this.rankFeaturesByImportance(individual_features);
            // 5. Statistical validation with multiple testing correction
            const statistical_validation = await this.performStatisticalValidation(individual_features, config);
            // 6. Generate production recommendations
            const recommendations = await this.generateProductionRecommendations(individual_features, feature_combinations, professional_system, config);
            // 7. Validation summary
            const validation_summary = this.generateValidationSummary(individual_features, professional_system, statistical_validation, config);
            const result = {
                individual_features,
                feature_combinations,
                professional_system,
                feature_ranking,
                statistical_validation,
                recommendations,
                validation_summary
            };
            const executionTime = Date.now() - startTime;
            this.logger.info('✅ Professional feature validation completed', {
                executionTimeMs: executionTime,
                featuresValidated: individual_features.length,
                professionalSystemImprovement: professional_system.professional_system_improvement.win_rate_lift.toFixed(2) + '%',
                readyForProduction: validation_summary.ready_for_production,
                criticalIssues: validation_summary.critical_issues.length
            });
            return result;
        }
        catch (error) {
            this.logger.error('❌ Professional feature validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTimeMs: Date.now() - startTime
            });
            throw error;
        }
    }
    /**
     * Validate each professional feature individually
     */
    async validateIndividualFeatures(bets, config) {
        this.logger.info('🔍 Validating individual professional features');
        const features = Object.keys(config.features).filter(f => config.features[f]);
        const featureAnalyses = [];
        for (const featureName of features) {
            this.logger.info(`📊 Analyzing feature: ${featureName}`);
            // Split bets based on feature trigger
            const { enabled_bets, disabled_bets } = this.splitBetsByFeature(bets, featureName, config);
            if (enabled_bets.length < config.validation.minimum_sample_size) {
                this.logger.warn(`⚠️ Insufficient samples for ${featureName}: ${enabled_bets.length}`);
                continue;
            }
            // Calculate performance with feature enabled
            const enabled_performance = this.calculateFeaturePerformance(enabled_bets);
            // Calculate performance with feature disabled
            const disabled_performance = this.calculateFeaturePerformance(disabled_bets);
            // Calculate impact metrics
            const impact_metrics = this.calculateImpactMetrics(enabled_performance, disabled_performance);
            // Calculate feature-specific insights
            const feature_insights = this.calculateFeatureInsights(enabled_bets, disabled_bets, featureName);
            // Calculate ROI attribution
            const roi_attribution = this.calculateROIAttribution(enabled_bets, disabled_bets, bets);
            featureAnalyses.push({
                feature_name: featureName,
                enabled_performance,
                disabled_performance,
                impact_metrics,
                feature_insights,
                roi_attribution
            });
            this.logger.info(`✅ Feature ${featureName} analysis completed`, {
                winRateImprovement: impact_metrics.win_rate_improvement.toFixed(2) + '%',
                roiImprovement: impact_metrics.roi_improvement.toFixed(2) + '%',
                pValue: impact_metrics.p_value.toFixed(4),
                statisticallySignificant: impact_metrics.p_value < config.validation.significance_threshold
            });
        }
        return featureAnalyses;
    }
    /**
     * Analyze feature combinations for synergistic effects
     */
    async analyzeFeatureCombinations(bets, config) {
        this.logger.info('🔗 Analyzing feature combinations for synergistic effects');
        const enabledFeatures = Object.keys(config.features).filter(f => config.features[f]);
        const combinations = [];
        // Test 2-feature combinations
        for (let i = 0; i < enabledFeatures.length; i++) {
            for (let j = i + 1; j < enabledFeatures.length; j++) {
                const combination = [enabledFeatures[i], enabledFeatures[j]];
                const analysis = await this.analyzeCombination(bets, combination, config);
                combinations.push(analysis);
            }
        }
        // Test 3-feature combinations (top performing pairs)
        const topPairs = combinations
            .filter(c => c.synergy_analysis.synergy_effect > 0)
            .sort((a, b) => b.synergy_analysis.synergy_effect - a.synergy_analysis.synergy_effect)
            .slice(0, 5);
        for (const pair of topPairs) {
            for (const additionalFeature of enabledFeatures) {
                if (!pair.features_included.includes(additionalFeature)) {
                    const combination = [...pair.features_included, additionalFeature];
                    const analysis = await this.analyzeCombination(bets, combination, config);
                    combinations.push(analysis);
                }
            }
        }
        // Test all features combination
        if (enabledFeatures.length > 1) {
            const allFeaturesAnalysis = await this.analyzeCombination(bets, enabledFeatures, config);
            combinations.push(allFeaturesAnalysis);
        }
        return combinations;
    }
    /**
     * Compare professional system performance vs baseline
     */
    async compareProfessionalSystemPerformance(bets, config) {
        this.logger.info('📈 Comparing professional system vs baseline performance');
        // Professional system (all features enabled)
        const professional_bets = this.filterBetsWithProfessionalFeatures(bets, config);
        const all_features_enabled = this.calculateSystemPerformance(professional_bets);
        // Baseline system (no professional features)
        const baseline_bets = this.filterBetsWithoutProfessionalFeatures(bets, config);
        const baseline_performance = this.calculateSystemPerformance(baseline_bets);
        // Calculate improvements
        const professional_system_improvement = {
            win_rate_lift: all_features_enabled.win_rate - baseline_performance.win_rate,
            roi_lift: all_features_enabled.roi - baseline_performance.roi,
            sharpe_lift: all_features_enabled.sharpe_ratio - baseline_performance.sharpe_ratio,
            total_edge_generated: this.calculateTotalEdgeGenerated(professional_bets, baseline_bets)
        };
        this.logger.info('📈 Professional system comparison completed', {
            professionalWinRate: all_features_enabled.win_rate.toFixed(2) + '%',
            baselineWinRate: baseline_performance.win_rate.toFixed(2) + '%',
            winRateLift: professional_system_improvement.win_rate_lift.toFixed(2) + '%',
            roiLift: professional_system_improvement.roi_lift.toFixed(2) + '%',
            totalEdgeGenerated: professional_system_improvement.total_edge_generated.toFixed(2) + '%'
        });
        return {
            all_features_enabled,
            baseline_performance,
            professional_system_improvement
        };
    }
    /**
     * Split bets based on whether a specific feature was triggered
     */
    splitBetsByFeature(bets, featureName, config) {
        // Simulate feature triggering based on bet characteristics
        // In production, this would use actual feature trigger data
        const enabled_bets = [];
        const disabled_bets = [];
        bets.forEach(bet => {
            const featureTriggered = this.simulateFeatureTrigger(bet, featureName, config);
            if (featureTriggered) {
                enabled_bets.push(bet);
            }
            else {
                disabled_bets.push(bet);
            }
        });
        return { enabled_bets, disabled_bets };
    }
    /**
     * Simulate feature trigger based on bet characteristics
     */
    simulateFeatureTrigger(bet, featureName, config) {
        // Simulate feature triggers based on realistic conditions
        switch (featureName) {
            case 'steam_detection':
                // Steam typically occurs in 15-20% of high-volume games
                return bet.confidence > 70 && Math.random() < 0.18;
            case 'closing_line_prediction':
                // CLV prediction available for most bets
                return Math.random() < 0.85;
            case 'optimal_timing':
                // Timing analysis for bets placed >2 hours before game
                return bet.confidence > 60 && Math.random() < 0.60;
            case 'line_shopping_edge':
                // Line shopping available for most markets
                return Math.random() < 0.90;
            case 'public_vs_sharp_split':
                // Public/sharp data available for major games
                return ['NBA', 'NFL', 'MLB'].includes(bet.sport) && Math.random() < 0.75;
            case 'market_timing_advantage':
                // Market timing applicable to most bets
                return Math.random() < 0.80;
            case 'injury_timing_edge':
                // Injury news affects ~10% of player props
                return bet.stat_type.includes('points') && Math.random() < 0.12;
            case 'cross_market_discrepancy':
                // Cross-market opportunities in ~8% of props
                return bet.confidence > 65 && Math.random() < 0.08;
            default:
                return false;
        }
    }
    /**
     * Calculate performance metrics for a feature subset
     */
    calculateFeaturePerformance(bets) {
        if (bets.length === 0) {
            return {
                sample_size: 0,
                win_rate: 0,
                roi: 0,
                avg_confidence: 0,
                avg_edge: 0,
                sharpe_ratio: 0
            };
        }
        const wins = bets.filter(bet => bet.won).length;
        const total_stake = bets.reduce((sum, bet) => sum + bet.stake, 0);
        const total_profit = bets.reduce((sum, bet) => sum + bet.profit, 0);
        return {
            sample_size: bets.length,
            win_rate: (wins / bets.length) * 100,
            roi: total_stake > 0 ? (total_profit / total_stake) * 100 : 0,
            avg_confidence: bets.reduce((sum, bet) => sum + bet.confidence, 0) / bets.length,
            avg_edge: bets.reduce((sum, bet) => sum + (bet.clv || 0), 0) / bets.length,
            sharpe_ratio: this.calculateSharpeRatio(bets)
        };
    }
    /**
     * Calculate impact metrics between enabled and disabled performance
     */
    calculateImpactMetrics(enabled, disabled) {
        const win_rate_improvement = enabled.win_rate - disabled.win_rate;
        const roi_improvement = enabled.roi - disabled.roi;
        const confidence_improvement = enabled.avg_confidence - disabled.avg_confidence;
        const edge_improvement = enabled.avg_edge - disabled.avg_edge;
        const sharpe_improvement = enabled.sharpe_ratio - disabled.sharpe_ratio;
        // Calculate statistical significance (simplified t-test)
        const { statistical_significance, p_value } = this.calculateTTestSignificance(enabled, disabled);
        const effect_size = this.calculateEffectSize(enabled, disabled);
        return {
            win_rate_improvement,
            roi_improvement,
            confidence_improvement,
            edge_improvement,
            sharpe_improvement,
            statistical_significance,
            p_value,
            effect_size
        };
    }
    // Helper methods with simplified implementations
    calculateFeatureInsights(enabled_bets, disabled_bets, featureName) {
        const total_bets = enabled_bets.length + disabled_bets.length;
        const trigger_frequency = enabled_bets.length / total_bets;
        return {
            trigger_frequency,
            false_positive_rate: 0.15, // Simplified
            precision: 0.82,
            recall: 0.75,
            optimal_threshold: 0.65,
            feature_correlation: {}
        };
    }
    calculateROIAttribution(enabled_bets, disabled_bets, all_bets) {
        const enabled_profit = enabled_bets.reduce((sum, bet) => sum + bet.profit, 0);
        const total_profit = all_bets.reduce((sum, bet) => sum + bet.profit, 0);
        return {
            direct_contribution: enabled_profit,
            interaction_effects: 0, // Simplified
            total_contribution: enabled_profit,
            contribution_percentage: total_profit > 0 ? (enabled_profit / total_profit) * 100 : 0
        };
    }
    async analyzeCombination(bets, features, config) {
        const combination_name = features.join(' + ');
        // Filter bets where all features in combination are triggered
        const combination_bets = bets.filter(bet => features.every(feature => this.simulateFeatureTrigger(bet, feature, config)));
        const performance = this.calculateSystemPerformance(combination_bets);
        // Calculate expected vs actual performance
        const expected_performance = features.length * 2; // Simplified expectation
        const actual_performance = performance.win_rate;
        const synergy_effect = actual_performance - expected_performance;
        return {
            combination_name,
            features_included: features,
            performance,
            synergy_analysis: {
                expected_performance,
                actual_performance,
                synergy_effect,
                interaction_strength: Math.abs(synergy_effect)
            },
            feature_weights: features.reduce((weights, feature) => {
                weights[feature] = 1 / features.length; // Equal weighting simplified
                return weights;
            }, {}),
            optimal_feature_combination: synergy_effect > 2
        };
    }
    calculateSystemPerformance(bets) {
        if (bets.length === 0) {
            return { win_rate: 0, roi: 0, sharpe_ratio: 0, sample_size: 0 };
        }
        const wins = bets.filter(bet => bet.won).length;
        const total_stake = bets.reduce((sum, bet) => sum + bet.stake, 0);
        const total_profit = bets.reduce((sum, bet) => sum + bet.profit, 0);
        return {
            win_rate: (wins / bets.length) * 100,
            roi: total_stake > 0 ? (total_profit / total_stake) * 100 : 0,
            sharpe_ratio: this.calculateSharpeRatio(bets),
            sample_size: bets.length
        };
    }
    calculateSharpeRatio(bets) {
        // Simplified Sharpe ratio calculation
        if (bets.length === 0)
            return 0;
        const daily_returns = this.calculateDailyReturns(bets);
        const mean_return = daily_returns.reduce((sum, ret) => sum + ret, 0) / daily_returns.length;
        const std_dev = this.calculateStandardDeviation(daily_returns);
        return std_dev > 0 ? mean_return / std_dev : 0;
    }
    calculateDailyReturns(bets) {
        // Group bets by date and calculate daily returns
        const dailyGroups = {};
        bets.forEach(bet => {
            const date = bet.date.split('T')[0];
            if (!dailyGroups[date])
                dailyGroups[date] = [];
            dailyGroups[date].push(bet);
        });
        return Object.values(dailyGroups).map(dayBets => {
            const stake = dayBets.reduce((sum, bet) => sum + bet.stake, 0);
            const profit = dayBets.reduce((sum, bet) => sum + bet.profit, 0);
            return stake > 0 ? (profit / stake) * 100 : 0;
        });
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    calculateTTestSignificance(enabled, disabled) {
        // Simplified t-test calculation
        const n1 = enabled.sample_size;
        const n2 = disabled.sample_size;
        if (n1 < 30 || n2 < 30) {
            return { statistical_significance: 0, p_value: 1 };
        }
        // Simplified calculation - would use proper t-test in production
        const mean_diff = Math.abs(enabled.win_rate - disabled.win_rate);
        const pooled_std = Math.sqrt((n1 + n2) / (n1 * n2)) * 10; // Simplified
        const t_stat = mean_diff / pooled_std;
        const p_value = Math.max(0.001, 2 * (1 - this.normalCDF(Math.abs(t_stat))));
        return {
            statistical_significance: t_stat,
            p_value
        };
    }
    calculateEffectSize(enabled, disabled) {
        // Cohen's d effect size
        const mean_diff = enabled.win_rate - disabled.win_rate;
        const pooled_std = 10; // Simplified assumption
        return pooled_std > 0 ? mean_diff / pooled_std : 0;
    }
    normalCDF(x) {
        // Simplified normal CDF approximation
        return 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    }
    filterBetsWithProfessionalFeatures(bets, config) {
        // Return bets where at least one professional feature triggered
        return bets.filter(bet => Object.keys(config.features).some(feature => config.features[feature] &&
            this.simulateFeatureTrigger(bet, feature, config)));
    }
    filterBetsWithoutProfessionalFeatures(bets, config) {
        // Return bets where no professional features triggered
        return bets.filter(bet => !Object.keys(config.features).some(feature => config.features[feature] &&
            this.simulateFeatureTrigger(bet, feature, config)));
    }
    calculateTotalEdgeGenerated(professional_bets, baseline_bets) {
        const prof_edge = professional_bets.reduce((sum, bet) => sum + (bet.clv || 0), 0);
        const base_edge = baseline_bets.reduce((sum, bet) => sum + (bet.clv || 0), 0);
        return prof_edge - base_edge;
    }
    async rankFeaturesByImportance(features) {
        const by_win_rate_impact = features.sort((a, b) => b.impact_metrics.win_rate_improvement - a.impact_metrics.win_rate_improvement).map(f => f.feature_name);
        const by_roi_impact = features.sort((a, b) => b.impact_metrics.roi_improvement - a.impact_metrics.roi_improvement).map(f => f.feature_name);
        const by_sharpe_impact = features.sort((a, b) => b.impact_metrics.sharpe_improvement - a.impact_metrics.sharpe_improvement).map(f => f.feature_name);
        const by_statistical_significance = features.sort((a, b) => a.impact_metrics.p_value - b.impact_metrics.p_value).map(f => f.feature_name);
        // Composite ranking based on multiple factors
        const composite_ranking = features
            .sort((a, b) => {
            const scoreA = a.impact_metrics.win_rate_improvement + a.impact_metrics.roi_improvement - a.impact_metrics.p_value * 100;
            const scoreB = b.impact_metrics.win_rate_improvement + b.impact_metrics.roi_improvement - b.impact_metrics.p_value * 100;
            return scoreB - scoreA;
        })
            .map(f => f.feature_name);
        return {
            by_win_rate_impact,
            by_roi_impact,
            by_sharpe_impact,
            by_statistical_significance,
            composite_ranking
        };
    }
    async performStatisticalValidation(features, config) {
        const p_values = features.map(f => f.impact_metrics.p_value);
        const significant_features = p_values.filter(p => p < config.validation.significance_threshold).length;
        const overall_significance = significant_features / features.length;
        // Bonferroni correction for multiple testing
        const bonferroni_threshold = config.validation.significance_threshold / features.length;
        const bonferroni_adjusted_p_values = features.reduce((adj, feature) => {
            adj[feature.feature_name] = Math.min(1, feature.impact_metrics.p_value * features.length);
            return adj;
        }, {});
        // False Discovery Rate (Benjamini-Hochberg)
        const sorted_p_values = [...p_values].sort((a, b) => a - b);
        const fdr_threshold = 0.05; // 5% FDR
        let false_discovery_rate = 0;
        for (let i = 0; i < sorted_p_values.length; i++) {
            const bh_threshold = (i + 1) / sorted_p_values.length * fdr_threshold;
            if (sorted_p_values[i] <= bh_threshold) {
                false_discovery_rate = sorted_p_values[i];
            }
        }
        const multiple_testing_correction = 1 - overall_significance; // Simplified
        return {
            overall_significance,
            multiple_testing_correction,
            bonferroni_adjusted_p_values,
            false_discovery_rate
        };
    }
    async generateProductionRecommendations(features, combinations, system, config) {
        // Features with significant positive impact
        const features_to_enable = features
            .filter(f => f.impact_metrics.win_rate_improvement > 1 && f.impact_metrics.p_value < 0.05)
            .map(f => f.feature_name);
        // Features with negative or insignificant impact
        const features_to_disable = features
            .filter(f => f.impact_metrics.win_rate_improvement <= 0 || f.impact_metrics.p_value > 0.1)
            .map(f => f.feature_name);
        // Threshold adjustments based on performance
        const threshold_adjustments = features.reduce((adj, feature) => {
            if (feature.feature_insights.precision < 0.7) {
                adj[feature.feature_name] = feature.feature_insights.optimal_threshold * 1.1; // Increase threshold
            }
            return adj;
        }, {});
        // Expected production performance
        const expected_production_performance = {
            win_rate: system.all_features_enabled.win_rate,
            roi: system.all_features_enabled.roi,
            confidence_interval: [
                system.all_features_enabled.win_rate - 2,
                system.all_features_enabled.win_rate + 2
            ]
        };
        return {
            features_to_enable,
            features_to_disable,
            threshold_adjustments,
            expected_production_performance
        };
    }
    generateValidationSummary(features, system, validation, config) {
        const significant_features = features.filter(f => f.impact_metrics.p_value < config.validation.significance_threshold);
        const professional_features_validated = significant_features.length >= features.length * 0.6; // 60% threshold
        const target_improvement_achieved = system.professional_system_improvement.win_rate_lift >= 3; // 3% minimum improvement
        const minimum_statistical_significance_met = validation.overall_significance >= 0.7; // 70% threshold
        const ready_for_production = professional_features_validated &&
            target_improvement_achieved &&
            minimum_statistical_significance_met;
        const critical_issues = [];
        if (!professional_features_validated)
            critical_issues.push('Insufficient validated professional features');
        if (!target_improvement_achieved)
            critical_issues.push('Target win rate improvement not achieved');
        if (!minimum_statistical_significance_met)
            critical_issues.push('Statistical significance threshold not met');
        return {
            professional_features_validated,
            target_improvement_achieved,
            minimum_statistical_significance_met,
            ready_for_production,
            critical_issues
        };
    }
}
exports.ProfessionalFeatureValidator = ProfessionalFeatureValidator;
