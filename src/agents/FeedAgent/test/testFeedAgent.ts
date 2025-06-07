import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { FeedAgent } from '../index';
import { fetchFromProviderActivity } from '../activities/fetchFromProvider';
import { BaseAgentDependencies } from '../../../types/agent';
import { FeedAgentConfig } from '../types';

// ---- FULL SUPABASE MOCK CHAIN ----
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      limit: jest.fn(() => ({ data: [], error: null })),
      in: jest.fn(() => ({ data: [], error: null })),
      single: jest.fn(() => ({ data: [], error: null })),
    })),
    insert: jest.fn(() => ({ data: [], error: null })),
    in: jest.fn(() => ({ data: [], error: null })),
  })),
  rpc: jest.fn(() => ({ data: [], error: null })),
};

// ---- LOGGER MOCK ----
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logAgentActivity: jest.fn(),
  logAgentError: jest.fn()
};

// ---- ERROR HANDLER MOCK ----
const mockErrorHandler = {
  handleError: jest.fn(),
  withRetry: jest.fn((fn: any) => fn())
};

// ---- CONFIG FIXTURE (must match Zod schema!) ----
const mockConfig: FeedAgentConfig = {
  name: 'FeedAgent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  retryConfig: {
    maxRetries: 3,
    backoffMs: 100,
    maxBackoffMs: 1000
  },
  providers: {
    SportsGameOdds: {
      enabled: true,
      baseUrl: 'https://api.sportsgameodds.com',
      apiKey: 'test-key',
      rateLimit: 60,
      retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    },
    OddsAPI: {
      enabled: true,
      baseUrl: 'https://api.oddsapi.com',
      apiKey: 'test-key',
      rateLimit: 60,
      retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    },
    Pinnacle: {
      enabled: false,
      baseUrl: 'https://api.pinnacle.com',
      apiKey: 'test-key',
      rateLimit: 60,
      retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    }
  },
  dedupeConfig: {
    checkInterval: 5,
    ttlHours: 24
  }
};

describe('FeedAgent', () => {
  let agent: FeedAgent;

  beforeEach(() => {
    jest.clearAllMocks();

    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase as any,
      config: mockConfig,
      errorHandler: mockErrorHandler as any,
      logger: mockLogger as any
    };

    agent = new FeedAgent(dependencies);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ markets: [] })
    }) as any;
  });

  describe('fetchFromProviderActivity', () => {
    it('should handle successful fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ odds: [{ prop: 'demo' }] })
      });

      const mockInput = {
        provider: 'SportsGameOdds' as const,
        baseUrl: 'https://api.sportsgameodds.com',
        apiKey: 'test-key',
        endpoint: '/odds',
        params: { gameId: '123' },
        timestamp: new Date().toISOString()
      };

      const result = await fetchFromProviderActivity(mockInput);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('FeedAgent Integration', () => {
    it('should start successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
    });

    it('should handle provider failure and fallback', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Primary provider down'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ markets: [] })
        });

      await agent.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.logAgentError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch from SportsGameOdds'),
        expect.any(Object)
      );
    });

    it('should handle commands correctly', async () => {
      await agent.start();
      await agent.handleCommand({
        type: 'FETCH_FEED',
        payload: {
          provider: 'SportsGameOdds'
        }
      });

      expect(mockLogger.logAgentActivity).toHaveBeenCalled();
    });
  });

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      expect(agent.__test__initialize).toBeDefined();
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should support test metrics collection', async () => {
      expect(agent.__test__collectMetrics).toBeDefined();
      const metrics = await agent.__test__collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBeDefined();
      expect(metrics.errorCount).toBeDefined();
      expect(metrics.warningCount).toBeDefined();
    });

    it('should support test health checks', async () => {
      expect(agent.__test__checkHealth).toBeDefined();
      const health = await agent.__test__checkHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });
});
