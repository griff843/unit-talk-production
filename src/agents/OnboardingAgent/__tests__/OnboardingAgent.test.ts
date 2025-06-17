import { OnboardingAgent } from '../index';
import { OnboardingPayload, OnboardingResult, OnboardingStep, UserType } from '../types';
import { createTestDependencies, createTestConfig } from '../../../test/helpers/testHelpers';

// Mock NotificationAgent
jest.mock('../../NotificationAgent', () => ({
  sendNotification: jest.fn(() => Promise.resolve({
    success: true,
    notificationId: 'test-notification-id',
    channels: ['discord', 'notion']
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
          single: jest.fn(() => ({
            data: {
              id: 'test-onboarding-id',
              user_id: 'test-user',
              user_type: 'customer',
              steps: [
                { id: 'accept_tos', label: 'Accept Terms', completed: false }
              ],
              status: 'in_progress'
            },
            error: null
          }))
        })),
        gte: jest.fn(() => ({
          data: [],
          error: null
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          data: [{ id: 'test-onboarding-id' }],
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
const mockOnboardingPayload: OnboardingPayload = {
  userId: 'test-user',
  userType: 'customer',
  meta: {
    source: 'web',
    referrer: 'test-referrer'
  }
};

const mockOnboardingResult: OnboardingResult = {
  success: true,
  onboardingId: 'test-onboarding-id',
  steps: [
    { id: 'accept_tos', label: 'Accept Terms of Service', completed: false },
    { id: 'profile', label: 'Complete Profile', completed: false },
    { id: 'intro', label: 'Post Introduction', completed: false }
  ]
};

const mockOnboardingSteps: OnboardingStep[] = [
  { id: 'accept_tos', label: 'Accept Terms of Service', completed: false },
  { id: 'profile', label: 'Complete Profile', completed: false },
  { id: 'intro', label: 'Post Introduction', completed: false }
];

// Test configuration
const mockConfig = {
  name: 'OnboardingAgent',
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
    prefix: 'onboarding'
  },
  onboardingConfig: {
    maxConcurrentOnboardings: 100,
    stepTimeout: 3600,
    notificationChannels: ['discord', 'notion'],
    userTypes: ['customer', 'capper']
  }
};

describe('OnboardingAgent', () => {
  let agent: OnboardingAgent;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Use test helpers to create proper dependencies and config
    const deps = createTestDependencies();
    const config = createTestConfig({ name: 'OnboardingAgent' });

    agent = new OnboardingAgent(config, deps);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await agent.stop();
    });
  });

  describe('lifecycle', () => {
    it('should handle start and stop lifecycle', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details.errors).toHaveLength(0);
    });

    it('should return unhealthy status when database is unreachable', async () => {
      // Mock database error
      jest.spyOn(mockSupabase.from, 'select')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const health = await agent.checkHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.details.errors).toHaveLength(1);
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      const health = await agent.checkHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('details');
    });
  });

  describe('public interface', () => {
    it('should handle agent lifecycle properly', async () => {
      await expect(agent.start()).resolves.not.toThrow();
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });
}); 