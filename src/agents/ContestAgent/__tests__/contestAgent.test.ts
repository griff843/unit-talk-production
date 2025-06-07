import { ContestAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';
import { BaseAgentDependencies } from '../BaseAgent/types';
import { Contest, Leaderboard, PrizePool } from '../types';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          data: [],
          error: null
        })),
        eq: jest.fn(() => ({
          data: [],
          error: null
        })),
        gte: jest.fn(() => ({
          data: [],
          error: null
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          data: [{ id: 'test-contest-id' }],
          error: null
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}));

// Mock data
const mockContest: Contest = {
  id: 'test-contest-id',
  name: 'Test Contest',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 86400000).toISOString(),
  prizePool: {
    total: 1000,
    distribution: [0.5, 0.3, 0.2]
  },
  participants: [],
  rules: {
    minParticipants: 2,
    maxParticipants: 100,
    entryFee: 10
  }
};

const mockLeaderboard: Leaderboard = {
  id: 'test-leaderboard-id',
  contestId: 'test-contest-id',
  entries: [],
  lastUpdated: new Date().toISOString()
};

const mockPrizePool: PrizePool = {
  id: 'test-prize-pool-id',
  contestId: 'test-contest-id',
  total: 1000,
  distribution: [0.5, 0.3, 0.2],
  status: 'active'
};

// Test configuration
const mockConfig = {
  name: 'ContestAgent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000
  ,
  metrics: { enabled: false, interval: 60 ,
  health: { enabled: false, interval: 30 }
}
},
  metricsConfig: {
    interval: 60000,
    prefix: 'contest'
  },
  contestConfig: {
    maxActiveContests: 10,
    minParticipants: 2,
    maxParticipants: 1000,
    prizeDistributionRules: {
      minPayout: 10,
      maxPayout: 10000,
      distributionTiers: [1, 2, 3, 4, 5]
    }
  }
};

describe('ContestAgent', () => {
  let agent: ContestAgent;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient('test-url', 'test-service-role-key');
    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      logger: new Logger('ContestAgent'),
      errorHandler: new ErrorHandler('ContestAgent')
    };
    agent = new ContestAgent(dependencies);
  });

  describe('initialization', () => {
    it('should initialize resources successfully', async () => {
      await expect(agent.initializeResources()).resolves.not.toThrow();
    });
  });

  describe('process', () => {
    it('should process contests successfully', async () => {
      await expect(agent.process()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources successfully', async () => {
      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details.errors).toHaveLength(0);
    });

    it('should return degraded status when some components are unhealthy', async () => {
      // Mock unhealthy component
      const mockUnhealthyResponse = {
        status: 'unhealthy',
        details: {
          errors: ['Test error'],
          warnings: [],
          info: {}
        }
      };

      // Mock the contest manager's health check to return unhealthy
      jest.spyOn(agent['contestManager'], 'checkHealth')
        .mockResolvedValueOnce(mockUnhealthyResponse);

      const health = await agent.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.errors).toHaveLength(0);
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.collectMetrics();
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('contests');
      expect(metrics).toHaveProperty('leaderboards');
      expect(metrics).toHaveProperty('fairPlay');
    });
  });

  describe('command processing', () => {
    it('should handle CREATE_CONTEST command', async () => {
      await expect(agent.processCommand({
        type: 'CREATE_CONTEST',
        payload: mockContest
      })).resolves.not.toThrow();
    });

    it('should handle UPDATE_LEADERBOARD command', async () => {
      await expect(agent.processCommand({
        type: 'UPDATE_LEADERBOARD',
        payload: mockLeaderboard
      })).resolves.not.toThrow();
    });

    it('should handle CHECK_FAIR_PLAY command', async () => {
      await expect(agent.processCommand({
        type: 'CHECK_FAIR_PLAY',
        payload: { contestId: 'test-contest-id' }
      })).resolves.not.toThrow();
    });

    it('should throw error for unknown command type', async () => {
      await expect(agent.processCommand({
        type: 'UNKNOWN_COMMAND',
        payload: {}
      })).rejects.toThrow('Unknown command type: UNKNOWN_COMMAND');
    });
  });
}); 