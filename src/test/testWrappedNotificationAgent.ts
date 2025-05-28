import { TestWorkflowEnvironment } from '@temporalio/testing';
import { beforeAll, beforeEach, afterAll, describe, it, expect, jest } from '@jest/globals';
import { NotificationAgent } from '../agents/NotificationAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationAgentConfig } from '../agents/NotificationAgent/types';

describe('NotificationAgent', () => {
  let testEnv: TestWorkflowEnvironment;
  let agent: NotificationAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  const mockConfig: NotificationAgentConfig = {
    agentName: 'NotificationAgent',
    enabled: true,
    channels: {
      email: {
        enabled: true,
        provider: 'sendgrid',
        apiKey: 'test-key',
        rateLimit: 100,
        retryConfig: {
          maxAttempts: 3,
          backoffMs: 1000
        }
      },
      sms: {
        enabled: true,
        provider: 'twilio',
        apiKey: 'test-key',
        rateLimit: 10,
        retryConfig: {
          maxAttempts: 3,
          backoffMs: 1000
        }
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
      maxBatchSize: 100,
      batchIntervalMs: 1000
    },
    metricsConfig: {
      interval: 60000,
      prefix: 'notification_agent'
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
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    } as any;

    agent = new NotificationAgent(
      mockConfig,
      mockSupabase,
      { maxRetries: 3, backoffMs: 100 }
    );
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('Configuration', () => {
    it('should validate config successfully', () => {
      expect(() => new NotificationAgent(mockConfig, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        ...mockConfig,
        channels: {
          email: {
            ...mockConfig.channels.email,
            rateLimit: -1 // Invalid rate limit
          }
        }
      };

      expect(() => new NotificationAgent(invalidConfig as any, mockSupabase, { maxRetries: 3, backoffMs: 100 }))
        .toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }));

      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should handle missing table access', async () => {
      mockSupabase.from.mockImplementation((table) => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error(`Table ${table} not found`) 
          })
        })
      }));

      await expect(agent.initialize()).rejects.toThrow();
    });
  });

  describe('Notification Processing', () => {
    beforeEach(() => {
      // Mock pending notifications
      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockNotification],
                error: null
              })
            })
          })
        })
      }));

      // Mock status update
      mockSupabase.from.mockImplementationOnce(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      }));

      // Mock delivery record storage
      mockSupabase.from.mockImplementationOnce(() => ({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      }));
    });

    it('should process notifications successfully', async () => {
      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.totalNotifications).toBeGreaterThan(0);
      expect(metrics.deliveryStats.email.sent).toBeGreaterThan(0);
      expect(metrics.deliveryStats.sms.sent).toBeGreaterThan(0);
    });

    it('should handle delivery failures', async () => {
      // Mock a failed SMS delivery
      jest.spyOn(agent as any, 'sendSMS').mockRejectedValueOnce(
        new Error('SMS delivery failed')
      );

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.deliveryStats.sms.failed).toBeGreaterThan(0);
      expect(metrics.errorCount).toBeGreaterThan(0);
    });

    it('should update notification status correctly', async () => {
      const updateSpy = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: updateSpy
        })
      }));

      await agent.initialize();
      await agent.start();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(String)
        })
      );
    });

    it('should respect batch configuration', async () => {
      const notifications = Array(mockConfig.batchConfig.maxBatchSize + 1)
        .fill(null)
        .map((_, i) => ({
          ...mockNotification,
          id: `${i + 1}`
        }));

      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: notifications,
                error: null
              })
            })
          })
        })
      }));

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.batchStats.avgBatchSize).toBeLessThanOrEqual(
        mockConfig.batchConfig.maxBatchSize
      );
    });
  });

  describe('Template Handling', () => {
    it('should track template usage statistics', async () => {
      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.templateStats['pick-alert']).toBeDefined();
      expect(metrics.templateStats['pick-alert'].sent).toBeGreaterThan(0);
    });

    it('should handle missing templates gracefully', async () => {
      const invalidNotification = {
        ...mockNotification,
        template_id: 'non-existent-template'
      };

      mockSupabase.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [invalidNotification],
                error: null
              })
            })
          })
        })
      }));

      await agent.initialize();
      await agent.start();

      const metrics = await agent.collectMetrics();
      expect(metrics.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when delivery rates are good', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('ok');
    });

    it('should report warning when failure rate is high', async () => {
      agent['metrics'].deliveryStats.email.sent = 80;
      agent['metrics'].deliveryStats.email.failed = 20; // 20% failure rate

      const health = await agent.checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details.errors).toContain('High failure rate for email: 20.0%');
    });

    it('should report warning when processing time is high', async () => {
      agent['metrics'].batchStats.avgProcessingTimeMs = 6000; // > 5 second threshold

      const health = await agent.checkHealth();
      expect(health.status).toBe('warn');
      expect(health.details.errors).toContain('High average processing time');
    });
  });
}); 