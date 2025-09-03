/**
 * Intelligent Caching Strategy
 * Context-aware caching with dynamic TTL based on data volatility
 * Expected Performance Improvement: 2-3x API response time improvement
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  tags: string[];
  volatility: 'low' | 'medium' | 'high' | 'critical';
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  volatility?: 'low' | 'medium' | 'high' | 'critical';
  priority?: 'low' | 'medium' | 'high';
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
}

export class IntelligentCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private metrics: CacheMetrics;
  private cleanupInterval: NodeJS.Timeout;

  // Context-aware TTL configurations
  private readonly TTL_CONFIGS = {
    // Real-time data (very volatile)
    'steam-analysis': 30000,      // 30 seconds
    'line-movement': 60000,       // 1 minute
    'betting-percentages': 120000, // 2 minutes
    'injury-reports': 300000,     // 5 minutes
    
    // Market data (moderately volatile)
    'odds-data': 180000,          // 3 minutes
    'prop-lines': 300000,         // 5 minutes
    'game-status': 600000,        // 10 minutes
    
    // Player data (stable)
    'player-stats': 3600000,      // 1 hour
    'team-stats': 3600000,        // 1 hour
    'historical-performance': 7200000, // 2 hours
    
    // Configuration data (very stable)
    'agent-config': 86400000,     // 24 hours
    'user-preferences': 43200000, // 12 hours
    'system-settings': 86400000,  // 24 hours
    
    // Default fallback
    'default': 300000             // 5 minutes
  };

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0
    };

    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Get cached data with intelligent TTL handling
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access metrics
    entry.hits++;
    entry.lastAccessed = now;
    this.metrics.hits++;
    this.updateHitRate();

    return entry.data;
  }

  /**
   * Set cached data with intelligent TTL selection
   */
  set(key: string, data: T, options: CacheOptions = {}): void {
    const now = Date.now();
    const ttl = this.getIntelligentTTL(key, options);
    const volatility = this.determineVolatility(key, options.volatility);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      tags: options.tags || [],
      volatility,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();
  }

  /**
   * Intelligent TTL selection based on key patterns and context
   */
  private getIntelligentTTL(key: string, options: CacheOptions): number {
    // Use explicit TTL if provided
    if (options.ttl) {
      return options.ttl;
    }

    // Pattern-based TTL selection
    for (const [pattern, ttl] of Object.entries(this.TTL_CONFIGS)) {
      if (key.includes(pattern) || key.startsWith(pattern)) {
        return ttl;
      }
    }

    // Volatility-based TTL
    switch (options.volatility) {
      case 'critical': return 15000;  // 15 seconds
      case 'high': return 60000;      // 1 minute
      case 'medium': return 300000;   // 5 minutes
      case 'low': return 3600000;     // 1 hour
      default: return this.TTL_CONFIGS.default;
    }
  }

  /**
   * Determine data volatility based on key patterns
   */
  private determineVolatility(key: string, explicit?: string): 'low' | 'medium' | 'high' | 'critical' {
    if (explicit) {
      return explicit as any;
    }

    // Pattern-based volatility detection
    if (key.includes('steam') || key.includes('line-movement')) {
      return 'critical';
    }
    if (key.includes('odds') || key.includes('betting-percentage')) {
      return 'high';
    }
    if (key.includes('player') || key.includes('team')) {
      return 'medium';
    }
    if (key.includes('config') || key.includes('settings')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    this.updateMemoryUsage();
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      invalidated++;
    });

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();
    return invalidated;
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmupData: Array<{ key: string; data: T; options?: CacheOptions }>): Promise<void> {
    for (const { key, data, options } of warmupData) {
      this.set(key, data, options);
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  /**
   * Update memory usage estimation
   */
  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    this.metrics.memoryUsage = this.cache.size * 1024; // Assume 1KB per entry average
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics.deletes += this.cache.size;
    this.updateMemoryUsage();
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

/**
 * Specialized cache instances for different data types
 */
export class GradingCache extends IntelligentCache {
  constructor() {
    super(5000); // Smaller cache for grading data
  }

  cacheGradingResult(propId: string, result: any): void {
    this.set(`grading:${propId}`, result, {
      volatility: 'medium',
      tags: ['grading', 'results']
    });
  }

  cacheSteamAnalysis(propId: string, analysis: any): void {
    this.set(`steam:${propId}`, analysis, {
      volatility: 'critical',
      tags: ['steam', 'real-time']
    });
  }
}

export class UserCache extends IntelligentCache {
  constructor() {
    super(10000); // Larger cache for user data
  }

  cacheUserProfile(userId: string, profile: any): void {
    this.set(`user:${userId}`, profile, {
      volatility: 'low',
      tags: ['users', 'profiles']
    });
  }
}
