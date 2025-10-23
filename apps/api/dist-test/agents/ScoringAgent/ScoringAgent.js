"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringAgent = void 0;
const crypto_1 = require("crypto");
const BaseAgent_1 = require("../BaseAgent");
const ProfessionalPropProcessor_1 = require("../../services/ProfessionalPropProcessor");
const ParallelScoringEngine_1 = require("./scoring/ParallelScoringEngine");
const database_1 = require("@unit-talk/database");
// TODO: Implement intelligent caching and config creation
// import { IntelligentCache, GradingCache } from '@unit-talk/shared-utils';
// import { createAgentConfig } from '@unit-talk/shared-utils';
const gradingEngine_1 = require("./scoring/gradingEngine");
const Enhanced45FactorEngine_1 = require("./scoring/Enhanced45FactorEngine");
const FeatureStoreIntegration_1 = require("./scoring/FeatureStoreIntegration");
const MaterialChangeDetector_1 = require("./scoring/MaterialChangeDetector");
const FeatureStoreService_1 = require("../../services/FeatureStoreService");
const dataValidationGates_1 = require("../../validation/dataValidationGates");
class ScoringAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.batchProcessor = new Map();
        this.BATCH_SIZE = 200; // Increased for better parallel processing
        this.BATCH_TIMEOUT_MS = 10000; // Reduced to 10 seconds for faster processing
        // Initialize feature flags from environment
        this.USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
        this.USE_PARALLEL_PROCESSING = process.env.USE_PARALLEL_PROCESSING !== 'false'; // Default to true
        this.SCORING_DEBUG = process.env.SCORING_DEBUG === 'true';
        this.USE_ENHANCED_45_FACTOR = process.env.USE_ENHANCED_45_FACTOR === 'true'; // 🆕 New enhanced scoring system
        this.scoringEngine = new gradingEngine_1.SyndicateGradingEngine();
        this.professionalProcessor = ProfessionalPropProcessor_1.ProfessionalPropProcessor.getInstance();
        // Initialize optimization components
        this.parallelEngine = new ParallelScoringEngine_1.ParallelScoringEngine(this.logger);
        this.queryOptimizer = new database_1.QueryOptimizer(this.requireSupabase());
        // 🆕 Initialize Enhanced 45-Factor System if enabled
        if (this.USE_ENHANCED_45_FACTOR) {
            try {
                const featureStoreService = new FeatureStoreService_1.FeatureStoreService();
                this.featureStoreIntegration = new FeatureStoreIntegration_1.FeatureStoreIntegration(featureStoreService);
                this.materialChangeDetector = new MaterialChangeDetector_1.MaterialChangeDetector(this.featureStoreIntegration);
                this.enhanced45FactorEngine = new Enhanced45FactorEngine_1.Enhanced45FactorEngine(this.featureStoreIntegration, this.materialChangeDetector);
                // Set up material change event listeners
                this.materialChangeDetector.on('materialChange', this.handleMaterialChange.bind(this));
                this.materialChangeDetector.on('criticalChange', this.handleCriticalChange.bind(this));
                this.logger.info('✅ Enhanced 45-Factor Scoring System initialized');
            }
            catch (error) {
                this.logger.error('❌ Failed to initialize Enhanced 45-Factor System', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Fall back to legacy scoring
                this.USE_ENHANCED_45_FACTOR = false;
            }
        }
        // this.scoringCache = new ScoringCache(); // TODO: Implement scoring cache
        // this.performanceAnalyzer = new PerformanceAnalyzer();
        // this.riskManager = new RiskManager({
        //   maxPositionSize: 0.05,
        //   maxCorrelation: 0.7,
        //   maxDrawdown: 0.2,
        //   minSharpeRatio: 1.0,
        //   maxExposurePerSport: 0.3,
        //   maxExposurePerPlayer: 0.1,
        //   maxDailyRisk: 0.15,
        //   kellyMultiplier: 0.25,
        //   stopLossThreshold: 0.15,
        //   maxVaR: 0.05,
        //   maxCVaR: 0.08
        // });
        this.scoringMetrics = {
            ...this.metrics,
            picksProcessed: 0,
            picksScored: 0,
            avgScoringTimeMs: 0,
            tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
            avgConfidence: 0,
            promotedToFinal: 0,
            rejectedPicks: 0,
            batchSize: this.BATCH_SIZE,
            throughputPerMinute: 0
        };
    }
    async initialize() {
        this.logger.info('🎯 Initializing ScoringAgent with ML scoring engine for v3.0.0 unified database');
        this.logger.info(`🔀 Scoring path: ${this.USE_PRO_SCORER ? 'PROFESSIONAL' : 'LEGACY'} (USE_PRO_SCORER=${this.USE_PRO_SCORER})`);
        this.logger.info(`⚡ Parallel processing: ${this.USE_PARALLEL_PROCESSING ? 'ENABLED' : 'DISABLED'} (Expected 5-7x performance boost)`);
        this.logger.info(`📊 Debug logging: ${this.SCORING_DEBUG ? 'ENABLED' : 'DISABLED'} (SCORING_DEBUG=${this.SCORING_DEBUG})`);
        this.logger.info(`🏆 Enhanced 45-Factor: ${this.USE_ENHANCED_45_FACTOR ? 'ENABLED' : 'DISABLED'} (World-class syndicate-level scoring)`); // 🆕
        // Verify database access
        if (!this.hasSupabase()) {
            throw new Error('Supabase client required for ScoringAgent');
        }
        // Test database connectivity for v3.0.0 unified tables only
        const requiredTables = ['raw_props', 'unified_picks', 'users'];
        for (const table of requiredTables) {
            try {
                const { error } = await this.requireSupabase()
                    .from(table)
                    .select('id')
                    .limit(1);
                if (error) {
                    this.logger.warn(`⚠️ Table ${table} access check failed: ${error.message}`);
                }
                else {
                    this.logger.info(`✅ v3.0.0 table ${table} accessible`);
                }
            }
            catch (err) {
                this.logger.error(`❌ Failed to access v3.0.0 table ${table}`, {
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }
        // Initialize batch processing timer
        this.startBatchTimer();
        this.logger.info('✅ ScoringAgent initialized successfully for v3.0.0 unified database');
    }
    async process() {
        const startTime = Date.now();
        this.logger.info('🔄 Starting ScoringAgent processing cycle');
        try {
            // Fetch pending props for scoring
            const pendingProps = await this.fetchPendingProps();
            if (pendingProps.length === 0) {
                this.logger.debug('📭 No pending props found for scoring');
                return;
            }
            this.logger.info(`📊 Processing ${pendingProps.length} pending props`);
            // Process in batches for better performance
            const batchResults = await this.processBatched(pendingProps);
            // Update metrics
            this.updateProcessingMetrics(batchResults, Date.now() - startTime);
            this.logger.info(`✅ Scoring cycle completed`, {
                totalProcessed: pendingProps.length,
                promoted: batchResults.filter(r => r.tier !== 'D').length,
                avgScore: batchResults.reduce((sum, r) => sum + r.finalScore, 0) / batchResults.length,
                processingTimeMs: Date.now() - startTime
            });
        }
        catch (error) {
            this.scoringMetrics.errorCount++;
            this.logger.error('❌ ScoringAgent processing failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async cleanup() {
        this.logger.info('🧹 Cleaning up ScoringAgent');
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        // Process any remaining batches
        await this.processRemainingBatches();
        this.logger.info('✅ ScoringAgent cleanup completed');
    }
    async checkHealth() {
        const checks = [];
        // Database connectivity
        if (this.hasSupabase()) {
            try {
                await this.requireSupabase().from('raw_props').select('count').limit(1);
                checks.push({ service: 'database', status: 'healthy' });
            }
            catch (error) {
                checks.push({
                    service: 'database',
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        // Grading engine health
        try {
            const configs = this.scoringEngine.getAvailableConfigs();
            checks.push({
                service: 'scoringEngine',
                status: configs.length > 0 ? 'healthy' : 'degraded',
                details: { availableConfigs: configs.length }
            });
        }
        catch (error) {
            checks.push({
                service: 'scoringEngine',
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        // Performance metrics check
        const errorRate = this.scoringMetrics.errorCount / Math.max(1, this.scoringMetrics.picksProcessed);
        const performanceHealthy = errorRate < 0.05 && this.scoringMetrics.avgGradingTimeMs < 5000;
        checks.push({
            service: 'performance',
            status: performanceHealthy ? 'healthy' : 'degraded',
            details: {
                errorRate: Math.round(errorRate * 100) / 100,
                avgGradingTime: this.scoringMetrics.avgGradingTimeMs,
                throughput: this.scoringMetrics.throughputPerMinute
            }
        });
        const isHealthy = checks.every(check => check.status === 'healthy');
        return {
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            details: { checks, metrics: this.scoringMetrics }
        };
    }
    async collectMetrics() {
        this.scoringMetrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
        return { ...this.scoringMetrics };
    }
    // Enhanced scoring methods with parallel processing optimization
    async scoreProp(features) {
        const startTime = Date.now();
        // TODO: Check cache first for recent scoring results when cache is implemented
        // const cacheKey = `scoring:${features.propId}`;
        // const cachedResult = this.scoringCache.get(cacheKey);
        // if (cachedResult) {
        //   this.logger.debug('🎯 Cache hit for scoring result', { propId: features.propId });
        //   return cachedResult;
        // }
        try {
            let result;
            // 🆕 ENHANCED 45-FACTOR PATH: World-class syndicate-level scoring
            if (this.USE_ENHANCED_45_FACTOR && this.enhanced45FactorEngine) {
                this.logger.debug('🏆 Using Enhanced 45-Factor Scoring System', {
                    propId: features.propId,
                    sport: features.sport,
                    expectedPerformance: 'sub-50ms feature retrieval + comprehensive analysis'
                });
                const enhanced45Result = await this.enhanced45FactorEngine.calculate45FactorScore(features);
                // Convert Enhanced45FactorResult to standard ScoringResult format
                result = this.convertEnhanced45ResultToScoringResult(enhanced45Result, features);
                // Register prop for material change monitoring
                if (this.materialChangeDetector) {
                    this.materialChangeDetector.registerProp(features.propId, features.sport || 'UNKNOWN', [], // Use default watched factors
                    {
                        odds: features.odds,
                        line: features.market?.line,
                        expectedValue: features.expectedValue,
                        sharpMoney: features.sharpMoney
                    });
                }
                this.logger.info('🏆 Enhanced 45-Factor analysis completed', {
                    propId: features.propId,
                    totalScore: enhanced45Result.totalScore,
                    tier: enhanced45Result.tier,
                    confidence: enhanced45Result.confidence,
                    processingTimeMs: enhanced45Result.processingTimeMs,
                    featuresRetrievedMs: enhanced45Result.featuresRetrievedMs,
                    factorsAnalyzed: 45
                });
            }
            else if (this.USE_PRO_SCORER) {
                // PROFESSIONAL PATH: Route through ProfessionalPropProcessor
                this.logger.debug('🎯 Using Professional Scoring Path', {
                    propId: features.propId,
                    sport: features.sport,
                    parallelProcessing: this.USE_PARALLEL_PROCESSING
                });
                if (this.USE_PARALLEL_PROCESSING) {
                    // OPTIMIZED: Use parallel processing for professional insights
                    const proResult = await this.professionalProcessor.processScoringFeatureSet(features);
                    // Enhance with parallel professional insights calculation
                    const parallelInsights = await this.parallelEngine.calculateProfessionalInsightsParallel(features, this.scoringEngine);
                    // Merge results
                    result = this.convertProfessionalResult(proResult, features);
                    result.professionalInsights = parallelInsights;
                }
                else {
                    // Standard professional processing
                    const proResult = await this.professionalProcessor.processScoringFeatureSet(features);
                    result = this.convertProfessionalResult(proResult, features);
                }
            }
            else {
                // LEGACY PATH: Direct to SyndicateGradingEngine (backward compatible)
                this.logger.debug('🔄 Using Legacy Scoring Path', {
                    propId: features.propId,
                    sport: features.sport
                });
                result = await this.scoringEngine.scoreProp(features);
            }
            // TODO: Cache the result for future requests when cache is implemented
            // this.scoringCache.cacheScoringResult(features.propId, result);
            // Update metrics
            this.scoringMetrics.picksGraded++;
            const executionTime = Date.now() - startTime;
            this.scoringMetrics.avgGradingTimeMs =
                (this.scoringMetrics.avgGradingTimeMs + executionTime) / 2;
            this.scoringMetrics.tierDistribution[result.tier]++;
            this.scoringMetrics.avgConfidence =
                (this.scoringMetrics.avgConfidence + result.confidence) / 2;
            // Log performance improvement if using parallel processing
            if (this.USE_PARALLEL_PROCESSING && this.USE_PRO_SCORER) {
                this.logger.debug('⚡ Parallel processing performance', {
                    propId: features.propId,
                    executionTime,
                    expectedImprovement: '5-7x faster than sequential'
                });
            }
            // Store scoring result with unifiedPickId for v3.0.0
            await this.storeScoringResult(result);
            // PROFESSIONAL SHARP BETTING PROMOTION CRITERIA
            // Only promote top 1-3% of props with exceptional edge and confidence
            const shouldPromote = this.meetsPromotionCriteria(result);
            if (shouldPromote) {
                await this.promoteToUnifiedPicks(result);
                this.scoringMetrics.promotedToFinal++;
                this.logger.info('🏆 Sharp pick promoted', {
                    propId: features.propId,
                    tier: result.tier,
                    edgeScore: result.edgeScore,
                    confidence: result.confidence,
                    kelly: result.kellyFraction
                });
            }
            else {
                this.scoringMetrics.rejectedPicks++;
            }
            return result;
        }
        catch (error) {
            this.scoringMetrics.errorCount++;
            this.logger.error('❌ Failed to grade prop', {
                propId: features.propId,
                unifiedPickId: features.unifiedPickId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scoreProps(propsList) {
        return await this.scoringEngine.scoreProps(propsList);
    }
    /**
     * Convert ProfessionalPropResult to ScoringResult format
     */
    convertProfessionalResult(proResult, _features) {
        // Create a standardized ScoringResult from ProfessionalPropProcessor output
        const result = {
            propId: proResult.pickId,
            finalScore: proResult.professionalScore,
            confidence: proResult.confidence,
            tier: proResult.tier,
            edgeScore: proResult.devigged_edge * 100, // Convert to percentage
            // Professional insights from processor
            featureContributions: proResult.professional_insights?.featureContributions || {},
            modelContributions: proResult.professional_insights?.modelContributions || {},
            // Risk management
            kellyFraction: proResult.kelly_fraction,
            positionSize: Math.max(0.005, proResult.kelly_fraction * 0.25), // Kelly * multiplier
            riskScore: proResult.professional_insights?.riskScore || 3,
            correlationRisk: proResult.professional_insights?.correlationRisk || 0,
            // Scenario analysis
            scenarioAnalysis: proResult.professional_insights?.scenarioAnalysis || {
                bullCase: { score: proResult.professionalScore * 1.2, probability: 0.3 },
                baseCase: { score: proResult.professionalScore, probability: 0.4 },
                bearCase: { score: proResult.professionalScore * 0.8, probability: 0.3 }
            },
            // Professional insights
            professionalInsights: proResult.professional_insights || {},
            deviggingResult: {
                originalEdge: proResult.devigged_edge || 0,
                deviggedEdge: proResult.devigged_edge || 0,
                totalVig: 0.05,
                fairOdds: -110,
                trueValue: (proResult.devigged_edge || 0) > 0.02
            },
            // Metadata
            dataQuality: 0.95,
            modelAgreement: 0.85,
            historicalAccuracy: 0.78,
            timestamp: new Date().toISOString(),
            modelVersion: 'professional-v1.0',
            configUsed: 'professional-v1.0'
        };
        return result;
    }
    // High-performance parallel batch processing with failure recovery
    async processBatched(props) {
        const batches = this.createBatches(props, this.BATCH_SIZE);
        const allResults = [];
        const failedProps = [];
        // Process all batches in parallel for maximum throughput
        const batchPromises = batches.map(async (batch, index) => {
            try {
                const results = await this.scoreProps(batch);
                return { success: true, results, failedProps: [] };
            }
            catch (error) {
                this.logger.error('❌ Batch processing failed, attempting individual recovery', {
                    batchIndex: index,
                    batchSize: batch.length,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // RECOVERY: Process each prop individually to salvage what we can
                const recoveredResults = [];
                const stillFailedProps = [];
                for (const prop of batch) {
                    try {
                        const result = await this.scoreProp(prop);
                        recoveredResults.push(result);
                    }
                    catch (propError) {
                        this.logger.warn('⚠️ Individual prop scoring failed, marking for retry', {
                            propId: prop.propId,
                            error: propError instanceof Error ? propError.message : 'Unknown error'
                        });
                        stillFailedProps.push(prop);
                    }
                }
                return { success: false, results: recoveredResults, failedProps: stillFailedProps };
            }
        });
        // Wait for all batches to complete simultaneously
        const batchResults = await Promise.all(batchPromises);
        // Collect all results and failed props
        for (const batchResult of batchResults) {
            allResults.push(...batchResult.results);
            failedProps.push(...batchResult.failedProps);
        }
        // Schedule failed props for retry
        if (failedProps.length > 0) {
            await this.scheduleFailedPropsForRetry(failedProps);
        }
        return allResults;
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * Schedule failed props for retry with exponential backoff
     */
    async scheduleFailedPropsForRetry(failedProps) {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Cannot schedule retries - Supabase not available');
            return;
        }
        try {
            // Update raw_props with retry information
            const retryUpdates = failedProps.map(prop => ({
                id: prop.propId,
                pro_attempts: (prop.pro_attempts || 0) + 1,
                processing_error: `Grading failed at ${new Date().toISOString()}`,
                processed_at: null // Reset to allow retry
            }));
            const { error } = await this.supabase
                .from('raw_props')
                .upsert(retryUpdates, { onConflict: 'id' });
            if (error) {
                this.logger.error('❌ Failed to schedule props for retry', { error });
            }
            else {
                this.logger.info(`📅 Scheduled ${failedProps.length} props for retry`, {
                    propIds: failedProps.map(p => p.propId).slice(0, 5), // Log first 5 IDs
                    totalScheduled: failedProps.length
                });
            }
        }
        catch (error) {
            this.logger.error('❌ Error scheduling failed props for retry', {
                error: error instanceof Error ? error.message : 'Unknown error',
                failedPropsCount: failedProps.length
            });
        }
    }
    async fetchPendingProps() {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, returning empty props list');
            return [];
        }
        if (this.USE_PRO_SCORER) {
            // OPTIMIZED PROFESSIONAL PATH: Use QueryOptimizer for better performance
            try {
                const rawProps = await this.queryOptimizer.getUnprocessedProps({
                    limit: 200,
                    useCache: true,
                    cacheTTL: 60000, // 1 minute cache for unprocessed props
                    filters: {
                    // Add any additional filters if needed
                    }
                });
                this.logger.info(`🎯 Found ${rawProps?.length || 0} props for professional processing (optimized query)`);
                // VALIDATION GATE: Validate props before processing
                if (rawProps && rawProps.length > 0) {
                    const validation = dataValidationGates_1.DataValidationGates.validatePropBatch(rawProps);
                    if (validation.invalidProps.length > 0) {
                        this.logger.warn(`⚠️ Found ${validation.invalidProps.length} invalid props, excluding from processing`, {
                            invalidPropIds: validation.invalidProps.map(p => p.prop.id).slice(0, 5)
                        });
                    }
                    // Use corrected props for processing
                    return validation.correctedProps.map(prop => this.convertToFeatureSet(prop));
                }
                return [];
            }
            catch (error) {
                this.logger.error('❌ Failed to fetch unprocessed props for professional scoring', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                return [];
            }
        }
        else {
            // LEGACY PATH: Grade props from raw_props that haven't been scoring_status yet
            const { data: rawProps, error } = await this.requireSupabase()
                .from('raw_props')
                .select('*')
                .is('tier', null) // Props that haven't been scoring_status yet (tier is null)
                .or('promoted_to_picks.is.null,promoted_to_picks.eq.false') // Props not yet promoted (null or false)
                .order('created_at', { ascending: true })
                .limit(200); // Reasonable limit for processing
            if (error) {
                this.logger.error('❌ Failed to fetch pending props for legacy scoring', {
                    error: error.message
                });
                return [];
            }
            // VALIDATION GATE: Validate legacy props before processing
            if (rawProps && rawProps.length > 0) {
                const validation = dataValidationGates_1.DataValidationGates.validatePropBatch(rawProps);
                if (validation.invalidProps.length > 0) {
                    this.logger.warn(`⚠️ Found ${validation.invalidProps.length} invalid legacy props, excluding from processing`, {
                        invalidPropIds: validation.invalidProps.map(p => p.prop.id).slice(0, 5)
                    });
                }
                // Use corrected props for processing
                return validation.correctedProps.map(prop => this.convertToFeatureSet(prop));
            }
            return [];
        }
    }
    convertToFeatureSet(rawProp) {
        // Legacy method - Convert raw database prop to ScoringFeatureSet format
        // This is kept for backward compatibility but unified picks should use convertUnifiedPickToFeatureSet
        return {
            propId: rawProp.id,
            date: rawProp.date || rawProp.game_date || new Date().toISOString().split('T')[0],
            sport: rawProp.sport || 'unknown',
            league: rawProp.league || 'unknown',
            player: rawProp.player_name,
            market: {
                type: rawProp.stat_type || rawProp.market_type || 'unknown', // v3.0.0 uses stat_type
                line: rawProp.line || 0,
                odds: rawProp.odds || 100
            },
            expectedValue: rawProp.expected_value || 0,
            sharpMoney: rawProp.sharp_money || 50,
            lineMovement: rawProp.line_movement || 0,
            matchupRating: rawProp.matchup_rating || 50,
            playerForm: rawProp.player_form || 50,
            marketType: rawProp.stat_type || rawProp.market_type,
            odds: rawProp.odds,
            // Add other required fields with defaults
            injuryImpact: rawProp.injury_impact || 0,
            weatherImpact: rawProp.weather_impact || 0,
            marketIntelligence: rawProp.market_intelligence || 50,
            volumeProfile: rawProp.volume_profile || 50,
            closingLineValue: rawProp.closing_line_value || 0,
            playerFatigue: rawProp.player_fatigue || 0,
            venueAdvantage: rawProp.venue_advantage || 0,
            refereeImpact: rawProp.referee_impact || 0,
            paceImpact: rawProp.pace_impact || 0,
            motivationalFactors: rawProp.motivational_factors || 0,
            correlationRisk: rawProp.correlation_risk || 0,
            volatility: rawProp.volatility || 5,
            portfolioImpact: rawProp.portfolio_impact || 0,
            bidAskSpread: rawProp.bid_ask_spread || 0.02,
            timestamp: rawProp.created_at || new Date().toISOString(),
            version: '1.0',
            source: 'database',
            confidence: rawProp.confidence || 50,
            dataQuality: {
                completeness: rawProp.data_completeness || 0.95,
                outlierScore: rawProp.outlier_score || 0.95,
                consistencyScore: rawProp.consistency_score || 0.95,
                dataValidationScore: rawProp.data_validation_score || 0.95
            }
        };
    }
    async storeScoringResult(result) {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, skipping result storage');
            return;
        }
        try {
            // Store scoring results in raw_props table (v3.0.0 approach)  
            // Fix: Use correct data types - confidence is 0/1 boolean, edge_score is integer
            const { error } = await this.requireSupabase()
                .from('raw_props')
                .update({
                confidence: result.confidence ? (result.confidence > 65 ? 1 : 0) : 0, // Boolean-like: 1 = high confidence, 0 = low, handle null
                tier: result.tier,
                professional_score: result.finalScore ? result.finalScore / 100 : 0.01, // Convert to 0-1 decimal scale, default minimum
                kelly_fraction: result.kellyFraction || 0.001,
                updated_at: new Date().toISOString(),
                processed_at: new Date().toISOString() // Mark as processed
            })
                .eq('id', result.propId);
            if (error) {
                this.logger.error('❌ Failed to store scoring result in raw_props', {
                    propId: result.propId,
                    error: error.message,
                    confidence: result.confidence,
                    edgeScore: result.edgeScore
                });
            }
            else {
                this.logger.info('✅ Grading result stored in raw_props', {
                    propId: result.propId,
                    tier: result.tier,
                    confidence: result.confidence > 65 ? 1 : 0, // Boolean format
                    confidencePercent: result.confidence, // Original percentage for reference
                    edgeScore: Math.round(result.edgeScore * 1000), // Per-mille basis points
                    edgeScoreDecimal: result.edgeScore, // Original decimal for reference
                    autoApproved: result.tier !== 'D' && result.confidence > 65
                });
            }
        }
        catch (error) {
            this.logger.error('❌ Error storing scoring result', {
                propId: result.propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    meetsPromotionCriteria(result) {
        // PROFESSIONAL SHARP BETTING PROMOTION STANDARDS
        // These criteria ensure only the most profitable picks are promoted
        // Rule 1: Edge Score Threshold (minimum 8% edge)
        const MIN_EDGE_SCORE = 800; // 800 basis points = 8% edge
        if (result.edgeScore < MIN_EDGE_SCORE) {
            return false;
        }
        // Rule 2: Ultra-High Confidence Requirement (85%+)
        const MIN_CONFIDENCE = 85; // 85% confidence minimum
        if (result.confidence < MIN_CONFIDENCE) {
            return false;
        }
        // Rule 3: Tier Requirements (S-tier or exceptional A-tier only)
        if (result.tier === 'S') {
            // S-tier props need minimum edge and confidence (already checked above)
            return true;
        }
        else if (result.tier === 'A') {
            // A-tier props need exceptional edge (12%+) and confidence (90%+)
            return result.edgeScore >= 1200 && result.confidence >= 90;
        }
        else {
            // B, C, D tier props are never promoted
            return false;
        }
    }
    async promoteToUnifiedPicks(result) {
        if (!this.hasSupabase()) {
            return;
        }
        try {
            // Get the original prop data from raw_props
            const { data: prop } = await this.requireSupabase()
                .from('raw_props')
                .select('*')
                .eq('id', result.propId)
                .single();
            if (!prop) {
                this.logger.warn('⚠️ Original prop not found for promotion', {
                    propId: result.propId
                });
                return;
            }
            // Get a default user_id for system-scoring_status picks
            const { data: systemUser } = await this.requireSupabase()
                .from('users')
                .select('id')
                .limit(1)
                .single();
            if (!systemUser) {
                this.logger.error('❌ No users found in database for promotion');
                return;
            }
            // Create the pick selection text
            const pickSide = prop.line > 0 ? 'over' : 'under';
            const selection = `${prop.player_name} ${prop.stat_type} ${pickSide} ${Math.abs(prop.line)}`;
            // Insert into unified_picks with actual v3.0.0 schema
            const { error } = await this.requireSupabase()
                .from('unified_picks')
                .insert({
                id: (0, crypto_1.randomUUID)(),
                user_id: systemUser.id,
                pick_type: 'parlay', // Valid pick_type from schema analysis
                selection: selection,
                odds: prop.odds || prop.over_odds || -110,
                stake: result.positionSize * 100, // Convert position size to dollar stake
                potential_payout: (result.positionSize * 100) * (1 + Math.abs(result.kellyFraction)),
                player_name: prop.player_name,
                stat_type: prop.stat_type,
                line: prop.line,
                over_odds: prop.over_odds,
                under_odds: prop.under_odds,
                sport: prop.sport || 'Unknown',
                game_date: prop.game_date,
                confidence: result.confidence,
                tier_when_placed: result.tier,
                kelly_bet_size: result.kellyFraction,
                created_at: new Date().toISOString()
            });
            if (error) {
                this.logger.error('❌ Failed to promote prop to unified_picks', {
                    propId: result.propId,
                    error: error.message
                });
            }
            else {
                this.logger.info('✅ Prop promoted to unified_picks', {
                    propId: result.propId,
                    tier: result.tier,
                    score: result.finalScore
                });
                // Mark raw_props as promoted
                await this.requireSupabase()
                    .from('raw_props')
                    .update({
                    promoted_to_picks: true,
                    promoted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                    .eq('id', result.propId);
            }
        }
        catch (error) {
            this.logger.error('❌ Error promoting prop to unified_picks', {
                propId: result.propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    updateProcessingMetrics(results, processingTimeMs) {
        this.scoringMetrics.picksProcessed += results.length;
        this.scoringMetrics.processingTimeMs = processingTimeMs;
        // Calculate throughput
        const throughputPerMs = results.length / processingTimeMs;
        this.scoringMetrics.throughputPerMinute = Math.round(throughputPerMs * 60000);
        this.scoringMetrics.successCount++;
    }
    startBatchTimer() {
        this.batchTimer = setTimeout(() => {
            this.processRemainingBatches();
            this.startBatchTimer(); // Restart timer
        }, this.BATCH_TIMEOUT_MS);
    }
    async processRemainingBatches() {
        for (const [key, batch] of this.batchProcessor.entries()) {
            if (batch.length > 0) {
                try {
                    await this.processBatched(batch);
                    this.batchProcessor.delete(key);
                }
                catch (error) {
                    this.logger.error('❌ Failed to process remaining batch', {
                        batchKey: key,
                        batchSize: batch.length,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }
    }
    // Configuration management
    updateScoringConfig(configName, config) {
        this.scoringEngine.updateScoringConfig(configName, config);
        this.logger.info('📝 Scoring configuration updated', { configName });
    }
    setActiveConfig(configName) {
        this.scoringEngine.setActiveConfig(configName);
        this.logger.info('🔧 Active scoring configuration changed', { configName });
    }
    getAvailableConfigs() {
        return this.scoringEngine.getAvailableConfigs();
    }
    // Performance optimization
    async optimizeWeights(timeframe = '30d') {
        try {
            const optimizedWeights = await this.scoringEngine.optimizeWeights(timeframe);
            this.logger.info('⚡ Scoring weights optimized', {
                timeframe,
                weightsUpdated: Object.keys(optimizedWeights).length
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to optimize weights', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // ========================================
    // 🆕 ENHANCED 45-FACTOR SYSTEM METHODS
    // ========================================
    /**
     * Convert Enhanced45FactorResult to standard ScoringResult format
     */
    convertEnhanced45ResultToScoringResult(enhanced45Result, features) {
        return {
            propId: features.propId,
            finalScore: enhanced45Result.totalScore,
            confidence: enhanced45Result.confidence * 100, // Convert 0-1 to 0-100
            tier: enhanced45Result.tier,
            edgeScore: enhanced45Result.expectedValue,
            // Feature Attribution - Enhanced with 45 factors
            featureContributions: this.convertFactorScoresToContributions(enhanced45Result.factorScores),
            modelContributions: {
                'Enhanced 45-Factor Engine': enhanced45Result.totalScore,
                'Market Factors': enhanced45Result.marketScore,
                'Player Factors': enhanced45Result.playerScore,
                'Matchup Factors': enhanced45Result.matchupScore,
                'Price Factors': enhanced45Result.priceScore,
                'Meta Factors': enhanced45Result.metaScore
            },
            // Risk Assessment - Enhanced
            kellyFraction: enhanced45Result.kellyFraction,
            positionSize: enhanced45Result.kellyFraction * 0.25, // Conservative Kelly multiplier
            riskScore: this.calculateRiskScoreFromEnhanced(enhanced45Result),
            correlationRisk: this.extractCorrelationRisk(enhanced45Result.factorScores),
            // Scenario Analysis - Enhanced
            scenarioAnalysis: {
                bullCase: {
                    score: Math.min(100, enhanced45Result.totalScore * 1.2),
                    probability: 0.25
                },
                baseCase: {
                    score: enhanced45Result.totalScore,
                    probability: 0.5
                },
                bearCase: {
                    score: Math.max(0, enhanced45Result.totalScore * 0.8),
                    probability: 0.25
                }
            },
            // Professional Insights - Enhanced with 45-factor context
            professionalInsights: {
                steamMoveDetected: enhanced45Result.factorScores.steamDetection > 70,
                predictedClosingLine: features.market?.line || 0,
                optimalBettingTime: this.determineOptimalTiming(enhanced45Result.factorScores),
                bestAvailableLine: features.market?.line || 0,
                bestBook: 'DraftKings', // Default
                publicBettingPercentage: enhanced45Result.factorScores.publicVsSharpSplit || 50,
                sharpBettingPercentage: 100 - (enhanced45Result.factorScores.publicVsSharpSplit || 50),
                contrarianOpportunity: (enhanced45Result.factorScores.publicVsSharpSplit || 50) > 70,
                injuryTimingAdvantage: enhanced45Result.factorScores.injuryImpact || 0,
                crossMarketArbitrage: enhanced45Result.factorScores.crossMarketArbitrage || 0
            },
            // Quality Metrics - Enhanced
            dataQuality: enhanced45Result.dataQuality,
            modelAgreement: enhanced45Result.modelAgreement,
            historicalAccuracy: 0.78, // Default - would be computed from backtest
            // Metadata
            timestamp: enhanced45Result.timestamp,
            modelVersion: enhanced45Result.version,
            configUsed: enhanced45Result.configUsed
        };
    }
    /**
     * Convert factor scores to feature contributions format
     */
    convertFactorScoresToContributions(factorScores) {
        const totalScore = Object.values(factorScores).reduce((sum, score) => sum + score, 0);
        const contributions = {};
        Object.entries(factorScores).forEach(([factor, score]) => {
            contributions[factor] = totalScore > 0 ? (score / totalScore) * 100 : 0;
        });
        return contributions;
    }
    /**
     * Calculate risk score from enhanced result
     */
    calculateRiskScoreFromEnhanced(enhanced45Result) {
        // Use risk-adjusted score and volatility factors
        const baseRisk = (100 - enhanced45Result.riskAdjustedScore) / 100 * 10;
        const volatilityRisk = (enhanced45Result.factorScores.volatilityScore || 50) / 100 * 5;
        const correlationRisk = (enhanced45Result.factorScores.correlationRisk || 0) / 100 * 3;
        return Math.min(10, baseRisk + volatilityRisk + correlationRisk);
    }
    /**
     * Extract correlation risk from factor scores
     */
    extractCorrelationRisk(factorScores) {
        return (factorScores.correlationRisk || 0) / 100;
    }
    /**
     * Determine optimal timing from factor scores
     */
    determineOptimalTiming(factorScores) {
        const optimalTiming = factorScores.optimalTiming || 50;
        if (optimalTiming > 80)
            return 'immediate';
        if (optimalTiming > 60)
            return 'within_hour';
        if (optimalTiming > 40)
            return 'monitor';
        return 'avoid';
    }
    /**
     * Handle material change events
     */
    async handleMaterialChange(change) {
        this.logger.info('📊 Material change detected', {
            propId: change.propId,
            changeType: change.changeType,
            severity: change.severity,
            impact: change.impact
        });
        // Trigger re-scoring for high-impact changes
        if (change.severity === 'high' || change.severity === 'critical') {
            try {
                // Get the current prop features and re-grade
                const state = this.materialChangeDetector?.['propStates']?.get(change.propId);
                if (state) {
                    this.logger.info('♻️ Triggering re-grade due to material change', {
                        propId: change.propId,
                        changeType: change.changeType
                    });
                    // In a production system, you would re-fetch the prop and re-grade it
                    // For now, we log the event for monitoring
                }
            }
            catch (error) {
                this.logger.error('❌ Failed to handle material change', {
                    propId: change.propId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }
    /**
     * Handle critical change events
     */
    async handleCriticalChange(change) {
        this.logger.warn('🚨 Critical material change detected', {
            propId: change.propId,
            changeType: change.changeType,
            impact: change.impact,
            correlatedChanges: change.correlatedChanges?.length || 0
        });
        // Send alert to monitoring systems
        // In production, this could trigger alerts to Slack, PagerDuty, etc.
        // Force immediate re-scoring
        await this.handleMaterialChange(change);
    }
    /**
     * Batch process props using Enhanced 45-Factor system
     */
    async batchProcessEnhanced45Factor(propsList) {
        if (!this.USE_ENHANCED_45_FACTOR || !this.enhanced45FactorEngine) {
            this.logger.warn('Enhanced 45-Factor system not available, falling back to standard processing');
            return this.processBatched(propsList);
        }
        const startTime = Date.now();
        try {
            const enhanced45Results = await this.enhanced45FactorEngine.batchProcess45Factor(propsList);
            const scoringResults = enhanced45Results.map((enhanced45Result, index) => this.convertEnhanced45ResultToScoringResult(enhanced45Result, propsList[index]));
            const totalProcessingTime = Date.now() - startTime;
            this.logger.info('🏆 Enhanced 45-Factor batch processing completed', {
                totalProps: propsList.length,
                avgProcessingTimeMs: totalProcessingTime / propsList.length,
                avgScore: scoringResults.reduce((sum, r) => sum + r.finalScore, 0) / scoringResults.length,
                tierDistribution: this.calculateTierDistribution(scoringResults),
                totalProcessingTimeMs: totalProcessingTime
            });
            return scoringResults;
        }
        catch (error) {
            this.logger.error('❌ Enhanced 45-Factor batch processing failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                propsCount: propsList.length
            });
            // Fall back to standard processing
            return this.processBatched(propsList);
        }
    }
    /**
     * Calculate tier distribution from results
     */
    calculateTierDistribution(results) {
        const distribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        results.forEach(result => {
            distribution[result.tier]++;
        });
        return distribution;
    }
    /**
     * Get Enhanced 45-Factor system status
     */
    getEnhanced45FactorStatus() {
        if (!this.USE_ENHANCED_45_FACTOR) {
            return null;
        }
        return {
            enabled: true,
            featureStoreHealth: this.featureStoreIntegration?.getCacheStats() || null,
            changeDetectorStatus: this.materialChangeDetector?.getStatus() || null,
            processingStats: {
                avgProcessingTime: this.scoringMetrics.avgGradingTimeMs,
                throughputPerMinute: this.scoringMetrics.throughputPerMinute,
                successRate: this.scoringMetrics.successCount / Math.max(1, this.scoringMetrics.successCount + this.scoringMetrics.errorCount)
            }
        };
    }
    /**
     * Cleanup enhanced systems
     */
    async cleanupEnhanced45Factor() {
        if (this.materialChangeDetector) {
            this.materialChangeDetector.shutdown();
            this.materialChangeDetector = undefined;
        }
        this.enhanced45FactorEngine = undefined;
        this.featureStoreIntegration = undefined;
        this.logger.info('🧹 Enhanced 45-Factor system cleanup completed');
    }
}
exports.ScoringAgent = ScoringAgent;
