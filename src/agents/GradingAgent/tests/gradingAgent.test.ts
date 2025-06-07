import { GradingAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { sendNotification } from '../../NotificationAgent';
import { ErrorHandler } from '../../../utils/errorHandler';

// Mock sendNotification
jest.mock('../../NotificationAgent', () => ({
  sendNotification: jest.fn(() => Promise.resolve({
    success: true,
    notificationId: 'test-notification-id',
    channels: ['discord']
  }))
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: [{
            id: 'test-pick-id',
            player_name: 'LeBron James',
            stat_type: 'PTS',
            league: 'NBA',
            line: 29.5,
            odds: -110,
            bet_type: 'player_prop',
            is_valid: true,
            promoted_to_final: false
          }],
          error: null
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          data: [{ id: 'test-final-pick-id' }],
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

describe('GradingAgent', () => {
  let agent: GradingAgent;
  const mockConfig = {
    name: 'GradingAgent',
    agentName: 'GradingAgent',
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
      prefix: 'grading'
    },
    gradeConfig: {
      minPicksForGrading: 1,
      gradingWindowHours: 24,
      autoPromoteThreshold: 0.7
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new GradingAgent({
      supabase: createClient('test-url', 'test-service-role-key'),
      config: mockConfig,
      logger: new Logger('test'),
      errorHandler: new ErrorHandler('GradingAgent')
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
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should validate dependencies', async () => {
      await expect(agent.validateDependencies()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details?.errors).toHaveLength(0);
    });
  });

  describe('grading operations', () => {
    it('should grade single picks correctly', async () => {
      const result = await agent.gradePick('test-pick-id');
      expect(result.success).toBe(true);
      expect(result.pickId).toBe('test-pick-id');
      expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'grading',
        channels: ['discord']
      }));
    });

    it('should handle promotion to final picks', async () => {
      const result = await agent.promoteToFinal('test-pick-id');
      expect(result.success).toBe(true);
      expect(result.finalPickId).toBe('test-final-pick-id');
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.collectMetrics();
      expect(metrics.agentName).toBe(mockConfig.name);
      expect(metrics.status).toBe('healthy');
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
    });
  });
});
