import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Redis from 'ioredis';
import fs from 'node:fs';
import path from 'node:path';

// Mock dependencies
jest.mock('ioredis');
jest.mock('node:fs');
jest.mock('node:path');

const MockRedis = Redis as jest.MockedClass<typeof Redis>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('CacheClient', () => {
  let cacheClient: any;
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedisInstance = {
      get: jest.fn(),
      setex: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockRedis.mockImplementation(() => mockRedisInstance);

    // Mock path operations
    mockPath.resolve.mockReturnValue('C:\\mock\\path');
    mockPath.join.mockReturnValue('C:\\mock\\path\\cache-stats.json');

    // Mock fs operations
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Reset module cache and import fresh
    delete require.cache[require.resolve('../../apps/api/src/services/cacheClient.ts')];
    const module = await import('../../apps/api/src/services/cacheClient.js');
    cacheClient = module.cacheClient;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('hit/miss accounting', () => {
    it('should track cache hits', async () => {
      mockRedisInstance.get.mockResolvedValue('{"data": "test"}');

      const result = await cacheClient.get('test-key');

      expect(result).toEqual({ data: 'test' });

      const stats = cacheClient.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await cacheClient.get('test-key');

      expect(result).toBeNull();

      const stats = cacheClient.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should track set operations', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      await cacheClient.set('test-key', { data: 'test' }, 60);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        60,
        '{"data":"test"}'
      );

      const stats = cacheClient.getStats();
      expect(stats.sets).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce('{"hit": 1}')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('{"hit": 2}');

      await cacheClient.get('key1'); // hit
      await cacheClient.get('key2'); // miss
      await cacheClient.get('key3'); // hit

      const filePath = cacheClient.exportStats();

      // Should write stats with correct hit rate
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"hitRate":"66.67%"')
      );
    });
  });

  describe('TTL behavior', () => {
    it('should use default TTL when not specified', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      await cacheClient.set('test-key', 'value');

      // Should use default TTL (90 seconds)
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        90,
        '"value"'
      );
    });

    it('should use custom TTL when specified', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      await cacheClient.set('test-key', 'value', 300);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        '"value"'
      );
    });

    it('should use set without expiration when TTL is 0', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await cacheClient.set('test-key', 'value', 0);

      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', '"value"');
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Simulate Redis connection error
      mockRedisInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheClient.get('test-key');

      expect(result).toBeNull();

      const stats = cacheClient.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should handle set errors gracefully', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Set failed'));

      const result = await cacheClient.set('test-key', 'value');

      expect(result).toBe(false);
    });

    it('should track misses when Redis is unavailable', async () => {
      // Simulate no Redis connection
      const module = await import('../../apps/api/src/services/cacheClient.js');
      const clientWithoutRedis = module.cacheClient;

      // Force redis to null
      (clientWithoutRedis as any).redis = null;

      const result = await clientWithoutRedis.get('test-key');

      expect(result).toBeNull();

      const stats = clientWithoutRedis.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe('cache-first mode', () => {
    it('should detect cache-first mode from environment', () => {
      const originalEnv = process.env.CACHE_FIRST;

      process.env.CACHE_FIRST = '1';
      expect(cacheClient.isCacheFirst()).toBe(true);

      process.env.CACHE_FIRST = 'true';
      expect(cacheClient.isCacheFirst()).toBe(true);

      process.env.CACHE_FIRST = 'false';
      expect(cacheClient.isCacheFirst()).toBe(false);

      delete process.env.CACHE_FIRST;
      expect(cacheClient.isCacheFirst()).toBe(false);

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.CACHE_FIRST = originalEnv;
      }
    });
  });

  describe('stats export', () => {
    it('should export stats to JSON file', () => {
      const filePath = cacheClient.exportStats();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('cache'),
        { recursive: true }
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringMatching(/"exportTime".*"hitRate".*"redisConnected"/)
      );

      expect(filePath).toContain('.json');
    });
  });
});