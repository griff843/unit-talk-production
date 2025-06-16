import { GradingAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../services/logging';
import { ErrorHandler } from '../../../shared/errors';

// Mock the notification activities
jest.mock('../../NotificationAgent/activities', () => ({
  sendNotification: jest.fn(() => Promise.resolve({
    success: true,
    notificationId: 'test-notification-id',
    channels: ['discord'],
    errors: []
  }))
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          data: [
            { status: 'graded', created_at: new Date().toISOString() },
            { status: 'pending', created_at: new Date().toISOString() },
            { status: 'failed', created_at: new Date().toISOString() }
          ],
          error: null
        })),
        limit: jest.fn(() => ({
          data: [{ id: 1 }],
          error: null
        })),
        is: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [
                {
                  id: 1,
                  player_name: 'Test Player',
                  stat_type: 'points',
                  line: 25.5,
                  direction: 'over'
                }
              ],
              error: null
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        data: null,
        error: null
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

let agent: GradingAgent;

describe('GradingAgent', () => {
  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
  });

  const mockConfig = {
    name: 'GradingAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info' as const,
    metrics: {
      enabled: true,
      interval: 60
    },
    retry: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      enabled: true,
      maxAttempts: 3,
      backoff: 1000,
      exponential: true,
      jitter: false
    },
    health: {
      enabled: false,
      interval: 30,
      timeout: 5000,
      checkDb: true,
      checkExternal: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new GradingAgent(mockConfig, {
      supabase: createClient('test-url', 'test-service-role-key'),
      logger: logger,
      errorHandler: new ErrorHandler({
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 10000,
        shouldRetry: () => true
      })
    });
  });

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should support test metrics collection', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBeDefined();
      expect(metrics.errorCount).toBeDefined();
      expect(metrics.warningCount).toBeDefined();
    });

    it('should support test health checks', async () => {
      const health = await agent.__test__checkHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'unhealthy', 'degraded']).toContain(health.status);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should validate dependencies', async () => {
      expect(agent).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const result = await agent.__test__checkHealth();
      expect(result.status).toBe('healthy');
    });
  });

  describe('grading operations', () => {
    it('should grade single picks correctly', async () => {
      const mockPick = { id: 1, player_name: 'Test Player' };
      await expect(agent.gradePick(mockPick)).resolves.not.toThrow();
    });

    it('should handle promotion to final picks', async () => {
      const mockPick = { id: 1, player_name: 'Test Player' };
      const result = await agent.promoteToFinal(mockPick);
      expect(result.success).toBe(true);
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('agentName');
    });
  });
});