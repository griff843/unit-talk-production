/**
 * Tests for AI Response Caching System
 * Validates caching behavior, invalidation, and cost optimization
 */

import { aiResponseCache } from '../../src/ai/cache';
import { aiModelRouter } from '../../src/ai/routing';

describe('AI Response Cache Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    aiResponseCache.clear();
    
    // Set test environment variables
    process.env.ADVICE_CACHE_TTL_SEC = '86400';
    process.env.ADVICE_REQUERY_BPS = '15';
  });

  describe('Cache Hit/Miss Logic', () => {
    test('should return MISS on first call, HIT on second call with same inputs', () => {
      const context = { player: 'LeBron James', tier: 'S', league: 'NBA' };
      const cacheKey = aiResponseCache.generateAdviceCacheKey('test-prop-1', -110, 25.5, context);
      
      // First call - should be MISS
      const firstResult = aiResponseCache.get(cacheKey);
      expect(firstResult).toBeNull();
      
      // Set cache entry
      aiResponseCache.set(cacheKey, 'Advice content', 'kimi-k2', 'moonshot', 250, 0.000375);
      
      // Second call - should be HIT
      const secondResult = aiResponseCache.get(cacheKey);
      expect(secondResult).not.toBeNull();
      expect(secondResult?.content).toBe('Advice content');
      expect(secondResult?.model).toBe('kimi-k2');
      expect(secondResult?.hitCount).toBe(1);
    });

    test('should trigger MISS when odds move beyond threshold', () => {
      const context = { player: 'Stephen Curry', tier: 'S', league: 'NBA' };
      const initialOdds = -110;
      const movedOdds = -125; // Significant movement
      
      const initialKey = aiResponseCache.generateAdviceCacheKey('test-prop-odds', initialOdds, 28.5, context);
      const movedKey = aiResponseCache.generateAdviceCacheKey('test-prop-odds', movedOdds, 28.5, context);
      
      // Set initial cache
      aiResponseCache.set(initialKey, 'Initial advice', 'kimi-k2', 'moonshot', 200, 0.0003);
      
      // Check requery logic
      const shouldRequery = aiResponseCache.shouldRequeryAdvice('test-prop-odds', movedOdds, 28.5, context);
      expect(shouldRequery.shouldRequery).toBe(true);
      expect(shouldRequery.reason).toContain('bps');
      
      // Moved odds key should be a miss
      const result = aiResponseCache.get(movedKey);
      expect(result).toBeNull();
    });

    test('should trigger MISS when context changes', () => {
      const initialContext = { player: 'Luka Doncic', tier: 'S', league: 'NBA' };
      const changedContext = { player: 'Luka Doncic', tier: 'A', league: 'NBA' }; // Tier changed
      
      const initialKey = aiResponseCache.generateAdviceCacheKey('test-prop-context', -110, 32.5, initialContext);
      const changedKey = aiResponseCache.generateAdviceCacheKey('test-prop-context', -110, 32.5, changedContext);
      
      // Set initial cache
      aiResponseCache.set(initialKey, 'Initial advice', 'kimi-k2', 'moonshot', 200, 0.0003);
      
      // Check requery logic for context change
      const shouldRequery = aiResponseCache.shouldRequeryAdvice('test-prop-context', -110, 32.5, changedContext);
      expect(shouldRequery.shouldRequery).toBe(true);
      expect(shouldRequery.reason).toBe('Context changed');
      
      // Changed context key should be a miss
      const result = aiResponseCache.get(changedKey);
      expect(result).toBeNull();
    });

    test('should NOT trigger requery for small odds movement', () => {
      const context = { player: 'Jimmy Butler', tier: 'A', league: 'NBA' };
      const initialOdds = -110;
      const slightlyMovedOdds = -111; // Small movement
      
      const shouldRequery = aiResponseCache.shouldRequeryAdvice('test-prop-small', slightlyMovedOdds, 22.5, context);
      expect(shouldRequery.shouldRequery).toBe(false);
    });
  });

  describe('Cache Metrics and Analysis', () => {
    test('should track cache hit rate correctly', () => {
      const context = { player: 'Giannis Antetokounmpo', tier: 'S', league: 'NBA' };
      const cacheKey = aiResponseCache.generateAdviceCacheKey('test-metrics', -110, 28.5, context);
      
      // Initial state
      let metrics = aiResponseCache.getMetrics();
      const initialHitRate = metrics.hitRate;
      
      // Miss
      aiResponseCache.get(cacheKey);
      
      // Set cache
      aiResponseCache.set(cacheKey, 'Advice content', 'kimi-k2', 'moonshot', 200, 0.0003);
      
      // Hit
      aiResponseCache.get(cacheKey);
      aiResponseCache.get(cacheKey);
      
      // Check final metrics
      metrics = aiResponseCache.getMetrics();
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.hitRate).toBe((2 / 3) * 100); // 66.67%
      expect(metrics.costSavings).toBe(0.0003 * 2); // 2 hits * cost
      expect(metrics.tokensSaved).toBe(200 * 2); // 2 hits * tokens
    });

    test('should provide cache statistics', () => {
      const context1 = { player: 'Joel Embiid', tier: 'S', league: 'NBA' };
      const context2 = { player: 'Jayson Tatum', tier: 'A', league: 'NBA' };
      
      const key1 = aiResponseCache.generateAdviceCacheKey('prop-1', -110, 25.5, context1);
      const key2 = aiResponseCache.generateAdviceCacheKey('prop-2', -115, 27.5, context2);
      
      // Set multiple cache entries
      aiResponseCache.set(key1, 'Advice 1', 'kimi-k2', 'moonshot', 200, 0.0003);
      aiResponseCache.set(key2, 'Advice 2', 'claude-sonnet', 'anthropic', 300, 0.0009);
      
      // Get some hits
      aiResponseCache.get(key1);
      aiResponseCache.get(key1);
      aiResponseCache.get(key2);
      
      const stats = aiResponseCache.getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.averageHitsPerEntry).toBe(1.5); // (2+1)/2
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    test('should identify popular cache entries', () => {
      const contexts = [
        { player: 'Kevin Durant', tier: 'S', league: 'NBA' },
        { player: 'Damian Lillard', tier: 'A', league: 'NBA' },
        { player: 'Anthony Davis', tier: 'S', league: 'NBA' }
      ];
      
      // Set cache entries
      contexts.forEach((context, i) => {
        const key = aiResponseCache.generateAdviceCacheKey(`popular-${i}`, -110, 25.5, context);
        aiResponseCache.set(key, `Advice ${i}`, 'kimi-k2', 'moonshot', 200, 0.0003);
        
        // Give different hit counts
        for (let j = 0; j <= i; j++) {
          aiResponseCache.get(key);
        }
      });
      
      const popularEntries = aiResponseCache.getPopularEntries(3);
      expect(popularEntries).toHaveLength(3);
      expect(popularEntries[0].entry.hitCount).toBeGreaterThanOrEqual(popularEntries[1].entry.hitCount);
      expect(popularEntries[1].entry.hitCount).toBeGreaterThanOrEqual(popularEntries[2].entry.hitCount);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate specific prop entries', () => {
      const context = { player: 'Russell Westbrook', tier: 'A', league: 'NBA' };
      const propId = 'test-invalidate-prop';
      
      const key = aiResponseCache.generateAdviceCacheKey(propId, -110, 25.5, context);
      aiResponseCache.set(key, 'Advice content', 'kimi-k2', 'moonshot', 200, 0.0003);
      
      // Verify entry exists
      expect(aiResponseCache.get(key)).not.toBeNull();
      
      // Invalidate
      const invalidatedCount = aiResponseCache.invalidateProp(propId);
      expect(invalidatedCount).toBe(1);
      
      // Verify entry is gone
      expect(aiResponseCache.get(key)).toBeNull();
    });

    test('should clean up expired entries', async () => {
      // Set short TTL for testing
      const originalTTL = aiResponseCache['DEFAULT_TTL_SEC'];
      aiResponseCache['DEFAULT_TTL_SEC'] = 1; // 1 second
      
      const context = { player: 'Chris Paul', tier: 'A', league: 'NBA' };
      const key = aiResponseCache.generateAdviceCacheKey('test-cleanup', -110, 25.5, context);
      
      // Set entry that will expire soon
      aiResponseCache.set(key, 'Advice content', 'kimi-k2', 'moonshot', 200, 0.0003);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Run cleanup
      const cleanedCount = aiResponseCache.cleanup();
      expect(cleanedCount).toBeGreaterThanOrEqual(1);
      
      // Verify entry is gone
      expect(aiResponseCache.get(key)).toBeNull();
      
      // Restore original TTL
      aiResponseCache['DEFAULT_TTL_SEC'] = originalTTL;
    }, 5000);
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent keys for advice', () => {
      const context = { player: 'Kawhi Leonard', tier: 'S', league: 'NBA' };
      
      const key1 = aiResponseCache.generateAdviceCacheKey('test-prop', -110, 25.5, context);
      const key2 = aiResponseCache.generateAdviceCacheKey('test-prop', -110, 25.5, context);
      
      expect(key1).toEqual(key2);
      expect(key1.type).toBe('advice');
      expect(key1.propId).toBe('test-prop');
      expect(key1.odds).toBe(-110);
      expect(key1.line).toBe(25.5);
    });

    test('should generate recap cache keys', () => {
      const context = { date: '2025-01-15', sport: 'NBA', games: 12 };
      const key = aiResponseCache.generateRecapCacheKey('2025-01-15', context);
      
      expect(key.type).toBe('recap');
      expect(key.propId).toBe('recap-2025-01-15');
      expect(key.odds).toBe(0);
    });

    test('should generate formatting cache keys', () => {
      const contentHash = 'abc123def456';
      const format = 'discord-embed';
      const key = aiResponseCache.generateFormattingCacheKey(contentHash, format);
      
      expect(key.type).toBe('formatting');
      expect(key.propId).toBe('format-abc123def456');
      expect(key.odds).toBe(0);
    });
  });

  describe('Integration with Routing System', () => {
    test('should integrate with odds movement calculation', () => {
      const bpsDiff1 = aiModelRouter.calculateOddsBpsDifference(-110, -115);
      const bpsDiff2 = aiModelRouter.calculateOddsBpsDifference(-110, -111);
      
      // Significant movement should trigger requery
      expect(bpsDiff1).toBeGreaterThan(15); // Above threshold
      expect(bpsDiff2).toBeLessThan(15); // Below threshold
      
      // Test requery logic
      expect(aiModelRouter.shouldRequery(-115, -110, 'hash1', 'hash1')).toBe(true);
      expect(aiModelRouter.shouldRequery(-111, -110, 'hash1', 'hash1')).toBe(false);
    });

    test('should integrate with context hash generation', () => {
      const context1 = { player: 'LeBron James', tier: 'S', game: 'LAL@GSW' };
      const context2 = { tier: 'S', game: 'LAL@GSW', player: 'LeBron James' }; // Same but different order
      const context3 = { player: 'LeBron James', tier: 'A', game: 'LAL@GSW' }; // Different tier
      
      const hash1 = aiModelRouter.generateContextHash(context1);
      const hash2 = aiModelRouter.generateContextHash(context2);
      const hash3 = aiModelRouter.generateContextHash(context3);
      
      expect(hash1).toBe(hash2); // Order independent
      expect(hash1).not.toBe(hash3); // Content dependent
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid cache entries gracefully', () => {
      const context = { player: 'Invalid Test', tier: 'S', league: 'NBA' };
      const key = aiResponseCache.generateAdviceCacheKey('invalid-test', -110, 25.5, context);
      
      // Try to get non-existent key
      const result = aiResponseCache.get(key);
      expect(result).toBeNull();
      
      // Metrics should still update
      const metrics = aiResponseCache.getMetrics();
      expect(metrics.cacheMisses).toBeGreaterThan(0);
    });

    test('should handle extreme odds movements', () => {
      const extremeBps = aiModelRouter.calculateOddsBpsDifference(+150, -150);
      expect(extremeBps).toBeGreaterThan(1000); // Very large movement
      
      const shouldRequery = aiModelRouter.shouldRequery(+150, -150, 'hash1', 'hash1');
      expect(shouldRequery).toBe(true);
    });
  });

  afterEach(() => {
    // Clean up
    aiResponseCache.clear();
    jest.restoreAllMocks();
  });
});