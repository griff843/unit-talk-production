import { BaseAgentDependencies, BaseAgentConfig } from '../../agents/BaseAgent/types';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';

export function createTestDependencies(): BaseAgentDependencies {
  const mockLogger = new Logger('TestAgent');
  const mockErrorHandler = new ErrorHandler('TestAgent', {} as any);

  // Create a comprehensive Supabase mock
  const mockSupabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        })),
        eq: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        })),
        gte: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({
          data: [{ id: 'test-contest-id' }],
          error: null
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(() => Promise.resolve())
      })),
      unsubscribe: jest.fn(() => Promise.resolve())
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: { id: 'test-user' } },
        error: null
      }))
    }
  };

  return {
    supabase: mockSupabase as any,
    logger: mockLogger,
    errorHandler: mockErrorHandler
  };
}

export function createTestConfig(overrides: Partial<BaseAgentConfig> = {}): BaseAgentConfig {
  return {
    name: 'TestAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60000
    },
    ...overrides
  };
}