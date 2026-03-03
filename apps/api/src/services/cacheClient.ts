/**
 * Cache Client
 *
 * Stub implementation for TypeScript compilation.
 * Provides caching interface for provider gateway.
 *
 * @module cacheClient
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('CacheClient');

/**
 * Cache Client Interface
 */
export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * In-Memory Cache Client
 *
 * Stub implementation - provides minimal caching for compilation
 */
class InMemoryCacheClient implements CacheClient {
  private cache: Map<string, { value: string; expiry: number }> = new Map();

  constructor() {
    logger.info('InMemoryCacheClient initialized (stub)');
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check expiry
    if (entry.expiry > 0 && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.cache.set(key, { value: serialized, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * Singleton cache client instance
 */
export const cacheClient: CacheClient = new InMemoryCacheClient();
