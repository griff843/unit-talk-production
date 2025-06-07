import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { FeedAgent } from '../agents/FeedAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeedAgentConfig } from '../agents/FeedAgent/types';
import { RawProp } from '../types/rawProps';
import { BaseAgentDependencies } from '../types/agent';
import { ErrorHandler } from '../utils/errorHandling';
import { Logger } from '../utils/logger';

describe('FeedAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: FeedAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: FeedAgentConfig = {
    name: "FeedAgent",
    agentName: 'FeedAgent',
    enabled: true,
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
      }
    },
    dedupeConfig: {
      checkInterval: 5,
      ttlHours: 24
    },
    metricsConfig: {
      interval: 60000,
      prefix: 'feed_agent'
    }
  };

  const mockRawProp: RawProp = {
    id: '123',
    external_id: 'SGO_123',
    player_name: 'John Doe',
    team: 'Team A',
    opponent: 'Team B',
    stat_type: 'points',
    line: 20.5,
    over_odds: -110,
    under_odds: -110,
    market: 'player_points',
    provider: 'SportsGameOdds',
    game_time: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    is_valid: true
  };

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  beforeEach(() => {
    // Create type-safe mock for Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      auth: {
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    } as unknown as jest.Mocked<SupabaseClient>;

    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      errorHandler: new ErrorHandler('FeedAgent'),
      logger: new Logger('FeedAgent')
    };

    agent = new FeedAgent(dependencies);
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('Configuration', () => {
    it('should validate config successfully', () => {
      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        config: mockConfig,
        errorHandler: new ErrorHandler('FeedAgent'),
        logger: new Logger('FeedAgent')
      };
      expect(() => new FeedAgent(dependencies)).not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        ...mockConfig,
        providers: {
          SportsGameOdds: {
            ...mockConfig.providers.SportsGameOdds,
            rateLimit: -1 // Invalid rate limit
          }
        }
      };

      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        config: invalidConfig,
        errorHandler: new ErrorHandler('FeedAgent'),
        logger: new Logger('FeedAgent')
      };

      expect(() => new FeedAgent(dependencies)).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any);

      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should handle Supabase connection failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Connection failed') })
        })
      } as any);

      await expect(agent.__test__initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('Data Ingestion', () => {
    beforeEach(() => {
      global.fetch = jest.fn() as any;
    });

    it('should fetch and process props successfully', async () => {
      const mockResponse = {
        odds: [{
          id: 'SGO_123',
          player: 'John Doe',
          team: 'Team A',
          opponent: 'Team B',
          market: 'points',
          line: 20.5,
          over: -110,
          under: -110,
          market_type: 'player_points',
          game_time: new Date().toISOString()
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: jest.fn().mockResolvedValue({ data: [mockRawProp], error: null })
      } as any);

      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
      expect(metrics.totalProps).toBe(1);
      expect(metrics.uniqueProps).toBe(1);
      expect(metrics.duplicates).toBe(0);
    });

    it('should handle duplicate props', async () => {
      const mockResponse = {
        odds: [
          {
            id: 'SGO_123',
            player: 'John Doe',
            team: 'Team A',
            opponent: 'Team B',
            market: 'points',
            line: 20.5,
            over: -110,
            under: -110,
            market_type: 'player_points',
            game_time: new Date().toISOString()
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Simulate existing prop
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ 
          data: [{ external_id: 'SGO_123' }],
          error: null 
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any);

      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
      expect(metrics.duplicates).toBe(1);
      expect(metrics.uniqueProps).toBe(0);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('API timeout')
      );

      await agent.__test__initialize();
      await agent.start();

      const metrics = await agent.__test__collectMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
      expect(metrics.providerStats.SportsGameOdds.failed).toBe(1);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when error rate is low', async () => {
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should report warning when error rate is high', async () => {
      // Simulate failed requests
      agent['metrics'].providerStats.SportsGameOdds.failed = 5;
      agent['metrics'].providerStats.SportsGameOdds.success = 1;

      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details?.errors ?? []).toHaveLength(1);
    });
  });
}); 