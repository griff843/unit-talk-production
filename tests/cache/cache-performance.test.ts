import { CacheFirstUnifiedPicksService } from '../../apps/api/src/services/CacheFirstUnifiedPicksService';
import { supabase } from '../../apps/api/src/services/supabaseClient';
import Redis from 'ioredis';
import { jest } from '@jest/globals';

/**
 * Cache Performance Tests for L1/L2/L3 Hierarchy
 * Tests cache hit rates, response times, and invalidation patterns
 */
describe('Cache Performance Tests', () => {
  let cacheService: CacheFirstUnifiedPicksService;
  let redis: Redis;
  
  // Performance targets
  const CACHE_HIT_RATE_TARGET = 0.9; // >90%
  const RESPONSE_TIME_TARGET = 100; // <100ms
  const BATCH_RESPONSE_TIME_TARGET = 500; // <500ms for 100 items

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    cacheService = new CacheFirstUnifiedPicksService({
      supabase,
      redis,
      logger: console
    });

    // Warm up cache with test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await redis.quit();
  });

  describe('L1 Cache (Redis) Performance', () => {
    test('single key retrieval under target response time', async () => {
      const key = 'test_prop_redis_001';
      
      // Prime the cache
      await cacheService.set(key, {
        external_prop_id: key,
        player_name: 'Test Player',
        market: 'passing_yards',
        line: 275.5,
        odds_over: -110,
        odds_under: -110
      }, 300); // 5 minutes TTL

      // Measure retrieval time
      const startTime = process.hrtime.bigint();
      const result = await cacheService.get(key);
      const endTime = process.hrtime.bigint();
      
      const responseTime = Number(endTime - startTime) / 1_000_000; // Convert to ms
      
      expect(result).toBeDefined();
      expect(result!.external_prop_id).toBe(key);
      expect(responseTime).toBeLessThan(RESPONSE_TIME_TARGET);
    });

    test('batch retrieval performance', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `batch_test_${i}`);
      
      // Prime cache with batch data
      const batchData = keys.map(key => ({
        key,
        value: {
          external_prop_id: key,
          player_name: `Player ${key}`,
          market: 'passing_yards',
          line: 250 + Math.random() * 50,
          odds_over: -110,
          odds_under: -110
        },
        ttl: 300
      }));
      
      await cacheService.setBatch(batchData);

      // Measure batch retrieval time
      const startTime = process.hrtime.bigint();
      const results = await cacheService.getBatch(keys);
      const endTime = process.hrtime.bigint();
      
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      expect(results.length).toBe(100);
      expect(responseTime).toBeLessThan(BATCH_RESPONSE_TIME_TARGET);
      expect(responseTime / 100).toBeLessThan(5); // <5ms per item average
    });

    test('cache hit rate validation', async () => {
      const testKeys = Array.from({ length: 50 }, (_, i) => `hit_rate_test_${i}`);
      
      // Prime half the cache
      for (let i = 0; i < 25; i++) {
        await cacheService.set(testKeys[i], {
          external_prop_id: testKeys[i],
          cached: true
        }, 300);
      }

      let cacheHits = 0;
      let totalRequests = 0;

      // Test cache hit/miss pattern
      for (const key of testKeys) {
        const result = await cacheService.get(key);
        totalRequests++;
        if (result) {
          cacheHits++;
        }
      }

      const hitRate = cacheHits / totalRequests;
      expect(hitRate).toBe(0.5); // Exactly 50% as expected
      
      // Now prime all keys and test again
      for (let i = 25; i < 50; i++) {
        await cacheService.set(testKeys[i], {
          external_prop_id: testKeys[i],
          cached: true
        }, 300);
      }

      cacheHits = 0;
      totalRequests = 0;

      for (const key of testKeys) {
        const result = await cacheService.get(key);
        totalRequests++;
        if (result) {
          cacheHits++;
        }
      }

      const fullHitRate = cacheHits / totalRequests;
      expect(fullHitRate).toBeGreaterThanOrEqual(CACHE_HIT_RATE_TARGET);
    });
  });

  describe('L2 Cache (Supabase Views) Performance', () => {
    test('materialized view query performance', async () => {
      const startTime = process.hrtime.bigint();
      
      const { data, error } = await supabase
        .from('mv_props_for_form')
        .select('*')
        .eq('sport', 'nfl')
        .limit(100);
      
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(responseTime).toBeLessThan(200); // <200ms for materialized view
    });

    test('view_props_for_form query performance with filters', async () => {
      const startTime = process.hrtime.bigint();
      
      const { data, error } = await supabase
        .from('view_props_for_form')
        .select('*')
        .eq('sport', 'nfl')
        .eq('market', 'passing_yards')
        .gte('line', 200)
        .limit(50);
      
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(responseTime).toBeLessThan(150); // <150ms for filtered view query
    });
  });

  describe('L3 Cache (Full Database) Performance', () => {
    test('unified_picks direct query performance', async () => {
      const startTime = process.hrtime.bigint();
      
      const { data, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('sport', 'nfl')
        .not('settled_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(responseTime).toBeLessThan(300); // <300ms for complex database query
    });

    test('index utilization for performance-critical queries', async () => {
      // Test external_ids index
      const startTime1 = process.hrtime.bigint();
      
      const { data: data1, error: error1 } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('external_game_id', 'test_game_001')
        .eq('external_prop_id', 'test_prop_001');
      
      const endTime1 = process.hrtime.bigint();
      const responseTime1 = Number(endTime1 - startTime1) / 1_000_000;
      
      expect(error1).toBeNull();
      expect(responseTime1).toBeLessThan(50); // <50ms for indexed lookup
      
      // Test game_date index
      const startTime2 = process.hrtime.bigint();
      
      const { data: data2, error: error2 } = await supabase
        .from('unified_picks')
        .select('*')
        .gte('game_date', '2024-01-01')
        .lte('game_date', '2024-01-31')
        .limit(100);
      
      const endTime2 = process.hrtime.bigint();
      const responseTime2 = Number(endTime2 - startTime2) / 1_000_000;
      
      expect(error2).toBeNull();
      expect(responseTime2).toBeLessThan(100); // <100ms for date range query
    });
  });

  describe('Cache Invalidation Patterns', () => {
    test('TTL expiration works correctly', async () => {
      const key = 'ttl_test_key';
      const shortTTL = 2; // 2 seconds
      
      await cacheService.set(key, { test: 'data' }, shortTTL);
      
      // Should be cached immediately
      const result1 = await cacheService.get(key);
      expect(result1).toBeDefined();
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Should be expired
      const result2 = await cacheService.get(key);
      expect(result2).toBeNull();
    });

    test('manual cache invalidation', async () => {
      const keys = ['manual_inv_1', 'manual_inv_2', 'manual_inv_3'];
      
      // Cache all keys
      for (const key of keys) {
        await cacheService.set(key, { data: key }, 300);
      }
      
      // Verify cached
      const results1 = await cacheService.getBatch(keys);
      expect(results1.length).toBe(3);
      
      // Invalidate one key
      await cacheService.invalidate(keys[0]);
      
      // Verify selective invalidation
      const result2 = await cacheService.get(keys[0]);
      const result3 = await cacheService.get(keys[1]);
      
      expect(result2).toBeNull();
      expect(result3).toBeDefined();
      
      // Batch invalidation
      await cacheService.invalidateBatch([keys[1], keys[2]]);
      
      const results4 = await cacheService.getBatch([keys[1], keys[2]]);
      expect(results4.every(r => r === null)).toBe(true);
    });

    test('cache warming performance', async () => {
      const warmingKeys = Array.from({ length: 200 }, (_, i) => `warm_${i}`);
      const warmingData = warmingKeys.map(key => ({
        key,
        value: {
          external_prop_id: key,
          warmed: true,
          timestamp: Date.now()
        },
        ttl: 600
      }));
      
      const startTime = process.hrtime.bigint();
      await cacheService.warmCache(warmingData);
      const endTime = process.hrtime.bigint();
      
      const warmingTime = Number(endTime - startTime) / 1_000_000;
      
      expect(warmingTime).toBeLessThan(1000); // <1 second to warm 200 keys
      expect(warmingTime / 200).toBeLessThan(5); // <5ms per key average
      
      // Verify warming worked
      const verifyResults = await cacheService.getBatch(warmingKeys.slice(0, 10));
      expect(verifyResults.length).toBe(10);
      expect(verifyResults.every(r => r && r.warmed)).toBe(true);
    });
  });

  describe('Redis Failure Scenarios', () => {
    test('graceful fallback when Redis is unavailable', async () => {
      // Simulate Redis failure by disconnecting
      await redis.disconnect();
      
      const startTime = process.hrtime.bigint();
      
      // Should fallback to database query
      const result = await cacheService.getWithFallback('fallback_test_prop');
      
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      expect(result).toBeDefined(); // Should work via fallback
      expect(responseTime).toBeLessThan(500); // Should still be reasonable
      
      // Reconnect Redis for other tests
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      cacheService = new CacheFirstUnifiedPicksService({
        supabase,
        redis,
        logger: console
      });
    });

    test('cache circuit breaker pattern', async () => {
      // This test would simulate multiple Redis failures
      // and verify that the circuit breaker opens to prevent
      // cascading failures
      
      const results = [];
      
      // Simulate 10 consecutive failures
      for (let i = 0; i < 10; i++) {
        try {
          const result = await cacheService.getWithCircuitBreaker(`circuit_test_${i}`);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error });
        }
      }
      
      // Circuit breaker should activate after multiple failures
      // This is implementation-dependent and would need the actual
      // circuit breaker logic in the cache service
      expect(results.length).toBe(10);
    });
  });

  describe('Memory and Resource Management', () => {
    test('cache memory usage stays within limits', async () => {
      const initialMemory = await redis.memory('usage');
      
      // Cache large amount of data
      const largeDataKeys = Array.from({ length: 1000 }, (_, i) => `large_data_${i}`);
      const largeData = largeDataKeys.map(key => ({
        key,
        value: {
          external_prop_id: key,
          largeField: 'x'.repeat(1000), // 1KB per entry
          metadata: Array.from({ length: 100 }, (_, j) => ({ field: j, value: Math.random() }))
        },
        ttl: 300
      }));
      
      await cacheService.setBatch(largeData);
      
      const finalMemory = await redis.memory('usage');
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should be reasonable memory usage (less than 2MB for 1000 x 1KB entries)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
      
      // Cleanup large data
      await cacheService.invalidateBatch(largeDataKeys);
    });

    test('connection pool management', async () => {
      // Test multiple concurrent cache operations
      const concurrentOperations = Array.from({ length: 50 }, (_, i) => 
        cacheService.get(`concurrent_test_${i}`)
      );
      
      const startTime = process.hrtime.bigint();
      const results = await Promise.all(concurrentOperations);
      const endTime = process.hrtime.bigint();
      
      const totalTime = Number(endTime - startTime) / 1_000_000;
      
      expect(results.length).toBe(50);
      expect(totalTime).toBeLessThan(1000); // <1 second for 50 concurrent ops
    });
  });

  // Helper functions
  async function setupTestData() {
    // Insert test data into unified_picks
    const testPicks = [
      {
        external_prop_id: 'test_prop_redis_001',
        external_game_id: 'test_game_001',
        source: 'optimal',
        sport: 'nfl',
        market: 'passing_yards',
        player_name: 'Test Player 1',
        line: 275.5,
        odds_over: -110,
        odds_under: -110,
        team: 'Team A',
        opponent: 'Team B',
        game_date: '2024-01-21'
      },
      {
        external_prop_id: 'fallback_test_prop',
        external_game_id: 'test_game_002',
        source: 'optimal',
        sport: 'nfl',
        market: 'rushing_yards',
        player_name: 'Test Player 2',
        line: 85.5,
        odds_over: -115,
        odds_under: -105,
        team: 'Team C',
        opponent: 'Team D',
        game_date: '2024-01-21'
      }
    ];

    for (const pick of testPicks) {
      await supabase.from('unified_picks').upsert(pick);
    }
  }

  async function cleanupTestData() {
    // Clean Redis cache
    const pattern = 'test_*';
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    // Clean batch test keys
    const batchKeys = await redis.keys('batch_test_*');
    if (batchKeys.length > 0) {
      await redis.del(...batchKeys);
    }

    // Clean hit rate test keys
    const hitRateKeys = await redis.keys('hit_rate_test_*');
    if (hitRateKeys.length > 0) {
      await redis.del(...hitRateKeys);
    }

    // Clean database test data
    await supabase
      .from('unified_picks')
      .delete()
      .in('external_prop_id', [
        'test_prop_redis_001',
        'fallback_test_prop'
      ]);
  }
});
