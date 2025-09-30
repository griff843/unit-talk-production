import { ProductionRedisService } from './productionRedis';
import { UnifiedPick, createUnifiedPick, patchUnifiedPick, findUnifiedPick, listUnifiedPicks } from '../db/unifiedPicksRepo';
import { requireSupabase } from '../utils/supabaseUtils';
import { toCamelKeys, toSnakeKeys } from '@unit-talk/shared-utils';
import { logger } from '../utils/logger';

export interface CacheMetrics {
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  misses: number;
  writeThrough: number;
  invalidations: number;
  errors: number;
  avgResponseTime: number;
  hitRatio: number;
  lastUpdated: Date;
}

export interface CacheConfig {
  l1TtlMs: number;
  l2TtlSec: number;
  writeThrough: boolean;
  enableMetrics: boolean;
  circuitBreakerThreshold: number;
  warmupOnStart: boolean;
}

export interface CacheKey {
  type: 'pick' | 'picks_list' | 'user_picks' | 'published_picks' | 'daily_picks';
  id?: string;
  params?: Record<string, any>;
}

/**
 * Cache-First Unified Picks Service
 * Implements L1 (Memory) → L2 (Redis) → L3 (Database) hierarchy
 * Provides <100ms response times with >90% cache hit rate targets
 */
export class CacheFirstUnifiedPicksService {
  private static instance: CacheFirstUnifiedPicksService;
  private redis: ProductionRedisService;
  
  // L1 Cache - In-memory with configurable TTL
  private l1Cache: Map<string, { data: any; expires: number; accessed: number }> = new Map();
  
  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerCount = 0;
  private circuitBreakerLastFailure = 0;
  
  // Configuration
  private config: CacheConfig = {
    l1TtlMs: 30 * 1000, // 30 seconds L1 cache
    l2TtlSec: 300, // 5 minutes L2 cache
    writeThrough: true,
    enableMetrics: true,
    circuitBreakerThreshold: 5,
    warmupOnStart: true
  };
  
