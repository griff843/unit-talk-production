import { OnboardingAgent } from '../index';
import { mockSupabaseClient, mockLogger, mockErrorHandler } from '../../../test/helpers/testHelpers';

// Mock NotificationAgent
jest.mock('../../NotificationAgent', () => ({
  sendNotification: jest.fn(() => Promise.resolve({
    success: true,
    notificationId: 'test-notification-id',
    channels: ['discord', 'notion']
  }))
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('OnboardingAgent', () => {
  let agent: OnboardingAgent;
  
  const mockConfig = {
    name: 'OnboardingAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info' as const,
    schedule: 'manual',
    metrics: {
      enabled: true,
      interval: 30000,
      port: 9090
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000,
      maxAttempts: 5,
      backoff: 1000,
      exponential: true,
      jitter: true
    },
    health: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      checkDb: true,
      checkExternal: false
    }
  };

  const mockOnboardingPayload = {
    userId: 'test-user-id',
    userProfile: {
      experience: 'beginner',
      riskTolerance: 'low',
      interests: ['sports', 'betting']
    }
  };

  const mockOnboardingResult = {
    success: true,
    learningPathId: 'test-path-id',
    steps: []
  };

  const mockOnboardingSteps = [
    {
      id: 'step-1',
      type: 'education',
      title: 'Welcome to Unit Talk',
      content: 'Learn the basics of sports betting',
      order: 1,
      completed: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock responses
    (mockSupabaseClient.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockOnboardingResult,
            error: null
          })
        }),
        limit: jest.fn().mockResolvedValue({
          data: [mockOnboardingResult],
          error: null
        })
      }),
      insert: jest.fn().mockResolvedValue({
        data: mockOnboardingResult,
        error: null
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: mockOnboardingResult,
          error: null
        })
      })
    });

    agent = new OnboardingAgent(mockConfig, {
      supabase: mockSupabaseClient,
      logger: mockLogger,
      errorHandler: mockErrorHandler
    });
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      // Since initialize is protected, we test it through start()
      await expect(agent.start()).resolves.not.toThrow();
      await agent.stop();
    });
  });

  describe('lifecycle', () => {
    it('should start successfully', async () => {
      await expect(agent.start()).resolves.not.toThrow();
    });

    it('should stop successfully', async () => {
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await agent.checkHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
    });

    it('should handle database errors gracefully', async () => {
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });

      const health = await agent.checkHealth();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('public interface', () => {
    it('should have start method', () => {
      expect(typeof agent.start).toBe('function');
    });

    it('should have stop method', () => {
      expect(typeof agent.stop).toBe('function');
    });
  });
});