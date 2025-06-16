import { NotificationAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../services/logging';
import { ErrorHandler } from '../../../shared/errors';
import { NotificationPayload, NotificationAgentConfig, NotificationChannel } from '../types';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../../services/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock console.log for Notion notifications
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Mock fetch for Discord API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('NotificationAgent', () => {
  const extendedConfig: NotificationAgentConfig = {
    name: 'NotificationAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    agentName: 'NotificationAgent',
    metrics: {
      enabled: true,
      interval: 60,
      port: 3001
    },
    metricsConfig: {
      interval: 60,
      prefix: 'notification'
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      backoffMs: 100,
      maxBackoffMs: 1000,
      maxAttempts: 3,
      backoff: 100,
      exponential: true,
      jitter: false
    },
    channels: {
      discord: {
        enabled: true,
        webhookUrl: 'https://discord.com/api/webhooks/test'
      },
      notion: {
        enabled: true,
        apiKey: 'test-key'
      },
      email: {
        enabled: true,
        smtpConfig: {
          host: 'smtp.test.com',
          port: 587,
          secure: true,
          auth: {
            user: 'test-user',
            pass: 'test-pass'
          }
        }
      },
      slack: {
        enabled: false,
        webhookUrl: 'https://hooks.slack.com/test'
      },
      sms: {
        enabled: false,
        apiKey: 'test-sms-key'
      }
    }
  };

  let agent: NotificationAgent;
  let mockSupabase: any;
  let mockErrorHandler: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }))
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Setup ErrorHandler mock
    mockErrorHandler = new ErrorHandler({
      maxRetries: 1, // Reduce retries for faster tests
      backoffMs: 10,
      maxBackoffMs: 100,
      shouldRetry: (error: Error) => true
    });

    // Reset and setup fetch mock
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup ErrorHandler mock
    mockErrorHandler = new ErrorHandler({
      maxRetries: 1, // Reduce retries for faster tests
      backoffMs: 100, // Minimum allowed value
      maxBackoffMs: 1000, // Minimum allowed value
      shouldRetry: (error: Error) => true
    });

    agent = new NotificationAgent(extendedConfig, {
      supabase: mockSupabase,
      logger: logger,
      errorHandler: mockErrorHandler
    });
  });

  describe('initialization', () => {
    it('should validate dependencies', async () => {
      await expect(agent.validateDependencies()).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
    });
  });

  describe('sendNotification', () => {
    it('should send Discord notifications successfully', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['discord'],
        message: 'Test message',
        priority: 'medium'
      };

      const result = await agent.sendNotification(payload);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual(['discord']);
      expect(result.notificationId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test message')
        })
      );
    });

    it('should send Notion notifications successfully', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['notion'],
        message: 'Test message',
        priority: 'medium'
      };

      const result = await agent.sendNotification(payload);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual(['notion']);
      expect(result.notificationId).toBeDefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Notion] Would send notification:',
        expect.any(Object)
      );
    });

    it('should handle multiple channels', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['discord', 'notion'],
        message: 'Test message',
        priority: 'medium'
      };

      const result = await agent.sendNotification(payload);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual(['discord', 'notion']);
      expect(result.notificationId).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    }, 10000); // 10 second timeout

    it('should handle disabled channels', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['slack'], // slack is disabled in config
        message: 'Test message',
        priority: 'medium'
      };

      const result = await agent.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.channels).toEqual([]);
      expect(result.error).toContain('Channel slack is not enabled');
    });

    it('should handle partial failures', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['discord', 'notion'],
        message: 'Test message',
        priority: 'medium'
      };

      // Make Discord fail
      mockFetch.mockRejectedValue(new Error('Discord API error'));

      const result = await agent.sendNotification(payload);

      expect(result.success).toBe(true); // Partial success is still success
      expect(result.channels).toEqual(['notion']); // Only successful channel
      expect(result.notificationId).toBeDefined();
    }, 10000);

    it('should handle complete failures', async () => {
      const payload: NotificationPayload = {
        type: 'test',
        channels: ['nonexistent' as NotificationChannel],
        message: 'Test message',
        priority: 'medium'
      };

      const result = await agent.sendNotification(payload);
      
      expect(result.success).toBe(false);
      expect(result.channels).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics correctly', async () => {
      const metrics = await agent.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.successCount).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.warningCount).toBe('number');
    });
  });
});