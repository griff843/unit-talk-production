import { MarketingAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { createTestConfig, createTestDependencies, resetMocks } from '../../../test/helpers/testHelpers';
import { Campaign, ReferralProgram, EngagementMetrics } from '../../../types/marketing';

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
          data: [{ id: 'test-campaign-id' }],
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
  type: 'email',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 86400000).toISOString(),
  targetAudience: ['test-user-1', 'test-user-2'],
  content: {
    subject: 'Test Subject',
    body: 'Test Body',
    template: 'default'
  },
  metrics: {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0
  }
};

const mockReferralProgram: ReferralProgram = {
  id: 'test-referral-id',
  name: 'Test Referral Program',
  enabled: true,
  rewards: {
    referrer: 10,
    referee: 5
  },
  conditions: {
    minDeposit: 100,
    validityDays: 30
  }
};

const mockEngagementMetrics: EngagementMetrics = {
  userId: 'test-user-id',
  campaignId: 'test-campaign-id',
  action: 'opened',
  timestamp: new Date().toISOString(),
  metadata: { source: 'email' }
};

describe('MarketingAgent', () => {
  let agent: MarketingAgent;
  let mockSupabase: any;

  beforeEach(() => {
    resetMocks();
    mockSupabase = createClient('test-url', 'test-service-role-key');
    const config = createTestConfig({ name: 'MarketingAgent' });
    const dependencies = createTestDependencies({ supabase: mockSupabase });
    agent = new MarketingAgent(config, dependencies);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should start and stop successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });


  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.collectMetrics();
      expect(metrics).toHaveProperty('agentName');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('processingTimeMs');
      expect(metrics).toHaveProperty('memoryUsageMb');
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.successCount).toBe('number');
    });
  });
}); 