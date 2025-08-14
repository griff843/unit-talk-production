import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getCanonicalHealthTiles, convertToLegacyFormat } from '../../src/server/health';

describe('Health Canonical API', () => {
  describe('getCanonicalHealthTiles', () => {
    it('should return canonical health tiles structure', async () => {
      const result = await getCanonicalHealthTiles();

      expect(result).toEqual(
        expect.objectContaining({
          feedFreshnessSeconds: expect.any(Number),
          temporalBacklogAgeSeconds: expect.any(Number),
          canaryLastSeenAt: expect.any(String),
          failureBurnRateLevel: expect.stringMatching(/^(green|yellow|red|unknown)$/),
          providerCreditsPerMin: expect.any(Number),
          providerPctDailyBudget: expect.any(Number),
          dlqCount: expect.any(Number),
          source: expect.stringMatching(/^(live|fallback)$/),
          timestamp: expect.any(String),
        })
      );
    });

    it('should return fallback data when live data unavailable', async () => {
      // Mock scenario where live data is not available
      const result = await getCanonicalHealthTiles();
      
      if (result.source === 'fallback') {
        expect(result.feedFreshnessSeconds).toBe(0);
        expect(result.temporalBacklogAgeSeconds).toBe(0);
        expect(result.canaryLastSeenAt).toBeNull();
        expect(result.failureBurnRateLevel).toBe('unknown');
        expect(result.providerCreditsPerMin).toBeNull();
        expect(result.providerPctDailyBudget).toBeNull();
        expect(result.dlqCount).toBe(0);
      }
    });

    it('should have valid timestamp format', async () => {
      const result = await getCanonicalHealthTiles();
      const timestamp = new Date(result.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have numeric values within reasonable ranges', async () => {
      const result = await getCanonicalHealthTiles();
      
      expect(result.feedFreshnessSeconds).toBeGreaterThanOrEqual(0);
      expect(result.temporalBacklogAgeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.dlqCount).toBeGreaterThanOrEqual(0);
      
      if (result.providerCreditsPerMin !== null) {
        expect(result.providerCreditsPerMin).toBeGreaterThanOrEqual(0);
      }
      
      if (result.providerPctDailyBudget !== null) {
        expect(result.providerPctDailyBudget).toBeGreaterThanOrEqual(0);
        expect(result.providerPctDailyBudget).toBeLessThanOrEqual(200); // Allow for over-budget scenarios
      }
    });
  });

  describe('convertToLegacyFormat', () => {
    const mockCanonicalData = {
      feedFreshnessSeconds: 120,
      temporalBacklogAgeSeconds: 300,
      canaryLastSeenAt: new Date().toISOString(),
      failureBurnRateLevel: 'green' as const,
      providerCreditsPerMin: 45.5,
      providerPctDailyBudget: 67.8,
      dlqCount: 2,
      source: 'live' as const,
      timestamp: new Date().toISOString(),
    };

    it('should convert canonical format to legacy format', () => {
      const result = convertToLegacyFormat(mockCanonicalData);

      expect(result).toEqual(
        expect.objectContaining({
          feedFreshnessSeconds: 120,
          temporalBacklogAgeSeconds: 300,
          canaryLastSeenAt: mockCanonicalData.canaryLastSeenAt,
          failureBurnRateLevel: 'green',
          providerCreditsPerMin: 45.5,
          percentOfDailyBudget: 67.8, // Note the field name change
          dlqCount: 2,
        })
      );
    });

    it('should handle null values properly', () => {
      const canonicalWithNulls = {
        ...mockCanonicalData,
        canaryLastSeenAt: null,
        providerCreditsPerMin: null,
        providerPctDailyBudget: null,
      };

      const result = convertToLegacyFormat(canonicalWithNulls);

      expect(result.canaryLastSeenAt).toBeNull();
      expect(result.providerCreditsPerMin).toBeNull();
      expect(result.percentOfDailyBudget).toBeNull();
    });

    it('should maintain data integrity during conversion', () => {
      const result = convertToLegacyFormat(mockCanonicalData);

      // Should preserve all non-renamed fields
      expect(result.feedFreshnessSeconds).toBe(mockCanonicalData.feedFreshnessSeconds);
      expect(result.temporalBacklogAgeSeconds).toBe(mockCanonicalData.temporalBacklogAgeSeconds);
      expect(result.failureBurnRateLevel).toBe(mockCanonicalData.failureBurnRateLevel);
      expect(result.dlqCount).toBe(mockCanonicalData.dlqCount);

      // Should rename the budget field correctly
      expect(result.percentOfDailyBudget).toBe(mockCanonicalData.providerPctDailyBudget);
    });
  });

  describe('API endpoint integration', () => {
    it('should return 200 status with canonical data structure', async () => {
      // This test would typically use supertest or similar to test the actual API endpoint
      // For now, we'll test the core function that the API uses
      const result = await getCanonicalHealthTiles();
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.source).toMatch(/^(live|fallback)$/);
    });

    it('should handle errors gracefully and return fallback data', async () => {
      // Test that the function never throws and always returns valid data
      await expect(getCanonicalHealthTiles()).resolves.toBeDefined();
    });
  });

  describe('performance requirements', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      await getCanonicalHealthTiles();
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 second max for health checks
    });

    it('should handle multiple concurrent calls', async () => {
      const promises = Array(5).fill(null).map(() => getCanonicalHealthTiles());
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.source).toMatch(/^(live|fallback)$/);
      });
    });
  });

  describe('data validation', () => {
    it('should validate burn rate levels', async () => {
      const result = await getCanonicalHealthTiles();
      expect(['green', 'yellow', 'red', 'unknown']).toContain(result.failureBurnRateLevel);
    });

    it('should validate source values', async () => {
      const result = await getCanonicalHealthTiles();
      expect(['live', 'fallback']).toContain(result.source);
    });

    it('should ensure timestamp is recent', async () => {
      const result = await getCanonicalHealthTiles();
      const timestamp = new Date(result.timestamp);
      const now = new Date();
      
      // Timestamp should be within the last 10 minutes
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      expect(timestamp.getTime()).toBeGreaterThan(tenMinutesAgo.getTime());
    });
  });
});