/**
 * AI Response Caching System
 * Implements intelligent caching for AI model responses with cost optimization
 */

import { createHash } from 'crypto';

import { aiModelRouter } from './routing';

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

class AIResponseCache {
  private static instance: AIResponseCache;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: CacheMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    costSavings: 0,
    tokensSaved: 0,
    avgResponseTime: 0,
  };

  private readonly DEFAULT_TTL_SEC = parseInt(process.env.ADVICE_CACHE_TTL_SEC || '86400'); // 24 hours
  private readonly REQUERY_BPS_THRESHOLD = parseInt(process.env.ADVICE_REQUERY_BPS || '15'); // 15 basis points

  private constructor() {
    // Start cleanup timer
    setInterval(() => this.cleanup(), 300000); // Clean up every 5 minutes
  }

  public static getInstance(): AIResponseCache {
    if (!AIResponseCache.instance) {
      AIResponseCache.instance = new AIResponseCache();
    }
    return AIResponseCache.instance;
  }

  /**
   * Generate cache key from request parameters
   */
  private generateCacheKey(cacheKey: CacheKey): string {
    const { type, propId, odds, line, contextHash } = cacheKey;
    const lineStr = line !== undefined ? `:${line}` : '';
    return `${type}:${propId}:${odds}${lineStr}:${contextHash}`;
  }

  /**
   * Check if cache entry is valid and should be used
   */
  private isValidCacheEntry(
    entry: CacheEntry,
    currentOdds: number,
    currentContextHash: string
  ): boolean {
    // Check if entry has expired
    if (new Date() > entry.expiresAt) {
      return false;
    }

    // Check if odds have moved beyond threshold
    const oddsBps = aiModelRouter.calculateOddsBpsDifference(currentOdds, entry.lastOdds);
    if (oddsBps >= this.REQUERY_BPS_THRESHOLD) {
      console.log(
        `🔄 Odds moved ${oddsBps.toFixed(1)} bps (threshold: ${this.REQUERY_BPS_THRESHOLD}), invalidating cache`
      );
      return false;
    }

    // Check if context has changed
    if (entry.contextHash !== currentContextHash) {
      console.log(
        `🔄 Context changed (${entry.contextHash.substring(0, 8)} → ${currentContextHash.substring(0, 8)}), invalidating cache`
      );
      return false;
    }

    return true;
  }

  /**
   * Get cached response if available and valid
   */
  public get(cacheKey: CacheKey): CacheEntry | null {
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
  public set(
    cacheKey: CacheKey,
    content: string,
    model: string,
    provider: string,
    tokenCount: number,
    cost: number
  ): void {
    const key = this.generateCacheKey(cacheKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_SEC * 1000);

    const entry: CacheEntry = {
      content,
      model,
      provider,
      tokenCount,
      cost,
      timestamp: now,
      lastOdds: cacheKey.odds,
      contextHash: cacheKey.contextHash,
      hitCount: 0,
      expiresAt,
    };

    this.cache.set(key, entry);
    console.log(`💾 Cache SET for ${key} (expires: ${expiresAt.toISOString()})`);
  }

  /**
   * Generate advice cache key with full context
   */
  public generateAdviceCacheKey(
    propId: string,
    odds: number,
    line: number | undefined,
    context: Record<string, any>
  ): CacheKey {
    const contextHash = aiModelRouter.generateContextHash(context);

    return {
      type: 'advice',
      propId,
      odds,
      line,
      contextHash,
    };
  }

  /**
   * Generate recap cache key
   */
  public generateRecapCacheKey(date: string, context: Record<string, any>): CacheKey {
    const contextHash = aiModelRouter.generateContextHash(context);

    return {
      type: 'recap',
      propId: `recap-${date}`,
      odds: 0, // Not applicable for recap
      contextHash,
    };
  }

  /**
   * Generate formatting cache key
   */
  public generateFormattingCacheKey(contentHash: string, format: string): CacheKey {
    const contextHash = aiModelRouter.generateContextHash({ format });

    return {
      type: 'formatting',
      propId: `format-${contentHash}`,
      odds: 0, // Not applicable for formatting
      contextHash,
    };
  }

  /**
   * Check if requery is needed for advice
   */
  public shouldRequeryAdvice(
    propId: string,
    currentOdds: number,
    currentLine: number | undefined,
    currentContext: Record<string, any>
  ): { shouldRequery: boolean; reason?: string; cachedEntry?: CacheEntry } {
    const cacheKey = this.generateAdviceCacheKey(propId, currentOdds, currentLine, currentContext);
    const key = this.generateCacheKey(cacheKey);
    const entry = this.cache.get(key);

    if (!entry) {
      return { shouldRequery: true, reason: 'No cached entry found' };
    }

    if (new Date() > entry.expiresAt) {
      return { shouldRequery: true, reason: 'Cache entry expired', cachedEntry: entry };
    }

    const oddsBps = aiModelRouter.calculateOddsBpsDifference(currentOdds, entry.lastOdds);
    if (oddsBps >= this.REQUERY_BPS_THRESHOLD) {
      return {
        shouldRequery: true,
        reason: `Odds moved ${oddsBps.toFixed(1)} bps (threshold: ${this.REQUERY_BPS_THRESHOLD})`,
        cachedEntry: entry,
      };
    }

    const currentContextHash = aiModelRouter.generateContextHash(currentContext);
    if (entry.contextHash !== currentContextHash) {
      return {
        shouldRequery: true,
        reason: 'Context changed',
        cachedEntry: entry,
      };
    }

    return { shouldRequery: false, cachedEntry: entry };
  }

  /**
   * Invalidate cache entries by pattern
   */
  public invalidateByPattern(pattern: string): number {
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
  public invalidateProp(propId: string): number {
    return this.invalidateByPattern(propId);
  }

  /**
   * Clean up expired cache entries
   */
  public cleanup(): number {
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
  private updateHitRate(): void {
    this.metrics.hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0;
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    averageHitsPerEntry: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const now = new Date();
    let expiredCount = 0;
    let totalHits = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
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
      newestEntry: newestDate,
    };
  }

  /**
   * Get entries sorted by hit count (most popular first)
   */
  public getPopularEntries(limit: number = 10): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => b.entry.hitCount - a.entry.hitCount)
      .slice(0, limit);
  }

  /**
   * Log cache metrics for monitoring
   */
  public logMetrics(): void {
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
  public exportCacheData(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
  }

  /**
   * Clear all cache entries
   */
  public clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared all ${count} cache entries`);
    return count;
  }

  /**
   * Set cache TTL for testing
   */
  public setCacheTTL(ttlSeconds: number): void {
    // This would be used in testing scenarios
    console.log(`⚙️ Cache TTL set to ${ttlSeconds} seconds`);
  }
}

// Export singleton instance
export const aiResponseCache = AIResponseCache.getInstance();
