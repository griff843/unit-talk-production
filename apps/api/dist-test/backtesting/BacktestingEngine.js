"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestingEngine = void 0;
const ScoringAgent_1 = require("../agents/ScoringAgent/ScoringAgent");
const ProfessionalPropProcessor_1 = require("../services/ProfessionalPropProcessor");
const supabaseClient_1 = require("../services/supabaseClient");
const logger_1 = require("../shared/logger");
class BacktestingEngine {
    constructor() {
        this.logger = new logger_1.Logger('BacktestingEngine');
        this.scoringAgent = new ScoringAgent_1.ScoringAgent({
            name: 'BacktestScoringAgent',
            interval: 0, // No scheduled runs for backtesting
            enabled: true,
            dependencies: ['supabase'],
            healthChecks: {
                enabled: true,
                interval: 30000,
                timeout: 5000,
                retries: 3
            }
        }, {
            supabase: supabaseClient_1.supabaseClient,
            temporal: null, // Not needed for backtesting
            logger: this.logger
        });
        this.professionalProcessor = ProfessionalPropProcessor_1.ProfessionalPropProcessor.getInstance();
    }
    /**
     * Main backtesting execution method
     */
    async runComprehensiveBacktest(config) {
        this.logger.info('🚀 Starting Phase 6 Comprehensive Backtesting', {
            config,
            targetWinRate: config.targetWinRate,
            expectedSamples: '142K+ settled props'
        });
        const startTime = Date.now();
        try {
            // 1. Load and validate historical data
            const historicalData = await this.loadHistoricalData(config);
            this.logger.info(`📊 Loaded ${historicalData.length} historical props for backtesting`);
            // 2. Split data for time-series validation
            const { trainData, testData, folds } = await this.createTimeSeriesSplits(historicalData, config);
            // 3. Cross-validation with rolling windows
            const crossValidationResults = await this.performCrossValidation(folds, config);
            // 4. Hold-out testing on final test set
            const holdoutResults = await this.performHoldoutTesting(testData, config);
            // 5. Bootstrap analysis for statistical significance
            const bootstrapResults = await this.performBootstrapAnalysis(testData, config);
            // 6. Professional feature validation
            const professionalFeatureResults = await this.validateProfessionalFeatures(testData, config);
            // 7. Risk management validation
            const riskAnalysis = await this.validateRiskManagement(testData, config);
            // 8. Stress testing
            const stressTestResults = await this.performStressTesting(testData, config);
            // 9. Model comparison analysis
            const modelComparison = await this.compareModels(testData, config);
            // 10. Compile comprehensive results
            const result = {
                overall_performance: holdoutResults.overall_performance,
                by_sport: holdoutResults.by_sport,
                by_confidence: holdoutResults.by_confidence,
                professional_features: professionalFeatureResults,
                risk_metrics: riskAnalysis,
                time_series: holdoutResults.time_series,
                statistical_validation: bootstrapResults.statistical_validation,
                cross_validation: crossValidationResults,
                bootstrap_analysis: bootstrapResults,
                model_comparison: modelComparison
            };
            const totalTime = Date.now() - startTime;
            this.logger.info('✅ Phase 6 Comprehensive Backtesting Completed', {
                executionTimeMs: totalTime,
                overallWinRate: result.overall_performance.win_rate,
                targetAchieved: result.overall_performance.win_rate >= config.targetWinRate,
                totalBets: result.overall_performance.total_bets,
                roi: result.overall_performance.roi,
                sharpeRatio: result.overall_performance.sharpe_ratio,
                maxDrawdown: result.overall_performance.max_drawdown,
                clvPositiveRate: result.overall_performance.clv_positive_rate
            });
            // Validate success criteria
            this.validateSuccessCriteria(result, config);
            return result;
        }
        catch (error) {
            this.logger.error('❌ Comprehensive backtesting failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTimeMs: Date.now() - startTime
            });
            throw error;
        }
    }
    /**
     * Load historical settled props data
     */
    async loadHistoricalData(config) {
        const query = supabaseClient_1.supabaseClient
            .from('raw_props')
            .select('*')
            .not('result', 'is', null) // Only settled props
            .gte('created_at', config.startDate)
            .lte('created_at', config.endDate)
            .in('sport', config.sports)
            .order('created_at', { ascending: true });
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to load historical data: ${error.message}`);
        }
        if (!data || data.length < config.minSamplesPerSport * config.sports.length) {
            throw new Error(`Insufficient historical data: ${data?.length || 0} samples`);
        }
        // Validate data quality
        const validData = data.filter(prop => prop.result &&
            prop.actual_value !== null &&
            prop.line !== null &&
            prop.over_odds &&
            prop.under_odds);
        this.logger.info('📋 Historical data validation completed', {
            totalLoaded: data.length,
            validSamples: validData.length,
            invalidFiltered: data.length - validData.length,
            dataQualityRate: (validData.length / data.length * 100).toFixed(2) + '%'
        });
        return validData;
    }
    /**
     * Create time-series splits for cross-validation
     */
    async createTimeSeriesSplits(data, config) {
        // Sort by date to ensure proper time-series ordering
        const sortedData = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        // Hold-out final test set
        const holdoutIndex = Math.floor(sortedData.length * (1 - config.holdoutPercentage));
        const trainData = sortedData.slice(0, holdoutIndex);
        const testData = sortedData.slice(holdoutIndex);
        // Create rolling window folds
        const folds = [];
        const trainMonths = config.rollingWindowMonths;
        const testMonths = config.testWindowMonths;
        // Generate monthly splits
        const monthlyData = this.groupDataByMonth(trainData);
        const months = Object.keys(monthlyData).sort();
        for (let i = trainMonths; i < months.length - testMonths; i++) {
            const trainMonthKeys = months.slice(i - trainMonths, i);
            const testMonthKeys = months.slice(i, i + testMonths);
            const foldTrainData = trainMonthKeys.flatMap(month => monthlyData[month]);
            const foldTestData = testMonthKeys.flatMap(month => monthlyData[month]);
            if (foldTrainData.length >= 1000 && foldTestData.length >= 200) {
                folds.push({
                    train: foldTrainData,
                    test: foldTestData
                });
            }
        }
        this.logger.info('📊 Time-series splits created', {
            totalSamples: sortedData.length,
            trainSamples: trainData.length,
            testSamples: testData.length,
            crossValidationFolds: folds.length,
            avgFoldTrainSize: Math.round(folds.reduce((sum, fold) => sum + fold.train.length, 0) / folds.length),
            avgFoldTestSize: Math.round(folds.reduce((sum, fold) => sum + fold.test.length, 0) / folds.length)
        });
        return { trainData, testData, folds };
    }
    /**
     * Group data by month for time-series validation
     */
    groupDataByMonth(data) {
        const monthlyData = {};
        data.forEach(prop => {
            const date = new Date(prop.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = [];
            }
            monthlyData[monthKey].push(prop);
        });
        return monthlyData;
    }
    /**
     * Perform cross-validation with rolling windows
     */
    async performCrossValidation(folds, config) {
        this.logger.info('🔄 Starting cross-validation with rolling windows', {
            totalFolds: folds.length
        });
        const foldResults = [];
        for (let i = 0; i < folds.length; i++) {
            const fold = folds[i];
            this.logger.info(`📊 Processing fold ${i + 1}/${folds.length}`, {
                trainSamples: fold.train.length,
                testSamples: fold.test.length
            });
            // Score props in test fold using training data context
            const foldScores = await this.scorePropsForBacktest(fold.test);
            const foldMetrics = this.calculateFoldMetrics(foldScores, fold.test);
            const trainPeriod = this.getDateRange(fold.train);
            const testPeriod = this.getDateRange(fold.test);
            foldResults.push({
                fold_number: i + 1,
                train_period: trainPeriod,
                test_period: testPeriod,
                win_rate: foldMetrics.win_rate,
                roi: foldMetrics.roi,
                sample_size: fold.test.length
            });
        }
        // Calculate cross-validation metrics
        const avgWinRate = foldResults.reduce((sum, fold) => sum + fold.win_rate, 0) / foldResults.length;
        const avgROI = foldResults.reduce((sum, fold) => sum + fold.roi, 0) / foldResults.length;
        const winRateStd = this.calculateStandardDeviation(foldResults.map(f => f.win_rate));
        const roiStd = this.calculateStandardDeviation(foldResults.map(f => f.roi));
        const stabilityMetric = 1 - (winRateStd / avgWinRate); // Higher is more stable
        const generalizationGap = Math.abs(avgWinRate - config.targetWinRate);
        this.logger.info('✅ Cross-validation completed', {
            avgWinRate,
            avgROI,
            winRateStd,
            stabilityMetric,
            generalizationGap
        });
        return {
            fold_results: foldResults,
            avg_cv_score: avgWinRate,
            cv_score_std: winRateStd,
            stability_metric: stabilityMetric,
            generalization_gap: generalizationGap
        };
    }
    /**
     * Get date range string for a dataset
     */
    getDateRange(data) {
        if (data.length === 0)
            return 'N/A';
        const dates = data.map(d => new Date(d.created_at)).sort((a, b) => a.getTime() - b.getTime());
        const start = dates[0].toISOString().split('T')[0];
        const end = dates[dates.length - 1].toISOString().split('T')[0];
        return `${start} to ${end}`;
    }
    /**
     * Calculate fold-specific metrics
     */
    calculateFoldMetrics(scores, props) {
        let wins = 0;
        let totalStake = 0;
        let totalPayout = 0;
        scores.forEach((score, index) => {
            const prop = props[index];
            const isWin = this.determineWin(prop, score);
            const stake = this.calculateKellyStake(score);
            const odds = score.predicted_side === 'over' ? prop.over_odds : prop.under_odds;
            if (isWin) {
                wins++;
                totalPayout += stake * (1 + Math.abs(odds) / 100);
            }
            totalStake += stake;
        });
        const win_rate = (wins / scores.length) * 100;
        const roi = totalStake > 0 ? ((totalPayout - totalStake) / totalStake) * 100 : 0;
        return { win_rate, roi };
    }
    /**
     * Score props for backtesting (simplified version)
     */
    async scorePropsForBacktest(props) {
        const scores = [];
        for (const prop of props) {
            try {
                // Convert prop to scoring feature set
                const featureSet = this.convertPropToFeatureSet(prop);
                // Score using the scoring agent
                const result = await this.scoringAgent.scoreProp(featureSet);
                // Determine predicted side based on score
                const predicted_side = result.finalScore > 50 ? 'over' : 'under';
                scores.push({
                    ...result,
                    predicted_side,
                    prop_id: prop.id
                });
            }
            catch (error) {
                this.logger.warn('⚠️ Failed to score prop for backtest', {
                    propId: prop.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Use neutral score for failed props
                scores.push({
                    finalScore: 50,
                    confidence: 50,
                    tier: 'C',
                    predicted_side: 'over',
                    prop_id: prop.id,
                    kellyFraction: 0.01
                });
            }
        }
        return scores;
    }
    /**
     * Convert prop to ScoringFeatureSet format
     */
    convertPropToFeatureSet(prop) {
        return {
            propId: prop.id,
            date: prop.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            sport: prop.sport || 'unknown',
            league: prop.sport || 'unknown',
            player: prop.player_name,
            market: {
                type: prop.stat_type || 'unknown',
                line: prop.line || 0,
                odds: prop.over_odds || -110
            },
            expectedValue: 0, // Will be calculated by scoring engine
            sharpMoney: 50,
            lineMovement: 0,
            matchupRating: 50,
            playerForm: 50,
            marketType: prop.stat_type,
            odds: prop.over_odds,
            injuryImpact: 0,
            weatherImpact: 0,
            marketIntelligence: 50,
            volumeProfile: 50,
            closingLineValue: 0,
            playerFatigue: 0,
            venueAdvantage: 0,
            refereeImpact: 0,
            paceImpact: 0,
            motivationalFactors: 0,
            correlationRisk: 0,
            volatility: 5,
            portfolioImpact: 0,
            bidAskSpread: 0.02,
            timestamp: prop.created_at || new Date().toISOString(),
            version: '1.0',
            source: 'backtest',
            confidence: 50,
            dataQuality: {
                completeness: 0.95,
                outlierScore: 0.95,
                consistencyScore: 0.95,
                dataValidationScore: 0.95
            }
        };
    }
    /**
     * Determine if a bet won based on actual outcome
     */
    determineWin(prop, score) {
        if (!prop.actual_value || !prop.line)
            return false;
        const actualValue = parseFloat(prop.actual_value);
        const line = parseFloat(prop.line);
        const predictedSide = score.predicted_side;
        if (predictedSide === 'over') {
            return actualValue > line;
        }
        else {
            return actualValue < line;
        }
    }
    /**
     * Calculate Kelly stake size
     */
    calculateKellyStake(score) {
        const kellyFraction = score.kellyFraction || 0.01;
        const baseStake = 100; // $100 base unit
        // Conservative Kelly multiplier
        const kellyMultiplier = 0.25;
        return baseStake * kellyFraction * kellyMultiplier;
    }
    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Placeholder methods - to be implemented in following steps
     */
    async performHoldoutTesting(testData, config) {
        // Will implement comprehensive holdout testing
        return {
            overall_performance: {
                total_bets: 0,
                wins: 0,
                losses: 0,
                win_rate: 0,
                roi: 0,
                sharpe_ratio: 0,
                max_drawdown: 0,
                clv_positive_rate: 0,
                avg_clv: 0,
                total_profit: 0,
                profit_factor: 0,
                expectancy: 0
            },
            by_sport: {},
            by_confidence: {},
            time_series: []
        };
    }
    async performBootstrapAnalysis(testData, config) {
        // Will implement bootstrap analysis
        return {
            bootstrap_win_rates: [],
            bootstrap_rois: [],
            win_rate_ci_lower: 0,
            win_rate_ci_upper: 0,
            roi_ci_lower: 0,
            roi_ci_upper: 0,
            probability_target_achieved: 0,
            statistical_validation: {
                win_rate_confidence_interval: [0, 0],
                roi_confidence_interval: [0, 0],
                statistical_significance: 0,
                p_value: 0,
                effect_size: 0,
                power_analysis: 0
            }
        };
    }
    async validateProfessionalFeatures(testData, config) {
        // Will implement professional feature validation
        return {
            steam_detection: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            closing_line_prediction: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            optimal_timing: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            line_shopping_edge: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            public_vs_sharp_split: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            market_timing_advantage: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            injury_timing_edge: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            cross_market_discrepancy: { enabled_win_rate: 0, disabled_win_rate: 0, impact_magnitude: 0, statistical_significance: 0, contribution_to_roi: 0 },
            combined_feature_impact: 0
        };
    }
    async validateRiskManagement(testData, config) {
        // Will implement risk management validation
        return {
            kelly_sizing_accuracy: 0,
            correlation_analysis: {
                max_daily_correlation: 0,
                avg_portfolio_correlation: 0,
                correlation_violations: 0,
                diversification_ratio: 0
            },
            variance_analysis: {
                bet_variance: 0,
                portfolio_variance: 0,
                variance_vs_expected: 0,
                bankroll_stability: 0
            },
            concentration_risk: {
                max_single_game_exposure: 0,
                max_sport_exposure: 0,
                max_player_exposure: 0,
                concentration_violations: 0
            },
            tail_risk_metrics: {
                var_95: 0,
                cvar_95: 0,
                max_consecutive_losses: 0,
                recovery_time_days: 0
            }
        };
    }
    async performStressTesting(testData, config) {
        // Will implement stress testing
        return {};
    }
    async compareModels(testData, config) {
        // Will implement model comparison
        return {
            individual_models: {},
            ensemble_performance: {
                win_rate: 0,
                roi: 0,
                sharpe_ratio: 0,
                sample_size: 0,
                feature_importance: {}
            },
            ensemble_improvement: 0,
            best_individual_model: ''
        };
    }
    /**
     * Validate if success criteria are met
     */
    validateSuccessCriteria(result, config) {
        const criteria = [
            {
                name: 'Win Rate Target',
                achieved: result.overall_performance.win_rate >= config.targetWinRate,
                target: config.targetWinRate,
                actual: result.overall_performance.win_rate
            },
            {
                name: 'Positive ROI',
                achieved: result.overall_performance.roi > 0,
                target: 0,
                actual: result.overall_performance.roi
            },
            {
                name: 'Maximum Drawdown',
                achieved: result.overall_performance.max_drawdown <= config.maxDrawdown,
                target: config.maxDrawdown,
                actual: result.overall_performance.max_drawdown
            },
            {
                name: 'CLV Positive Rate',
                achieved: result.overall_performance.clv_positive_rate >= config.minCLVPositiveRate,
                target: config.minCLVPositiveRate,
                actual: result.overall_performance.clv_positive_rate
            }
        ];
        const allCriteriaMet = criteria.every(c => c.achieved);
        this.logger.info('🎯 Success Criteria Validation', {
            allCriteriaMet,
            criteria: criteria.map(c => ({
                name: c.name,
                achieved: c.achieved,
                target: c.target,
                actual: c.actual
            }))
        });
        if (!allCriteriaMet) {
            const failedCriteria = criteria.filter(c => !c.achieved);
            throw new Error(`Backtesting failed to meet success criteria: ${failedCriteria.map(c => c.name).join(', ')}`);
        }
    }
}
exports.BacktestingEngine = BacktestingEngine;
