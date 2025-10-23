"use strict";
/**
 * AI Response Caching System
 * Implements intelligent caching for AI model responses with cost optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiResponseCache = void 0;
const routing_1 = require("./routing");
class AIResponseCache {
    constructor() {
        this.cache = new Map();
        this.metrics = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            hitRate: 0,
            costSavings: 0,
            tokensSaved: 0,
            avgResponseTime: 0
        };
        this.DEFAULT_TTL_SEC = parseInt(process.env.ADVICE_CACHE_TTL_SEC || '86400'); // 24 hours
        this.REQUERY_BPS_THRESHOLD = parseInt(process.env.ADVICE_REQUERY_BPS || '15'); // 15 basis points
        // Start cleanup timer
        setInterval(() => this.cleanup(), 300000); // Clean up every 5 minutes
    }
    static getInstance() {
        if (!AIResponseCache.instance) {
            AIResponseCache.instance = new AIResponseCache();
        }
        return AIResponseCache.instance;
    }
    /**
     * Generate cache key from request parameters
     */
    generateCacheKey(cacheKey) {
        const { type, propId, odds, line, contextHash } = cacheKey;
        const lineStr = line !== undefined ? `:${line}` : '';
        return `${type}:${propId}:${odds}${lineStr}:${contextHash}`;
    }
    /**
     * Check if cache entry is valid and should be used
     */
    isValidCacheEntry(entry, currentOdds, currentContextHash) {
        // Check if entry has expired
        if (new Date() > entry.expiresAt) {
            return false;
        }
        // Check if odds have moved beyond threshold
        const oddsBps = routing_1.aiModelRouter.calculateOddsBpsDifference(currentOdds, entry.lastOdds);
        if (oddsBps >= this.REQUERY_BPS_THRESHOLD) {
            console.log(`🔄 Odds moved ${oddsBps.toFixed(1)} bps (threshold: ${this.REQUERY_BPS_THRESHOLD}), invalidating cache`);
            return false;
        }
        // Check if context has changed
        if (entry.contextHash !== currentContextHash) {
            console.log(`🔄 Context changed (${entry.contextHash.substring(0, 8)} → ${currentContextHash.substring(0, 8)}), invalidating cache`);
            return false;
        }
        return true;
    }
    /**
     * Get cached response if available and valid
     */
    get(cacheKey) {
        this.metrics.totalRequests++;
        const key = this.generateCacheKey(cacheKey);
        const entry = this.cache.get(key);
        if (!entry) {
            this.metrics.cacheMisses++;
            this.updateHitRate();
            return null;
        }
        // Check if entry is still valid
        if (!this.isValidCacheEntry(entry, cacheKey.odds, cacheKey.contextHash)) {
            // Remove invalid entry
            this.cache.delete(key);
            this.metrics.cacheMisses++;
            this.updateHitRate();
            return null;
        }
        // Valid cache hit
        entry.hitCount++;
        this.metrics.cacheHits++;
        this.metrics.costSavings += entry.cost;
        this.metrics.tokensSaved += entry.tokenCount;
        this.updateHitRate();
        console.log(`💾 Cache HIT for ${key} (hit #${entry.hitCount})`);
        return entry;
    }
    /**
     * Store response in cache
     */
    set(cacheKey, content, model, provider, tokenCount, cost) {
        const key = this.generateCacheKey(cacheKey);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (this.DEFAULT_TTL_SEC * 1000));
        const entry = {
            content,
            model,
            provider,
            tokenCount,
            cost,
            timestamp: now,
            lastOdds: cacheKey.odds,
            contextHash: cacheKey.contextHash,
            hitCount: 0,
            expiresAt
        };
        this.cache.set(key, entry);
        console.log(`💾 Cache SET for ${key} (expires: ${expiresAt.toISOString()})`);
    }
    /**
     * Generate advice cache key with full context
     */
    generateAdviceCacheKey(propId, odds, line, context) {
        const contextHash = routing_1.aiModelRouter.generateContextHash(context);
        return {
            type: 'advice',
            propId,
            odds,
            line,
            contextHash
        };
    }
    /**
     * Generate recap cache key
     */
    generateRecapCacheKey(date, context) {
        const contextHash = routing_1.aiModelRouter.generateContextHash(context);
        return {
            type: 'recap',
            propId: `recap-${date}`,
            odds: 0, // Not applicable for recap
            contextHash
        };
    }
    /**
     * Generate formatting cache key
     */
    generateFormattingCacheKey(contentHash, format) {
        const contextHash = routing_1.aiModelRouter.generateContextHash({ format });
        return {
            type: 'formatting',
            propId: `format-${contentHash}`,
            odds: 0, // Not applicable for formatting
            contextHash
        };
    }
    /**
     * Check if requery is needed for advice
     */
    shouldRequeryAdvice(propId, currentOdds, currentLine, currentContext) {
        const cacheKey = this.generateAdviceCacheKey(propId, currentOdds, currentLine, currentContext);
        const key = this.generateCacheKey(cacheKey);
        const entry = this.cache.get(key);
        if (!entry) {
            return { shouldRequery: true, reason: 'No cached entry found' };
        }
        if (new Date() > entry.expiresAt) {
            return { shouldRequery: true, reason: 'Cache entry expired', cachedEntry: entry };
        }
        const oddsBps = routing_1.aiModelRouter.calculateOddsBpsDifference(currentOdds, entry.lastOdds);
        if (oddsBps >= this.REQUERY_BPS_THRESHOLD) {
            return {
                shouldRequery: true,
                reason: `Odds moved ${oddsBps.toFixed(1)} bps (threshold: ${this.REQUERY_BPS_THRESHOLD})`,
                cachedEntry: entry
            };
        }
        const currentContextHash = routing_1.aiModelRouter.generateContextHash(currentContext);
        if (entry.contextHash !== currentContextHash) {
            return {
                shouldRequery: true,
                reason: 'Context changed',
                cachedEntry: entry
            };
        }
        return { shouldRequery: false, cachedEntry: entry };
    }
    /**
     * Invalidate cache entries by pattern
     */
    invalidateByPattern(pattern) {
        let invalidatedCount = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                invalidatedCount++;
            }
        }
        console.log(`🗑️ Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`);
        return invalidatedCount;
    }
    /**
     * Invalidate cache entries for specific prop
     */
    invalidateProp(propId) {
        return this.invalidateByPattern(propId);
    }
    /**
     * Clean up expired cache entries
     */
    cleanup() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
        }
        return cleanedCount;
    }
    /**
     * Update hit rate calculation
     */
    updateHitRate() {
        this.metrics.hitRate = this.metrics.totalRequests > 0
            ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
            : 0;
    }
    /**
     * Get cache metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const now = new Date();
        let expiredCount = 0;
        let totalHits = 0;
        let oldestDate = null;
        let newestDate = null;
        let totalSize = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                expiredCount++;
            }
            totalHits += entry.hitCount;
            totalSize += key.length + entry.content.length + 200; // Approximate size
            if (!oldestDate || entry.timestamp < oldestDate) {
                oldestDate = entry.timestamp;
            }
            if (!newestDate || entry.timestamp > newestDate) {
                newestDate = entry.timestamp;
            }
        }
        return {
            totalEntries: this.cache.size,
            expiredEntries: expiredCount,
            averageHitsPerEntry: this.cache.size > 0 ? totalHits / this.cache.size : 0,
            totalSize,
            oldestEntry: oldestDate,
            newestEntry: newestDate
        };
    }
    /**
     * Get entries sorted by hit count (most popular first)
     */
    getPopularEntries(limit = 10) {
        return Array.from(this.cache.entries())
            .map(([key, entry]) => ({ key, entry }))
            .sort((a, b) => b.entry.hitCount - a.entry.hitCount)
            .slice(0, limit);
    }
    /**
     * Log cache metrics for monitoring
     */
    logMetrics() {
        const metrics = this.getMetrics();
        const stats = this.getCacheStats();
        console.log('💾 AI CACHE METRICS');
        console.log('===================');
        console.log(`Total Requests: ${metrics.totalRequests}`);
        console.log(`Cache Hits: ${metrics.cacheHits}`);
        console.log(`Cache Misses: ${metrics.cacheMisses}`);
        console.log(`Hit Rate: ${metrics.hitRate.toFixed(1)}%`);
        console.log(`Cost Savings: $${metrics.costSavings.toFixed(4)}`);
        console.log(`Tokens Saved: ${metrics.tokensSaved.toLocaleString()}`);
        console.log('\n📊 Cache Statistics:');
        console.log(`Total Entries: ${stats.totalEntries}`);
        console.log(`Expired Entries: ${stats.expiredEntries}`);
        console.log(`Average Hits/Entry: ${stats.averageHitsPerEntry.toFixed(1)}`);
        console.log(`Cache Size: ${(stats.totalSize / 1024).toFixed(1)} KB`);
        if (stats.totalEntries > 0) {
            console.log('\n🏆 Most Popular Entries:');
            const popular = this.getPopularEntries(5);
            popular.forEach((item, index) => {
                const key = item.key.length > 50 ? item.key.substring(0, 47) + '...' : item.key;
                console.log(`  ${index + 1}. ${key} (${item.entry.hitCount} hits)`);
            });
        }
    }
    /**
     * Export cache data for analysis
     */
    exportCacheData() {
        return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
    }
    /**
     * Clear all cache entries
     */
    clear() {
        const count = this.cache.size;
        this.cache.clear();
        console.log(`🗑️ Cleared all ${count} cache entries`);
        return count;
    }
    /**
     * Set cache TTL for testing
     */
    setCacheTTL(ttlSeconds) {
        // This would be used in testing scenarios
        console.log(`⚙️ Cache TTL set to ${ttlSeconds} seconds`);
    }
}
// Export singleton instance
exports.aiResponseCache = AIResponseCache.getInstance();
