import { logger } from '../shared/logger';

/**
 * Production Redis Service with Fallback
 * Works with or without Redis server
 */
export class ProductionRedisService {
  private static instance: ProductionRedisService;
  private memoryCache: Map<string, { value: string; expires?: number }> = new Map();
  private isRedisAvailable: boolean = false;
  private redis: any = null;

  private constructor() {
    this.initializeRedis();
  }

  public static getInstance(): ProductionRedisService {
    if (!ProductionRedisService.instance) {
      ProductionRedisService.instance = new ProductionRedisService();
    }
    return ProductionRedisService.instance;
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Try to import and connect to Redis
      const Redis = await import('ioredis');
      this.redis = new Redis.default(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 5000,
      });

      await this.redis.ping();
      this.isRedisAvailable = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      this.isRedisAvailable = false;
      logger.warn('Redis not available, using memory cache fallback', {
        error: (error as Error).message,
      });
    }
  }

  async healthCheck(): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.ping();
        return result === 'PONG';
      } catch (error) {
        this.isRedisAvailable = false;
        logger.warn('Redis health check failed, switching to fallback', {
          error: (error as Error).message,
        });
      }
    }

    // Memory cache is always available
    return true;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        if (ttl) {
          await this.redis.setex(key, ttl, value);
        } else {
          await this.redis.set(key, value);
        }
        return;
      } catch (error) {
        logger.warn('Redis SET failed, using fallback', { key, error: (error as Error).message });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const expires = ttl ? Date.now() + ttl * 1000 : undefined;
    this.memoryCache.set(key, { value, expires });
  }

  async get(key: string): Promise<string | null> {
    if (this.isRedisAvailable && this.redis) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        logger.warn('Redis GET failed, using fallback', { key, error: (error as Error).message });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (cached.expires && Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value;
  }

  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        logger.warn('Redis DEL failed, using fallback', { key, error: (error as Error).message });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    this.memoryCache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        logger.warn('Redis EXISTS failed, using fallback', {
          key,
          error: (error as Error).message,
        });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (!cached) return false;

    if (cached.expires && Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return false;
    }

    return true;
  }

  getConnectionStatus(): { redis: boolean; fallback: boolean; mode: string } {
    return {
      redis: this.isRedisAvailable,
      fallback: !this.isRedisAvailable,
      mode: this.isRedisAvailable ? 'Redis' : 'Memory Cache',
    };
  }

  async getStats(): Promise<any> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const info = await this.redis.info('stats');
        return {
          mode: 'redis',
          totalConnections: this.extractInfo(info, 'total_connections_received'),
          totalCommands: this.extractInfo(info, 'total_commands_processed'),
        };
      } catch (error) {
        // Fall through to memory stats
      }
    }

    return {
      mode: 'memory',
      cacheSize: this.memoryCache.size,
      memoryUsage: process.memoryUsage(),
    };
  }

  private extractInfo(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1]) : 0;
  }

  async cleanup(): Promise<void> {
    // Clean expired entries from memory cache
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expires && now > cached.expires) {
        this.memoryCache.delete(key);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.disconnect();
      } catch (error) {
        logger.warn('Redis disconnect error', { error: (error as Error).message });
      }
    }
    this.memoryCache.clear();
  }
}

export const productionRedis = ProductionRedisService.getInstance();
