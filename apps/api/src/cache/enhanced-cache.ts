import { productionRedis } from '../services/productionRedis';
import { logger } from '../shared/logger';

/**
 * Enhanced Redis Cache with fallback capabilities
 */
export class RedisEnhancedCache {
  private redis = productionRedis;

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Cache GET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      await this.redis.set(key, value, ttl);
      return true;
    } catch (error) {
      logger.error('Cache SET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache DEL error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      logger.error('Cache EXISTS error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    return await this.redis.healthCheck();
  }

  getConnectionStatus() {
    return this.redis.getConnectionStatus();
  }

  async getStats() {
    return await this.redis.getStats();
  }

  async getPattern(pattern: string): Promise<Map<string, string>> {
    try {
      const result = new Map<string, string>();
      // For now, return empty map since pattern matching isn't implemented
      // This is a placeholder to fix compilation errors
      logger.warn('getPattern method called but pattern matching not implemented', { pattern });
      return result;
    } catch (error) {
      logger.error('Cache getPattern error', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Map();
    }
  }

  async ping(): Promise<boolean> {
    try {
      return await this.redis.healthCheck();
    } catch (error) {
      logger.error('Cache ping error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.cleanup();
  }
}

/**
 * ML Prediction Cache for storing and retrieving ML predictions
 */
export class MLPredictionCache extends RedisEnhancedCache {
  private mlPrefix = 'ml:prediction:';

  async getPrediction(key: string): Promise<any | null> {
    try {
      const result = await this.get(`${this.mlPrefix}${key}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('ML Cache GET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setPrediction(key: string, prediction: any, ttl?: number): Promise<boolean> {
    try {
      return await this.set(`${this.mlPrefix}${key}`, JSON.stringify(prediction), ttl);
    } catch (error) {
      logger.error('ML Cache SET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async invalidatePrediction(key: string): Promise<boolean> {
    return await this.del(`${this.mlPrefix}${key}`);
  }
}

export const redis = new RedisEnhancedCache();
export const redisCache = redis;
export const mlPredictionCache = new MLPredictionCache();
