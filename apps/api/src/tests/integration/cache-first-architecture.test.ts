/**
 * Comprehensive Cache-First Architecture Integration Tests
 * Tests the L1/L2/L3 cache hierarchy and performance targets
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';
import { ProductionRedisService } from '../../services/productionRedis';
import { createSupabaseClient } from '../../services/supabaseClient';
import { performance } from 'perf_hooks';

describe('Cache-First Architecture Integration', () => {
  let cacheFirstService: CacheFirstUnifiedPicksService;
  let redisService: ProductionRedisService;
  let supabaseClient: ReturnType<typeof createSupabaseClient>;

  beforeEach(async () => {
    // Initialize services
    redisService = new ProductionRedisService();
    supabaseClient = createSupabaseClient();
    cacheFirstService = new CacheFirstUnifiedPicksService(
      redisService,
      supabaseClient,
      console
    );

    // Clear test data
    await redisService.clear();
    await supabaseClient.from('unified_picks').delete().neq('id', '');
  });

  afterEach(async () => {
    await redisService.disconnect();
  });

  describe('Contract Tests', () => {
    it('should validate unified_picks table schema', async () => {
      const { data, error } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify required columns exist
      const testPick = {
        capper_id: 'test-capper',
        player_name: 'Test Player',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      const { error: insertError } = await supabaseClient
        .from('unified_picks')
        .insert(testPick);

      expect(insertError).toBeNull();
    });

    it('should validate view_props_for_form exists', async () => {
      const { data, error } = await supabaseClient
        .from('view_props_for_form')
        .select('player_name, market, game_date')
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should validate cache.book_quotes schema', async () => {
      const { data, error } = await supabaseClient
        .from('book_quotes')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
    });
  });

  describe('Cache Performance Tests', () => {
    it('should achieve <100ms response times for cache hits', async () => {
      const testPick = {
        id: 'perf-test-1',
        capper_id: 'test-capper',
        player_name: 'Performance Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      // First call - cache miss (warm the cache)
      await cacheFirstService.createUnifiedPick(testPick);

      // Second call - cache hit (measure performance)
      const startTime = performance.now();
      const result = await cacheFirstService.getUnifiedPick('perf-test-1');
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(100); // <100ms target
      expect(result).toBeDefined();
      expect(result?.id).toBe('perf-test-1');
    });

    it('should maintain >90% cache hit rate over time', async () => {
      const testPicks = Array.from({ length: 100 }, (_, i) => ({
        id: `cache-test-${i}`,
        capper_id: 'test-capper',
        player_name: `Player ${i}`,
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      }));

      // Create picks (cache miss)
      await Promise.all(
        testPicks.map(pick => cacheFirstService.createUnifiedPick(pick))
      );

      // Read picks multiple times (should hit cache)
      const reads = [];
      for (let i = 0; i < 100; i++) {
        reads.push(cacheFirstService.getUnifiedPick(`cache-test-${i % 20}`));
      }

      await Promise.all(reads);

      // Verify cache hit rate
      const metrics = await cacheFirstService.getCacheMetrics();
      expect(metrics.hitRate).toBeGreaterThan(0.9); // >90% target
    });

    it('should gracefully handle Redis failures', async () => {
      const testPick = {
        capper_id: 'test-capper',
        player_name: 'Fallback Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      // Simulate Redis failure
      jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis down'));
      jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis down'));

      // Should still work with database fallback
      const result = await cacheFirstService.createUnifiedPick(testPick);
      expect(result).toBeDefined();
      expect(result.player_name).toBe('Fallback Test');

      // Clean up mocks
      jest.restoreAllMocks();
    });
  });

  describe('Cache Invalidation Tests', () => {
    it('should invalidate related caches on pick updates', async () => {
      const testPick = {
        id: 'invalidation-test',
        capper_id: 'test-capper',
        player_name: 'Invalidation Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      // Create pick
      await cacheFirstService.createUnifiedPick(testPick);

      // Update pick (should invalidate cache)
      await cacheFirstService.updateUnifiedPick('invalidation-test', {
        professional_score: 0.85
      });

      // Verify cache was invalidated and updated
      const updated = await cacheFirstService.getUnifiedPick('invalidation-test');
      expect(updated?.professional_score).toBe(0.85);
    });

    it('should warm frequently accessed data', async () => {
      const startTime = performance.now();

      await cacheFirstService.warmFrequentlyAccessedData();

      const endTime = performance.now();
      const warmupTime = endTime - startTime;

      // Should complete warming in reasonable time
      expect(warmupTime).toBeLessThan(5000); // <5 seconds

      // Verify some data was warmed
      const metrics = await cacheFirstService.getCacheMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('L1/L2/L3 Cache Hierarchy', () => {
    it('should follow L1 -> L2 -> L3 fallback pattern', async () => {
      const testId = 'hierarchy-test';
      const testPick = {
        id: testId,
        capper_id: 'test-capper',
        player_name: 'Hierarchy Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'ingested'
      };

      // L3: Create in database
      await cacheFirstService.createUnifiedPick(testPick);

      // L2: Should cache in Redis
      const fromRedis = await cacheFirstService.getUnifiedPick(testId);
      expect(fromRedis).toBeDefined();

      // L1: Should cache in memory for subsequent calls
      const startTime = performance.now();
      await cacheFirstService.getUnifiedPick(testId);
      const endTime = performance.now();

      // Memory cache should be ultra-fast
      expect(endTime - startTime).toBeLessThan(10); // <10ms for L1
    });
  });
});