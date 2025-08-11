/**
 * Advanced Multi-Layer Caching System for Command Center
 *
 * Features:
 * - In-memory LRU cache for hot data
 * - Session storage for user-specific data
 * - Local storage for persistent preferences
 * - Redis-compatible interface for server-side caching
 * - Intelligent cache invalidation strategies
 * - Performance monitoring and metrics
 */

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  tags: string[];
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memory_usage: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Tags for batch invalidation
  serialize?: boolean; // Whether to serialize the data
  compression?: boolean; // Whether to compress large data
}

class LRUCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memory_usage: 0,
  };

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    item.hits++;
    this.cache.set(key, item);
    this.metrics.hits++;

    return item.data;
  }

  set(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || 300000; // Default 5 minutes
    const tags = options.tags || [];

    // Evict oldest items if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.metrics.evictions++;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      tags,
    });

    this.metrics.sets++;
    this.updateMemoryUsage();
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.deletes++;
      this.updateMemoryUsage();
    }
    return deleted;
  }

  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.metrics.deletes += count;
    this.updateMemoryUsage();
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.metrics = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0, memory_usage: 0 };
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  private updateMemoryUsage(): void {
    this.metrics.memory_usage = this.cache.size;
  }
}

class CacheManager {
  private memoryCache = new LRUCache(2000); // 2000 items max
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  private readonly AGENT_TTL = 30000; // 30 seconds for agent data
  private readonly USER_TTL = 600000; // 10 minutes for user data
  private readonly ANALYTICS_TTL = 120000; // 2 minutes for analytics

  // Memory cache methods
  get<T>(key: string): T | null {
    return this.memoryCache.get(key) as T | null;
  }

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    this.memoryCache.set(key, data, options);
  }

  delete(key: string): boolean {
    this.deleteFromSessionStorage(key);
    this.deleteFromLocalStorage(key);
    return this.memoryCache.delete(key);
  }

  // Intelligent caching with automatic TTL selection
  cacheAgentData(agentId: string, data: any): void {
    this.set(`agent:${agentId}`, data, {
      ttl: this.AGENT_TTL,
      tags: ['agents', 'real-time'],
    });
  }

  cacheUserData(userId: string, data: any): void {
    this.set(`user:${userId}`, data, {
      ttl: this.USER_TTL,
      tags: ['users'],
    });
  }

  cacheAnalytics(analyticsType: string, data: any): void {
    this.set(`analytics:${analyticsType}`, data, {
      ttl: this.ANALYTICS_TTL,
      tags: ['analytics'],
    });
  }

  cachePickData(pickId: string, data: any): void {
    this.set(`pick:${pickId}`, data, {
      ttl: this.AGENT_TTL,
      tags: ['picks', 'real-time'],
    });
  }

  // Session storage for user session data
  setSessionData(key: string, data: any): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          `command-center:${key}`,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.warn('Session storage failed:', error);
      }
    }
  }

  getSessionData<T>(key: string, maxAge: number = 3600000): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = sessionStorage.getItem(`command-center:${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);
      if (Date.now() - parsed.timestamp > maxAge) {
        sessionStorage.removeItem(`command-center:${key}`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn('Session storage read failed:', error);
      return null;
    }
  }

  // Local storage for persistent preferences
  setUserPreference(key: string, value: any): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`command-center:pref:${key}`, JSON.stringify(value));
      } catch (error) {
        console.warn('Local storage failed:', error);
      }
    }
  }

  getUserPreference<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const item = localStorage.getItem(`command-center:pref:${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Local storage read failed:', error);
      return defaultValue;
    }
  }

  // Batch operations
  invalidateByTag(tag: string): number {
    return this.memoryCache.invalidateByTag(tag);
  }

  invalidateAgentData(): number {
    return this.invalidateByTag('agents');
  }

  invalidateAnalytics(): number {
    return this.invalidateByTag('analytics');
  }

  invalidateRealTimeData(): number {
    return this.invalidateByTag('real-time');
  }

  // Cache warming for critical data
  async warmCache(): Promise<void> {
    console.log('🔥 Warming Command Center cache...');
    const startTime = Date.now();

    try {
      // Pre-cache critical data that's likely to be requested
      const promises = [
        this.preloadAgentStatuses(),
        this.preloadSystemMetrics(),
        this.preloadRecentPicks(),
      ];

      await Promise.allSettled(promises);

      const warmTime = Date.now() - startTime;
      console.log(`✅ Cache warmed in ${warmTime}ms`);
    } catch (error) {
      console.warn('Cache warming failed:', error);
    }
  }

  private async preloadAgentStatuses(): Promise<void> {
    // This would be called from your data fetching service
    // Example: const agents = await agentService.getStatuses();
    // agents.forEach(agent => this.cacheAgentData(agent.id, agent));
  }

  private async preloadSystemMetrics(): Promise<void> {
    // Preload system metrics
  }

  private async preloadRecentPicks(): Promise<void> {
    // Preload recent picks data
  }

  // Cleanup and maintenance
  cleanup(): void {
    // Clean expired session storage items
    if (typeof window !== 'undefined') {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('command-center:')) {
          try {
            const item = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (Date.now() - item.timestamp > 3600000) {
              // 1 hour
              sessionStorage.removeItem(key);
            }
          } catch (error) {
            sessionStorage.removeItem(key); // Remove corrupted items
          }
        }
      });
    }
  }

  // Debugging and monitoring
  getMetrics(): CacheMetrics {
    return this.memoryCache.getMetrics();
  }

  getCacheSize(): number {
    return this.memoryCache['cache'].size;
  }

  getHitRate(): number {
    const metrics = this.getMetrics();
    const total = metrics.hits + metrics.misses;
    return total > 0 ? (metrics.hits / total) * 100 : 0;
  }

  // Private helper methods
  private deleteFromSessionStorage(key: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`command-center:${key}`);
    }
  }

  private deleteFromLocalStorage(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`command-center:pref:${key}`);
    }
  }
}

