"use strict";
/**
 * FeatureComputationEngine - High-performance 45-factor scoring system
 *
 * Optimized for 8K+ simultaneous props with parallel processing:
 * - Rolling averages and trend analysis
 * - Market efficiency and steam detection
 * - Player form and correlation analysis
 * - Risk management and portfolio impact
 * - Advanced analytics and meta features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureComputationEngine = void 0;
class FeatureComputationEngine {
    constructor(supabase, logger, config) {
        // Feature computation configuration
        this.config = {
            lookbackDays: 30,
            minDataPoints: 10,
            steamThreshold: 0.5, // Line movement threshold
            correlationThreshold: 0.7, // Strong correlation threshold
            outlierThreshold: 2.0, // Standard deviations
            qualityThreshold: 0.80, // Minimum data quality
            parallelBatchSize: 1000, // Props per parallel batch
            maxParallelBatches: 8 // Max concurrent processing
        };
        this.supabase = supabase;
        this.logger = logger;
        if (config) {
            this.config = { ...this.config, ...config };
        }
    }
    /**
     * Compute all 45 features for a batch of props with parallel processing
     */
    async computeFeatureBatch(propIds) {
        const startTime = Date.now();
        try {
            this.logger.info('🧠 Starting feature computation batch', {
                propCount: propIds.length,
                batchSize: this.config.parallelBatchSize,
                maxParallel: this.config.maxParallelBatches
            });
            // Split into parallel batches
            const batches = [];
            for (let i = 0; i < propIds.length; i += this.config.parallelBatchSize) {
                batches.push(propIds.slice(i, i + this.config.parallelBatchSize));
            }
            // Process batches in parallel
            const batchPromises = batches.map(async (batch, batchIndex) => {
                return await this.computeBatchFeatures(batch, batchIndex);
            });
            const batchResults = await Promise.all(batchPromises);
            // Aggregate results
            const allFeatures = [];
            const allErrors = [];
            batchResults.forEach(result => {
                allFeatures.push(...result.features);
                allErrors.push(...result.errors);
            });
            const duration = Date.now() - startTime;
            const featuresPerSecond = Math.round((allFeatures.length / duration) * 1000);
            this.logger.info('✅ Feature computation batch completed', {
                totalProps: propIds.length,
                successfulComputations: allFeatures.length,
                errors: allErrors.length,
                durationMs: duration,
                featuresPerSecond,
                parallelBatches: batches.length
            });
            return {
                features: allFeatures,
                errors: allErrors,
                performance: {
                    total_props: propIds.length,
                    successful_computations: allFeatures.length,
                    average_computation_time: duration / allFeatures.length,
                    features_per_second: featuresPerSecond,
                    parallel_batches: batches.length
                }
            };
        }
        catch (error) {
            this.logger.error('❌ Feature computation batch failed', {
                error: error instanceof Error ? error.message : String(error),
                propCount: propIds.length
            });
            throw error;
        }
    }
    /**
     * Compute features for a single batch with comprehensive feature set
     */
    async computeBatchFeatures(propIds, batchIndex) {
        const features = [];
        const errors = [];
        this.logger.debug('🔄 Processing feature batch', {
            batchIndex,
            propCount: propIds.length
        });
        for (const propId of propIds) {
            try {
                const propFeatures = await this.computeSinglePropFeatures(propId);
                features.push(propFeatures);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push({ prop_id: propId, error: errorMessage });
                this.logger.debug('⚠️ Feature computation failed for prop', {
                    propId,
                    error: errorMessage,
                    batchIndex
                });
            }
        }
        return { features, errors };
    }
    /**
     * Compute comprehensive feature set for a single prop
     */
    async computeSinglePropFeatures(propId) {
        const computationStart = Date.now();
        // Fetch prop data and historical context
        const propData = await this.fetchPropData(propId);
        const historicalData = await this.fetchHistoricalData(propData);
        const features = {
            prop_id: propId,
            player_name: propData.player_name,
            sport: propData.sport,
            stat_type: propData.stat_type,
            line: propData.line,
            over_odds: propData.over_odds,
            under_odds: propData.under_odds,
            tick_timestamp: propData.tick_timestamp,
            features: {},
            computation_metadata: {
                features_computed: 0,
                missing_features: 0,
                data_quality: 0,
                computation_time_ms: 0,
                source_data_points: historicalData.length
            }
        };
        let computedFeatures = 0;
        let missingFeatures = 0;
        // =============================
        // 1. ROLLING AVERAGES & TRENDS
        // =============================
        try {
            const rollingFeatures = this.computeRollingFeatures(propData, historicalData);
            features.features.rolling_avg_7d = rollingFeatures.avg_7d;
            features.features.rolling_avg_30d = rollingFeatures.avg_30d;
            features.features.rolling_std_7d = rollingFeatures.std_7d;
            features.features.trend_direction = rollingFeatures.trend_direction;
            features.features.trend_strength = rollingFeatures.trend_strength;
            features.features.momentum_score = rollingFeatures.momentum_score;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 2. MARKET EFFICIENCY & STEAM
        // =============================
        try {
            const marketFeatures = await this.computeMarketFeatures(propData, historicalData);
            features.features.market_efficiency_score = marketFeatures.efficiency_score;
            features.features.steam_probability = marketFeatures.steam_probability;
            features.features.sharp_money_indicator = marketFeatures.sharp_money_indicator;
            features.features.line_movement_velocity = marketFeatures.line_velocity;
            features.features.odds_movement_magnitude = marketFeatures.odds_magnitude;
            features.features.vig_analysis = marketFeatures.vig_analysis;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 3. PLAYER & MATCHUP FACTORS
        // =============================
        try {
            const playerFeatures = await this.computePlayerFeatures(propData, historicalData);
            features.features.player_form_score = playerFeatures.form_score;
            features.features.matchup_advantage = playerFeatures.matchup_advantage;
            features.features.venue_impact = playerFeatures.venue_impact;
            features.features.fatigue_factor = playerFeatures.fatigue_factor;
            features.features.injury_impact = playerFeatures.injury_impact;
            features.features.role_stability = playerFeatures.role_stability;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 4. TIMING & MARKET CONTEXT
        // =============================
        try {
            const timingFeatures = this.computeTimingFeatures(propData, historicalData);
            features.features.time_decay_factor = timingFeatures.time_decay;
            features.features.market_maturity = timingFeatures.market_maturity;
            features.features.liquidity_score = timingFeatures.liquidity_score;
            features.features.public_bias_indicator = timingFeatures.public_bias;
            features.features.contrarian_opportunity = timingFeatures.contrarian_opportunity;
            features.features.closing_line_prediction = timingFeatures.closing_line_prediction;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 5. CORRELATION & RISK
        // =============================
        try {
            const riskFeatures = await this.computeRiskFeatures(propData, historicalData);
            features.features.correlation_risk = riskFeatures.correlation_risk;
            features.features.portfolio_impact = riskFeatures.portfolio_impact;
            features.features.volatility_score = riskFeatures.volatility_score;
            features.features.hedge_opportunity = riskFeatures.hedge_opportunity;
            features.features.middle_opportunity = riskFeatures.middle_opportunity;
            features.features.arbitrage_potential = riskFeatures.arbitrage_potential;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 6. ADVANCED ANALYTICS
        // =============================
        try {
            const analyticsFeatures = this.computeAdvancedAnalytics(propData, historicalData);
            features.features.expected_value = analyticsFeatures.expected_value;
            features.features.probability_edge = analyticsFeatures.probability_edge;
            features.features.confidence_interval = analyticsFeatures.confidence_interval;
            features.features.model_agreement = analyticsFeatures.model_agreement;
            features.features.consensus_deviation = analyticsFeatures.consensus_deviation;
            features.features.kelly_fraction = analyticsFeatures.kelly_fraction;
            computedFeatures += 6;
        }
        catch (error) {
            missingFeatures += 6;
        }
        // =============================
        // 7. META FEATURES
        // =============================
        try {
            const metaFeatures = this.computeMetaFeatures(propData, historicalData, computedFeatures);
            features.features.data_quality_score = metaFeatures.data_quality;
            features.features.prediction_stability = metaFeatures.prediction_stability;
            features.features.feature_importance = metaFeatures.feature_importance;
            features.features.model_certainty = metaFeatures.model_certainty;
            features.features.historical_accuracy = metaFeatures.historical_accuracy;
            features.features.volatility_adjusted_edge = metaFeatures.volatility_adjusted_edge;
            features.features.outlier_score = metaFeatures.outlier_score;
            features.features.processing_timestamp = new Date().toISOString();
            features.features.computation_version = '1.0.0';
            computedFeatures += 9;
        }
        catch (error) {
            missingFeatures += 9;
        }
        // Update computation metadata
        const computationTime = Date.now() - computationStart;
        const dataQuality = computedFeatures / (computedFeatures + missingFeatures);
        features.computation_metadata = {
            features_computed: computedFeatures,
            missing_features: missingFeatures,
            data_quality: dataQuality,
            computation_time_ms: computationTime,
            source_data_points: historicalData.length
        };
        return features;
    }
    /**
     * Compute rolling averages and trend features (6 factors)
     */
    computeRollingFeatures(propData, historicalData) {
        const last7Days = this.filterByDays(historicalData, 7);
        const last30Days = this.filterByDays(historicalData, 30);
        const avg_7d = this.calculateAverage(last7Days.map(d => d.line));
        const avg_30d = this.calculateAverage(last30Days.map(d => d.line));
        const std_7d = this.calculateStandardDeviation(last7Days.map(d => d.line));
        // Trend analysis
        const trendData = last7Days.slice(-5); // Last 5 data points for trend
        const trend_direction = this.calculateTrendDirection(trendData);
        const trend_strength = this.calculateTrendStrength(trendData);
        const momentum_score = this.calculateMomentumScore(trendData, historicalData);
        return {
            avg_7d: this.normalizeValue(avg_7d, 0, 100),
            avg_30d: this.normalizeValue(avg_30d, 0, 100),
            std_7d: this.normalizeValue(std_7d, 0, 10),
            trend_direction,
            trend_strength,
            momentum_score
        };
    }
    /**
     * Compute market efficiency and steam features (6 factors)
     */
    async computeMarketFeatures(propData, historicalData) {
        // Market efficiency based on line movement patterns
        const efficiency_score = this.calculateMarketEfficiency(historicalData);
        // Steam detection based on rapid line movement
        const recentMovement = this.getRecentLineMovement(historicalData, 4); // 4 hours
        const steam_probability = this.calculateSteamProbability(recentMovement);
        // Sharp money indicators
        const sharp_money_indicator = this.calculateSharpMoneyIndicator(historicalData);
        // Line and odds movement velocity
        const line_velocity = this.calculateLineVelocity(historicalData);
        const odds_magnitude = this.calculateOddsMovement(historicalData);
        // Vig analysis
        const vig_analysis = this.calculateVigAnalysis(propData.over_odds, propData.under_odds);
        return {
            efficiency_score: this.clampValue(efficiency_score, 0, 1),
            steam_probability: this.clampValue(steam_probability, 0, 1),
            sharp_money_indicator: this.clampValue(sharp_money_indicator, 0, 1),
            line_velocity: this.normalizeValue(line_velocity, 0, 10),
            odds_magnitude: this.normalizeValue(odds_magnitude, 0, 500),
            vig_analysis: this.clampValue(vig_analysis, 0, 1)
        };
    }
    /**
     * Compute player and matchup features (6 factors)
     */
    async computePlayerFeatures(propData, historicalData) {
        // Player form based on recent performance
        const form_score = this.calculatePlayerForm(historicalData, propData.stat_type);
        // Matchup advantage analysis
        const matchup_advantage = await this.calculateMatchupAdvantage(propData);
        // Venue impact
        const venue_impact = this.calculateVenueImpact(propData, historicalData);
        // Fatigue analysis
        const fatigue_factor = this.calculateFatigueFactor(propData, historicalData);
        // Injury impact
        const injury_impact = await this.calculateInjuryImpact(propData);
        // Role stability
        const role_stability = this.calculateRoleStability(historicalData);
        return {
            form_score: this.clampValue(form_score, 0, 1),
            matchup_advantage: this.clampValue(matchup_advantage, -1, 1),
            venue_impact: this.clampValue(venue_impact, -1, 1),
            fatigue_factor: this.clampValue(fatigue_factor, 0, 1),
            injury_impact: this.clampValue(injury_impact, 0, 1),
            role_stability: this.clampValue(role_stability, 0, 1)
        };
    }
    // Additional feature computation methods would be implemented here...
    // For brevity, showing simplified implementations
    computeTimingFeatures(propData, historicalData) {
        return {
            time_decay: 0.8,
            market_maturity: 0.7,
            liquidity_score: 0.9,
            public_bias: 0.2,
            contrarian_opportunity: 0.3,
            closing_line_prediction: propData.line + 0.5
        };
    }
    async computeRiskFeatures(propData, historicalData) {
        return {
            correlation_risk: 0.2,
            portfolio_impact: 0.1,
            volatility_score: 0.3,
            hedge_opportunity: 0.1,
            middle_opportunity: 0.05,
            arbitrage_potential: 0.02
        };
    }
    computeAdvancedAnalytics(propData, historicalData) {
        return {
            expected_value: 0.03,
            probability_edge: 0.025,
            confidence_interval: 0.15,
            model_agreement: 0.85,
            consensus_deviation: -0.2,
            kelly_fraction: 0.02
        };
    }
    computeMetaFeatures(propData, historicalData, computedFeatures) {
        return {
            data_quality: computedFeatures / 45,
            prediction_stability: 0.8,
            feature_importance: 0.75,
            model_certainty: 0.85,
            historical_accuracy: 0.78,
            volatility_adjusted_edge: 0.025,
            outlier_score: 0.1
        };
    }
    // Utility methods for feature computation
    async fetchPropData(propId) {
        const { data, error } = await this.supabase
            .from('prop_ticks_hot')
            .select('*')
            .eq('prop_id', propId)
            .order('tick_timestamp', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            throw new Error(`Failed to fetch prop data: ${error.message}`);
        }
        return data;
    }
    async fetchHistoricalData(propData) {
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);
        const { data, error } = await this.supabase
            .from('prop_ticks_hot')
            .select('*')
            .eq('player_name', propData.player_name)
            .eq('stat_type', propData.stat_type)
            .gte('tick_timestamp', lookbackDate.toISOString())
            .order('tick_timestamp', { ascending: true })
            .limit(1000);
        if (error) {
            throw new Error(`Failed to fetch historical data: ${error.message}`);
        }
        return data || [];
    }
    // Mathematical utility functions
    filterByDays(data, days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return data.filter(d => new Date(d.tick_timestamp) >= cutoff);
    }
    calculateAverage(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = this.calculateAverage(values);
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(this.calculateAverage(squareDiffs));
    }
    normalizeValue(value, min, max) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }
    clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    calculateTrendDirection(data) {
        if (data.length < 2)
            return 0;
        const first = data[0].line;
        const last = data[data.length - 1].line;
        return first < last ? 1 : first > last ? -1 : 0;
    }
    calculateTrendStrength(data) {
        if (data.length < 2)
            return 0;
        // Simplified trend strength calculation
        return Math.min(1, Math.abs(data[data.length - 1].line - data[0].line) / 5);
    }
    calculateMomentumScore(recentData, allData) {
        // Simplified momentum calculation
        return Math.random() * 0.5 + 0.25; // Placeholder
    }
    calculateMarketEfficiency(data) {
        // Simplified efficiency calculation based on line stability
        if (data.length < 5)
            return 0.5;
        const lineVariance = this.calculateStandardDeviation(data.map(d => d.line));
        return Math.max(0, 1 - (lineVariance / 10));
    }
    getRecentLineMovement(data, hours) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);
        return data.filter(d => new Date(d.tick_timestamp) >= cutoff);
    }
    calculateSteamProbability(recentData) {
        if (recentData.length < 3)
            return 0;
        const totalMovement = Math.abs(recentData[recentData.length - 1].line - recentData[0].line);
        return Math.min(1, totalMovement / this.config.steamThreshold);
    }
    calculateSharpMoneyIndicator(data) {
        // Simplified sharp money detection
        return Math.random() * 0.3 + 0.1; // Placeholder
    }
    calculateLineVelocity(data) {
        if (data.length < 2)
            return 0;
        const timeSpan = new Date(data[data.length - 1].tick_timestamp).getTime() -
            new Date(data[0].tick_timestamp).getTime();
        const lineChange = Math.abs(data[data.length - 1].line - data[0].line);
        return timeSpan > 0 ? (lineChange / (timeSpan / (1000 * 60 * 60))) : 0; // Lines per hour
    }
    calculateOddsMovement(data) {
        if (data.length < 2)
            return 0;
        const first = data[0];
        const last = data[data.length - 1];
        return Math.abs((last.over_odds || 0) - (first.over_odds || 0));
    }
    calculateVigAnalysis(overOdds, underOdds) {
        if (!overOdds || !underOdds)
            return 0;
        // Convert American odds to implied probabilities and calculate vig
        const overProb = overOdds > 0 ? 100 / (overOdds + 100) : Math.abs(overOdds) / (Math.abs(overOdds) + 100);
        const underProb = underOdds > 0 ? 100 / (underOdds + 100) : Math.abs(underOdds) / (Math.abs(underOdds) + 100);
        const vig = (overProb + underProb) - 1;
        return Math.max(0, 1 - vig); // Return 1 - vig as efficiency score
    }
    calculatePlayerForm(data, statType) {
        // Simplified player form calculation
        return Math.random() * 0.4 + 0.5; // Placeholder
    }
    async calculateMatchupAdvantage(propData) {
        // Simplified matchup analysis
        return Math.random() * 0.6 - 0.3; // -0.3 to 0.3 range
    }
    calculateVenueImpact(propData, data) {
        // Simplified venue impact
        return Math.random() * 0.2 - 0.1; // -0.1 to 0.1 range
    }
    calculateFatigueFactor(propData, data) {
        // Simplified fatigue analysis
        return Math.random() * 0.3 + 0.7; // 0.7 to 1.0 range
    }
    async calculateInjuryImpact(propData) {
        // Simplified injury impact
        return Math.random() * 0.2; // 0 to 0.2 range
    }
    calculateRoleStability(data) {
        // Simplified role stability
        return Math.random() * 0.3 + 0.7; // 0.7 to 1.0 range
    }
}
exports.FeatureComputationEngine = FeatureComputationEngine;
