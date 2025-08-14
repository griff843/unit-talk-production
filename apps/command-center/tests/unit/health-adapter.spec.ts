import { describe, it, expect } from '@jest/globals';
import { 
  useHealthTileStatus, 
  useFormattedHealthTiles, 
  getHealthStatusColor, 
  getHealthTooltips 
} from '../../src/lib/hooks/useHealthTiles';
import type { CanonicalHealthTiles } from '../../src/server/health';

describe('Health Adapter Unit Tests', () => {
  const mockHealthTiles: CanonicalHealthTiles = {
    feedFreshnessSeconds: 120,
    temporalBacklogAgeSeconds: 300,
    canaryLastSeenAt: '2025-01-15T10:30:00Z',
    failureBurnRateLevel: 'green',
    providerCreditsPerMin: 45.5,
    providerPctDailyBudget: 67.8,
    dlqCount: 2,
    source: 'live',
    timestamp: '2025-01-15T10:35:00Z',
  };

  const mockHealthTilesWithNulls: CanonicalHealthTiles = {
    feedFreshnessSeconds: 1800,
    temporalBacklogAgeSeconds: 2000,
    canaryLastSeenAt: null,
    failureBurnRateLevel: 'red',
    providerCreditsPerMin: null,
    providerPctDailyBudget: null,
    dlqCount: 15,
    source: 'fallback',
    timestamp: '2025-01-15T10:35:00Z',
  };

  describe('useHealthTileStatus', () => {
    it('should return correct status for healthy metrics', () => {
      const result = useHealthTileStatus(mockHealthTiles);

      expect(result).toEqual({
        feedStatus: 'healthy', // 120s < 300s
        backlogStatus: 'healthy', // 300s < 300s (boundary)
        canaryStatus: 'critical', // Assuming canary is older than 15 minutes
        burnRateStatus: 'green',
        providerStatus: 'warning', // 67.8% between 50-80%
        dlqStatus: 'healthy', // 2 < 10
      });
    });

    it('should return correct status for critical metrics', () => {
      const result = useHealthTileStatus(mockHealthTilesWithNulls);

      expect(result).toEqual({
        feedStatus: 'critical', // 1800s >= 1800s
        backlogStatus: 'critical', // 2000s >= 1800s
        canaryStatus: 'unknown', // null canary
        burnRateStatus: 'red',
        providerStatus: 'unknown', // null provider data
        dlqStatus: 'critical', // 15 >= 10
      });
    });

    it('should return unknown status for undefined tiles', () => {
      const result = useHealthTileStatus(undefined);

      expect(result).toEqual({
        feedStatus: 'unknown',
        backlogStatus: 'unknown',
        canaryStatus: 'unknown',
        burnRateStatus: 'unknown',
        providerStatus: 'unknown',
        dlqStatus: 'unknown',
      });
    });

    it('should handle edge cases for thresholds', () => {
      const edgeCaseData: CanonicalHealthTiles = {
        feedFreshnessSeconds: 300, // Exactly at healthy/warning boundary
        temporalBacklogAgeSeconds: 1800, // Exactly at warning/critical boundary
        canaryLastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        failureBurnRateLevel: 'yellow',
        providerCreditsPerMin: 25,
        providerPctDailyBudget: 50, // Exactly at healthy/warning boundary
        dlqCount: 10, // Exactly at warning/critical boundary
        source: 'live',
        timestamp: new Date().toISOString(),
      };

      const result = useHealthTileStatus(edgeCaseData);

      expect(result.feedStatus).toBe('warning'); // 300s = warning threshold
      expect(result.backlogStatus).toBe('critical'); // 1800s = critical threshold
      expect(result.canaryStatus).toBe('healthy'); // 5 min < 5 min threshold
      expect(result.providerStatus).toBe('warning'); // 50% = warning threshold
      expect(result.dlqStatus).toBe('critical'); // 10 = critical threshold
    });
  });

  describe('useFormattedHealthTiles', () => {
    it('should format duration values correctly', () => {
      const result = useFormattedHealthTiles(mockHealthTiles);

      expect(result).toEqual({
        feedFreshness: '2m', // 120 seconds
        backlogAge: '5m', // 300 seconds
        canaryAge: expect.any(String), // Dynamic based on current time
        burnRate: 'GREEN',
        creditsPerMin: '45.50',
        budgetPercent: '67.8%',
        dlqCount: '2',
      });
    });

    it('should handle null values gracefully', () => {
      const result = useFormattedHealthTiles(mockHealthTilesWithNulls);

      expect(result).toEqual({
        feedFreshness: '30m', // 1800 seconds
        backlogAge: '33m', // 2000 seconds
        canaryAge: 'unknown',
        burnRate: 'RED',
        creditsPerMin: 'N/A',
        budgetPercent: 'N/A',
        dlqCount: '15',
      });
    });

    it('should return placeholder values for undefined tiles', () => {
      const result = useFormattedHealthTiles(undefined);

      expect(result).toEqual({
        feedFreshness: '...',
        backlogAge: '...',
        canaryAge: '...',
        burnRate: '...',
        creditsPerMin: '...',
        budgetPercent: '...',
        dlqCount: '...',
      });
    });

    it('should format different duration scales correctly', () => {
      const testCases = [
        { seconds: 30, expected: '30s' },
        { seconds: 90, expected: '1m' },
        { seconds: 3600, expected: '1h' },
        { seconds: 7200, expected: '2h' },
        { seconds: 86400, expected: '1d' },
        { seconds: 172800, expected: '2d' },
      ];

      testCases.forEach(({ seconds, expected }) => {
        const testData: CanonicalHealthTiles = {
          ...mockHealthTiles,
          feedFreshnessSeconds: seconds,
        };

        const result = useFormattedHealthTiles(testData);
        expect(result.feedFreshness).toBe(expected);
      });
    });
  });

  describe('getHealthStatusColor', () => {
    it('should return correct CSS classes for each status', () => {
      const testCases = [
        { status: 'healthy', expected: 'bg-green-500 text-green-50' },
        { status: 'green', expected: 'bg-green-500 text-green-50' },
        { status: 'warning', expected: 'bg-yellow-500 text-yellow-50' },
        { status: 'yellow', expected: 'bg-yellow-500 text-yellow-50' },
        { status: 'critical', expected: 'bg-red-500 text-red-50' },
        { status: 'red', expected: 'bg-red-500 text-red-50' },
        { status: 'unknown', expected: 'bg-gray-500 text-gray-50' },
      ];

      testCases.forEach(({ status, expected }) => {
        const result = getHealthStatusColor(status as any);
        expect(result).toBe(expected);
      });
    });

    it('should return default color for invalid status', () => {
      const result = getHealthStatusColor('invalid' as any);
      expect(result).toBe('bg-gray-500 text-gray-50');
    });
  });

  describe('getHealthTooltips', () => {
    it('should return all required tooltip explanations', () => {
      const tooltips = getHealthTooltips();

      expect(tooltips).toEqual(
        expect.objectContaining({
          feedFreshness: expect.stringContaining('Feed freshness'),
          backlogAge: expect.stringContaining('Temporal backlog'),
          canary: expect.stringContaining('Canary heartbeat'),
          burnRate: expect.stringContaining('Failure burn rate'),
          provider: expect.stringContaining('Daily budget usage'),
          dlq: expect.stringContaining('Dead letter queue'),
          source: expect.stringContaining('Data source'),
        })
      );
    });

    it('should include threshold information in tooltips', () => {
      const tooltips = getHealthTooltips();

      expect(tooltips.feedFreshness).toMatch(/\d+min.*healthy.*\d+min.*warning.*\d+min.*critical/);
      expect(tooltips.backlogAge).toMatch(/\d+min.*healthy.*\d+min.*warning.*\d+min.*critical/);
      expect(tooltips.canary).toMatch(/\d+min.*healthy.*\d+min.*warning.*\d+min.*critical/);
      expect(tooltips.burnRate).toMatch(/green.*yellow.*red/);
      expect(tooltips.provider).toMatch(/\d+%.*healthy.*\d+%.*warning.*\d+%.*critical/);
      expect(tooltips.dlq).toMatch(/0.*healthy.*\d+.*warning.*\d+.*critical/);
    });

    it('should explain live vs fallback data sources', () => {
      const tooltips = getHealthTooltips();
      
      expect(tooltips.source).toContain('live');
      expect(tooltips.source).toContain('fallback');
      expect(tooltips.source).toContain('real-time data');
      expect(tooltips.source).toContain('safe defaults');
    });
  });

  describe('integration behavior', () => {
    it('should maintain consistency between status and color functions', () => {
      const statuses = ['healthy', 'warning', 'critical', 'unknown'] as const;
      
      statuses.forEach(status => {
        const color = getHealthStatusColor(status);
        expect(color).toBeDefined();
        expect(color).toMatch(/^bg-(green|yellow|red|gray)-500 text-(green|yellow|red|gray)-50$/);
      });
    });

    it('should handle rapid updates gracefully', () => {
      // Simulate rapid status updates
      const updates = Array.from({ length: 100 }, (_, i) => ({
        ...mockHealthTiles,
        feedFreshnessSeconds: i * 10,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }));

      updates.forEach(data => {
        const status = useHealthTileStatus(data);
        const formatted = useFormattedHealthTiles(data);
        
        expect(status).toBeDefined();
        expect(formatted).toBeDefined();
        expect(status.feedStatus).toMatch(/^(healthy|warning|critical)$/);
      });
    });

    it('should preserve data types through transformations', () => {
      const result = useFormattedHealthTiles(mockHealthTiles);
      
      // All formatted values should be strings
      Object.values(result).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });
  });
});