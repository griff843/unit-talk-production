import { MarketingAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';
import { BaseAgentDependencies } from '../BaseAgent/types';
import { Campaign, ReferralProgram, EngagementMetrics, MarketingEvent } from '../../../types/marketing';

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
          data: [{ id: 'test-campaign-id' }],
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
const mockCampaign: Campaign = {
  id: 'test-campaign-id',
  name: 'Test Campaign',
  status: 'active',
  type: 'promotion',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 86400000).toISOString(),
  budget: 1000,
  metrics: {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0
  }
};

const mockReferralProgram: ReferralProgram = {
  id: 'test-referral-id',
  name: 'Test Referral Program',
  status: 'active',
  rewards: {
    referrer: 50,
    referee: 25
  },
  metrics: {
    totalReferrals: 0,
    activeReferrals: 0,
    totalRewards: 0
  }
};

const mockEngagementMetrics: EngagementMetrics = {
  id: 'test-engagement-id',
  timestamp: new Date().toISOString(),
  metrics: {
    activeUsers: 0,
    newUsers: 0,
    returningUsers: 0,
    averageSessionDuration: 0,
    bounceRate: 0
  }
};

const mockMarketingEvent: MarketingEvent = {
  id: 'test-event-id',
  type: 'promotion',
  details: {
    campaignId: 'test-campaign-id',
    action: 'click'
  },
  timestamp: new Date()
};

// Test configuration
const mockConfig = {
  name: 'MarketingAgent',
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
    prefix: 'marketing'
  },
  campaignConfig: {
    maxActiveCampaigns: 5,
    minBudget: 100,
    maxBudget: 10000
  }
};

describe('MarketingAgent', () => {
  let agent: MarketingAgent;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient('test-url', 'test-service-role-key');
    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      logger: new Logger('MarketingAgent'),
      errorHandler: new ErrorHandler('MarketingAgent')
    };
    agent = new MarketingAgent(dependencies);
  });

  describe('initialization', () => {
    it('should initialize resources successfully', async () => {
      await expect(agent.initializeResources()).resolves.not.toThrow();
    });
  });

  describe('process', () => {
    it('should process marketing tasks successfully', async () => {
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

      // Mock the campaign manager's health check to return unhealthy
      jest.spyOn(agent['campaignManager'], 'checkHealth')
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
      expect(metrics).toHaveProperty('campaigns');
      expect(metrics).toHaveProperty('referrals');
      expect(metrics).toHaveProperty('engagement');
    });
  });

  describe('command processing', () => {
    it('should handle CREATE_CAMPAIGN command', async () => {
      await expect(agent.processCommand({
        type: 'CREATE_CAMPAIGN',
        payload: mockCampaign
      })).resolves.not.toThrow();
    });

    it('should handle UPDATE_REFERRAL command', async () => {
      await expect(agent.processCommand({
        type: 'UPDATE_REFERRAL',
        payload: mockReferralProgram
      })).resolves.not.toThrow();
    });

    it('should handle GENERATE_REPORT command', async () => {
      await expect(agent.processCommand({
        type: 'GENERATE_REPORT',
        payload: { type: 'engagement' }
      })).resolves.not.toThrow();
    });

    it('should handle TRIGGER_PROMOTION command', async () => {
      await expect(agent.processCommand({
        type: 'TRIGGER_PROMOTION',
        payload: mockMarketingEvent
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