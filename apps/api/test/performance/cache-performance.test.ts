import { MLPredictionCache } from '../../src/cache/enhanced-cache';
import { CachedMLPipeline } from '../../src/ml/cached-pipeline';
import { mockFeatureSet } from '../mocks/ml-mocks';

describe('Cache Performance Tests', () => {
  let cachedPipeline: CachedMLPipeline;
  let cache: MLPredictionCache;

  beforeEach(() => {
    cachedPipeline = new CachedMLPipeline();
    cache = new MLPredictionCache();
  });

  describe('Cache Hit Performance', () => {
    it('should provide significant performance improvement on cache hits', async () => {
      const input = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      // First call - cache miss
      const startTime1 = Date.now();
      const result1 = await cachedPipeline.predict(input);
      const endTime1 = Date.now();
      const firstCallLatency = endTime1 - startTime1;

      // Second call - cache hit
      const startTime2 = Date.now();
      const result2 = await cachedPipeline.predict(input);
      const endTime2 = Date.now();
      const secondCallLatency = endTime2 - startTime2;

      // Verify cache hit is significantly faster
      expect(secondCallLatency).toBeLessThan(firstCallLatency * 0.1); // 90% improvement
      expect(result2.metadata?.cached).toBe(true);
      expect(result1.prediction).toBe(result2.prediction);
    });

    it('should handle high volume of cache hits efficiently', async () => {
      const inputs = Array(100).fill(null).map((_, i) => ({
        sport: 'NBA',
        player: `Player${i}`,
        market: 'points',
        line: 20 + (i % 10),
        timestamp: new Date().toISOString()
      }));

      // First pass - populate cache
      const startTime1 = Date.now();
      await Promise.all(inputs.map(input => cachedPipeline.predict(input)));
      const endTime1 = Date.now();
      const firstPassTime = endTime1 - startTime1;

      // Second pass - cache hits
      const startTime2 = Date.now();
      await Promise.all(inputs.map(input => cachedPipeline.predict(input)));
      const endTime2 = Date.now();
      const secondPassTime = endTime2 - startTime2;

      // Verify significant performance improvement
      expect(secondPassTime).toBeLessThan(firstPassTime * 0.2); // 80% improvement
    });
  });

  describe('Cache Memory Management', () => {
    it('should maintain memory usage within limits', async () => {
      const inputs = Array(1000).fill(null).map((_, i) => ({
        sport: 'NBA',
        player: `Player${i}`,
        market: 'points',
        line: 20 + (i % 10),
        timestamp: new Date().toISOString()
      }));

      // Populate cache
      await Promise.all(inputs.map(input => cachedPipeline.predict(input)));

      const stats = await cachedPipeline.getCacheStats();
      
      // Verify memory usage is reasonable
      expect(stats.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB limit
      expect(stats.size).toBeLessThanOrEqual(10000); // Max cache size
    });

    it('should evict entries when cache is full', async () => {
      const inputs = Array(15000).fill(null).map((_, i) => ({
        sport: 'NBA',
        player: `Player${i}`,
        market: 'points',
        line: 20 + (i % 10),
        timestamp: new Date().toISOString()
      }));

      // Populate cache beyond capacity
      await Promise.all(inputs.map(input => cachedPipeline.predict(input)));

      const stats = await cachedPipeline.getCacheStats();
      
      // Verify evictions occurred
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(10000); // Max cache size
    });
  });

  describe('Cache Invalidation', () => {
    it('should properly invalidate cache entries', async () => {
      const input = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      // First call
      const result1 = await cachedPipeline.predict(input);
      expect(result1.metadata?.cached).toBe(false);

      // Second call - should be cached
      const result2 = await cachedPipeline.predict(input);
      expect(result2.metadata?.cached).toBe(true);

      // Invalidate cache
      await cachedPipeline.invalidateCache('.*LeBron.*');

      // Third call - should not be cached
      const result3 = await cachedPipeline.predict(input);
      expect(result3.metadata?.cached).toBe(false);
    });

    it('should handle force refresh correctly', async () => {
      const input = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      // First call
      const result1 = await cachedPipeline.predict(input);
      expect(result1.metadata?.cached).toBe(false);

      // Second call with force refresh
      const result2 = await cachedPipeline.predictWithCache(input, true);
      expect(result2.metadata?.cached).toBe(false);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent cache access correctly', async () => {
      const input = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      // Simulate concurrent access
      const concurrentRequests = Array(50).fill(null).map(() => 
        cachedPipeline.predict(input)
      );

      const results = await Promise.all(concurrentRequests);

      // Verify all requests completed successfully
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.prediction).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });

      // Verify only one cache miss occurred
      const cacheMisses = results.filter(r => !r.metadata?.cached).length;
      expect(cacheMisses).toBe(1);
    });
  });

  describe('Cache Hit Rate Optimization', () => {
    it('should maintain high hit rate with similar inputs', async () => {
      const baseInput = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      // Generate similar inputs
      const similarInputs = Array(100).fill(null).map((_, i) => ({
        ...baseInput,
        line: 25.5 + (i * 0.1), // Small variations
        timestamp: new Date(Date.now() + i * 60000).toISOString() // 1-minute intervals
      }));

      // Process all inputs
      await Promise.all(similarInputs.map(input => cachedPipeline.predict(input)));

      const stats = await cachedPipeline.getCacheStats();
      const hitRate = stats.hits / (stats.hits + stats.misses);

      // Should have reasonable hit rate
      expect(hitRate).toBeGreaterThan(0.3);
    });
  });
}); 