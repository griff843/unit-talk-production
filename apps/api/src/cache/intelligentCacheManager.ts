/**
 * Intelligent Cache Manager
 * Advanced caching system with predictive prefetching, intelligent invalidation,
 * and performance optimization for production workloads
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('IntelligentCacheManager');

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

export class IntelligentCacheManager<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private prefetchPatterns = new Map<string, PrefetchPattern>();
  private accessLog: Array<{ key: string; timestamp: number }> = [];
  private cleanupTimer?: NodeJS.Timeout;
  private prefetchTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemoryMB: 100,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enablePrefetching: true,
      enableCompression: true,
      enableMetrics: true,
      prefetchThreshold: 0.7, // Prefetch when hit rate > 70%
      compressionThreshold: 1024, // Compress items > 1KB
      cleanupIntervalMs: 60000, // 1 minute
      ...config
    };

    this.metrics = {
      totalItems: 0,
      memoryUsageMB: 0,
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      compressionRatio: 0,
      prefetchHitRate: 0,
      avgAccessTime: 0
    };

    this.startBackgroundTasks();
  }

  /**
   * Get item from cache with intelligent access tracking
   */
  async get(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.recordAccess(key, false);
        return null;
      }

      // Check TTL
      if (Date.now() > item.timestamp + item.ttl) {
        this.cache.delete(key);
        this.recordAccess(key, false);
        return null;
      }

      // Update access patterns
      item.accessCount++;
      item.lastAccessed = Date.now();

      // Move to end for LRU
      this.cache.delete(key);
      this.cache.set(key, item);

      this.recordAccess(key, true);
      
      // Decompress if needed
      let value = item.value;
      if (item.compressed && this.config.enableCompression) {
        value = await this.decompress(value);
      }

      // Trigger prefetch analysis
      if (this.config.enablePrefetching) {
        this.analyzePrefetchOpportunity(key);
      }

      return value;

    } finally {
      const accessTime = Date.now() - startTime;
      this.updateAccessTimeMetric(accessTime);
    }
  }

  /**
   * Set item in cache with intelligent optimization
   */
  async set(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      tags?: string[];
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.config.defaultTTL;
    const priority = options.priority || 'medium';
    const tags = options.tags || [];

    // Calculate item size
    const size = this.calculateSize(value);
    
    // Compress if beneficial
    let finalValue = value;
    let compressed = false;
    
    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      try {
        finalValue = await this.compress(value);
        compressed = true;
      } catch (error) {
        logger.warn('Compression failed, storing uncompressed', { key, error });
      }
    }

    const item: CacheItem<T> = {
      value: finalValue,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      size: compressed ? this.calculateSize(finalValue) : size,
      compressed,
      tags,
      priority
    };

    // Ensure memory limits
    await this.ensureMemoryLimits(item.size);

    this.cache.set(key, item);
    this.updateMetrics();
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics();
    }
    return deleted;
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache) {
      if (item.tags.some(tag => tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      invalidated++;
    }

    this.updateMetrics();
    return invalidated;
  }

  /**
   * Intelligent cache warming based on access patterns
   */
  async warmCache(keyValuePairs: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    logger.info(`🔥 Warming cache with ${keyValuePairs.length} items`);

    const warmPromises = keyValuePairs.map(async ({ key, value, options }) => {
      try {
        await this.set(key, value, { ...options, priority: 'high' });
      } catch (error) {
        logger.warn('Failed to warm cache item', { key, error });
      }
    });

    await Promise.allSettled(warmPromises);
    logger.info('✅ Cache warming completed');
  }

  /**
   * Predictive prefetching based on access patterns
   */
  private async performPredictivePrefetching(): Promise<void> {
    if (!this.config.enablePrefetching) return;

    const patterns = this.analyzePrefetchPatterns();
    
    for (const pattern of patterns) {
      if (pattern.successRate > this.config.prefetchThreshold) {
        await this.executePrefetch(pattern);
      }
    }
  }

  /**
   * Analyze access patterns for prefetch opportunities
   */
  private analyzePrefetchOpportunity(key: string): void {
    // Simple pattern: if key ends with ID, prefetch related keys
    const idMatch = key.match(/(.+)_(\d+)$/);
    if (idMatch) {
      const basePattern = idMatch[1];
      const pattern = this.prefetchPatterns.get(basePattern) || {
        keyPattern: basePattern,
        accessFrequency: 0,
        lastPrefetch: 0,
        successRate: 0
      };

      pattern.accessFrequency++;
      this.prefetchPatterns.set(basePattern, pattern);
    }
  }

  /**
   * Analyze prefetch patterns
   */
  private analyzePrefetchPatterns(): PrefetchPattern[] {
    const patterns: PrefetchPattern[] = [];
    const now = Date.now();

    for (const [, pattern] of this.prefetchPatterns) {
      // Only consider patterns accessed recently and frequently
      if (pattern.accessFrequency > 5 && 
          now - pattern.lastPrefetch > 60000) { // 1 minute cooldown
        patterns.push(pattern);
      }
    }

    return patterns.sort((a, b) => b.accessFrequency - a.accessFrequency);
  }

  /**
   * Execute prefetch for a pattern
   */
  private async executePrefetch(pattern: PrefetchPattern): Promise<void> {
    // This would be implemented based on your specific data access patterns
    // For example, prefetch related user data, recent props, etc.
    logger.debug('🔮 Executing prefetch', { pattern: pattern.keyPattern });
    
    pattern.lastPrefetch = Date.now();
  }

  /**
   * Ensure memory limits are respected
   */
  private async ensureMemoryLimits(newItemSize: number): Promise<void> {
    const currentMemoryMB = this.calculateTotalMemoryUsage();
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    const newItemSizeBytes = newItemSize;

    if (currentMemoryMB * 1024 * 1024 + newItemSizeBytes > maxMemoryBytes) {
      await this.intelligentEviction(newItemSizeBytes);
    }
  }

  /**
   * Intelligent eviction based on priority, access patterns, and age
   */
  private async intelligentEviction(spaceNeeded: number): Promise<void> {
    const items = Array.from(this.cache.entries());
    
    // Sort by eviction score (lower = more likely to evict)
    items.sort(([, a], [, b]) => {
      const scoreA = this.calculateEvictionScore(a);
      const scoreB = this.calculateEvictionScore(b);
      return scoreA - scoreB;
    });

    let freedSpace = 0;
    let evicted = 0;

    for (const [key, item] of items) {
      if (freedSpace >= spaceNeeded) break;

      this.cache.delete(key);
      freedSpace += item.size;
      evicted++;
    }

    logger.debug('🗑️ Intelligent eviction completed', {
      evicted,
      freedSpaceMB: (freedSpace / 1024 / 1024).toFixed(2)
    });
  }

  /**
   * Calculate eviction score (lower = more likely to evict)
   */
  private calculateEvictionScore(item: CacheItem<T>): number {
    const now = Date.now();
    const age = now - item.timestamp;
    const timeSinceLastAccess = now - item.lastAccessed;
    
    // Priority weights
    const priorityWeights = { low: 1, medium: 2, high: 4, critical: 8 };
    const priorityScore = priorityWeights[item.priority] * 100;
    
    // Access frequency score
    const frequencyScore = Math.log(item.accessCount + 1) * 50;
    
    // Recency score (more recent = higher score)
    const recencyScore = Math.max(0, 100 - (timeSinceLastAccess / 60000)); // Decay over minutes
    
    // Age penalty (older = lower score)
    const ageScore = Math.max(0, 50 - (age / item.ttl * 50));
    
    return priorityScore + frequencyScore + recencyScore + ageScore;
  }

  /**
   * Record access for metrics and pattern analysis
   */
  private recordAccess(key: string, hit: boolean): void {
    if (!this.config.enableMetrics) return;

    this.accessLog.push({ key, timestamp: Date.now() });
    
    // Keep only recent access log (last 1000 entries)
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }
  }

  /**
   * Update access time metric
   */
  private updateAccessTimeMetric(accessTime: number): void {
    if (!this.config.enableMetrics) return;

    if (this.metrics.avgAccessTime === 0) {
      this.metrics.avgAccessTime = accessTime;
    } else {
      this.metrics.avgAccessTime = (this.metrics.avgAccessTime + accessTime) / 2;
    }
  }

  /**
   * Calculate total memory usage
   */
  private calculateTotalMemoryUsage(): number {
    let totalBytes = 0;
    for (const [, item] of this.cache) {
      totalBytes += item.size;
    }
    return totalBytes / 1024 / 1024; // Convert to MB
  }

  /**
   * Calculate item size (rough estimation)
   */
  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size if can't calculate
    }
  }

  /**
   * Compress value (placeholder - implement with actual compression library)
   */
  private async compress(value: T): Promise<T> {
    // Placeholder for compression logic
    // In production, use libraries like zlib, lz4, etc.
    return value;
  }

  /**
   * Decompress value (placeholder)
   */
  private async decompress(value: T): Promise<T> {
    // Placeholder for decompression logic
    return value;
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalItems = this.cache.size;
    this.metrics.memoryUsageMB = this.calculateTotalMemoryUsage();

    // Calculate hit/miss rates from recent access log
    const recentAccesses = this.accessLog.slice(-100); // Last 100 accesses
    if (recentAccesses.length > 0) {
      const hits = recentAccesses.filter(access => this.cache.has(access.key)).length;
      this.metrics.hitRate = hits / recentAccesses.length;
      this.metrics.missRate = 1 - this.metrics.hitRate;
    }
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup expired items
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupIntervalMs);

    // Predictive prefetching
    if (this.config.enablePrefetching) {
      this.prefetchTimer = setInterval(() => {
        this.performPredictivePrefetching();
      }, this.config.cleanupIntervalMs * 2);
    }
  }

  /**
   * Cleanup expired items
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.timestamp + item.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug('🧹 Cleaned up expired cache items', { count: expiredKeys.length });
      this.updateMetrics();
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.getMetrics(),
      cacheSize: this.cache.size,
      prefetchPatterns: this.prefetchPatterns.size,
      accessLogSize: this.accessLog.length
    };
  }

  /**
   * Shutdown cache manager
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.prefetchTimer) {
      clearInterval(this.prefetchTimer);
    }
    this.cache.clear();
    this.accessLog.length = 0;
    this.prefetchPatterns.clear();
  }
}

// Export singleton instance
let intelligentCacheManager: IntelligentCacheManager | null = null;

export function initializeIntelligentCache(config?: Partial<CacheConfig>): IntelligentCacheManager {
  if (!intelligentCacheManager) {
    intelligentCacheManager = new IntelligentCacheManager(config);
  }
  return intelligentCacheManager;
}

export function getIntelligentCache(): IntelligentCacheManager | null {
  return intelligentCacheManager;
}
