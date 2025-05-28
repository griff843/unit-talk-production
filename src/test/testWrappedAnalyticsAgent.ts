import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { AnalyticsAgent } from '../agents/AnalyticsAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { AnalyticsAgentConfig } from '../agents/AnalyticsAgent/types';

describe('AnalyticsAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: AnalyticsAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: AnalyticsAgentConfig = {
    agentName: 'AnalyticsAgent',
    enabled: true,
    analysisConfig: {
      minPicksForAnalysis: 10,
      roiTimeframes: [7, 30, 90],
      streakThreshold: 3,
      trendWindowDays: 30
    },
    alertConfig: {
      roiAlertThreshold: 15,
      streakAlertThreshold: 5,
      volatilityThreshold: 0.2
    },
    metricsConfig: {
      interval: 60000,
      prefix: 'analytics_agent'
    }
  };

  const mockPicks = [
    {
      id: '1',
      capper_id: 'capper1',
      player_id: 'player1',
      stat_type: 'points',
      result: 'win',
      stake: 100,
      payout: 190,
      odds: 1.9,
      actual_value: 25,
      created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
    {
      id: '2',
      capper_id: 'capper1',
      player_id: 'player1',
      stat_type: 'points',
      result: 'win',
      stake: 100,
      payout: 190,
      odds: 1.9,
      actual_value: 28,
      created_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    }
  ];

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis()
    } as any;

    agent = new AnalyticsAgent(
      mockConfig,
      mockSupabase,
      { maxRetries: 3, backoffMs: 100 }
    );
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('Configuration', () => {
    it('should validate config successfully', () => {
      expect(() => new AnalyticsAgent(mockConfig, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        ...mockConfig,
        analysisConfig: {
          ...mockConfig.analysisConfig,
          minPicksForAnalysis: -1 // Invalid minimum picks
        }
      };

      expect(() => new AnalyticsAgent(invalidConfig as any, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }));

      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should handle missing table access', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error(`Table ${table} not found`) 
          })
        })
      }));

      await expect(agent.initialize()).rejects.toThrow();
    });
  });

  describe('Analytics Processing', () => {
    beforeEach(() => {
      // Mock active cappers
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          distinct: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: [{ capper_id: 'capper1' }],
              error: null
            })
          })
        })
      }));

      // Mock picks data
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: mockPicks,
              error: null
            })
          })
        })
      }));

      // Mock capper data
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { tier: 'pro', ticket_type: 'standard' },
              error: null
            })
          })
        })
      }));
    });

    it('should calculate ROI correctly', async () => {
      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.totalAnalyzed).toBeGreaterThan(0);
      expect(metrics.profitableCappers).toBeGreaterThan(0);
    });

    it('should detect trends correctly', async () => {
      // Mock ascending trend data
      const trendPicks = mockPicks.map((pick, i) => ({
        ...pick,
        actual_value: 20 + i * 2 // Increasing values
      }));

      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: trendPicks,
                error: null
              })
            })
          })
        })
      }));

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.activeStreaks).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', async () => {
      // Mock empty data response
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      }));

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.errorCount).toBe(0);
      expect(metrics.totalAnalyzed).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when processing is normal', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should report warning when processing time is high', async () => {
      // Simulate long processing time
      agent['metrics'].processingTimeMs = 400000; // > 5 minutes

      const health = await agent.checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details.errors).toContain('Processing time exceeds threshold');
    });

    it('should report warning when errors occur', async () => {
      // Simulate processing errors
      agent['metrics'].errorCount = 3;

      const health = await agent.checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details.errors).toContain('3 errors in last run');
    });
  });
}); 