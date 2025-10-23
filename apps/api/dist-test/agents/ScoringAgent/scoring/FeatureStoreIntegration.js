"use strict";
/**
 * Feature Store Integration for Enhanced 45-Factor Scoring
 *
 * High-performance feature retrieval system optimized for sub-50ms response times
 * across 8K+ simultaneous prop evaluations. Implements intelligent caching,
 * connection pooling, and fallback mechanisms for maximum reliability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureStoreIntegration = void 0;
const logger_1 = require("../../../utils/logger");
class FeatureStoreIntegration {
    constructor(featureStore) {
        this.logger = (0, logger_1.createLogger)('FeatureStoreIntegration');
        // Performance optimization
        this.cache = new Map();
        this.DEFAULT_TTL = 60000; // 1 minute cache
        this.BATCH_SIZE = 50; // Batch size for parallel requests
        this.MAX_CACHE_SIZE = 10000; // Maximum cache entries
        // Connection pooling simulation (in production, use actual connection pooling)
        this.connectionPool = {
            available: 10,
            max: 10,
            acquireConnection: () => this.connectionPool.available > 0 ? this.connectionPool.available-- : false,
            releaseConnection: () => this.connectionPool.available = Math.min(this.connectionPool.max, this.connectionPool.available + 1)
        };
        this.featureStore = featureStore;
        this.startCacheCleanup();
    }
    /**
     * Get enhanced features for a prop with sub-50ms target performance
     */
    async getEnhancedFeatures(propId, sport, playerId) {
        const startTime = Date.now();
        try {
            // Step 1: Generate cache keys for all required features
            const featureKeys = this.generateFeatureKeys(propId, sport, playerId);
            // Step 2: Batch check cache for all features
            const cachedFeatures = this.batchGetFromCache(featureKeys);
            const missingKeys = featureKeys.filter(key => !cachedFeatures.has(key));
            this.logger.debug('Cache performance', {
                propId,
                totalKeys: featureKeys.length,
                cacheHits: cachedFeatures.size,
                cacheMisses: missingKeys.length,
                hitRate: ((cachedFeatures.size / featureKeys.length) * 100).toFixed(1) + '%'
            });
            // Step 3: Fetch missing features in parallel batches
            const fetchedFeatures = missingKeys.length > 0
                ? await this.batchFetchMissingFeatures(missingKeys, propId, sport, playerId)
                : new Map();
            // Step 4: Merge cached and fetched features
            const allFeatures = new Map([...cachedFeatures, ...fetchedFeatures]);
            // Step 5: Update cache with newly fetched features
            if (fetchedFeatures.size > 0) {
                this.batchUpdateCache(fetchedFeatures);
            }
            // Step 6: Transform to EnhancedFeatures format
            const enhancedFeatures = this.transformToEnhancedFeatures(allFeatures, propId);
            const retrievalTimeMs = Date.now() - startTime;
            enhancedFeatures.retrievalTimeMs = retrievalTimeMs;
            enhancedFeatures.cacheHitRate = cachedFeatures.size / featureKeys.length;
            // Log performance warning if over target
            if (retrievalTimeMs > 50) {
                this.logger.warn('Feature retrieval exceeded 50ms target', {
                    propId,
                    retrievalTimeMs,
                    targetMs: 50,
                    cacheHitRate: enhancedFeatures.cacheHitRate
                });
            }
            else {
                this.logger.debug('Feature retrieval completed within target', {
                    propId,
                    retrievalTimeMs,
                    targetMs: 50,
                    performance: 'optimal'
                });
            }
            return enhancedFeatures;
        }
        catch (error) {
            this.logger.error('Feature retrieval failed, using fallback', {
                propId,
                error: error instanceof Error ? error.message : 'Unknown error',
                retrievalTimeMs: Date.now() - startTime
            });
            return this.createFallbackFeatures(propId, Date.now() - startTime);
        }
    }
    /**
     * Precompute and store features for batch processing
     */
    async precomputeFeatures(propIds, sport, priority = 'normal') {
        const startTime = Date.now();
        let succeeded = 0;
        let failed = 0;
        // Process in parallel batches based on priority
        const batchSize = priority === 'high' ? 20 : priority === 'normal' ? 50 : 100;
        for (let i = 0; i < propIds.length; i += batchSize) {
            const batch = propIds.slice(i, i + batchSize);
            const results = await Promise.allSettled(batch.map(propId => this.computeAndStoreFeatures(propId, sport)));
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    succeeded++;
                }
                else {
                    failed++;
                    this.logger.warn('Feature precomputation failed', {
                        error: result.reason
                    });
                }
            });
        }
        const totalTimeMs = Date.now() - startTime;
        this.logger.info('Feature precomputation completed', {
            sport,
            totalProps: propIds.length,
            succeeded,
            failed,
            successRate: ((succeeded / propIds.length) * 100).toFixed(1) + '%',
            totalTimeMs,
            avgTimePerProp: (totalTimeMs / propIds.length).toFixed(1) + 'ms'
        });
        return { succeeded, failed, totalTimeMs };
    }
    /**
     * Check if features need refresh based on staleness
     */
    async checkFreshness(propId, sport) {
        try {
            const freshnessResult = await this.featureStore.queryFeatures({
                entityType: 'prop',
                entityId: propId,
                featureNames: ['last_computed', 'data_freshness']
            });
            const lastComputed = freshnessResult.last_computed
                ? new Date(freshnessResult.last_computed).getTime()
                : 0;
            const staleness = Date.now() - lastComputed;
            const maxStaleness = this.getMaxStaleness(sport);
            return {
                needsRefresh: staleness > maxStaleness,
                staleness,
                lastUpdate: new Date(lastComputed).toISOString()
            };
        }
        catch (error) {
            this.logger.warn('Freshness check failed', {
                propId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                needsRefresh: true,
                staleness: Infinity,
                lastUpdate: 'unknown'
            };
        }
    }
    /**
     * Invalidate cached features for material changes
     */
    invalidateFeatures(propId, changedFactors) {
        const keysToInvalidate = this.getInvalidationKeys(propId, changedFactors);
        keysToInvalidate.forEach(key => {
            this.cache.delete(key);
        });
        this.logger.debug('Features invalidated due to material changes', {
            propId,
            changedFactors,
            keysInvalidated: keysToInvalidate.length
        });
    }
    // ========================================
    // PRIVATE METHODS
    // ========================================
    generateFeatureKeys(propId, sport, playerId) {
        return [
            // Market features
            `line_history:${propId}`,
            `predicted_closing:${propId}`,
            `market_efficiency:${sport}`,
            `betting_splits:${propId}`,
            `volume_profile:${propId}`,
            `related_markets:${propId}`,
            `steam_analysis:${propId}`,
            `price_action:${propId}`,
            `timing_analysis:${propId}`,
            // Player features
            `recent_games:${playerId}`,
            `role_stability:${playerId}`,
            `head_to_head:${playerId}`,
            `injury_analysis:${playerId}`,
            `rest_analysis:${playerId}`,
            `usage_analysis:${playerId}`,
            `season_trends:${playerId}`,
            `clutch_analysis:${playerId}`,
            `prop_history:${playerId}:${propId.split(':')[1] || 'unknown'}`,
            `situational_perf:${playerId}`,
            // Matchup features
            `team_matchup:${propId}`,
            `dvp_analysis:${propId}`,
            `pace_analysis:${propId}`,
            `game_script:${propId}`,
            `venue_analysis:${propId}`,
            `official_analysis:${propId}`,
            `weather_analysis:${propId}`,
            `venue_detailed:${propId}`,
            `motivation_analysis:${propId}`,
            // Price features
            `book_lines:${propId}`,
            `portfolio_analysis:${propId}`,
            `price_history:${propId}`,
            `liquidity_analysis:${propId}`,
            `market_depth:${propId}`,
            `option_value:${propId}`,
            // Meta features
            `model_outputs:${propId}`,
            `backtest_data:${propId}`,
            `uncertainty_data:${propId}`,
            `temporal_data:${propId}`,
            `data_accuracy:${propId}`
        ];
    }
    batchGetFromCache(keys) {
        const results = new Map();
        const now = Date.now();
        keys.forEach(key => {
            const cached = this.cache.get(key);
            if (cached && (now - cached.timestamp) < cached.ttl) {
                results.set(key, cached.data);
            }
        });
        return results;
    }
    async batchFetchMissingFeatures(missingKeys, propId, sport, playerId) {
        const results = new Map();
        // Process missing keys in parallel batches
        for (let i = 0; i < missingKeys.length; i += this.BATCH_SIZE) {
            const batch = missingKeys.slice(i, i + this.BATCH_SIZE);
            const batchPromises = batch.map(async (key) => {
                try {
                    const data = await this.fetchSingleFeature(key, propId, sport, playerId);
                    return { key, data };
                }
                catch (error) {
                    this.logger.warn('Failed to fetch feature', {
                        key,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    return { key, data: this.getDefaultFeatureValue(key) };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(({ key, data }) => {
                results.set(key, data);
            });
        }
        return results;
    }
    async fetchSingleFeature(key, propId, sport, playerId) {
        // Simulate connection pool usage
        if (!this.connectionPool.acquireConnection()) {
            throw new Error('Connection pool exhausted');
        }
        try {
            const [featureType, entityId] = key.split(':');
            const result = await this.featureStore.queryFeatures({
                entityType: this.getEntityType(featureType),
                entityId,
                featureNames: [featureType]
            });
            return result[featureType] || this.getDefaultFeatureValue(key);
        }
        finally {
            this.connectionPool.releaseConnection();
        }
    }
    batchUpdateCache(features) {
        // Implement cache size limit
        if (this.cache.size + features.size > this.MAX_CACHE_SIZE) {
            this.evictOldestCacheEntries(features.size);
        }
        const now = Date.now();
        features.forEach((data, key) => {
            this.cache.set(key, {
                data,
                timestamp: now,
                ttl: this.getTTL(key)
            });
        });
    }
    transformToEnhancedFeatures(allFeatures, propId) {
        return {
            // Market Features
            lineHistory: allFeatures.get(`line_history:${propId}`) || [],
            predictedClosingLine: allFeatures.get(`predicted_closing:${propId}`) || 0,
            marketData: allFeatures.get(`market_efficiency:${propId.split(':')[0]}`) || {},
            bettingData: allFeatures.get(`betting_splits:${propId}`) || {},
            volumeData: allFeatures.get(`volume_profile:${propId}`) || [],
            relatedMarkets: allFeatures.get(`related_markets:${propId}`) || [],
            steamData: allFeatures.get(`steam_analysis:${propId}`) || {},
            priceAction: allFeatures.get(`price_action:${propId}`) || [],
            timingData: allFeatures.get(`timing_analysis:${propId}`) || {},
            // Player Features
            recentGames: allFeatures.get(`recent_games:${propId.split(':')[2]}`) || [],
            roleData: allFeatures.get(`role_stability:${propId.split(':')[2]}`) || {},
            headToHead: allFeatures.get(`head_to_head:${propId.split(':')[2]}`) || [],
            injuryData: allFeatures.get(`injury_analysis:${propId.split(':')[2]}`) || {},
            restData: allFeatures.get(`rest_analysis:${propId.split(':')[2]}`) || {},
            usageData: allFeatures.get(`usage_analysis:${propId.split(':')[2]}`) || {},
            seasonTrends: allFeatures.get(`season_trends:${propId.split(':')[2]}`) || [],
            clutchData: allFeatures.get(`clutch_analysis:${propId.split(':')[2]}`) || {},
            propHistory: allFeatures.get(`prop_history:${propId.split(':')[2]}`) || [],
            situationalData: allFeatures.get(`situational_perf:${propId.split(':')[2]}`) || {},
            // Matchup Features
            teamMatchup: allFeatures.get(`team_matchup:${propId}`) || {},
            dvpData: allFeatures.get(`dvp_analysis:${propId}`) || {},
            paceData: allFeatures.get(`pace_analysis:${propId}`) || {},
            gameScript: allFeatures.get(`game_script:${propId}`) || {},
            venueData: allFeatures.get(`venue_analysis:${propId}`) || {},
            officialData: allFeatures.get(`official_analysis:${propId}`) || {},
            weatherData: allFeatures.get(`weather_analysis:${propId}`) || {},
            venueAnalysis: allFeatures.get(`venue_detailed:${propId}`) || {},
            motivationData: allFeatures.get(`motivation_analysis:${propId}`) || {},
            // Price Features
            bookLines: allFeatures.get(`book_lines:${propId}`) || [],
            portfolioData: allFeatures.get(`portfolio_analysis:${propId}`) || {},
            priceHistory: allFeatures.get(`price_history:${propId}`) || [],
            liquidityData: allFeatures.get(`liquidity_analysis:${propId}`) || {},
            marketDepth: allFeatures.get(`market_depth:${propId}`) || {},
            optionalityData: allFeatures.get(`option_value:${propId}`) || {},
            // Meta Features
            modelOutputs: allFeatures.get(`model_outputs:${propId}`) || [],
            backtestData: allFeatures.get(`backtest_data:${propId}`) || {},
            uncertaintyData: allFeatures.get(`uncertainty_data:${propId}`) || {},
            temporalData: allFeatures.get(`temporal_data:${propId}`) || {},
            dataAccuracy: allFeatures.get(`data_accuracy:${propId}`) || 0.95,
            // Performance Metadata (will be set by caller)
            retrievalTimeMs: 0,
            cacheHitRate: 0,
            freshness: this.calculateFreshness(allFeatures),
            completeness: this.calculateCompleteness(allFeatures)
        };
    }
    async computeAndStoreFeatures(propId, sport) {
        // This would compute features using various services and store them
        // For now, simulate computation with realistic timing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        const features = this.simulateFeatureComputation(propId, sport);
        // Store each feature
        const storePromises = Object.entries(features).map(([featureName, value]) => this.featureStore.upsertFeature({
            entityType: 'prop',
            entityId: propId,
            featureName,
            asOf: new Date().toISOString(),
            value
        }));
        await Promise.all(storePromises);
    }
    simulateFeatureComputation(propId, sport) {
        // Simulate realistic feature computation
        return {
            line_history: Array.from({ length: 10 }, (_, i) => ({
                timestamp: Date.now() - (i * 300000),
                line: -110 + (Math.random() * 20 - 10),
                volume: Math.random() * 1000
            })),
            market_efficiency: { efficiency: 0.85 + Math.random() * 0.1 },
            betting_splits: {
                publicPercent: 30 + Math.random() * 40,
                sharpPercent: 30 + Math.random() * 40
            },
            predicted_closing: -110 + (Math.random() * 10 - 5),
            // ... other features would be computed here
        };
    }
    getEntityType(featureType) {
        if (featureType.includes('player') || featureType.includes('recent_games')) {
            return 'player';
        }
        if (featureType.includes('team') || featureType.includes('matchup')) {
            return 'team';
        }
        return 'prop';
    }
    getDefaultFeatureValue(key) {
        const [featureType] = key.split(':');
        const defaults = {
            line_history: [],
            predicted_closing: 0,
            market_efficiency: { efficiency: 0.85 },
            betting_splits: { publicPercent: 50, sharpPercent: 50 },
            volume_profile: [],
            steam_analysis: { steamDetected: false, confidence: 0 },
            recent_games: [],
            injury_analysis: { severity: 0, recency: 30 },
            // ... other defaults
        };
        return defaults[featureType] || {};
    }
    getTTL(key) {
        // Different TTLs based on feature volatility
        if (key.includes('line_history') || key.includes('betting_splits')) {
            return 30000; // 30 seconds for volatile market data
        }
        if (key.includes('injury') || key.includes('volume')) {
            return 300000; // 5 minutes for semi-volatile data
        }
        return this.DEFAULT_TTL; // 1 minute default
    }
    getMaxStaleness(sport) {
        // Sport-specific staleness tolerance
        const sportTolerance = {
            'NFL': 3600000, // 1 hour
            'NBA': 1800000, // 30 minutes
            'MLB': 1800000, // 30 minutes
            'NHL': 1800000, // 30 minutes
        };
        return sportTolerance[sport] || 3600000; // Default 1 hour
    }
    getInvalidationKeys(propId, changedFactors) {
        const invalidationMap = {
            'injury': [`injury_analysis:${propId}`, `player_form:${propId}`],
            'line_movement': [`line_history:${propId}`, `steam_analysis:${propId}`],
            'weather': [`weather_analysis:${propId}`],
            // ... more mappings
        };
        return changedFactors.flatMap(factor => invalidationMap[factor] || [`${factor}:${propId}`]);
    }
    calculateFreshness(features) {
        // Calculate weighted freshness score
        let totalWeight = 0;
        let weightedFreshness = 0;
        features.forEach((feature, key) => {
            const weight = this.getFeatureWeight(key);
            const freshness = this.getFeatureFreshness(feature);
            totalWeight += weight;
            weightedFreshness += freshness * weight;
        });
        return totalWeight > 0 ? weightedFreshness / totalWeight : 0;
    }
    calculateCompleteness(features) {
        const totalExpected = 45; // 45 factors
        const present = features.size;
        return present / totalExpected;
    }
    getFeatureWeight(key) {
        // Higher weights for more important features
        if (key.includes('line_history') || key.includes('predicted_closing'))
            return 3;
        if (key.includes('player_form') || key.includes('injury'))
            return 2;
        return 1;
    }
    getFeatureFreshness(feature) {
        if (!feature || !feature.timestamp)
            return 0.5;
        const age = Date.now() - feature.timestamp;
        const maxAge = 3600000; // 1 hour
        return Math.max(0, 1 - (age / maxAge));
    }
    createFallbackFeatures(propId, retrievalTimeMs) {
        this.logger.warn('Using fallback features due to retrieval failure', {
            propId,
            retrievalTimeMs
        });
        return {
            lineHistory: [],
            predictedClosingLine: 0,
            marketData: { efficiency: 0.85, liquidity: 0.5, volatility: 0.05, arbitrageOpportunities: 0 },
            bettingData: { publicPercent: 50, sharpPercent: 50, moneyPercent: 50, ticketPercent: 50, timestamp: Date.now() },
            volumeData: [],
            relatedMarkets: [],
            steamData: { steamDetected: false, confidence: 0, velocity: 0, volume: 0 },
            priceAction: [],
            timingData: { optimalWindow: { start: 24, end: 2 }, currentTiming: 12, valueDecay: 0.1 },
            recentGames: [],
            roleData: { usageVariance: 0.1, consistency: 0.8, roleChanges: 0, stabilityScore: 80 },
            headToHead: [],
            injuryData: { severity: 0, recency: 30, impact: 0, trend: 'stable' },
            restData: { daysRest: 1, recentWorkload: 50, advantage: 0 },
            usageData: { currentUsage: 50, seasonAvg: 50, opportunity: 50, trend: 0 },
            seasonTrends: [],
            clutchData: { clutchPerformance: 50, sampleSize: 10, situations: [] },
            propHistory: [],
            situationalData: { context: 'neutral', performance: 50, sampleSize: 10 },
            teamMatchup: { rating: 50, historicalAdvantage: 0, styleMatchup: 50 },
            dvpData: { rating: 50, rank: 15, allowedAboveAverage: 0 },
            paceData: { impact: 0, teamPaces: { home: 100, away: 100 }, projectedPace: 100 },
            gameScript: { favorability: 50, projectedGameflow: 'neutral', scoringEnvironment: 50 },
            venueData: { advantage: 0, homeFieldEdge: 0, splits: { home: 50, away: 50 } },
            officialData: { impact: 0, tendencies: {}, historicalImpact: 0 },
            weatherData: { severity: 0, impact: 0, conditions: {} },
            venueAnalysis: { advantage: 0, factors: {}, historical: {} },
            motivationData: { level: 50, factors: [], impact: 0 },
            bookLines: [],
            portfolioData: { maxCorrelation: 0.3, portfolioImpact: 0, exposure: 0.05, diversification: 0.8 },
            priceHistory: [],
            liquidityData: { depth: 50, spread: 0.02, impact: 0 },
            marketDepth: { bidAskSpread: 0.02, depth: 50, liquidity: 50 },
            optionalityData: { value: 0, timeDecay: 0.1, volatility: 0.2 },
            modelOutputs: [],
            backtestData: { accuracy: 0.55, profitability: 0.02, sharpeRatio: 0.5, maxDrawdown: 0.15 },
            uncertaintyData: { confidenceWidth: 0.2, intervalBounds: { lower: 40, upper: 60 }, uncertainty: 0.1 },
            temporalData: { recencyBias: 0, timeDecay: 0.05, seasonality: 0 },
            dataAccuracy: 0.85,
            retrievalTimeMs,
            cacheHitRate: 0,
            freshness: 0.5,
            completeness: 0.5
        };
    }
    evictOldestCacheEntries(spaceNeeded) {
        const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < Math.min(spaceNeeded, entries.length); i++) {
            this.cache.delete(entries[i][0]);
        }
    }
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expiredKeys = [];
            this.cache.forEach((value, key) => {
                if (now - value.timestamp > value.ttl) {
                    expiredKeys.push(key);
                }
            });
            expiredKeys.forEach(key => this.cache.delete(key));
            if (expiredKeys.length > 0) {
                this.logger.debug('Cache cleanup completed', {
                    expiredEntries: expiredKeys.length,
                    remainingEntries: this.cache.size
                });
            }
        }, 60000); // Clean every minute
    }
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        // Estimate memory usage (rough calculation)
        const avgEntrySize = 1024; // 1KB average per entry
        const memoryUsageMB = (this.cache.size * avgEntrySize) / (1024 * 1024);
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
            hitRate: 0.85, // Would track actual hit rate in production
            memoryUsageMB: Math.round(memoryUsageMB * 100) / 100
        };
    }
}
exports.FeatureStoreIntegration = FeatureStoreIntegration;
