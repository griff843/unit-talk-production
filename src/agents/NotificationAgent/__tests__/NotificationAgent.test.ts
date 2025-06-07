import { NotificationAgent, initializeNotificationAgent } from '../index';
import { NotificationPayload, NotificationResult } from '../types';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { BaseAgentConfig, BaseAgentDependencies } from '@shared/types/baseAgent';

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
global.fetch = jest.fn().mockImplementation(async (url, options) => {
  if (url.includes('discord')) {
    return { ok: true, json: () => Promise.resolve({ id: 'test-notification-id' }) };
  }
  if (url.includes('notion')) {
    return { ok: true, json: () => Promise.resolve({ id: 'test-notification-id' }) };
  }
  throw new Error('Unexpected URL');
});

describe('NotificationAgent', () => {
  let agent: NotificationAgent;
  const mockConfig: BaseAgentConfig = {
    name: 'NotificationAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info',
    metrics: { enabled: true, interval: 60 },
    health: { enabled: true, interval: 30 },
    retry: {
      maxRetries: 3,
      backoffMs: 100,
      maxBackoffMs: 1000
    }
  };

  const extendedConfig = {
  logLevel: 'info',
  version: '0.0.1',
  name: 'TestAgent',
    ...mockConfig,
    channels: {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/test',
        enabled: true
      ,
  metrics: { enabled: false, interval: 60 ,
  health: { enabled: false, interval: 30 ,
  retry: { maxRetries: 0, backoffMs: 200, maxBackoffMs: 500 }
}
}
},
      notion: {
        apiKey: 'test-notion-key',
        databaseId: 'test-db-id',
        enabled: true
      }
    }
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  const mockErrorHandler = {
    withRetry: jest.fn((fn: any) => fn())
  };

  const mockSupabase = createClient('test-url', 'test-service-role-key');

  beforeEach(() => {
    jest.clearAllMocks();
    
    const deps: BaseAgentDependencies = {
      supabase: mockSupabase,
      logger: mockLogger as any,
      errorHandler: mockErrorHandler as any
    };

    agent = new NotificationAgent(extendedConfig as BaseAgentConfig, deps);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing NotificationAgent...');
      expect(mockLogger.info).toHaveBeenCalledWith('NotificationAgent initialized successfully');
    });

    it('should validate dependencies', async () => {
      await expect(agent.validateDependencies()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      await agent.initialize();
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
      expect(result.notificationId).toBeDefined();
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
        extendedConfig.channels.discord.webhookUrl,
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
            'Authorization': `Bearer ${extendedConfig.channels.notion.apiKey}`,
            'Notion-Version': '2022-06-28'
          })
        })
      );
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      await agent.initialize();
      const metrics = await agent.collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBeDefined();
      expect(metrics.errorCount).toBeDefined();
      expect(metrics.warningCount).toBeDefined();
      expect(metrics.memoryUsageMb).toBeGreaterThan(0);
    });
  });

  describe('command handling', () => {
    it('should handle SEND_NOTIFICATION command', async () => {
      const command = {
        type: 'SEND_NOTIFICATION',
        payload: {
          type: 'test',
          message: 'Test message',
          channels: ['discord']
        }
      };

      await expect(agent.handleCommand(command)).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Processing command: SEND_NOTIFICATION');
    });

    it('should handle unknown commands', async () => {
      const command = {
        type: 'UNKNOWN_COMMAND',
        payload: {}
      };

      await expect(agent.handleCommand(command)).rejects.toThrow('Unknown command type: UNKNOWN_COMMAND');
    });
  });
}); 