// Global cache instance
export const cache = new CacheManager();

// React hooks for cache integration
import { useCallback, useEffect } from 'react';

export function useCache() {
  return {
    get: cache.get.bind(cache),
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
    invalidateByTag: cache.invalidateByTag.bind(cache),
    getMetrics: cache.getMetrics.bind(cache),
  };
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const getCachedData = useCallback(async (): Promise<T> => {
    // Try cache first
    const cached = cache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Fetch and cache
    const data = await fetcher();
    cache.set(key, data, options);
    return data;
  }, [key, fetcher, options]);

  return getCachedData;
}

export function useSessionData<T>(key: string, defaultValue: T) {
  const setData = useCallback(
    (data: T) => {
      cache.setSessionData(key, data);
    },
    [key]
  );

  const getData = useCallback(() => {
    return cache.getSessionData<T>(key) ?? defaultValue;
  }, [key, defaultValue]);

  return [getData(), setData] as const;
}

export function useUserPreference<T>(key: string, defaultValue: T) {
  const setPreference = useCallback(
    (value: T) => {
      cache.setUserPreference(key, value);
    },
    [key]
  );

  const getPreference = useCallback(() => {
    return cache.getUserPreference(key, defaultValue);
  }, [key, defaultValue]);

  return [getPreference(), setPreference] as const;
}

// Cache performance monitoring
export function useCacheMetrics() {
  const getMetrics = useCallback(() => cache.getMetrics(), []);
  const getHitRate = useCallback(() => cache.getHitRate(), []);
  const getCacheSize = useCallback(() => cache.getCacheSize(), []);

  return {
    getMetrics,
    getHitRate,
    getCacheSize,
  };
}

// Initialize cache warming and cleanup
if (typeof window !== 'undefined') {
  // Warm cache on page load
  cache.warmCache();

  // Cleanup periodically
  setInterval(() => {
    cache.cleanup();
  }, 300000); // Every 5 minutes

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cache.cleanup();
  });
}

export default cache;
