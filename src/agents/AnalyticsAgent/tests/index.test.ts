import { AnalyticsAgent } from '../';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { sendNotification } from '../../NotificationAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '@shared/types/baseAgent';

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
        distinct: jest.fn().mockResolvedValue({ data: [{ capper_id: 'test-capper' }], error: null }),
        eq: jest.fn().mockResolvedValue({ data: mockPicks, error: null }),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
        order: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockResolvedValue({ error: null }),
        lt: jest.fn().mockReturnThis(),
      })),
    })),
  })),
}));

// Mock data
const mockPicks = [
  {
    id: 1,
    capper_id: 'test-capper',
    stat_type: 'points',
    result: 'win',
    stake: 100,
    payout: 190,
    odds: 1.9,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    capper_id: 'test-capper',
    stat_type: 'points',
    result: 'loss',
    stake: 100,
    payout: 0,
    odds: 1.9,
    created_at: new Date().toISOString(),
  },
];

// Test configuration
const testConfig: AnalyticsAgentConfig = {
  name: 'TestAgent',
  agentName: 'AnalyticsAgent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
  ,
  metrics: { enabled: false, interval: 60 ,
  health: { enabled: false, interval: 30 }
}
},
  analysisConfig: {
    minPicksForAnalysis: 2,
    roiTimeframes: [7, 30],
    streakThreshold: 2,
    trendWindowDays: 30,
  },
  alertConfig: {
    roiAlertThreshold: 15,
    streakAlertThreshold: 5,
    volatilityThreshold: 0.2,
  },
  metricsConfig: {
    interval: 60000,
    prefix: 'analytics_agent',
  },
};

const errorConfig = {
  logLevel: 'info',
  enabled: true,
  version: '0.0.1',
  name: 'TestAgent',
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  shouldRetry: (error: Error) => true,
,
  metrics: { enabled: false, interval: 60 ,
  health: { enabled: false, interval: 30 ,
  retry: { maxRetries: 0, backoffMs: 200, maxBackoffMs: 500 }
}
}
};

describe('AnalyticsAgent', () => {
  let agent: AnalyticsAgent;
  let supabase: any;

  beforeEach(() => {
    supabase = createClient('test-url', 'test-service-role-key');
    agent = new AnalyticsAgent(testConfig, supabase, errorConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
  });

  describe('runAnalysis', () => {
    it('should process picks and update analytics', async () => {
      await expect(agent.runAnalysis()).resolves.not.toThrow();
    });

    it('should handle empty data gracefully', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          distinct: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);
      await expect(agent.runAnalysis()).resolves.not.toThrow();
    });

    it('should handle database errors', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          distinct: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);
      await expect(agent.runAnalysis()).rejects.toThrow('DB Error');
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should return warning status when there are errors', async () => {
      // Simulate some errors
      agent['metrics'].errorCount = 1;
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details?.errors).toContain('1 errors in last run');
    });
  });

  describe('cleanup', () => {
    it('should clean up old data successfully', async () => {
      await expect(agent['cleanup']()).resolves.not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockFrom = jest.fn(() => ({
        delete: jest.fn(() => ({
          lt: jest.fn().mockResolvedValue({ error: new Error('Cleanup Error') }),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);
      await expect(agent['cleanup']()).resolves.not.toThrow();
    });
  });
}); 