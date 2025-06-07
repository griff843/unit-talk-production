import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { AnalyticsAgent } from '../agents/AnalyticsAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { AnalyticsAgentConfig } from '../agents/AnalyticsAgent/types';
import { BaseAgentDependencies } from '../types/agent';
import { ErrorHandler } from '../utils/errorHandling';
import { Logger } from '../utils/logger';

describe('AnalyticsAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: AnalyticsAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: AnalyticsAgentConfig = {
    name: 'AnalyticsAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info' as const,
    metrics: { enabled: true, interval: 60 },
    retryConfig: {
      maxRetries: 3,
      backoffMs: 100,
      maxBackoffMs: 1000
    },
    dataRetentionDays: 90,
    aggregationInterval: 3600,
    alertThresholds: {
      errorRate: 0.1,
      latencyMs: 5000
    },
    analysisConfig: {
      minPicksForAnalysis: 10,
      roiTimeframes: [7, 30, 90],
      streakThreshold: 3,
      trendWindowDays: 30
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
      from: jest.fn(),
      rpc: jest.fn()
    } as any;

    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      errorHandler: new ErrorHandler('AnalyticsAgent'),
      logger: new Logger('AnalyticsAgent')
    };

    agent = new AnalyticsAgent(dependencies);
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('Configuration', () => {
    it('should validate config successfully', () => {
      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        config: mockConfig,
        errorHandler: new ErrorHandler('AnalyticsAgent'),
        logger: new Logger('AnalyticsAgent')
      };
      expect(() => new AnalyticsAgent(dependencies)).not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        ...mockConfig,
        analysisConfig: {
          ...mockConfig.analysisConfig,
          minPicksForAnalysis: -1 // Invalid minimum picks
        }
      };

      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        config: invalidConfig,
        errorHandler: new ErrorHandler('AnalyticsAgent'),
        logger: new Logger('AnalyticsAgent')
      };

      expect(() => new AnalyticsAgent(dependencies)).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockResolvedValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }));

      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should handle missing table access', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockResolvedValue({
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error(`Table ${table} not found`) 
          })
        })
      }));

      await expect(agent.__test__initialize()).rejects.toThrow();
    });
  });

  describe('Analytics Processing', () => {
    beforeEach(() => {
      // Mock active cappers
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockResolvedValue({
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
        select: jest.fn().mockResolvedValue({
          eq: jest.fn().mockResolvedValue({
            gt: jest.fn().mockResolvedValue({
              data: mockPicks,
              error: null
            })
          })
        })
      }));

      // Mock capper data
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockResolvedValue({
          eq: jest.fn().mockResolvedValue({
            single: jest.fn().mockResolvedValue({
              data: { tier: 'pro', ticket_type: 'standard' },
              error: null
            })
          })
        })
      }));
    });

    it('should calculate ROI correctly', async () => {
      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
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
        select: jest.fn().mockResolvedValue({
          eq: jest.fn().mockResolvedValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: trendPicks,
                error: null
              })
            })
          })
        })
      }));

      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
      expect(metrics.activeStreaks).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', async () => {
      // Mock empty data response
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          eq: jest.fn().mockResolvedValue({
            gt: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      }));

      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
      expect(metrics.errorCount).toBe(0);
      expect(metrics.totalAnalyzed).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when processing is normal', async () => {
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should report warning when processing time is high', async () => {
      // Simulate long processing time
      agent['metrics'].processingTimeMs = 400000; // > 5 minutes

      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details?.errors ?? []).toContain('Processing time exceeds threshold');
    });

    it('should report warning when errors occur', async () => {
      // Simulate processing errors
      agent['metrics'].errorCount = 3;

      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details?.errors ?? []).toContain('3 errors in last run');
    });
  });

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should support test metrics collection', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.agentName).toBe(mockConfig.name);
    });

    it('should support test health checks', async () => {
      const health = await agent.__test__checkHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });
}); 