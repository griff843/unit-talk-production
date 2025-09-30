import Redis from 'ioredis';
import fs from 'node:fs';
import path from 'node:path';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  sessionStart: string;
}

class CacheClient {
  private static instance: CacheClient;
  private redis: Redis | null = null;
  private stats: CacheStats;
  private defaultTtl: number;

  private constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      sessionStart: new Date().toISOString()
    };
    this.defaultTtl = parseInt(process.env.CACHE_TTL_SECONDS || '90', 10);
    this.initRedis();
  }

  static getInstance(): CacheClient {
    if (!CacheClient.instance) {
      CacheClient.instance = new CacheClient();
    }
    return CacheClient.instance;
  }

  private initRedis(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('error', (error) => {
        console.warn('Redis connection error:', error.message);
        this.redis = null;
      });
    } catch (error) {
      console.warn('Failed to initialize Redis:', (error as Error).message);
      this.redis = null;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value !== null) {
        this.stats.hits++;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.warn('Cache get error:', (error as Error).message);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, ttlSec?: number): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const ttl = ttlSec || this.defaultTtl;
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      console.warn('Cache set error:', (error as Error).message);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.warn('Cache del error:', (error as Error).message);
      return false;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  exportStats(outPath?: string): string {
    const timestamp = Date.now();
    const defaultPath = path.resolve(process.cwd(), 'out', 'ops', 'cache');
    fs.mkdirSync(defaultPath, { recursive: true });

    const filePath = outPath || path.join(defaultPath, `cache-stats-${timestamp}.json`);

    const exportData = {
      ...this.stats,
      exportTime: new Date().toISOString(),
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%',
      redisConnected: this.redis !== null
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    return filePath;
  }

  isCacheFirst(): boolean {
    return process.env.CACHE_FIRST === '1' || process.env.CACHE_FIRST?.toLowerCase() === 'true';
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
    }
  }
}

export const cacheClient = CacheClient.getInstance();
export type { CacheStats };