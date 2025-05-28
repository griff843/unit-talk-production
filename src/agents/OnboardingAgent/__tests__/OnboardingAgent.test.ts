import { OnboardingAgent } from '../index';
import { OnboardingPayload, OnboardingResult, UserType } from '../types';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
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

describe('OnboardingAgent', () => {
  let agent: OnboardingAgent;
  const mockConfig = {
    name: 'OnboardingAgent',
    agentName: 'OnboardingAgent',
    enabled: true,
    metricsConfig: {
      interval: 60000,
      prefix: 'onboarding'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new OnboardingAgent({
      supabase: createClient('test-url', 'test-service-role-key'),
      config: mockConfig,
      logger: new Logger('test')
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should validate dependencies', async () => {
      await expect(agent.validateDependencies()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details?.errors).toHaveLength(0);
    });
  });

  describe('startOnboarding', () => {
    it('should start onboarding process successfully', async () => {
      const payload: OnboardingPayload = {
        userId: 'test-user',
        userType: 'customer' as UserType,
        meta: { source: 'test' }
      };

      const result = await agent.startOnboarding(payload);
      expect(result.success).toBe(true);
      expect(result.onboardingId).toBe('test-onboarding-id');
      expect(result.steps).toHaveLength(3); // Base step + 2 customer steps
      expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'onboarding',
        channels: ['discord', 'notion']
      }));
    });

    it('should handle different user types correctly', async () => {
      const userTypes: UserType[] = ['customer', 'capper', 'staff', 'mod', 'va', 'vip'];
      
      for (const userType of userTypes) {
        const payload: OnboardingPayload = {
          userId: 'test-user',
          userType,
          meta: { source: 'test' }
        };

        const result = await agent.startOnboarding(payload);
        expect(result.success).toBe(true);
        expect(result.steps[0]).toEqual(expect.objectContaining({
          id: 'accept_tos',
          completed: false
        }));
      }
    });
  });

  describe('completeStep', () => {
    it('should complete a step successfully', async () => {
      const result = await agent.completeStep('test-user', 'accept_tos');
      expect(result).toBe(true);
      expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'onboarding',
        channels: ['discord', 'notion']
      }));
    });

    it('should handle non-existent steps gracefully', async () => {
      await expect(agent.completeStep('test-user', 'non-existent-step'))
        .rejects.toThrow('Onboarding record not found');
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