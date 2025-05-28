import { NotificationAgent, initializeNotificationAgent } from '../index';
import { NotificationPayload, NotificationResult } from '../types';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';

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
          data: [{ id: 'test-notification-id' }],
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

// Mock fetch for Discord and Notion API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    statusText: 'OK'
  })
) as jest.Mock;

describe('NotificationAgent', () => {
  let agent: NotificationAgent;
  const mockConfig = {
    name: 'NotificationAgent',
    agentName: 'NotificationAgent',
    enabled: true,
    metricsConfig: {
      interval: 60000,
      prefix: 'notification'
    },
    channels: {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/test',
        enabled: true
      },
      notion: {
        apiKey: 'test-notion-key',
        databaseId: 'test-database-id',
        enabled: true
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = initializeNotificationAgent({
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

  describe('sendNotification', () => {
    it('should send a notification successfully', async () => {
      const payload: NotificationPayload = {
        type: 'system',
        message: 'Test notification',
        channels: ['discord', 'notion'],
        priority: 'low'
      };

      const result = await agent.sendNotification(payload);
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('test-notification-id');
      expect(result.channels).toEqual(['discord', 'notion']);
    });

    it('should handle Discord notifications', async () => {
      const payload: NotificationPayload = {
        type: 'system',
        message: 'Test Discord notification',
        channels: ['discord'],
        priority: 'high'
      };

      await agent.sendNotification(payload);
      expect(fetch).toHaveBeenCalledWith(
        mockConfig.channels.discord.webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle Notion notifications', async () => {
      const payload: NotificationPayload = {
        type: 'system',
        message: 'Test Notion notification',
        channels: ['notion'],
        priority: 'medium'
      };

      await agent.sendNotification(payload);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/pages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockConfig.channels.notion.apiKey}`,
            'Notion-Version': '2022-06-28'
          })
        })
      );
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