import { ContestAgent } from '../index';
import { createTestDependencies, createTestConfig } from '../../../test/helpers/testHelpers';

jest.mock('../contests', () => ({
  ContestManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    createContest: jest.fn().mockResolvedValue(undefined),
    checkHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    }),
    getMetrics: jest.fn().mockReturnValue({
      contests: {
        active: 0,
        completed: 0,
        totalParticipants: 0,
        prizeValueDistributed: 0
      },
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0
    })
  }))
}));

jest.mock('../leaderboards', () => ({
  LeaderboardManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    updateLeaderboards: jest.fn().mockResolvedValue(undefined),
    checkHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    }),
    getMetrics: jest.fn().mockReturnValue({
      leaderboards: {
        active: 0,
        totalEntries: 0,
        updateFrequency: 0
      }
    })
  }))
}));

jest.mock('../fairplay', () => ({
  FairPlayMonitor: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    checkHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    }),
    getMetrics: jest.fn().mockReturnValue({
      fairPlay: {
        checksPerformed: 0,
        violationsDetected: 0,
        appealRate: 0,
        averageFairPlayScore: 1.0
      }
    })
  }))
}));

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

describe('ContestAgent', () => {
  let agent: ContestAgent;

  beforeEach(async () => {
    // Use test helpers to create proper dependencies and config
    const deps = createTestDependencies();
    const config = createTestConfig({ name: 'ContestAgent' });

    agent = new ContestAgent(config, deps);
    await agent.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await agent.stop();
    });
  });

  describe('process', () => {
    it('should start and stop successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should handle lifecycle properly', async () => {
      await agent.start();
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
      if (health.details) {
        expect(health.details['errors']).toHaveLength(0);
      }
    });

    it('should return degraded status when some components are unhealthy', async () => {
      // Mock unhealthy component
      const mockUnhealthyResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
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
      if (health.details) {
        expect(health.details['errors']).toHaveLength(0);
      }
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

  describe('public interface', () => {
    it('should initialize properly', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should collect metrics successfully', async () => {
      const metrics = await agent.collectMetrics();
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('successCount');
    });

    it('should handle start/stop lifecycle', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await expect(agent.stop()).resolves.not.toThrow();
    });

    it('should perform health checks', async () => {
      const health = await agent.checkHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('details');
    });
  });
});