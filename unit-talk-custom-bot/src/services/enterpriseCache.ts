import Redis from 'ioredis';
import { logger, withErrorHandling } from '../utils/enterpriseErrorHandling';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

export class EnterpriseCache {
  private redis: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0
  };
  private defaultTTL: number = 3600; // 1 hour
  private keyPrefix: string = 'ut:';

  constructor(options?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    defaultTTL?: number;
  }) {
    this.redis = new Redis({
      host: options?.host || process.env.REDIS_HOST || 'localhost',
      port: options?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: options?.password || process.env.REDIS_PASSWORD,
      db: options?.db || 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      // Connection pool settings
      family: 4,
      keepAlive: 30000, // Changed from boolean to number (30 seconds)
      // Cluster support
      enableOfflineQueue: false,
      // Error handling
    });

    this.keyPrefix = options?.keyPrefix || 'ut:';
    this.defaultTTL = options?.defaultTTL || 3600;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
      this.stats.errors++;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  private buildKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.keyPrefix;
    return `${finalPrefix}${key}`;
  }

  private serialize(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.error('Cache serialization error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private deserialize(value: string): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache deserialization error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return value; // Return as string if JSON parsing fails
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // Get value from cache
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      if (options?.serialize !== false) {
        return this.deserialize(value);
      }

      return value as T;
    }, 'cache.get');
  }

  // Set value in cache
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      
      let serializedValue: string;
      if (options?.serialize !== false) {
        serializedValue = this.serialize(value);
      } else {
        serializedValue = String(value);
      }

      const result = await this.redis.setex(fullKey, ttl, serializedValue);
      
      if (result === 'OK') {
        this.stats.sets++;
        return true;
      }
      
      return false;
    }, 'cache.set');
  }

  // Delete value from cache
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.del(fullKey);
      
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      
      return false;
    }, 'cache.delete');
  }

  // Check if key exists
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    }, 'cache.exists');
  }

  // Set expiration for existing key
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    }, 'cache.expire');
  }

  // Get multiple values
  async mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    return withErrorHandling(async () => {
      const fullKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const values = await this.redis.mget(...fullKeys);
      
      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        
        if (options?.serialize !== false) {
          return this.deserialize(value);
        }
        
        return value as T;
      });
    }, 'cache.mget');
  }

  // Set multiple values
  async mset(keyValuePairs: Record<string, any>, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const pipeline = this.redis.pipeline();
      const ttl = options?.ttl || this.defaultTTL;

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = this.buildKey(key, options?.prefix);
        let serializedValue: string;
        
        if (options?.serialize !== false) {
          serializedValue = this.serialize(value);
        } else {
          serializedValue = String(value);
        }

        pipeline.setex(fullKey, ttl, serializedValue);
      }

      const results = await pipeline.exec();
      const success = results?.every(([error, result]) => error === null && result === 'OK') || false;
      
      if (success) {
        this.stats.sets += Object.keys(keyValuePairs).length;
      }
      
      return success;
    }, 'cache.mset');
  }

  // Delete multiple keys
  async mdel(keys: string[], options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const result = await this.redis.del(...fullKeys);
      this.stats.deletes += result;
      return result;
    }, 'cache.mdel');
  }

  // Clear all keys with prefix
  async clear(prefix?: string): Promise<number> {
    return withErrorHandling(async () => {
      const pattern = this.buildKey('*', prefix);
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      this.stats.deletes += result;
      return result;
    }, 'cache.clear');
  }

  // Increment counter
  async increment(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.incrby(fullKey, amount);
      
      // Set expiration if specified
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return result;
    }, 'cache.increment');
  }

  // Decrement counter
  async decrement(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.decrby(fullKey, amount);
      
      // Set expiration if specified
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return result;
    }, 'cache.decrement');
  }

  // Add to set
  async sadd(key: string, members: string[], options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.sadd(fullKey, ...members);
      
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return result;
    }, 'cache.sadd');
  }

  // Get set members
  async smembers(key: string, options?: CacheOptions): Promise<string[]> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      return await this.redis.smembers(fullKey);
    }, 'cache.smembers');
  }

  // Check if member exists in set
  async sismember(key: string, member: string, options?: CacheOptions): Promise<boolean> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.sismember(fullKey, member);
      return result === 1;
    }, 'cache.sismember');
  }

  // Remove from set
  async srem(key: string, members: string[], options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      return await this.redis.srem(fullKey, ...members);
    }, 'cache.srem');
  }

  // Add to sorted set
  async zadd(key: string, scoreMembers: Array<{ score: number; member: string }>, options?: CacheOptions): Promise<number> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      const args: (string | number)[] = [];
      
      for (const { score, member } of scoreMembers) {
        args.push(score, member);
      }
      
      const result = await this.redis.zadd(fullKey, ...args);
      
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return result;
    }, 'cache.zadd');
  }

  // Get sorted set range
  async zrange(key: string, start: number, stop: number, options?: CacheOptions & { withScores?: boolean }): Promise<string[] | Array<{ member: string; score: number }>> {
    return withErrorHandling(async () => {
      const fullKey = this.buildKey(key, options?.prefix);
      
      if (options?.withScores) {
        const result = await this.redis.zrange(fullKey, start, stop, 'WITHSCORES');
        const pairs: Array<{ member: string; score: number }> = [];
        
        for (let i = 0; i < result.length; i += 2) {
          pairs.push({
            member: result[i],
            score: parseFloat(result[i + 1])
          });
        }
        
        return pairs;
      } else {
        return await this.redis.zrange(fullKey, start, stop);
      }
    }, 'cache.zrange');
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    };
  }

  // Get Redis info
  async getInfo(): Promise<any> {
    return withErrorHandling(async () => {
      const info = await this.redis.info();
      return this.parseRedisInfo(info);
    }, 'cache.getInfo');
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};
    let section = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        section = line.substring(2).toLowerCase();
        result[section] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (section) {
          result[section][key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }

    return result;
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      const info = await this.getInfo();
      
      return {
        status: latency < 100 ? 'healthy' : 'unhealthy',
        details: {
          latency,
          connected: this.redis.status === 'ready',
          stats: this.getStats(),
          memory: info.memory,
          clients: info.clients
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connected: false
        }
      };
    }
  }

  // Close connection
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
let cacheInstance: EnterpriseCache | null = null;

export function getCache(): EnterpriseCache {
  if (!cacheInstance) {
    cacheInstance = new EnterpriseCache();
  }
  return cacheInstance;
}

// Cache decorators for methods
export function Cacheable(options?: CacheOptions & { keyGenerator?: (...args: any[]) => string }) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = getCache();
      const key = options?.keyGenerator ? options.keyGenerator(...args) : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = await cache.get(key, options);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await cache.set(key, result, options);
      
      return result;
    };
  };
}

// Cache invalidation decorator
export function CacheEvict(options?: { keyPattern?: string; allEntries?: boolean }) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const cache = getCache();
      
      if (options?.allEntries) {
        await cache.clear();
      } else if (options?.keyPattern) {
        // This would require implementing pattern-based deletion
        // For now, we'll just delete specific keys
        await cache.delete(options.keyPattern);
      }
      
      return result;
    };
  };
}