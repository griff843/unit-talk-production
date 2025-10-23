/**
 * AI Response Caching System
 * Implements intelligent caching for AI model responses with cost optimization
 */
export interface CacheEntry {
    content: string;
    model: string;
    provider: string;
    tokenCount: number;
    cost: number;
    timestamp: Date;
    lastOdds: number;
    contextHash: string;
    hitCount: number;
    expiresAt: Date;
}
export interface CacheKey {
    type: 'advice' | 'recap' | 'formatting';
    propId: string;
    odds: number;
    line?: number;
    contextHash: string;
}
export interface CacheMetrics {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    costSavings: number;
    tokensSaved: number;
    avgResponseTime: number;
}
declare class AIResponseCache {
    private static instance;
    private cache;
    private metrics;
    private readonly DEFAULT_TTL_SEC;
    private readonly REQUERY_BPS_THRESHOLD;
    private constructor();
    static getInstance(): AIResponseCache;
    /**
     * Generate cache key from request parameters
     */
    private generateCacheKey;
    /**
     * Check if cache entry is valid and should be used
     */
    private isValidCacheEntry;
    /**
     * Get cached response if available and valid
     */
    get(cacheKey: CacheKey): CacheEntry | null;
    /**
     * Store response in cache
     */
    set(cacheKey: CacheKey, content: string, model: string, provider: string, tokenCount: number, cost: number): void;
    /**
     * Generate advice cache key with full context
     */
    generateAdviceCacheKey(propId: string, odds: number, line: number | undefined, context: Record<string, any>): CacheKey;
    /**
     * Generate recap cache key
     */
    generateRecapCacheKey(date: string, context: Record<string, any>): CacheKey;
    /**
     * Generate formatting cache key
     */
    generateFormattingCacheKey(contentHash: string, format: string): CacheKey;
    /**
     * Check if requery is needed for advice
     */
    shouldRequeryAdvice(propId: string, currentOdds: number, currentLine: number | undefined, currentContext: Record<string, any>): {
        shouldRequery: boolean;
        reason?: string;
        cachedEntry?: CacheEntry;
    };
    /**
     * Invalidate cache entries by pattern
     */
    invalidateByPattern(pattern: string): number;
    /**
     * Invalidate cache entries for specific prop
     */
    invalidateProp(propId: string): number;
    /**
     * Clean up expired cache entries
     */
    cleanup(): number;
    /**
     * Update hit rate calculation
     */
    private updateHitRate;
    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalEntries: number;
        expiredEntries: number;
        averageHitsPerEntry: number;
        totalSize: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    };
    /**
     * Get entries sorted by hit count (most popular first)
     */
    getPopularEntries(limit?: number): Array<{
        key: string;
        entry: CacheEntry;
    }>;
    /**
     * Log cache metrics for monitoring
     */
    logMetrics(): void;
    /**
     * Export cache data for analysis
     */
    exportCacheData(): Array<{
        key: string;
        entry: CacheEntry;
    }>;
    /**
     * Clear all cache entries
     */
    clear(): number;
    /**
     * Set cache TTL for testing
     */
    setCacheTTL(ttlSeconds: number): void;
}
export declare const aiResponseCache: AIResponseCache;
export {};
//# sourceMappingURL=cache.d.ts.map