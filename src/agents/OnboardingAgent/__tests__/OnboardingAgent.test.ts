import { OnboardingAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';
import { BaseAgentDependencies } from '../BaseAgent/types';
import { OnboardingPayload, OnboardingResult, OnboardingStep, UserType } from '../types';
import { sendNotification } from '../../NotificationAgent';

// Mock sendNotification
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
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient('test-url', 'test-service-role-key');
    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      logger: new Logger('OnboardingAgent'),
      errorHandler: new ErrorHandler('OnboardingAgent')
    };
    agent = new OnboardingAgent(dependencies);
  });

  describe('initialization', () => {
    it('should initialize resources successfully', async () => {
      await expect(agent.initializeResources()).resolves.not.toThrow();
    });

    it('should validate dependencies', async () => {
      await expect(agent['validateDependencies']()).resolves.not.toThrow();
    });
  });

  describe('process', () => {
    it('should process onboarding tasks successfully', async () => {
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

    it('should return unhealthy status when database is unreachable', async () => {
      // Mock database error
      jest.spyOn(mockSupabase.from, 'select')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const health = await agent.checkHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.details.errors).toHaveLength(1);
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.collectMetrics();
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('onboardingStats');
    });
  });

  describe('command processing', () => {
    it('should handle START_ONBOARDING command', async () => {
      await expect(agent.processCommand({
        type: 'START_ONBOARDING',
        payload: mockOnboardingPayload
      })).resolves.not.toThrow();

      expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'onboarding',
        channels: ['discord', 'notion']
      }));
    });

    it('should handle COMPLETE_STEP command', async () => {
      await expect(agent.processCommand({
        type: 'COMPLETE_STEP',
        payload: {
          userId: 'test-user',
          stepId: 'accept_tos'
        }
      })).resolves.not.toThrow();
    });

    it('should throw error for unknown command type', async () => {
      await expect(agent.processCommand({
        type: 'UNKNOWN_COMMAND',
        payload: {}
      })).rejects.toThrow('Unknown command type: UNKNOWN_COMMAND');
    });
  });

  describe('workflow steps', () => {
    it('should return correct steps for customer type', () => {
      const steps = agent['getWorkflowSteps']('customer');
      expect(steps).toHaveLength(3);
      expect(steps[0].id).toBe('accept_tos');
      expect(steps[1].id).toBe('profile');
      expect(steps[2].id).toBe('intro');
    });

    it('should return correct steps for capper type', () => {
      const steps = agent['getWorkflowSteps']('capper');
      expect(steps).toHaveLength(5);
      expect(steps[0].id).toBe('accept_tos');
      expect(steps[1].id).toBe('kyc');
      expect(steps[2].id).toBe('training');
      expect(steps[3].id).toBe('access');
    });

    it('should return base steps for unknown type', () => {
      const steps = agent['getWorkflowSteps']('unknown' as UserType);
      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('accept_tos');
    });
  });
}); 