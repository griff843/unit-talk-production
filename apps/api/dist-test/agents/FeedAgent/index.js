"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimitStatus = exports.fetchOptimalProps = exports.FeedAgent = void 0;
const config_1 = require("../BaseAgent/config");
const index_1 = require("../BaseAgent/index");
const types_1 = require("./types");
const utils_1 = require("./utils");
/**
 * Create a proper FeedAgent configuration that extends BaseAgentConfig
 */
function createFeedAgentConfig(config) {
    // Create base config first
    const baseConfig = (0, config_1.createBaseAgentConfig)(config);
    // Try to parse feed-specific config, but don't fail if it's incomplete
    let feedConfig;
    try {
        feedConfig = types_1.FeedAgentConfigSchema.parse(config);
    }
    catch (error) {
        // If feed config validation fails, create a minimal valid config
        feedConfig = {
            name: config.name || 'FeedAgent',
            enabled: config.enabled ?? true,
            version: config.version || '1.0.0',
            logLevel: config.logLevel || 'info',
            metrics: { enabled: true },
            retryConfig: {
                maxRetries: 3,
                backoffMs: 1000,
                maxBackoffMs: 30000
            },
            providers: config.providers || {},
            dedupeConfig: {
                checkInterval: 300,
                ttlHours: 24
            }
        };
    }
    return { ...baseConfig, feedConfig };
}
/**
 * FeedAgent handles fetching, normalizing, and processing raw sports betting props
 * from various data providers.
 */
class FeedAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        // Create a proper configuration that works with BaseAgent
        const enhancedConfig = createFeedAgentConfig(config);
        super(enhancedConfig, deps);
        // Use the feed-specific config if available, otherwise create defaults
        this.fullConfig = enhancedConfig.feedConfig || {
            name: enhancedConfig.name,
            enabled: enhancedConfig.enabled || true,
            version: enhancedConfig.version || '1.0.0',
            logLevel: 'info',
            metrics: { enabled: true },
            retryConfig: {
                maxRetries: 3,
                backoffMs: 1000,
                maxBackoffMs: 30000
            },
            providers: {},
            dedupeConfig: {
                checkInterval: 300,
                ttlHours: 24
            }
        };
        this.feedMetrics = {
            totalProps: 0,
            uniqueProps: 0,
            duplicates: 0,
            errors: 0,
            latencyMs: 0,
            providerStats: {
                SportsGameOdds: { success: 0, failed: 0, avgLatencyMs: 0 },
                OddsAPI: { success: 0, failed: 0, avgLatencyMs: 0 },
                Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 },
                Optimal: { success: 0, failed: 0, avgLatencyMs: 0 }
            }
        };
    }
    async initialize() {
        this.logger.info('🚀 Initializing FeedAgent...');
        await this.validateDependencies();
    }
    async process() {
        this.logger.info('🔄 Processing feed data...');
        try {
            // Process each configured provider
            for (const [_providerName, provider] of Object.entries(this.fullConfig.providers)) {
                if (provider.enabled) {
                    await this.startProviderIngestion(provider);
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to process feed data', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async cleanup() {
        this.logger.info('🧹 FeedAgent cleanup completed');
    }
    async checkHealth() {
        try {
            const errorRate = this.feedMetrics.errors / Math.max(this.feedMetrics.totalProps, 1);
            const status = errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';
            return {
                status,
                timestamp: new Date().toISOString(),
                details: {
                    errorRate,
                    metrics: this.feedMetrics
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                details: {
                    err: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    async collectMetrics() {
        return {
            agentName: this.fullConfig.name,
            successCount: this.feedMetrics.totalProps - this.feedMetrics.errors,
            errorCount: this.feedMetrics.errors,
            warningCount: this.feedMetrics.duplicates,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    async validateDependencies() {
        // Check database connectivity
        if (!this.supabase) {
            throw new Error('Supabase client is required for FeedAgent');
        }
        const { error } = await this.supabase
            .from('raw_props')
            .select('id')
            .limit(1);
        if (error) {
            throw new Error(`Database connectivity check failed: ${error.message}`);
        }
    }
    async startProviderIngestion(provider) {
        try {
            this.logger.info(`Starting ingestion for provider: ${provider.name}`);
            // Fetch data from provider
            const rawData = await this.fetchFromProvider(provider);
            // Ensure supabase is available
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedAgent');
            }
            // Normalize the data
            const normalizedData = await (0, utils_1.normalizePublicProps)(rawData, provider, true, this.supabase);
            // Deduplicate the data
            const deduplicatedData = await (0, utils_1.dedupePublicProps)(normalizedData, provider, this.supabase);
            // Transform to RawProp objects
            const rawProps = this.transformProps(deduplicatedData, provider);
            // Process the props
            await this.processProps(rawProps);
        }
        catch (error) {
            this.logger.error(`Provider ingestion failed: ${provider.name}`, {
                error: error instanceof Error ? error.message : String(error)
            });
            this.feedMetrics.errors++;
            throw error;
        }
    }
    async fetchFromProvider(_provider) {
        const startTime = Date.now();
        try {
            this.logger.info(`🌐 Fetching real data using unified data source router`);
            // Import the unified data source router
            const { fetchUnifiedData } = await Promise.resolve().then(() => __importStar(require('./dataSourceRouter')));
            // Get today's date for filtering
            const today = new Date().toISOString().split('T')[0];
            // Fetch props for all supported sports using smart routing
            const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF'];
            const allProps = [];
            for (const sport of sports) {
                try {
                    this.logger.info(`🏀 Fetching ${sport} props using smart routing`);
                    // Force NCAAF to use Odds API since Optimal doesn't support it
                    const requestConfig = {
                        sport,
                        marketType: 'player-props',
                        date: today
                    };
                    // Override routing for NCAAF
                    if (sport === 'NCAAF') {
                        requestConfig.forceSource = 'odds-api';
                        this.logger.info('🏈 Forcing NCAAF to use Odds API (Optimal unsupported)');
                    }
                    // Use unified data router with potential override
                    const result = await fetchUnifiedData(requestConfig);
                    this.logger.info(`📊 ${sport}: ${result.data.length} props from ${result.source} (${result.metadata.processingTimeMs}ms)`);
                    // Add source metadata to props
                    const sourceProps = result.data.map(prop => ({
                        ...prop,
                        source: result.source,
                        fetched_via: 'unified-router'
                    }));
                    allProps.push(...sourceProps);
                    // Update provider stats based on source used
                    if (result.source === 'optimal-api') {
                        this.feedMetrics.providerStats.Optimal.success++;
                        this.feedMetrics.providerStats.Optimal.avgLatencyMs = result.metadata.processingTimeMs;
                    }
                    else if (result.source === 'odds-api') {
                        this.feedMetrics.providerStats.OddsAPI.success++;
                        this.feedMetrics.providerStats.OddsAPI.avgLatencyMs = result.metadata.processingTimeMs;
                    }
                    // Log any errors from the unified system
                    if (result.metadata.errors.length > 0) {
                        this.logger.warn(`⚠️ ${sport} fetch had errors:`, result.metadata.errors);
                    }
                    // Small delay between sports
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                catch (error) {
                    this.logger.error(`❌ Failed to fetch ${sport} props`, {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    this.feedMetrics.errors++;
                }
            }
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Fetched ${allProps.length} total props using unified routing in ${duration}ms`);
            return allProps;
        }
        catch (error) {
            this.logger.error(`❌ Unified data fetch failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async processProps(props) {
        if (!this.supabase) {
            throw new Error('Supabase client is required for FeedAgent');
        }
        if (props.length === 0) {
            this.logger.info('No props to process');
            return;
        }
        this.logger.info(`🔄 Processing ${props.length} props with HOT/WARM/COLD architecture...`);
        const startTime = Date.now();
        try {
            // Import and initialize HOT data integration
            const { HotDataIntegration } = await Promise.resolve().then(() => __importStar(require('./HotDataIntegration')));
            const hotDataIntegration = new HotDataIntegration(this.supabase, this.logger, {
                batchSize: 500,
                maxParallelBatches: 5,
                hotTableEnabled: true,
                enableSteamDetection: true,
                enableMarketIntelligence: true
            });
            // Process props with dual write to raw_props and prop_ticks_hot
            const result = await hotDataIntegration.processPropsWithHotStorage(props);
            // Update metrics with HOT architecture results
            this.feedMetrics.uniqueProps += result.rawPropsInserted;
            this.feedMetrics.errors += result.errors.length;
            this.feedMetrics.totalProps += props.length;
            const duration = Date.now() - startTime;
            const propsPerSecond = Math.round((props.length / duration) * 1000);
            // Enhanced logging for HOT architecture
            this.logger.info(`✅ HOT/WARM/COLD processing complete in ${duration}ms (${propsPerSecond} props/sec)`);
            this.logger.info(`📊 Results: ${result.rawPropsInserted} to raw_props, ${result.hotTicksInserted} to HOT storage`);
            if (result.steamMovesDetected > 0) {
                this.logger.info(`🌊 Steam detection: ${result.steamMovesDetected} moves detected`);
            }
            if (result.errors.length > 0) {
                this.logger.warn(`⚠️ Processing errors: ${result.errors.length} errors`);
                this.logger.debug('Error details:', result.errors.slice(0, 5)); // Log first 5 errors
            }
            if (result.hotTicksInserted === 0 && props.length > 0) {
                this.logger.warn('⚠️ WARNING: No props written to HOT storage - all were duplicates or errors');
            }
            else if (result.hotTicksInserted > 0) {
                this.logger.info(`🎉 SUCCESS: ${result.hotTicksInserted} new ticks added to HOT storage!`);
            }
            return;
        }
        catch (error) {
            this.logger.error('❌ HOT architecture processing failed, falling back to legacy mode', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Fallback to legacy processing for reliability
            return this.processPropsLegacy(props);
        }
    }
    /**
     * Legacy prop processing method (fallback for HOT architecture failures)
     */
    async processPropsLegacy(props) {
        this.logger.info(`🔄 Processing ${props.length} props with legacy parallel batch insertion...`);
        const startTime = Date.now();
        // Batch size for parallel processing (optimal for Supabase)
        const BATCH_SIZE = 500;
        const MAX_PARALLEL_BATCHES = 5;
        // Split props into batches
        const batches = [];
        for (let i = 0; i < props.length; i += BATCH_SIZE) {
            batches.push(props.slice(i, i + BATCH_SIZE));
        }
        this.logger.info(`📦 Split ${props.length} props into ${batches.length} batches of up to ${BATCH_SIZE} props each`);
        let totalInserted = 0;
        let totalDuplicates = 0;
        let totalErrors = 0;
        // Process batches in parallel chunks
        for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
            const parallelBatches = batches.slice(i, i + MAX_PARALLEL_BATCHES);
            this.logger.info(`🚀 Processing parallel chunk ${Math.floor(i / MAX_PARALLEL_BATCHES) + 1}/${Math.ceil(batches.length / MAX_PARALLEL_BATCHES)} (${parallelBatches.length} batches)`);
            const batchPromises = parallelBatches.map(async (batch, batchIndex) => {
                try {
                    // Use upsert with onConflict to handle duplicates gracefully
                    const { data, error } = await this.supabase
                        .from('raw_props')
                        .upsert(batch, {
                        onConflict: 'id',
                        ignoreDuplicates: true
                    })
                        .select('id');
                    if (error) {
                        // Handle specific error types
                        if (error.code === '23505' || error?.message?.includes('duplicate')) {
                            this.logger.debug(`Batch ${i + batchIndex}: ${batch.length} props contained duplicates`);
                            return { inserted: 0, duplicates: batch.length, errors: 0 };
                        }
                        else {
                            this.logger.error(`Batch ${i + batchIndex} failed:`, {
                                error: error.message,
                                code: error.code,
                                batchSize: batch.length
                            });
                            return { inserted: 0, duplicates: 0, errors: batch.length };
                        }
                    }
                    const insertedCount = data?.length || 0;
                    const duplicateCount = batch.length - insertedCount;
                    this.logger.debug(`Batch ${i + batchIndex}: Inserted ${insertedCount}, Duplicates ${duplicateCount}`);
                    return {
                        inserted: insertedCount,
                        duplicates: duplicateCount,
                        errors: 0
                    };
                }
                catch (error) {
                    this.logger.error(`Batch ${i + batchIndex} exception:`, {
                        err: error instanceof Error ? error.message : String(error),
                        batchSize: batch.length
                    });
                    return { inserted: 0, duplicates: 0, errors: batch.length };
                }
            });
            // Wait for parallel batch to complete
            const results = await Promise.all(batchPromises);
            // Aggregate results
            results.forEach(result => {
                totalInserted += result.inserted;
                totalDuplicates += result.duplicates;
                totalErrors += result.errors;
            });
            // Log progress
            const progress = Math.min(i + MAX_PARALLEL_BATCHES, batches.length);
            const percentage = ((progress / batches.length) * 100).toFixed(1);
            this.logger.info(`📊 Progress: ${percentage}% - Inserted: ${totalInserted}, Duplicates: ${totalDuplicates}, Errors: ${totalErrors}`);
        }
        // Update metrics
        this.feedMetrics.uniqueProps += totalInserted;
        this.feedMetrics.duplicates += totalDuplicates;
        this.feedMetrics.errors += totalErrors;
        this.feedMetrics.totalProps += props.length;
        const duration = Date.now() - startTime;
        const propsPerSecond = Math.round((props.length / duration) * 1000);
        // Final summary
        this.logger.info(`✅ Batch processing complete in ${duration}ms (${propsPerSecond} props/sec)`);
        this.logger.info(`📈 Results: ${totalInserted} inserted, ${totalDuplicates} duplicates, ${totalErrors} errors`);
        if (totalInserted === 0 && props.length > 0) {
            this.logger.warn('⚠️ WARNING: No props were inserted - all were duplicates or errors');
        }
        else if (totalInserted > 0) {
            this.logger.info(`🎉 SUCCESS: ${totalInserted} new props added to database!`);
        }
    }
    transformProps(data, provider) {
        return data.map(item => ({
            // Required fields
            id: crypto.randomUUID(),
            player_name: item.player_name || '',
            sport: item.sport || '',
            team: item.team || '',
            opponent: item.opponent || '',
            stat_type: item.stat_type || item.market || '',
            line: parseFloat(item.line) || 0,
            game_date: item.game_date || new Date().toISOString().split('T')[0],
            matchup: item.matchup || `${item.team} vs ${item.opponent}`,
            // Market and odds fields
            market: item.market || item.stat_type || '',
            market_type: item.market_type || 'player_prop',
            over: parseFloat(item.over_odds) || 0,
            under: parseFloat(item.under_odds) || 0,
            over_odds: parseFloat(item.over_odds) || null,
            under_odds: parseFloat(item.under_odds) || null,
            // Game timing
            game_time: item.game_time || new Date().toISOString(),
            start_time: item.start_time || item.game_time || null,
            // Provider and metadata
            provider: provider?.name || 'unified-router',
            external_id: item.external_id || crypto.randomUUID(),
            external_game_id: item.external_game_id || null,
            game_id: null, // Set to null to avoid foreign key constraint
            sport_key: item.sport_key || item.sport?.toLowerCase(),
            // Data quality and validation
            is_valid: true,
            is_primary: true,
            is_alt_line: false,
            auto_approved: false,
            context_flag: false,
            promoted: false,
            is_promoted: false,
            promoted_to_picks: false,
            steam_detected: false,
            contrarian_opportunity: false,
            is_canary: false,
            needs_review: false,
            // Default numerical fields
            unit_size: 1,
            confidence: 0,
            volatility: 5,
            bid_ask_spread: 0.02,
            data_completeness: 0.95,
            outlier_score: 0.95,
            consistency_score: 0.95,
            data_validation_score: 0.95,
            data_quality_score: 0,
            pro_attempts: 0,
            // Timestamps
            created_at: new Date().toISOString(),
            inserted_at: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
            // Nullable fields that may be populated later
            outcome: null,
            odds: null,
            trend_confidence: null,
            matchup_quality: null,
            line_value_score: null,
            role_stability: null,
            confidence_score: null,
            edge_score: null,
            tier_tag: null,
            source: null,
            bet_type: null,
            outcomes: null,
            player_id: null,
            player_slug: null,
            fair_odds: null,
            league: null,
            promoted_at: null,
            tier: null,
            ev_percent: null,
            trend_score: null,
            matchup_score: null,
            line_score: null,
            role_score: null,
            direction: null,
            unique_key: null,
            event_id: null,
            book: null,
            updated_at: null,
            home_team: null,
            home_team_id: null,
            away_team: null,
            away_team_id: null,
            expected_value: null,
            sharp_money: null,
            line_movement: null,
            player_form: null,
            injury_impact: null,
            best_available_line: null,
            best_book: null,
            public_betting_percentage: null,
            sharp_betting_percentage: null,
            correlation_risk: null,
            weather_impact: null,
            market_intelligence: null,
            volume_profile: null,
            closing_line_value: null,
            predicted_closing_line: null,
            optimal_betting_time: null,
            injury_timing_advantage: null,
            cross_market_arbitrage: null,
            player_fatigue: null,
            venue_advantage: null,
            referee_impact: null,
            pace_impact: null,
            motivational_factors: null,
            portfolio_impact: null,
            metadata: null,
            prop_category: null,
            team_name: null,
            standardized_sport: null,
            standardized_stat: null,
            processed_at: null,
            processing_error: null,
            professional_score: null,
            kelly_fraction: null,
            clv_tracking_id: null
        }));
    }
}
exports.FeedAgent = FeedAgent;
// Export Optimal integration
var optimal_1 = require("./optimal");
Object.defineProperty(exports, "fetchOptimalProps", { enumerable: true, get: function () { return optimal_1.fetchOptimalProps; } });
Object.defineProperty(exports, "getRateLimitStatus", { enumerable: true, get: function () { return optimal_1.getRateLimitStatus; } });
