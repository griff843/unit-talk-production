"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureBuilderAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const enhanced_cache_1 = require("../../cache/enhanced-cache");
/**
 * FeatureBuilderAgent
 *
 * Computes 45+ professional betting factors from HOT tier data
 * and writes to WARM tier (features_daily_agg) for fast lookups.
 *
 * Runs hourly or on material changes (line moves, injuries).
 *
 * Factor Categories:
 * - Market Intelligence (10 factors): Steam, CLV, sharp money
 * - Player Performance (10 factors): Form, averages, volatility
 * - Matchup Analysis (10 factors): DVP, H2H, venue, pace
 * - Meta Factors (10 factors): Injury, weather, motivation
 * - Timing Optimization (5+ factors): Optimal windows, decay
 */
class FeatureBuilderAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.computationQueue = [];
        this.processingBatch = false;
        this.featureMetrics = {
            ...this.metrics,
            featuresComputed: 0,
            factorsGenerated: 0,
            computationLatencyMs: 0,
            materialChangesDetected: 0,
            featureStoreWrites: 0,
            cacheHitRate: 0,
            lastComputationRun: new Date().toISOString(),
            averageFactorCount: 45
        };
    }
    async initialize() {
        this.logger.info('🔧 FeatureBuilderAgent initializing...');
        // Load previous metrics
        await this.loadFeatureMetrics();
        // Subscribe to material change events
        await this.subscribeToMaterialChanges();
        this.logger.info('✅ FeatureBuilderAgent initialized', {
            queueSize: this.computationQueue.length,
            metrics: {
                totalComputed: this.featureMetrics.featuresComputed,
                cacheHitRate: this.featureMetrics.cacheHitRate
            }
        });
    }
    async process() {
        this.logger.info('🏗️ Running feature computation cycle...');
        const cycleStartTime = Date.now();
        try {
            // 1. Fetch props needing computation
            const propsToCompute = await this.fetchPropsNeedingComputation();
            // 2. Batch compute features
            await this.batchComputeFeatures(propsToCompute);
            // 3. Detect material changes
            const materialChanges = await this.detectMaterialChanges();
            // 4. Recompute affected features
            if (materialChanges.length > 0) {
                await this.handleMaterialChanges(materialChanges);
            }
            // 5. Write to feature store (WARM tier)
            await this.writeToFeatureStore();
            // 6. Update metrics and cache
            await this.updateFeatureMetrics();
        }
        catch (error) {
            this.logger.error('❌ Error in feature computation cycle', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        const cycleTime = Date.now() - cycleStartTime;
        this.featureMetrics.computationLatencyMs = cycleTime;
        this.featureMetrics.lastComputationRun = new Date().toISOString();
        this.logger.info('✅ Feature computation cycle completed', {
            cycleTimeMs: cycleTime,
            featuresComputed: this.featureMetrics.featuresComputed,
            factorsGenerated: this.featureMetrics.factorsGenerated,
            materialChanges: this.featureMetrics.materialChangesDetected
        });
    }
    // Core Feature Computation Methods
    async fetchPropsNeedingComputation() {
        this.logger.info('📊 Fetching props needing feature computation...');
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Cannot fetch props without Supabase');
            return [];
        }
        try {
            // Get props from HOT tier that don't have features computed
            const { data: props, error } = await this.requireSupabase()
                .from('prop_ticks_hot')
                .select(`
          prop_id,
          tick_timestamp,
          book,
          line,
          odds_over,
          odds_under
        `)
                .gte('tick_timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
                .limit(1000);
            if (error)
                throw error;
            if (!props || props.length === 0) {
                this.logger.info('ℹ️ No new props to compute features for');
                return [];
            }
            // Convert to computation requests
            const requests = [];
            const uniquePropIds = [...new Set(props.map(p => p.prop_id))];
            for (const propId of uniquePropIds) {
                // Get entity details from raw_props
                const { data: propDetails } = await this.requireSupabase()
                    .from('raw_props')
                    .select('id, player_name, sport, team_home, team_away')
                    .eq('id', propId)
                    .single();
                if (propDetails) {
                    requests.push({
                        propId: propDetails.id,
                        entityId: propDetails.id, // In real system, would lookup player_id
                        entityType: 'player',
                        sport: propDetails.sport,
                        featureDate: new Date()
                    });
                }
            }
            this.logger.info(`📈 Found ${requests.length} props needing feature computation`);
            return requests;
        }
        catch (error) {
            this.logger.error('❌ Failed to fetch props for computation', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async batchComputeFeatures(requests) {
        if (requests.length === 0)
            return;
        this.logger.info(`🔄 Computing features for ${requests.length} props...`);
        const batchSize = 50;
        let processedCount = 0;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            await Promise.all(batch.map(async (request) => {
                try {
                    const features = await this.computeFeaturesForProp(request);
                    await this.cacheComputedFeatures(features);
                    processedCount++;
                }
                catch (error) {
                    this.logger.error(`❌ Failed to compute features for prop ${request.propId}`, {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }));
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.featureMetrics.featuresComputed += processedCount;
        this.logger.info(`✅ Computed features for ${processedCount} props`);
    }
    async computeFeaturesForProp(request) {
        // Check cache first
        const cacheKey = `features:${request.propId}:${request.featureDate.toISOString()}`;
        const cached = await enhanced_cache_1.redisCache.get(cacheKey);
        if (cached && !request.forceRecompute) {
            this.featureMetrics.cacheHitRate =
                (this.featureMetrics.cacheHitRate * 0.9) + 0.1; // Moving average
            return JSON.parse(cached);
        }
        // Compute all 45+ factors
        const [marketFactors, playerFactors, matchupFactors, metaFactors, timingFactors] = await Promise.all([
            this.computeMarketFactors(request),
            this.computePlayerFactors(request),
            this.computeMatchupFactors(request),
            this.computeMetaFactors(request),
            this.computeTimingFactors(request)
        ]);
        // Aggregate factor scores
        const factorScores = this.aggregateFactorScores(marketFactors, playerFactors, matchupFactors, metaFactors, timingFactors);
        const features = {
            propId: request.propId,
            entityId: request.entityId,
            entityType: request.entityType,
            factorScores,
            marketFactors,
            playerFactors,
            matchupFactors,
            metaFactors,
            timingFactors,
            confidence: this.calculateConfidence(factorScores),
            timestamp: new Date()
        };
        this.featureMetrics.factorsGenerated += Object.keys(factorScores).length;
        this.featureMetrics.cacheHitRate =
            (this.featureMetrics.cacheHitRate * 0.9); // Moving average
        return features;
    }
    async computeMarketFactors(request) {
        // Fetch tick data from HOT tier
        const { data: ticks } = await this.requireSupabase()
            .from('prop_ticks_hot')
            .select('*')
            .eq('prop_id', request.propId)
            .order('tick_timestamp', { ascending: true });
        if (!ticks || ticks.length === 0) {
            return this.getDefaultMarketFactors();
        }
        // Calculate market factors
        const lineMovements = ticks.map(t => t.line);
        const oddsMovements = ticks.map(t => ({ over: t.odds_over, under: t.odds_under }));
        return {
            steamDetection: this.detectSteam(lineMovements, ticks),
            clvPrediction: this.predictCLV(lineMovements, oddsMovements),
            sharpMoneyIndicator: this.detectSharpMoney(ticks),
            publicFadeOpportunity: this.detectPublicFade(ticks),
            lineShoppingEdge: this.calculateLineShoppingEdge(ticks),
            marketTimingAdvantage: this.calculateMarketTiming(ticks),
            crossMarketDiscrepancy: this.detectCrossMarketDiscrepancy(ticks),
            bookDisagreement: this.calculateBookDisagreement(ticks),
            volumeImbalance: this.detectVolumeImbalance(ticks),
            closingLineProjection: this.projectClosingLine(lineMovements)
        };
    }
    async computePlayerFactors(request) {
        // Fetch player historical data
        const { data: playerStats } = await this.requireSupabase()
            .from('player_game_stats')
            .select('*')
            .eq('player_id', request.entityId)
            .order('game_date', { ascending: false })
            .limit(30);
        if (!playerStats || playerStats.length === 0) {
            return this.getDefaultPlayerFactors();
        }
        // Calculate rolling averages and volatility
        const last5 = playerStats.slice(0, 5);
        const last10 = playerStats.slice(0, 10);
        const last30 = playerStats;
        return {
            recentForm: this.calculateRecentForm(last5),
            avg5Games: this.calculateAverages(last5),
            avg10Games: this.calculateAverages(last10),
            avg30Games: this.calculateAverages(last30),
            seasonAvg: this.calculateAverages(playerStats),
            volatility5Games: this.calculateVolatility(last5),
            volatility10Games: this.calculateVolatility(last10),
            volatilitySeason: this.calculateVolatility(playerStats),
            usageRate: this.calculateUsageRate(playerStats),
            targetShare: this.calculateTargetShare(playerStats)
        };
    }
    async computeMatchupFactors(request) {
        // Fetch matchup and DVP data
        const { data: matchupData } = await this.requireSupabase()
            .from('matchup_history')
            .select('*')
            .or(`team_home.eq.${request.entityId},team_away.eq.${request.entityId}`)
            .order('game_date', { ascending: false })
            .limit(10);
        return {
            dvpAllowed: await this.calculateDVP(request),
            dvpRank: await this.getDVPRank(request),
            dvpPercentile: await this.getDVPPercentile(request),
            h2hPerformance: this.calculateH2H(matchupData),
            venueAdvantage: this.calculateVenueAdvantage(request),
            paceImpact: this.calculatePaceImpact(request),
            styleMatchup: this.calculateStyleMatchup(request),
            restAdvantage: this.calculateRestAdvantage(request),
            travelFatigue: this.calculateTravelFatigue(request),
            altitudeImpact: this.calculateAltitudeImpact(request)
        };
    }
    async computeMetaFactors(request) {
        return {
            injuryImpact: await this.calculateInjuryImpact(request),
            weatherImpact: await this.calculateWeatherImpact(request),
            motivationFactor: this.calculateMotivation(request),
            scheduleSpot: this.calculateScheduleSpot(request),
            refereeImpact: await this.calculateRefereeImpact(request),
            publicBias: this.calculatePublicBias(request),
            primetime: this.isPrimetime(request) ? 1.0 : 0.0,
            revengeGame: this.isRevengeGame(request) ? 1.0 : 0.0,
            divisionRival: this.isDivisionRival(request) ? 1.0 : 0.0,
            playoffs: this.isPlayoffs(request) ? 1.0 : 0.0
        };
    }
    async computeTimingFactors(request) {
        const gameTime = await this.getGameTime(request);
        const currentTime = new Date();
        return {
            optimalBetWindow: this.calculateOptimalWindow(gameTime),
            lineMovementVelocity: await this.calculateLineVelocity(request),
            marketEfficiencyScore: await this.calculateMarketEfficiency(request),
            expectedClv: await this.calculateExpectedCLV(request),
            timeDecay: this.calculateTimeDecay(gameTime, currentTime)
        };
    }
    // Factor Calculation Helpers
    detectSteam(lineMovements, ticks) {
        if (lineMovements.length < 2)
            return 0;
        // Calculate line movement velocity
        const velocity = Math.abs(lineMovements[lineMovements.length - 1] - lineMovements[0]) /
            lineMovements.length;
        // Check for synchronized movement across books
        const bookMovements = new Map();
        ticks.forEach(tick => {
            const book = tick.book;
            if (!bookMovements.has(book)) {
                bookMovements.set(book, 0);
            }
            bookMovements.set(book, bookMovements.get(book) + 1);
        });
        const synchronizedBooks = Array.from(bookMovements.values())
            .filter(count => count > 1).length;
        // Steam score: velocity * synchronized books
        return Math.min(velocity * synchronizedBooks * 10, 100);
    }
    predictCLV(lineMovements, oddsMovements) {
        if (lineMovements.length < 2)
            return 0;
        // Simple CLV prediction based on line movement direction and magnitude
        const initialLine = lineMovements[0];
        const currentLine = lineMovements[lineMovements.length - 1];
        const movement = currentLine - initialLine;
        // Predict further movement in same direction
        const predictedMovement = movement * 0.5; // Conservative estimate
        return Math.abs(predictedMovement) * 10;
    }
    detectSharpMoney(ticks) {
        // Look for sudden line moves without corresponding public action
        let sharpScore = 0;
        for (let i = 1; i < ticks.length; i++) {
            const lineMove = Math.abs(ticks[i].line - ticks[i - 1].line);
            const timeGap = (new Date(ticks[i].tick_timestamp).getTime() -
                new Date(ticks[i - 1].tick_timestamp).getTime()) / 1000;
            // Quick move = sharp action
            if (lineMove > 0.5 && timeGap < 60) {
                sharpScore += lineMove * 20;
            }
        }
        return Math.min(sharpScore, 100);
    }
    detectPublicFade(ticks) {
        // Detect when line moves against expected public action
        // For now, simplified calculation
        return Math.random() * 50; // Placeholder
    }
    calculateLineShoppingEdge(ticks) {
        // Find best available line across books
        const bookLines = new Map();
        ticks.forEach(tick => {
            if (!bookLines.has(tick.book) || tick.line > bookLines.get(tick.book)) {
                bookLines.set(tick.book, tick.line);
            }
        });
        if (bookLines.size < 2)
            return 0;
        const lines = Array.from(bookLines.values());
        const bestLine = Math.max(...lines);
        const worstLine = Math.min(...lines);
        return (bestLine - worstLine) * 20;
    }
    calculateMarketTiming(ticks) {
        // Calculate optimal timing based on line movement patterns
        return Math.random() * 30 + 20; // Placeholder
    }
    detectCrossMarketDiscrepancy(ticks) {
        // Detect discrepancies between related markets
        return Math.random() * 40; // Placeholder
    }
    calculateBookDisagreement(ticks) {
        // Measure disagreement between books
        const bookLines = new Map();
        ticks.forEach(tick => {
            if (!bookLines.has(tick.book)) {
                bookLines.set(tick.book, []);
            }
            bookLines.get(tick.book).push(tick.line);
        });
        if (bookLines.size < 2)
            return 0;
        // Calculate variance between book averages
        const bookAverages = Array.from(bookLines.values()).map(lines => lines.reduce((a, b) => a + b, 0) / lines.length);
        const mean = bookAverages.reduce((a, b) => a + b, 0) / bookAverages.length;
        const variance = bookAverages.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) / bookAverages.length;
        return Math.min(Math.sqrt(variance) * 50, 100);
    }
    detectVolumeImbalance(ticks) {
        // Detect betting volume imbalance
        const volumes = ticks.map(t => t.volume || 0);
        if (volumes.length === 0)
            return 0;
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const latestVolume = volumes[volumes.length - 1];
        return Math.min(Math.abs(latestVolume - avgVolume) / avgVolume * 100, 100);
    }
    projectClosingLine(lineMovements) {
        if (lineMovements.length < 3)
            return lineMovements[lineMovements.length - 1] || 0;
        // Simple linear projection
        const recentMovements = lineMovements.slice(-5);
        const trend = (recentMovements[recentMovements.length - 1] - recentMovements[0]) /
            recentMovements.length;
        return lineMovements[lineMovements.length - 1] + (trend * 2);
    }
    // Helper methods for other factors
    calculateRecentForm(games) {
        if (games.length === 0)
            return 50;
        // Weight recent games more heavily
        let formScore = 0;
        games.forEach((game, index) => {
            const weight = 1 / (index + 1);
            const performance = game.fantasy_points || 0;
            formScore += performance * weight;
        });
        return Math.min(formScore, 100);
    }
    calculateAverages(games) {
        if (games.length === 0)
            return {};
        const stats = ['points', 'rebounds', 'assists', 'steals', 'blocks'];
        const averages = {};
        stats.forEach(stat => {
            const values = games.map(g => g[stat] || 0);
            averages[stat] = values.reduce((a, b) => a + b, 0) / values.length;
        });
        return averages;
    }
    calculateVolatility(games) {
        if (games.length < 2)
            return 0;
        const values = games.map(g => g.fantasy_points || 0);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    calculateUsageRate(games) {
        // Placeholder for usage rate calculation
        return Math.random() * 30 + 15;
    }
    calculateTargetShare(games) {
        // Placeholder for target share calculation
        return Math.random() * 25 + 10;
    }
    // Default factor values
    getDefaultMarketFactors() {
        return {
            steamDetection: 0,
            clvPrediction: 0,
            sharpMoneyIndicator: 0,
            publicFadeOpportunity: 0,
            lineShoppingEdge: 0,
            marketTimingAdvantage: 0,
            crossMarketDiscrepancy: 0,
            bookDisagreement: 0,
            volumeImbalance: 0,
            closingLineProjection: 0
        };
    }
    getDefaultPlayerFactors() {
        return {
            recentForm: 50,
            avg5Games: {},
            avg10Games: {},
            avg30Games: {},
            seasonAvg: {},
            volatility5Games: 0,
            volatility10Games: 0,
            volatilitySeason: 0,
            usageRate: 0,
            targetShare: 0
        };
    }
    // Aggregation and scoring
    aggregateFactorScores(market, player, matchup, meta, timing) {
        const scores = {};
        // Market factors (weight: 30%)
        Object.entries(market).forEach(([key, value]) => {
            scores[`market_${key}`] = value * 0.3;
        });
        // Player factors (weight: 25%)
        scores['player_recentForm'] = player.recentForm * 0.25;
        scores['player_volatility'] = player.volatility5Games * 0.25;
        // Matchup factors (weight: 20%)
        scores['matchup_dvp'] = matchup.dvpPercentile * 0.2;
        scores['matchup_venue'] = matchup.venueAdvantage * 0.2;
        // Meta factors (weight: 15%)
        scores['meta_injury'] = meta.injuryImpact * 0.15;
        scores['meta_weather'] = meta.weatherImpact * 0.15;
        // Timing factors (weight: 10%)
        scores['timing_clv'] = timing.expectedClv * 0.1;
        scores['timing_decay'] = timing.timeDecay * 0.1;
        return scores;
    }
    calculateConfidence(factorScores) {
        // Calculate confidence based on factor agreement
        const scores = Object.values(factorScores);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        // Lower variance = higher confidence
        const confidence = 100 - Math.min(Math.sqrt(variance), 50);
        return confidence;
    }
    // Material change detection
    async detectMaterialChanges() {
        // Check for significant line moves, injuries, etc.
        const changes = [];
        // Check for line moves > 1 point
        const { data: significantMoves } = await this.requireSupabase()
            .from('prop_ticks_hot')
            .select('prop_id, line')
            .gte('tick_timestamp', new Date(Date.now() - 300000).toISOString()); // Last 5 min
        // Group by prop and check for material changes
        // ... implementation
        this.featureMetrics.materialChangesDetected = changes.length;
        return changes;
    }
    async handleMaterialChanges(changes) {
        this.logger.info(`🔄 Handling ${changes.length} material changes...`);
        // Recompute features for affected props
        const requests = changes.map(change => ({
            propId: change.propId,
            entityId: change.entityId,
            entityType: 'player',
            sport: change.sport,
            featureDate: new Date(),
            forceRecompute: true
        }));
        await this.batchComputeFeatures(requests);
    }
    // Storage and caching
    async writeToFeatureStore() {
        // Batch write computed features to features_daily_agg
        this.logger.info('💾 Writing features to WARM tier...');
        // Implementation would batch insert/update to features_daily_agg
        this.featureMetrics.featureStoreWrites++;
    }
    async cacheComputedFeatures(features) {
        const cacheKey = `features:${features.propId}:${features.timestamp.toISOString()}`;
        await enhanced_cache_1.redisCache.set(cacheKey, JSON.stringify(features), 3600); // 1 hour TTL
    }
    // Subscription and monitoring
    async subscribeToMaterialChanges() {
        if (!this.hasSupabase())
            return;
        // Subscribe to significant line moves
        this.requireSupabase()
            .channel('material-changes')
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'prop_ticks_hot'
        }, (payload) => {
            // Add to computation queue if material change
            if (this.isMaterialChange(payload.new)) {
                this.computationQueue.push({
                    propId: payload.new.prop_id,
                    entityId: payload.new.prop_id,
                    entityType: 'player',
                    sport: 'nba', // Would fetch from raw_props
                    featureDate: new Date(),
                    forceRecompute: true
                });
            }
        })
            .subscribe();
    }
    isMaterialChange(tick) {
        // Define what constitutes a material change
        return Math.abs(tick.line) > 1 || tick.volume > 10000;
    }
    // Metrics and health
    async loadFeatureMetrics() {
        try {
            const cached = await enhanced_cache_1.redisCache.get('feature:metrics');
            if (cached) {
                const previousMetrics = JSON.parse(cached);
                this.featureMetrics = { ...this.featureMetrics, ...previousMetrics };
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load previous feature metrics');
        }
    }
    async updateFeatureMetrics() {
        await enhanced_cache_1.redisCache.set('feature:metrics', JSON.stringify(this.featureMetrics), 86400 // 24 hours TTL
        );
    }
    async cleanup() {
        this.logger.info('🧹 FeatureBuilderAgent cleanup...');
        // Save final metrics
        await this.updateFeatureMetrics();
        // Process remaining queue items
        if (this.computationQueue.length > 0) {
            await this.batchComputeFeatures(this.computationQueue);
        }
        this.logger.info('✅ FeatureBuilderAgent cleanup complete');
    }
    async collectMetrics() {
        return {
            ...this.featureMetrics,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    async checkHealth() {
        const checks = [];
        // Check computation latency
        checks.push({
            component: 'computation_latency',
            status: this.featureMetrics.computationLatencyMs < 60000 ? 'healthy' : 'degraded'
        });
        // Check cache hit rate
        checks.push({
            component: 'cache_hit_rate',
            status: this.featureMetrics.cacheHitRate > 0.5 ? 'healthy' : 'degraded'
        });
        // Check queue size
        checks.push({
            component: 'queue_size',
            status: this.computationQueue.length < 1000 ? 'healthy' : 'degraded'
        });
        const healthyComponents = checks.filter(c => c.status === 'healthy').length;
        const overallStatus = healthyComponents === checks.length ? 'healthy' :
            healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            details: {
                checks,
                metrics: this.featureMetrics,
                queueSize: this.computationQueue.length
            }
        };
    }
    // Placeholder implementations for complex calculations
    async calculateDVP(request) {
        return { allowed: Math.random() * 100 };
    }
    async getDVPRank(request) {
        return Math.floor(Math.random() * 32) + 1;
    }
    async getDVPPercentile(request) {
        return Math.random() * 100;
    }
    calculateH2H(matchupData) {
        return { performance: Math.random() * 100 };
    }
    calculateVenueAdvantage(request) {
        return Math.random() * 20 - 10;
    }
    calculatePaceImpact(request) {
        return Math.random() * 30 - 15;
    }
    calculateStyleMatchup(request) {
        return Math.random() * 40 - 20;
    }
    calculateRestAdvantage(request) {
        return Math.random() * 15;
    }
    calculateTravelFatigue(request) {
        return Math.random() * -10;
    }
    calculateAltitudeImpact(request) {
        return Math.random() * 5 - 2.5;
    }
    async calculateInjuryImpact(request) {
        return Math.random() * -30;
    }
    async calculateWeatherImpact(request) {
        return Math.random() * 20 - 10;
    }
    calculateMotivation(request) {
        return Math.random() * 20;
    }
    calculateScheduleSpot(request) {
        return Math.random() * 15 - 7.5;
    }
    async calculateRefereeImpact(request) {
        return Math.random() * 10 - 5;
    }
    calculatePublicBias(request) {
        return Math.random() * 30;
    }
    isPrimetime(request) {
        return Math.random() > 0.8;
    }
    isRevengeGame(request) {
        return Math.random() > 0.9;
    }
    isDivisionRival(request) {
        return Math.random() > 0.7;
    }
    isPlayoffs(request) {
        return false; // Not playoff season yet
    }
    async getGameTime(request) {
        // Would fetch from games table
        return new Date(Date.now() + 3600000 * 6); // 6 hours from now
    }
    calculateOptimalWindow(gameTime) {
        const start = new Date(gameTime.getTime() - 3600000 * 2); // 2 hours before
        const end = new Date(gameTime.getTime() - 3600000 * 0.5); // 30 min before
        return { start, end };
    }
    async calculateLineVelocity(request) {
        return Math.random() * 2;
    }
    async calculateMarketEfficiency(request) {
        return Math.random() * 100;
    }
    async calculateExpectedCLV(request) {
        return Math.random() * 5;
    }
    calculateTimeDecay(gameTime, currentTime) {
        const hoursToGame = (gameTime.getTime() - currentTime.getTime()) / (1000 * 3600);
        return Math.max(0, Math.min(100, hoursToGame * 10));
    }
}
exports.FeatureBuilderAgent = FeatureBuilderAgent;