  // Metrics
  private metrics: CacheMetrics = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    writeThrough: 0,
    invalidations: 0,
    errors: 0,
    avgResponseTime: 0,
    hitRatio: 0,
    lastUpdated: new Date()
  };
  
  private responseTimes: number[] = [];

  private constructor() {
    this.redis = ProductionRedisService.getInstance();
    
    // Start periodic L1 cache cleanup
    setInterval(() => this.cleanupL1Cache(), 60 * 1000); // Every minute
    
    // Start periodic metrics calculation
    if (this.config.enableMetrics) {
      setInterval(() => this.calculateMetrics(), 30 * 1000); // Every 30 seconds
    }
    
    logger.info('CacheFirstUnifiedPicksService initialized', {
      config: this.config
    });
  }

  public static getInstance(): CacheFirstUnifiedPicksService {
    if (!CacheFirstUnifiedPicksService.instance) {
      CacheFirstUnifiedPicksService.instance = new CacheFirstUnifiedPicksService();
    }
    return CacheFirstUnifiedPicksService.instance;
  }

  /**
   * Generate cache key from CacheKey interface
   */
  private generateCacheKey(key: CacheKey): string {
    const baseKey = `unified_picks:${key.type}`;
    
    if (key.id) {
      return `${baseKey}:${key.id}`;
    }
    
    if (key.params) {
      const paramString = Object.keys(key.params)
        .sort()
        .map(k => `${k}=${key.params![k]}`)
        .join('&');
      return `${baseKey}:${Buffer.from(paramString).toString('base64')}`;
    }
    
    return baseKey;
  }

  /**
   * L1 Cache Operations
   */
  private setL1(key: string, data: any): void {
    const expires = Date.now() + this.config.l1TtlMs;
    this.l1Cache.set(key, {
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      expires,
      accessed: Date.now()
    });
  }

  private getL1(key: string): any | null {
    const cached = this.l1Cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.l1Cache.delete(key);
      return null;
    }
    
    // Update access time for LRU tracking
    cached.accessed = Date.now();
    this.metrics.l1Hits++;
    
    return JSON.parse(JSON.stringify(cached.data)); // Deep clone
  }

  private deleteL1(key: string): void {
    this.l1Cache.delete(key);
  }

  /**
   * Clean expired entries from L1 cache and enforce size limits
   */
  private cleanupL1Cache(): void {
    const now = Date.now();
    const maxSize = 1000; // Maximum L1 cache entries
    
    // Remove expired entries
    for (const [key, cached] of this.l1Cache.entries()) {
      if (now > cached.expires) {
        this.l1Cache.delete(key);
      }
    }
    
    // Enforce size limit using LRU
    if (this.l1Cache.size > maxSize) {
      const entries = Array.from(this.l1Cache.entries())
        .sort(([,a], [,b]) => a.accessed - b.accessed);
      
      const toRemove = entries.slice(0, this.l1Cache.size - maxSize);
      toRemove.forEach(([key]) => this.l1Cache.delete(key));
      
      logger.debug('L1 cache cleanup completed', {
        removed: toRemove.length,
        remaining: this.l1Cache.size
      });
    }
  }

  /**
   * Circuit breaker check
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    // Reset circuit breaker after 60 seconds
    if (Date.now() - this.circuitBreakerLastFailure > 60 * 1000) {
      this.circuitBreakerOpen = false;
      this.circuitBreakerCount = 0;
      logger.info('Circuit breaker reset');
      return false;
    }
    
    return true;
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerCount++;
    this.circuitBreakerLastFailure = Date.now();
    
    if (this.circuitBreakerCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerOpen = true;
      logger.warn('Circuit breaker opened', {
        failureCount: this.circuitBreakerCount,
        threshold: this.config.circuitBreakerThreshold
      });
    }
  }

  /**
   * Get data with L1 → L2 → L3 fallback
   */
  private async getCachedData<T>(cacheKey: CacheKey): Promise<T | null> {
    const key = this.generateCacheKey(cacheKey);
    const startTime = Date.now();
    
    try {
      // L1 Cache check
      const l1Result = this.getL1(key);
      if (l1Result !== null) {
        this.recordResponseTime(Date.now() - startTime);
        return l1Result as T;
      }
      
      // Circuit breaker check for L2/L3
      if (this.isCircuitBreakerOpen()) {
        this.metrics.errors++;
        return null;
      }
      
      // L2 Cache check (Redis)
      try {
        const l2Result = await this.redis.get(key);
        if (l2Result) {
          const parsed = JSON.parse(l2Result) as T;
          this.setL1(key, parsed); // Populate L1 cache
          this.metrics.l2Hits++;
          this.recordResponseTime(Date.now() - startTime);
          return parsed;
        }
      } catch (error) {
        logger.warn('L2 cache (Redis) failure', { key, error: (error as Error).message });
        this.recordCircuitBreakerFailure();
      }
      
      // L3 Cache miss - caller will handle database fetch
      this.metrics.misses++;
      this.recordResponseTime(Date.now() - startTime);
      return null;
      
    } catch (error) {
      logger.error('Cache lookup failed', { key, error: (error as Error).message });
      this.metrics.errors++;
      this.recordCircuitBreakerFailure();
      return null;
    }
  }

  /**
   * Set data in L1 and L2 caches
   */
  private async setCachedData(cacheKey: CacheKey, data: any): Promise<void> {
    const key = this.generateCacheKey(cacheKey);
    
    try {
      // Always set in L1
      this.setL1(key, data);
      
      // Set in L2 if not circuit broken
      if (!this.isCircuitBreakerOpen()) {
        try {
          await this.redis.set(key, JSON.stringify(data), this.config.l2TtlSec);
        } catch (error) {
          logger.warn('L2 cache (Redis) write failure', { key, error: (error as Error).message });
          this.recordCircuitBreakerFailure();
        }
      }
    } catch (error) {
      logger.error('Cache write failed', { key, error: (error as Error).message });
      this.metrics.errors++;
    }
  }

  /**
   * Invalidate cache entry across all levels
   */
  private async invalidateCache(cacheKey: CacheKey): Promise<void> {
    const key = this.generateCacheKey(cacheKey);
    
    try {
      // Clear L1
      this.deleteL1(key);
      
      // Clear L2 if available
      if (!this.isCircuitBreakerOpen()) {
        try {
          await this.redis.del(key);
        } catch (error) {
          logger.warn('L2 cache (Redis) delete failure', { key, error: (error as Error).message });
        }
      }
      
      this.metrics.invalidations++;
      
    } catch (error) {
      logger.error('Cache invalidation failed', { key, error: (error as Error).message });
      this.metrics.errors++;
    }
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * Calculate and update metrics
   */
  private calculateMetrics(): void {
    const totalRequests = this.metrics.l1Hits + this.metrics.l2Hits + this.metrics.l3Hits + this.metrics.misses;
    const cacheHits = this.metrics.l1Hits + this.metrics.l2Hits + this.metrics.l3Hits;
    
    this.metrics.hitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    this.metrics.avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
    this.metrics.lastUpdated = new Date();
    
    // Log metrics if hit ratio is below target
    if (this.metrics.hitRatio < 90 && totalRequests > 100) {
      logger.warn('Cache hit ratio below target', {
        hitRatio: this.metrics.hitRatio,
        totalRequests,
        metrics: this.metrics
      });
    }
  }

  // Public API Methods

  /**
   * Create unified pick with write-through caching and automatic scoring trigger
   */
  public async createPick(pick: UnifiedPick): Promise<UnifiedPick> {
    const startTime = Date.now();

    try {
      // Create in database
      const result = await createUnifiedPick(pick);

      if (this.config.writeThrough) {
        // Cache the new pick
        await this.setCachedData({ type: 'pick', id: result.id }, result);

        // Invalidate list caches that might include this pick
        await this.invalidateListCaches(result);

        this.metrics.writeThrough++;
      }

      this.metrics.l3Hits++;
      this.recordResponseTime(Date.now() - startTime);

      // 🚀 REAL-TIME SCORING TRIGGER: Automatically score pick immediately after creation
      this.triggerScoringAsync(result).catch(error => {
        logger.error('Async scoring trigger failed', {
          pickId: result.id,
          error: (error as Error).message
        });
      });

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error('Create pick failed', { error: (error as Error).message, pick: pick.id });
      throw error;
    }
  }

  /**
   * Trigger ScoringAgent asynchronously for real-time scoring via Supabase queue
   * Non-blocking - fires and forgets to maintain ingestion performance
   */
  private async triggerScoringAsync(pick: UnifiedPick): Promise<void> {
    try {
      const { createSupabaseClient } = await import('../utils/supabase');
      const supabase = createSupabaseClient();

      const { error } = await supabase
        .from('scoring_queue')
        .insert({
          pick_id: pick.id,
          status: 'PENDING'
        });

      if (error) {
        logger.error('Failed to enqueue scoring job', {
          pickId: pick.id,
          error: error.message
        });
        return;
      }

      logger.info('⚡ queued for scoring', {
        pickId: pick.id,
        playerName: pick.playerName
      });

    } catch (error) {
      logger.error('Scoring enqueue failed', {
        pickId: pick.id,
        error: (error as Error).message
      });
    }
  }

  /**
   * Update unified pick with cache invalidation
   */
  public async updatePick(id: string, patch: Partial<UnifiedPick>): Promise<UnifiedPick> {
    const startTime = Date.now();
    
    try {
      // Update in database
      const result = await patchUnifiedPick(id, patch);
      
      // Invalidate caches
      await this.invalidateCache({ type: 'pick', id });
      await this.invalidateListCaches(result);
      
      // Cache the updated pick if write-through enabled
      if (this.config.writeThrough) {
        await this.setCachedData({ type: 'pick', id }, result);
        this.metrics.writeThrough++;
      }
      
      this.metrics.l3Hits++;
      this.recordResponseTime(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('Update pick failed', { error: (error as Error).message, id });
      throw error;
    }
  }

  /**
   * Get unified pick with caching
   */
  public async getPick(id: string): Promise<UnifiedPick | null> {
    const cacheKey: CacheKey = { type: 'pick', id };
    
    // Try cache first
    const cached = await this.getCachedData<UnifiedPick>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from database
    const startTime = Date.now();
    try {
      const result = await findUnifiedPick(id);
      
      // Cache the result
      await this.setCachedData(cacheKey, result);
      
      this.metrics.l3Hits++;
      this.recordResponseTime(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('Get pick failed', { error: (error as Error).message, id });
      throw error;
    }
  }

  /**
   * List unified picks with caching
   */
  public async listPicks(params: { 
    status?: string; 
    published?: boolean; 
    limit?: number;
    userId?: string;
  } = {}): Promise<UnifiedPick[]> {
    const cacheKey: CacheKey = { 
      type: params.userId ? 'user_picks' : 'picks_list', 
      params 
    };
    
    // Try cache first
    const cached = await this.getCachedData<UnifiedPick[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from database
    const startTime = Date.now();
    try {
      const result = await listUnifiedPicks(params);
      
      // Cache the result with shorter TTL for lists
      await this.setCachedData(cacheKey, result);
      
      this.metrics.l3Hits++;
      this.recordResponseTime(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('List picks failed', { error: (error as Error).message, params });
      throw error;
    }
  }

  /**
   * Get published picks with caching (high-frequency endpoint)
   */
  public async getPublishedPicks(limit = 50): Promise<UnifiedPick[]> {
    return this.listPicks({ published: true, limit });
  }

  /**
   * Get today's picks with caching
   */
  public async getTodaysPicks(): Promise<UnifiedPick[]> {
    const cacheKey: CacheKey = { 
      type: 'daily_picks', 
      params: { date: new Date().toISOString().split('T')[0] }
    };
    
    // Try cache first
    const cached = await this.getCachedData<UnifiedPick[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Custom query for today's picks
    const startTime = Date.now();
    try {
      const supabase = requireSupabase();
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('unified_picks')
        .select('*')
        .gte('placed_at', `${today}T00:00:00Z`)
        .lt('placed_at', `${today}T23:59:59Z`)
        .eq('published', true)
        .order('placed_at', { ascending: false });
      
      if (error) throw error;
      
      const result = toCamelKeys<UnifiedPick[]>(data);
      
      // Cache with shorter TTL for time-sensitive data
      await this.setCachedData(cacheKey, result);
      
      this.metrics.l3Hits++;
      this.recordResponseTime(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      logger.error('Get todays picks failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Invalidate list caches that might include a specific pick
   */
  private async invalidateListCaches(pick: UnifiedPick): Promise<void> {
    // Invalidate general list cache
    await this.invalidateCache({ type: 'picks_list', params: {} });
    
    // Invalidate user-specific cache if userId available
    if (pick.userId) {
      await this.invalidateCache({ type: 'user_picks', params: { userId: pick.userId } });
    }
    
    // Invalidate published picks cache if relevant
    if (pick.published) {
      await this.invalidateCache({ type: 'published_picks', params: {} });
    }
    
    // Invalidate today's picks if it's from today
    const today = new Date().toISOString().split('T')[0];
    const pickDate = new Date(pick.placedAt || '').toISOString().split('T')[0];
    if (pickDate === today) {
      await this.invalidateCache({ type: 'daily_picks', params: { date: today } });
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmupCache(): Promise<void> {
    if (!this.config.warmupOnStart) return;
    
    logger.info('Starting cache warmup...');
    const startTime = Date.now();
    
    try {
      // Warm up published picks
      await this.getPublishedPicks();
      
      // Warm up today's picks
      await this.getTodaysPicks();
      
      // Warm up recent picks
      await this.listPicks({ limit: 100 });
      
      const warmupTime = Date.now() - startTime;
      logger.info('Cache warmup completed', { warmupTimeMs: warmupTime });
      
    } catch (error) {
      logger.error('Cache warmup failed', { error: (error as Error).message });
    }
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  public updateConfig(updates: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Cache configuration updated', { config: this.config });
  }

  /**
   * Health check for cache service
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const redisHealth = await this.redis.healthCheck();
      const l1Size = this.l1Cache.size;
      const hitRatio = this.metrics.hitRatio;
      const avgResponseTime = this.metrics.avgResponseTime;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!redisHealth || this.circuitBreakerOpen) {
        status = 'degraded';
      }
      
      if (hitRatio < 50 || avgResponseTime > 500) {
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
      }
      
      return {
        status,
        details: {
          redis: redisHealth,
          l1CacheSize: l1Size,
          metrics: this.metrics,
          circuitBreakerOpen: this.circuitBreakerOpen,
          responseTimes: {
            count: this.responseTimes.length,
            avg: avgResponseTime,
            p95: this.getPercentile(95),
            p99: this.getPercentile(99)
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Get response time percentile
   */
  private getPercentile(percentile: number): number {
    if (this.responseTimes.length === 0) return 0;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<void> {
    logger.info('Clearing all caches...');
    
    // Clear L1
    this.l1Cache.clear();
    
    // Clear L2 by pattern
    try {
      // Note: This is a simplified version. In production, you might want
      // to use Redis SCAN with pattern matching for efficiency
      const keys = ['unified_picks:*'];
      for (const pattern of keys) {
        // Redis doesn't have a direct pattern delete, so this would need
        // to be implemented with SCAN in a production environment
        logger.warn('L2 pattern delete not fully implemented', { pattern });
      }
    } catch (error) {
      logger.error('Failed to clear L2 cache', { error: (error as Error).message });
    }
    
    // Reset metrics
    this.metrics.invalidations += this.l1Cache.size;
    
    logger.info('All caches cleared');
  }
}

// Export singleton instance
export const cacheFirstUnifiedPicks = CacheFirstUnifiedPicksService.getInstance();