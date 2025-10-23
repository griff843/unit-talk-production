"use strict";
/**
 * Automated Feedback Loop Service
 * Uses CLV/ROI data to continuously optimize weights and features
 * This is what separates sharp systems from static models
 *
 * @module FeedbackLoopService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackLoopService = exports.FeedbackLoopService = void 0;
const gradingEngine_1 = require("../../agents/ScoringAgent/scoring/gradingEngine");
const logger_1 = require("../../utils/logger");
const CLVTrackingService_1 = require("../clv/CLVTrackingService");
const supabaseClient_1 = require("../supabaseClient");
class FeedbackLoopService {
    constructor() {
        // Configuration
        this.MIN_SAMPLE_SIZE = 50; // Min bets before adjusting
        this.ADJUSTMENT_RATE = 0.1; // Max 10% change per update
        this.CLV_TARGET = 2.5; // Target 2.5% CLV
        this.PRUNE_THRESHOLD = 0.01; // Prune features < 1% importance
        this.logger = (0, logger_1.createLogger)('FeedbackLoopService');
        this.gradingEngine = new gradingEngine_1.SyndicateGradingEngine();
    }
    static getInstance() {
        if (!FeedbackLoopService.instance) {
            FeedbackLoopService.instance = new FeedbackLoopService();
        }
        return FeedbackLoopService.instance;
    }
    /**
     * Main feedback loop - runs automatically
     * Should be scheduled to run every 6-24 hours
     */
    async runFeedbackLoop() {
        this.logger.info('Starting automated feedback loop...');
        try {
            // 1. Analyze recent CLV performance
            const clvData = await this.analyzeRecentCLV();
            // 2. Adjust feature weights based on CLV correlation
            const weightAdjustments = await this.adjustFeatureWeights(clvData);
            // 3. Adjust sportsbook weights based on performance
            const bookAdjustments = await this.adjustBookWeights();
            // 4. Adjust market-specific confidence
            const marketAdjustments = await this.adjustMarketConfidence();
            // 5. Prune underperforming features
            const prunedFeatures = await this.pruneFeatures(clvData);
            // 6. Apply adjustments to grading engine
            await this.applyAdjustments(weightAdjustments, bookAdjustments, marketAdjustments);
            // 7. Log results
            await this.logFeedbackResults({
                weightAdjustments,
                bookAdjustments,
                marketAdjustments,
                prunedFeatures
            });
            this.logger.info('Feedback loop completed successfully');
            return {
                weightAdjustments,
                bookAdjustments,
                marketAdjustments,
                prunedFeatures
            };
        }
        catch (error) {
            this.logger.error('Feedback loop failed', error);
            throw error;
        }
    }
    /**
     * Analyze recent CLV performance by feature
     */
    async analyzeRecentCLV() {
        // Get recent picks with CLV data
        const { data: recentPicks, error } = await supabaseClient_1.supabaseClient
            .from('graded_props')
            .select(`
        *,
        clv_tracking!inner(
          clv,
          clvPercentage,
          beatsClosing
        )
      `)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .not('clv_tracking.clv', 'is', null);
        if (error)
            throw error;
        // Analyze feature contribution to CLV
        const featureImportance = new Map();
        const currentWeights = this.gradingEngine.getCurrentConfig().weights;
        // Calculate correlation between each feature and CLV
        for (const [feature, weight] of Object.entries(currentWeights)) {
            const correlation = this.calculateFeatureCLVCorrelation(recentPicks || [], feature);
            const importance = weight * Math.abs(correlation);
            featureImportance.set(feature, {
                feature: feature,
                importance,
                clvCorrelation: correlation,
                shouldPrune: importance < this.PRUNE_THRESHOLD && recentPicks.length > this.MIN_SAMPLE_SIZE
            });
        }
        return featureImportance;
    }
    /**
     * Calculate correlation between feature values and CLV
     */
    calculateFeatureCLVCorrelation(picks, feature) {
        if (picks.length < 10)
            return 0;
        // Extract feature values and CLV values
        const featureValues = picks.map(p => p.featureContributions?.[feature] || 0);
        const clvValues = picks.map(p => p.clv_tracking?.clvPercentage || 0);
        // Calculate Pearson correlation
        const n = featureValues.length;
        const sumX = featureValues.reduce((a, b) => a + b, 0);
        const sumY = clvValues.reduce((a, b) => a + b, 0);
        const sumXY = featureValues.reduce((total, x, i) => total + x * clvValues[i], 0);
        const sumX2 = featureValues.reduce((total, x) => total + x * x, 0);
        const sumY2 = clvValues.reduce((total, y) => total + y * y, 0);
        const correlation = (n * sumXY - sumX * sumY) /
            Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        return isNaN(correlation) ? 0 : correlation;
    }
    /**
     * Adjust feature weights based on CLV performance
     */
    async adjustFeatureWeights(featureImportance) {
        const adjustments = [];
        const currentConfig = this.gradingEngine.getCurrentConfig();
        const currentWeights = { ...currentConfig.weights };
        // Get current CLV performance
        const recentStats = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        });
        const currentCLV = recentStats.avgCLVPercentage;
        const clvGap = this.CLV_TARGET - currentCLV;
        for (const [feature, importance] of featureImportance) {
            const featureKey = feature;
            const currentWeight = currentWeights[featureKey];
            // Skip if no current weight
            if (!currentWeight)
                continue;
            let adjustment = 0;
            // Positive correlation with CLV = increase weight
            // Negative correlation = decrease weight
            if (importance.clvCorrelation > 0.1 && clvGap > 0) {
                // Feature helps CLV and we need more CLV
                adjustment = Math.min(this.ADJUSTMENT_RATE, importance.clvCorrelation * 0.5);
            }
            else if (importance.clvCorrelation < -0.1 && clvGap > 0) {
                // Feature hurts CLV and we need more CLV
                adjustment = -Math.min(this.ADJUSTMENT_RATE, Math.abs(importance.clvCorrelation) * 0.5);
            }
            else if (importance.clvCorrelation > 0.1 && clvGap < 0) {
                // Feature helps CLV but we have too much CLV (rare)
                adjustment = -Math.min(this.ADJUSTMENT_RATE * 0.5, importance.clvCorrelation * 0.25);
            }
            if (Math.abs(adjustment) > 0.01) {
                const newWeight = Math.max(0, currentWeight * (1 + adjustment));
                adjustments.push({
                    feature: featureKey,
                    oldWeight: currentWeight,
                    newWeight,
                    reason: `CLV correlation: ${importance.clvCorrelation.toFixed(3)}`,
                    clvImpact: importance.clvCorrelation,
                    confidence: Math.min(1, recentStats.totalBets / 100)
                });
                currentWeights[featureKey] = newWeight;
            }
        }
        // Normalize weights to sum to previous total
        const oldTotal = Object.values(currentConfig.weights).reduce((a, b) => a + b, 0);
        const newTotal = Object.values(currentWeights).reduce((a, b) => a + b, 0);
        if (newTotal > 0) {
            const scale = oldTotal / newTotal;
            Object.keys(currentWeights).forEach(key => {
                currentWeights[key] *= scale;
            });
        }
        return adjustments;
    }
    /**
     * Adjust sportsbook weights based on CLV performance
     */
    async adjustBookWeights() {
        const stats = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        });
        const bookPerformance = [];
        // Get current book weights from database
        const { data: currentWeights } = await supabaseClient_1.supabaseClient
            .from('sportsbook_weights')
            .select('*');
        const weightMap = new Map(currentWeights?.map((w) => [w.book, w.weight]) || []);
        // Analyze each book
        for (const [book, metrics] of stats.byBook) {
            const currentWeight = Number(weightMap.get(book) ?? 1.0);
            // Calculate reliability professional_score based on CLV consistency
            const reliability = this.calculateReliability(metrics);
            // Suggest new weight based on CLV performance
            let suggestedWeight = currentWeight;
            if (metrics.avgCLV > this.CLV_TARGET && metrics.count > this.MIN_SAMPLE_SIZE) {
                // Book consistently provides value
                suggestedWeight = Math.min(1.5, currentWeight * (1 + this.ADJUSTMENT_RATE));
            }
            else if (metrics.avgCLV < 0 && metrics.count > this.MIN_SAMPLE_SIZE) {
                // Book consistently overvalues (bad for us)
                suggestedWeight = Math.max(0.5, currentWeight * (1 - this.ADJUSTMENT_RATE));
            }
            bookPerformance.push({
                book,
                avgCLV: metrics.avgCLV,
                betCount: metrics.count,
                roi: metrics.roi,
                reliability,
                weight: Number(currentWeight),
                suggestedWeight: Number(suggestedWeight)
            });
        }
        // Sort by suggested weight
        return bookPerformance.sort((a, b) => b.suggestedWeight - a.suggestedWeight);
    }
    /**
     * Calculate reliability professional_score for a book
     */
    calculateReliability(metrics) {
        // Factors: sample size, consistency (low std dev), positive CLV
        const sampleScore = Math.min(1, metrics.count / 100);
        const consistencyScore = metrics.stdDev > 0 ? Math.max(0, 1 - metrics.stdDev / 10) : 0.5;
        const clvScore = Math.max(0, Math.min(1, (metrics.avgCLV + 5) / 10));
        return (sampleScore * 0.2 + consistencyScore * 0.4 + clvScore * 0.4);
    }
    /**
     * Adjust market-specific confidence multipliers
     */
    async adjustMarketConfidence() {
        const stats = await CLVTrackingService_1.clvTrackingService.getCLVStats({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        });
        const marketPerformance = [];
        // Analyze sport+market combinations
        const { data: recentPicks } = await supabaseClient_1.supabaseClient
            .from('graded_props')
            .select('sport, market, clv_tracking(clvPercentage)')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .not('clv_tracking.clvPercentage', 'is', null);
        // Group by sport+market
        const marketGroups = new Map();
        recentPicks?.forEach((pick) => {
            const key = `${pick.sport}:${pick.market}`;
            if (!marketGroups.has(key)) {
                marketGroups.set(key, []);
            }
            marketGroups.get(key).push(pick);
        });
        // Calculate performance for each market
        for (const [key, picks] of marketGroups) {
            const [sport, market] = key.split(':');
            const avgCLV = picks.reduce((sum, p) => sum + p.clv_tracking.clvPercentage, 0) / picks.length;
            const betCount = picks.length;
            // Calculate confidence based on CLV and sample size
            const clvScore = Math.max(0, Math.min(1, avgCLV / 5)); // 5% CLV = max professional_score
            const sampleScore = Math.min(1, betCount / 50);
            const confidence = clvScore * 0.7 + sampleScore * 0.3;
            // Edge multiplier: boost edges in high-CLV markets
            const edgeMultiplier = avgCLV > 2 ? 1.1 : avgCLV > 0 ? 1.0 : 0.9;
            marketPerformance.push({
                sport,
                market,
                avgCLV,
                betCount,
                confidence,
                edgeMultiplier
            });
        }
        return marketPerformance.sort((a, b) => b.avgCLV - a.avgCLV);
    }
    /**
     * Prune underperforming features
     */
    async pruneFeatures(featureImportance) {
        const prunedFeatures = [];
        const currentConfig = this.gradingEngine.getCurrentConfig();
        for (const [feature, importance] of featureImportance) {
            if (importance.shouldPrune) {
                // Mark feature for pruning (set weight to 0)
                const updatedWeights = { ...currentConfig.weights };
                updatedWeights[feature] = 0;
                prunedFeatures.push(feature);
                this.logger.warn(`Pruning feature ${feature}: importance=${importance.importance.toFixed(4)}`);
            }
        }
        return prunedFeatures;
    }
    /**
     * Apply all adjustments to the system
     */
    async applyAdjustments(weightAdjustments, bookAdjustments, marketAdjustments) {
        // 1. Update feature weights in grading engine
        if (weightAdjustments.length > 0) {
            const currentConfig = this.gradingEngine.getCurrentConfig();
            const newWeights = { ...currentConfig.weights };
            weightAdjustments.forEach(adj => {
                newWeights[adj.feature] = adj.newWeight;
            });
            this.gradingEngine.updateScoringConfig('optimized', {
                ...currentConfig,
                name: 'Auto-Optimized',
                version: new Date().toISOString(),
                weights: newWeights
            });
            this.gradingEngine.setActiveConfig('optimized');
        }
        // 2. Update sportsbook weights in database
        for (const bookAdj of bookAdjustments) {
            if (Math.abs(bookAdj.weight - bookAdj.suggestedWeight) > 0.01) {
                await supabaseClient_1.supabaseClient
                    .from('sportsbook_weights')
                    .upsert({
                    book: bookAdj.book,
                    weight: bookAdj.suggestedWeight,
                    reliability: bookAdj.reliability,
                    last_updated: new Date().toISOString()
                });
            }
        }
        // 3. Update market confidence in database
        for (const marketAdj of marketAdjustments) {
            await supabaseClient_1.supabaseClient
                .from('market_confidence')
                .upsert({
                sport: marketAdj.sport,
                market: marketAdj.market,
                confidence: marketAdj.confidence,
                edge_multiplier: marketAdj.edgeMultiplier,
                last_updated: new Date().toISOString()
            });
        }
    }
    /**
     * Log feedback loop results for monitoring
     */
    async logFeedbackResults(results) {
        await supabaseClient_1.supabaseClient
            .from('feedback_loop_history')
            .insert({
            timestamp: new Date().toISOString(),
            weight_adjustments: results.weightAdjustments,
            book_adjustments: results.bookAdjustments,
            market_adjustments: results.marketAdjustments,
            pruned_features: results.prunedFeatures,
            summary: {
                total_adjustments: results.weightAdjustments.length,
                books_adjusted: results.bookAdjustments.filter((b) => Math.abs(b.weight - b.suggestedWeight) > 0.01).length,
                features_pruned: results.prunedFeatures.length
            }
        });
    }
    /**
     * Get optimization history
     */
    async getOptimizationHistory(days = 30) {
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('feedback_loop_history')
            .select('*')
            .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('timestamp', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    /**
     * Manual trigger for immediate optimization
     */
    async triggerOptimization() {
        this.logger.info('Manual optimization triggered');
        return this.runFeedbackLoop();
    }
}
exports.FeedbackLoopService = FeedbackLoopService;
// Export singleton instance
exports.feedbackLoopService = FeedbackLoopService.getInstance();
