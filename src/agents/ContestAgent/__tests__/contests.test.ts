import { ContestManager } from '../contests';
import { mockSupabaseClient, mockLogger, mockErrorHandler, createTestConfig } from '../../../test/helpers/testHelpers';
import { Contest, ContestAgentConfig } from '../types';

// Mock Supabase
jest.mock('@supabase/supabase-js');

describe('ContestManager', () => {
  let contestManager: ContestManager;
  let mockConfig: ContestAgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      name: 'ContestAgent',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info' as const,
      schedule: 'manual',
      metrics: {
        enabled: true,
        interval: 30000,
        port: 9090
      },
      retry: {
        enabled: true,
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 10000,
        maxAttempts: 5,
        backoff: 1000,
        exponential: true,
        jitter: true
      },
      health: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        checkDb: true,
        checkExternal: false
      },
      fairPlay: {
        enabled: true,
        maxViolations: 3,
        checkInterval: 300000,
        autoban: false
      },
      leaderboard: {
        updateInterval: 60000,
        cacheTimeout: 300000,
        maxEntries: 1000
      },
      prizePool: {
        enabled: true,
        distribution: [],
        minPrize: 10
      }
    };

    // Setup mock responses
    (mockSupabaseClient.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }),
      insert: jest.fn().mockResolvedValue({
        data: [{ id: 'test-contest-id' }],
        error: null
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: 'test-contest-id' }],
          error: null
        })
      })
    });

    // Create a proper error handler mock
    const mockErrorHandlerForContest = {
      handleError: jest.fn(),
      withRetry: jest.fn(),
      logger: mockLogger,
      supabase: mockSupabaseClient,
      context: {},
      determineSeverity: jest.fn(),
      logError: jest.fn(),
      notifyOperators: jest.fn(),
      escalateError: jest.fn(),
      trackError: jest.fn()
    };

    contestManager = new ContestManager(
      mockSupabaseClient,
      mockLogger,
      mockErrorHandlerForContest as any,
      mockConfig
    );
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(contestManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('contest creation', () => {
    it('should create a contest successfully', async () => {
      const contestData: Omit<Contest, 'id' | 'metrics'> = {
        name: 'Test Contest',
        description: 'A test contest',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        status: 'draft',
        type: 'daily',
        rules: [],
        prizePool: {
          totalAmount: 1000,
          distribution: [],
          currency: 'USD',
          winners: [],
          totalValue: 1000
        },
        participants: [],
        metadata: {}
      };

      const result = await contestManager.createContest(contestData);
      expect(result).toBeDefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('contests');
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await contestManager.checkHealth();
      expect(health.status).toBe('healthy');
    });

    it('should handle database errors gracefully', async () => {
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });

      const health = await contestManager.checkHealth();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics successfully', () => {
      const metrics = contestManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.contests).toBe('object');
    });
  });

  describe('cleanup', () => {
    it('should cleanup without errors', async () => {
      await expect(contestManager.cleanup()).resolves.not.toThrow();
    });
  });
});