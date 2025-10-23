import { createClient, RedisClientType } from 'redis';
import { Logger } from '../logger';
import { performance } from 'perf_hooks';

export interface CacheConfig {
  url: string;
  ttl: {
    playerMetadata: number;
    teamMetadata: number;
    oddsLines: number;
    gameSchedules: number;
    userProfiles: number;
    default: number;
  };
  maxRetries: number;
  retryDelay: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  avgLatency: number;
}

export class RedisCache {
  private client: RedisClientType;
  private logger: Logger;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private connected: boolean = false;

  constructor(config: CacheConfig) {
    this.config = config;
    this.logger = new Logger('RedisCache');
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
    };

    this.client = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > config.maxRetries) {
            this.logger.error('Max retries reached, stopping reconnection');
            return false;
          }
          return config.retryDelay * retries;
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err);
      this.metrics.errors++;
    });

    this.client.on('connect', () => {
      this.logger.info('Redis connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Redis disconnected');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.connected = false;
  }

  /**
   * Get value with automatic deserialization
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    const start = performance.now();
    try {
      const value = await this.client.get(key);
      const latency = performance.now() - start;
      this.updateMetrics(latency);

      if (value) {
        this.metrics.hits++;
        return JSON.parse(value);
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value with automatic serialization and TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.connected) return false;

    const start = performance.now();
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.getTTLForKey(key);
      
      await this.client.setEx(key, expiry, serialized);
      
      const latency = performance.now() - start;
      this.updateMetrics(latency);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key or keys matching pattern
   */
  async delete(pattern: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache delete error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple values in batch
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.connected || keys.length === 0) {
      return keys.map(() => null);
    }

    const start = performance.now();
    try {
      const values = await this.client.mGet(keys);
      const latency = performance.now() - start;
      this.updateMetrics(latency);

      return values.map((value, index) => {
        if (value) {
          this.metrics.hits++;
          return JSON.parse(value);
        } else {
          this.metrics.misses++;
          return null;
        }
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Cache-aside pattern helper
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    try {
      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      this.logger.error(`Factory error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const count = await this.delete(pattern);
    this.logger.info(`Invalidated ${count} keys matching pattern: ${pattern}`);
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics & { hitRate: number } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      hitRate,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
    };
  }

  /**
   * Get TTL based on key pattern
   */
  private getTTLForKey(key: string): number {
    if (key.startsWith('player:')) return this.config.ttl.playerMetadata;
    if (key.startsWith('team:')) return this.config.ttl.teamMetadata;
    if (key.startsWith('odds:')) return this.config.ttl.oddsLines;
    if (key.startsWith('schedule:')) return this.config.ttl.gameSchedules;
    if (key.startsWith('user:')) return this.config.ttl.userProfiles;
    return this.config.ttl.default;
  }

  /**
   * Update latency metrics
   */
  private updateMetrics(latency: number): void {
    const total = this.metrics.hits + this.metrics.misses + 1;
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (total - 1) + latency) / total;
  }

  /**
   * Ping Redis server for health check
   */
  async ping(): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.disconnect();
        this.connected = false;
        this.logger.info('Disconnected from Redis');
      } catch (error) {
        this.logger.error('Error disconnecting from Redis:', error);
      }
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Warm up cache with common data
   */
  async warmup(): Promise<void> {
    this.logger.info('Starting cache warmup...');
    
    // This would be implemented with actual data fetching
    // For now, just a placeholder
    const warmupKeys = [
      'schedule:nfl:today',
      'schedule:nba:today',
      'team:metadata:all',
    ];

    for (const key of warmupKeys) {
      // In real implementation, fetch and cache data
      this.logger.debug(`Warming up: ${key}`);
    }

    this.logger.info('Cache warmup completed');
  }
}