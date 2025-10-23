/**
 * Intelligent Cache Manager
 * Advanced caching system with predictive prefetching, intelligent invalidation,
 * and performance optimization for production workloads
 */
export interface CacheConfig {
    maxMemoryMB: number;
    defaultTTL: number;
    enablePrefetching: boolean;
    enableCompression: boolean;
    enableMetrics: boolean;
    prefetchThreshold: number;
    compressionThreshold: number;
    cleanupIntervalMs: number;
}
export interface CacheItem<T> {
    value: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    compressed: boolean;
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
}
export interface CacheMetrics {
    totalItems: number;
    memoryUsageMB: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    compressionRatio: number;
    prefetchHitRate: number;
    avgAccessTime: number;
}
export interface PrefetchPattern {
    keyPattern: string;
    accessFrequency: number;
    lastPrefetch: number;
    successRate: number;
}
export declare class IntelligentCacheManager<T = any> {
    private cache;
    private config;
    private metrics;
    private prefetchPatterns;
    private accessLog;
    private cleanupTimer?;
    private prefetchTimer?;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Get item from cache with intelligent access tracking
     */
    get(key: string): Promise<T | null>;
    /**
     * Set item in cache with intelligent optimization
     */
    set(key: string, value: T, options?: {
        ttl?: number;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        tags?: string[];
    }): Promise<void>;
    /**
     * Delete item from cache
     */
    delete(key: string): boolean;
    /**
     * Invalidate cache entries by tags
     */
    invalidateByTags(tags: string[]): number;
    /**
     * Intelligent cache warming based on access patterns
     */
    warmCache(keyValuePairs: Array<{
        key: string;
        value: T;
        options?: any;
    }>): Promise<void>;
    /**
     * Predictive prefetching based on access patterns
     */
    private performPredictivePrefetching;
    /**
     * Analyze access patterns for prefetch opportunities
     */
    private analyzePrefetchOpportunity;
    /**
     * Analyze prefetch patterns
     */
    private analyzePrefetchPatterns;
    /**
     * Execute prefetch for a pattern
     */
    private executePrefetch;
    /**
     * Ensure memory limits are respected
     */
    private ensureMemoryLimits;
    /**
     * Intelligent eviction based on priority, access patterns, and age
     */
    private intelligentEviction;
    /**
     * Calculate eviction score (lower = more likely to evict)
     */
    private calculateEvictionScore;
    /**
     * Record access for metrics and pattern analysis
     */
    private recordAccess;
    /**
     * Update access time metric
     */
    private updateAccessTimeMetric;
    /**
     * Calculate total memory usage
     */
    private calculateTotalMemoryUsage;
    /**
     * Calculate item size (rough estimation)
     */
    private calculateSize;
    /**
     * Compress value (placeholder - implement with actual compression library)
     */
    private compress;
    /**
     * Decompress value (placeholder)
     */
    private decompress;
    /**
     * Update cache metrics
     */
    private updateMetrics;
    /**
     * Start background tasks
     */
    private startBackgroundTasks;
    /**
     * Cleanup expired items
     */
    private cleanupExpired;
    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics;
    /**
     * Get cache statistics
     */
    getStats(): {
        cacheSize: number;
        prefetchPatterns: number;
        accessLogSize: number;
        totalItems: number;
        memoryUsageMB: number;
        hitRate: number;
        missRate: number;
        evictionRate: number;
        compressionRatio: number;
        prefetchHitRate: number;
        avgAccessTime: number;
    };
    /**
     * Shutdown cache manager
     */
    shutdown(): void;
}
export declare function initializeIntelligentCache(config?: Partial<CacheConfig>): IntelligentCacheManager;
export declare function getIntelligentCache(): IntelligentCacheManager | null;
//# sourceMappingURL=intelligentCacheManager.d.ts.map