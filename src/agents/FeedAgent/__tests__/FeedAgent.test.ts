import { FeedAgent } from '../index';
import { Provider, FeedAgentConfig } from '../types';
import { BaseAgentDependencies } from '../../../types/agent';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';

// Mock dependencies
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockErrorHandler = {
  handleError: jest.fn()
};

// Mock the activities and utilities
jest.mock('../activities/fetchFromProvider', () => ({
  fetchFromProviderActivity: jest.fn()
}));

jest.mock('../utils/normalizePublicProps', () => ({
  normalizePublicProps: jest.fn()
}));

jest.mock('../utils/dedupePublicProps', () => ({
  dedupePublicProps: jest.fn()
}));

import { fetchFromProviderActivity } from '../activities/fetchFromProvider';
import { normalizePublicProps } from '../utils/normalizePublicProps';
import { dedupePublicProps } from '../utils/dedupePublicProps';

const mockFetchFromProviderActivity = fetchFromProviderActivity as jest.MockedFunction<typeof fetchFromProviderActivity>;
const mockNormalizePublicProps = normalizePublicProps as jest.MockedFunction<typeof normalizePublicProps>;
const mockDedupePublicProps = dedupePublicProps as jest.MockedFunction<typeof dedupePublicProps>;

describe('FeedAgent', () => {
  let agent: FeedAgent;
  let mockConfig: FeedAgentConfig;
  let dependencies: BaseAgentDependencies;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      name: 'FeedAgent',
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

    dependencies = {
      supabase: mockSupabase as any,
      config: mockConfig,
      logger: mockLogger as any,
      errorHandler: mockErrorHandler as any
    };

    agent = new FeedAgent(dependencies);
  });

  describe('Constructor', () => {
    it('should create FeedAgent with valid config', () => {
      expect(agent).toBeInstanceOf(FeedAgent);
    });

    it('should throw error with invalid config', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).name;

      expect(() => new FeedAgent({
        ...dependencies,
        config: invalidConfig as any
      })).toThrow();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
    });

    it('should initialize successfully with valid dependencies', async () => {
      await expect(agent['initialize']()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing FeedAgent...');
      expect(mockLogger.info).toHaveBeenCalledWith('FeedAgent initialized successfully');
    });

    it('should throw error when no providers configured', async () => {
      const configWithoutProviders = { ...mockConfig, providers: {} };
      const agentWithoutProviders = new FeedAgent({
        ...dependencies,
        config: configWithoutProviders
      });

      await expect(agentWithoutProviders['initialize']()).rejects.toThrow('No providers configured');
    });

    it('should throw error when provider missing apiKey', async () => {
      const configMissingApiKey = {
        ...mockConfig,
        providers: {
          SportsGameOdds: {
            ...mockConfig.providers.SportsGameOdds!,
            apiKey: ''
          }
        }
      };
      const agentMissingApiKey = new FeedAgent({
        ...dependencies,
        config: configMissingApiKey
      });

      await expect(agentMissingApiKey['initialize']()).rejects.toThrow('missing apiKey or baseUrl');
    });

    it('should throw error when Supabase connection fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Connection failed' } 
          })
        })
      });

      await expect(agent['initialize']()).rejects.toThrow('Supabase connection failed');
    });
  });

  describe('checkHealth', () => {
    beforeEach(async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      await agent['initialize']();
    });

    it('should return healthy status when no errors', async () => {
      const health = await agent['checkHealth']();
      expect(health.status).toBe('healthy');
      expect(health.details?.errors).toHaveLength(0);
      expect(health.details?.warnings).toHaveLength(0);
    });

    it('should return degraded status with warnings for elevated error rate', async () => {
      // Simulate some errors
      agent['feedMetrics'].providerStats.SportsGameOdds = {
        success: 85,
        failed: 5, // 5.6% error rate
        avgLatencyMs: 1000
      };

      const health = await agent['checkHealth']();
      expect(health.status).toBe('degraded');
      expect(health.details?.warnings.length).toBeGreaterThan(0);
    });

    it('should return unhealthy status with high error rate', async () => {
      // Simulate high error rate
      agent['feedMetrics'].providerStats.SportsGameOdds = {
        success: 80,
        failed: 20, // 20% error rate
        avgLatencyMs: 1000
      };

      const health = await agent['checkHealth']();
      expect(health.status).toBe('unhealthy');
      expect(health.details?.errors.length).toBeGreaterThan(0);
    });

    it('should warn about high latency', async () => {
      agent['feedMetrics'].providerStats.SportsGameOdds = {
        success: 100,
        failed: 0,
        avgLatencyMs: 6000 // High latency
      };

      const health = await agent['checkHealth']();
      expect(health.status).toBe('degraded');
      expect(health.details?.warnings.some(w => w.includes('High latency'))).toBe(true);
    });
  });

  describe('collectMetrics', () => {
    beforeEach(async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      await agent['initialize']();
    });

    it('should return metrics with correct counts', async () => {
      agent['feedMetrics'] = {
        totalProps: 100,
        uniqueProps: 80,
        duplicates: 20,
        errors: 2,
        latencyMs: 1500,
        providerStats: {
          SportsGameOdds: {
            success: 98,
            failed: 2,
            avgLatencyMs: 1500
          }
        }
      };

      const metrics = await agent['collectMetrics']();
      
      expect(metrics.errorCount).toBe(2);
      expect(metrics.successCount).toBe(98);
      expect(metrics.warningCount).toBe(1); // One provider with failures
      expect(metrics.totalProps).toBe(100);
      expect(metrics.uniqueProps).toBe(80);
      expect(metrics.duplicates).toBe(20);
    });
  });

  describe('handleCommand', () => {
    beforeEach(async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      await agent['initialize']();
    });

    it('should handle FETCH_FEED command', async () => {
      const command = {
        type: 'FETCH_FEED',
        payload: { provider: 'SportsGameOdds' as Provider }
      };

      // Mock successful fetch
      mockFetchFromProviderActivity.mockResolvedValue({
        success: true,
        data: [],
        latencyMs: 1000,
        timestamp: new Date().toISOString()
      });
      mockNormalizePublicProps.mockResolvedValue([]);
      mockDedupePublicProps.mockResolvedValue([]);

      await expect(agent.handleCommand(command)).resolves.not.toThrow();
    });

    it('should handle START_PROCESSING command', async () => {
      const command = {
        type: 'START_PROCESSING',
        payload: {}
      };

      // Mock successful fetch
      mockFetchFromProviderActivity.mockResolvedValue({
        success: true,
        data: [],
        latencyMs: 1000,
        timestamp: new Date().toISOString()
      });
      mockNormalizePublicProps.mockResolvedValue([]);
      mockDedupePublicProps.mockResolvedValue([]);

      await expect(agent.handleCommand(command)).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting feed processing for all enabled providers');
    });

    it('should throw error for unknown command type', async () => {
      const command = {
        type: 'UNKNOWN_COMMAND',
        payload: {}
      };

      await expect(agent.handleCommand(command)).rejects.toThrow('Unknown command type: UNKNOWN_COMMAND');
    });
  });

  describe('startProviderIngestion', () => {
    beforeEach(async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      await agent['initialize']();
    });

    it('should successfully process provider data', async () => {
      const mockData = [
        {
          external_id: 'test-1',
          player_name: 'Test Player',
          market_type: 'points',
          line: 10.5
        }
      ];

      mockFetchFromProviderActivity.mockResolvedValue({
        success: true,
        data: mockData,
        latencyMs: 1000,
        timestamp: new Date().toISOString()
      });

      mockNormalizePublicProps.mockResolvedValue([
        {
          id: '1',
          unique_key: 'test-key-1',
          external_game_id: 'game-1',
          player_name: 'Test Player',
          market_type: 'points',
          line: 10.5
        } as any
      ]);

      mockDedupePublicProps.mockResolvedValue([
        {
          id: '1',
          unique_key: 'test-key-1',
          external_game_id: 'game-1',
          player_name: 'Test Player',
          market_type: 'points',
          line: 10.5
        } as any
      ]);

      // Mock successful insert
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'raw_props') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null })
            }),
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        return mockSupabase;
      });

      await agent['startProviderIngestion']('SportsGameOdds');

      expect(mockFetchFromProviderActivity).toHaveBeenCalled();
      expect(mockNormalizePublicProps).toHaveBeenCalled();
      expect(mockDedupePublicProps).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Provider ingestion completed', expect.any(Object));
    });

    it('should handle fetch failure with retries', async () => {
      mockFetchFromProviderActivity
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: [],
          latencyMs: 1000,
          timestamp: new Date().toISOString()
        });

      mockNormalizePublicProps.mockResolvedValue([]);
      mockDedupePublicProps.mockResolvedValue([]);

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'raw_props') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null })
            }),
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        return mockSupabase;
      });

      await agent['startProviderIngestion']('SportsGameOdds');

      expect(mockFetchFromProviderActivity).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed on attempt'),
        expect.any(Object)
      );
    });

    it('should handle disabled provider gracefully', async () => {
      const configDisabledProvider = {
        ...mockConfig,
        providers: {
          SportsGameOdds: {
            ...mockConfig.providers.SportsGameOdds!,
            enabled: false
          }
        }
      };

      const agentDisabled = new FeedAgent({
        ...dependencies,
        config: configDisabledProvider
      });

      await agentDisabled['initialize']();
      await agentDisabled['startProviderIngestion']('SportsGameOdds');

      expect(mockLogger.warn).toHaveBeenCalledWith('Provider SportsGameOdds is not enabled or configured');
      expect(mockFetchFromProviderActivity).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await expect(agent['cleanup']()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up FeedAgent...');
      expect(mockLogger.info).toHaveBeenCalledWith('FeedAgent cleanup completed');
    });
  });
});