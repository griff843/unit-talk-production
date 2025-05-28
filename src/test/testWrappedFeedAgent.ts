import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { FeedAgent } from '../agents/FeedAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeedAgentConfig } from '../agents/FeedAgent/types';
import { RawProp } from '../types/rawProps';

describe('FeedAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: FeedAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: FeedAgentConfig = {
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
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    } as any;

    agent = new FeedAgent(
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
      expect(() => new FeedAgent(mockConfig, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .not.toThrow();
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

      expect(() => new FeedAgent(invalidConfig as any, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any);

      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should handle Supabase connection failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Connection failed') })
        })
      } as any);

      await expect(agent.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('Data Ingestion', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
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

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
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

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.duplicates).toBe(1);
      expect(metrics.uniqueProps).toBe(0);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('API timeout')
      );

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
      expect(metrics.providerStats.SportsGameOdds.failed).toBe(1);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when error rate is low', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should report warning when error rate is high', async () => {
      // Simulate failed requests
      agent['metrics'].providerStats.SportsGameOdds.failed = 5;
      agent['metrics'].providerStats.SportsGameOdds.success = 1;

      const health = await agent.checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details.errors).toHaveLength(1);
    });
  });
}); 