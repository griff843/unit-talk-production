import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { FeedAgent } from '../index';
import { RedisClient } from '../../../utils/redis';
import { SupabaseClient } from '@supabase/supabase-js';
import { Provider, FeedAgentConfig } from '../types';
import { checkIngestionState } from '../checkIngestionState';
import { fetchFromProvider } from '../fetchFromProvider';
import { logCoverage } from '../logCoverage';

describe('FeedAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: FeedAgent;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: FeedAgentConfig = {
    agentName: 'FeedAgent',
    enabled: true,
    providers: {
      SportsGameOdds: {
        enabled: true,
        priority: 1,
        baseUrl: 'https://api.sportsgameodds.com',
        apiKey: 'test-key',
        rateLimit: 60
      },
      DraftEdge: {
        enabled: true,
        priority: 2,
        baseUrl: 'https://api.draftedge.com',
        apiKey: 'test-key',
        rateLimit: 60
      }
    },
    ingestionConfig: {
      defaultInterval: 5,
      minInterval: 1,
      maxRetries: 3,
      backoffMs: 1000
    },
    cacheConfig: {
      ttlMs: 300000,
      staleWhileRevalidateMs: 60000
    }
  };

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      ping: jest.fn(),
      disconnect: jest.fn()
    } as any;

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null })
    } as any;

    agent = new FeedAgent(
      mockConfig,
      mockSupabase,
      mockRedis,
      { maxRetries: 3, backoffMs: 100 }
    );
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('checkIngestionState', () => {
    it('should return true when force is enabled', async () => {
      const result = await checkIngestionState({
        provider: 'SportsGameOdds',
        interval: 5,
        force: true
      }, mockRedis);

      expect(result.shouldPull).toBe(true);
      expect(result.reason).toContain('Force pull');
    });

    it('should return true when no previous pull exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await checkIngestionState({
        provider: 'SportsGameOdds',
        interval: 5
      }, mockRedis);

      expect(result.shouldPull).toBe(true);
      expect(result.reason).toContain('No previous pull');
    });

    it('should return false when interval has not elapsed', async () => {
      const now = new Date();
      mockRedis.get.mockResolvedValue(now.toISOString());

      const result = await checkIngestionState({
        provider: 'SportsGameOdds',
        interval: 5
      }, mockRedis);

      expect(result.shouldPull).toBe(false);
    });
  });

  describe('fetchFromProvider', () => {
    const mockInput = {
      provider: 'SportsGameOdds' as Provider,
      baseUrl: 'https://api.test.com',
      apiKey: 'test-key',
      timestamp: new Date().toISOString()
    };

    it('should handle successful fetch', async () => {
      const mockResponse = {
        data: { markets: [{ type: 'points' }] },
        status: 200
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse as any);

      const result = await fetchFromProvider(mockInput, mockSupabase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('feed_raw_responses');
    });

    it('should handle fetch failure', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));

      const result = await fetchFromProvider(mockInput, mockSupabase);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('feed_errors');
    });
  });

  describe('logCoverage', () => {
    it('should calculate correct coverage for SportsGameOdds', async () => {
      const mockData = {
        markets: [
          { type: 'points' },
          { type: 'rebounds' },
          { type: 'assists' }
        ]
      };

      const result = await logCoverage({
        provider: 'SportsGameOdds',
        data: mockData,
        timestamp: new Date().toISOString()
      }, mockSupabase);

      expect(result.covered).toBe(3);
      expect(result.missing.length).toBe(6);
      expect(mockSupabase.from).toHaveBeenCalledWith('feed_coverage');
    });

    it('should calculate correct coverage for DraftEdge', async () => {
      const mockData = {
        props: {
          points: {},
          rebounds: {},
          assists: {},
          threes: {}
        }
      };

      const result = await logCoverage({
        provider: 'DraftEdge',
        data: mockData,
        timestamp: new Date().toISOString()
      }, mockSupabase);

      expect(result.covered).toBe(4);
      expect(result.missing.length).toBe(5);
    });

    it('should handle invalid data gracefully', async () => {
      const result = await logCoverage({
        provider: 'SportsGameOdds',
        data: null,
        timestamp: new Date().toISOString()
      }, mockSupabase);

      expect(result.covered).toBe(0);
      expect(result.missing.length).toBe(9);
    });
  });

  describe('FeedAgent Integration', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should handle provider failure and fallback', async () => {
      // Mock primary provider failure
      jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Primary provider down'))
        .mockResolvedValueOnce({ data: { markets: [] }, status: 200 });

      await agent.initialize();
      await agent.start();

      // Verify fallback occurred
      const metrics = await agent.collectMetrics();
      expect(metrics.providerHealth.SportsGameOdds).toBe('degraded');
      expect(metrics.providerHealth.DraftEdge).toBe('healthy');
    });

    it('should track provider health correctly', async () => {
      const healthStatus = await agent.checkHealth();
      expect(healthStatus.status).toBe('ok');
      expect(healthStatus.details.providers).toHaveLength(2);
    });
  });
}); 