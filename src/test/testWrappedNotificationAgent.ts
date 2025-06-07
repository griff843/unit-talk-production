import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { NotificationAgent } from '../agents/NotificationAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationAgentConfig } from '../agents/NotificationAgent/types';
import { BaseAgentDependencies } from '../agents/BaseAgent/types';
import { ErrorHandler } from '../utils/errorHandling';
import { Logger } from '../utils/logger';

describe('NotificationAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: NotificationAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: NotificationAgentConfig = {
    name: 'NotificationAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60
    },
    health: {
      enabled: true,
      interval: 30
    },
    retry: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000
    },
    channels: {
      email: {
        smtpConfig: {
          host: 'smtp.example.com',
          port: 587,
          secure: true,
          auth: {
            user: 'test@example.com',
            pass: 'test123'
          }
        },
        enabled: true
      },
      sms: {
        provider: 'twilio',
        apiKey: 'test_key',
        accountSid: 'test_sid',
        fromNumber: '+1234567890',
        enabled: true
      },
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/test',
        enabled: true
      },
      notion: {
        apiKey: 'test_key',
        databaseId: 'test_db',
        enabled: true
      },
      slack: {
        webhookUrl: 'https://hooks.slack.com/test',
        defaultChannel: '#test',
        enabled: true
      }
    },
    templates: {
      'pick-alert': {
        title: 'New Pick Alert',
        body: 'A new pick has been posted for {{player}}',
        priority: 'high',
        channels: ['email', 'sms']
      }
    },
    batchConfig: {
      maxBatchSize: 100
    }
  };

  const mockNotification = {
    id: '1',
    user_id: 'user1',
    template_id: 'pick-alert',
    title: 'New Pick Alert',
    body: 'A new pick has been posted for John Doe',
    priority: 'high',
    channels: ['email', 'sms'],
    data: { player: 'John Doe' },
    status: 'pending',
    created_at: new Date().toISOString()
  };

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  beforeEach(() => {
    // Create type-safe mock for Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      auth: {
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    } as unknown as jest.Mocked<SupabaseClient>;

    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      logger: new Logger('NotificationAgent') as any,
      errorHandler: new ErrorHandler('NotificationAgent') as any
    };

    agent = new NotificationAgent(mockConfig, dependencies);
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      await expect(agent['initialize']()).resolves.not.toThrow();
    });

    it('should support test metrics collection', async () => {
      const metrics = await agent['collectMetrics']();
      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBeDefined();
      expect(metrics.errorCount).toBeDefined();
      expect(metrics.warningCount).toBeDefined();
    });

    it('should support test health checks', async () => {
      const health = await agent['checkHealth']();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should validate config successfully', () => {
      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        logger: new Logger('NotificationAgent') as any,
        errorHandler: new ErrorHandler('NotificationAgent') as any
      };
      expect(() => new NotificationAgent(mockConfig, dependencies)).not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        ...mockConfig,
        name: undefined // Invalid - missing required field
      } as any;

      const dependencies: BaseAgentDependencies = {
        supabase: mockSupabase,
        logger: new Logger('NotificationAgent') as any,
        errorHandler: new ErrorHandler('NotificationAgent') as any
      };

      expect(() => new NotificationAgent(invalidConfig, dependencies)).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any));

      await expect(agent['initialize']()).resolves.not.toThrow();
    });

    it('should handle missing table access', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error(`Table ${table} not found`) 
          })
        })
      } as any));

      await expect(agent['initialize']()).rejects.toThrow();
    });
  });

  describe('Notification Processing', () => {
    beforeEach(() => {
      // Mock pending notifications
      mockSupabase.from.mockImplementation(() => ({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            order: jest.fn().mockReturnValue({
              ...mockSupabase,
              limit: jest.fn().mockResolvedValue({
                data: [mockNotification],
                error: null
              })
            })
          })
        })
      } as any));
    });

    it('should process notifications successfully', async () => {
      await agent['initialize']();
      await agent['process']();

      const metrics = await agent['collectMetrics']();
      expect(metrics.successCount).toBeGreaterThan(0);
    });

    it('should handle delivery failures', async () => {
      // Mock a failed delivery
      jest.spyOn(agent as any, 'sendNotification').mockRejectedValueOnce(
        new Error('Notification delivery failed')
      );

      await agent['initialize']();
      try {
        await agent['process']();
      } catch (e) {
        // Expected to throw
      }

      const metrics = await agent['collectMetrics']();
      expect(metrics.errorCount).toBeGreaterThan(0);
    });

    it('should update notification status correctly', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      mockSupabase.from.mockImplementation(() => ({
        ...mockSupabase,
        update: updateMock,
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any));

      await agent['initialize']();
      
      // Send a notification directly
      await agent.sendNotification({
        type: 'test',
        message: 'Test message',
        channels: ['discord'],
        priority: 'low'
      });

      // Check that the notification log was inserted
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
    });

    it('should respect batch configuration', async () => {
      const notifications = Array((mockConfig.batchConfig?.maxBatchSize ?? 0) + 1)
        .fill(null)
        .map((_, i) => ({
          ...mockNotification,
          id: `${i + 1}`
        }));

      mockSupabase.from.mockImplementation(() => ({
        ...mockSupabase,
        select: jest.fn().mockReturnValue({
          ...mockSupabase,
          eq: jest.fn().mockReturnValue({
            ...mockSupabase,
            data: notifications,
            error: null
          })
        })
      } as any));

      await agent['initialize']();
      await agent['process']();

      // Agent should process notifications in batches
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when error rate is low', async () => {
      const health = await agent['checkHealth']();
      expect(health.status).toBe('healthy');
    });

    it('should report warning when error rate is high', async () => {
      // Set high error rate in agent stats
      (agent as any).notificationStats = {
        sent: 1,
        failed: 10,
        pending: 0,
        partialSuccess: 0
      };

      const health = await agent['checkHealth']();
      expect(['degraded', 'unhealthy']).toContain(health.status);
    });
  });
}); 