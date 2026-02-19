/**
 * SEARCH-CATALOG-CONTRACT-035: Redis Client for Smart Form
 *
 * Provides caching for search/catalog endpoints with memory fallback.
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 4.B
 */

import { createRouteLogger } from './logger';

const log = createRouteLogger('redis', 'CACHE');

interface CacheEntry {
  value: string;
  expires: number;
}

class SmartFormRedisClient {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redis: any = null;
  private isRedisAvailable: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Lazy initialize on first use
  }

  private async initializeRedis(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Only try to connect if REDIS_URL is configured
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          log.info({}, 'REDIS_URL not configured, using memory cache');
          return;
        }

        // Dynamic import to avoid requiring ioredis if not used
        const Redis = (await import('ioredis')).default;
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          connectTimeout: 3000,
          retryStrategy: () => null, // Don't retry, fall back to memory
        });

        await this.redis.ping();
        this.isRedisAvailable = true;
        log.info({}, 'Redis connected for catalog caching');
      } catch (error) {
        this.isRedisAvailable = false;
        log.warn(
          { error: error instanceof Error ? error.message : 'Unknown' },
          'Redis not available, using memory cache fallback'
        );
      }
    })();

    return this.initPromise;
  }

  async get(key: string): Promise<string | null> {
    await this.initializeRedis();

    if (this.isRedisAvailable && this.redis) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        log.warn({ key, error }, 'Redis GET failed, using fallback');
        this.isRedisAvailable = false;
      }
    }

    // Memory cache fallback
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.initializeRedis();

    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, value);
        return;
      } catch (error) {
        log.warn({ key, error }, 'Redis SETEX failed, using fallback');
        this.isRedisAvailable = false;
      }
    }

    // Memory cache fallback
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });

    // Cleanup expired entries periodically (every 100 sets)
    if (this.memoryCache.size % 100 === 0) {
      this.cleanup();
    }
  }

  async del(key: string): Promise<void> {
    await this.initializeRedis();

    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        log.warn({ key, error }, 'Redis DEL failed, using fallback');
        this.isRedisAvailable = false;
      }
    }

    this.memoryCache.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    // Use Array.from for ES5 compatibility
    Array.from(this.memoryCache.entries()).forEach(([key, cached]) => {
      if (now > cached.expires) {
        this.memoryCache.delete(key);
      }
    });
  }

  getStatus(): { mode: 'redis' | 'memory'; cacheSize: number } {
    return {
      mode: this.isRedisAvailable ? 'redis' : 'memory',
      cacheSize: this.memoryCache.size,
    };
  }
}

// Singleton instance
let instance: SmartFormRedisClient | null = null;

/**
 * Get the Redis client instance (with memory fallback)
 */
export function getRedisClient(): SmartFormRedisClient {
  if (!instance) {
    instance = new SmartFormRedisClient();
  }
  return instance;
}

export type { SmartFormRedisClient };
