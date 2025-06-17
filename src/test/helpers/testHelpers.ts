import { BaseAgentConfig, BaseAgentDependencies, Logger, ErrorHandler } from '../../agents/BaseAgent/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { createBaseAgentConfig } from '../../agents/BaseAgent/config';

/**
 * Mock logger for testing
 */
export const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger)
};

/**
 * Mock error handler for testing
 */
export const mockErrorHandler: ErrorHandler = {
  handleError: jest.fn(),
  withRetry: jest.fn(async (fn) => await fn())
};

/**
 * Mock Supabase client for testing
 */
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      limit: jest.fn(() => ({ error: null, data: [] })),
      eq: jest.fn(() => ({ error: null, data: [] })),
      insert: jest.fn(() => ({ error: null, data: [] })),
      update: jest.fn(() => ({ error: null, data: [] })),
      delete: jest.fn(() => ({ error: null, data: [] }))
    })),
    insert: jest.fn(() => ({ error: null, data: [] })),
    update: jest.fn(() => ({ error: null, data: [] })),
    delete: jest.fn(() => ({ error: null, data: [] }))
  }))
} as unknown as SupabaseClient;

/**
 * Create test configuration for BaseAgent
 */
export function createTestConfig(overrides: Partial<BaseAgentConfig> = {}): BaseAgentConfig {
  return createBaseAgentConfig({
    name: 'TestAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info',
    ...overrides
  });
}

/**
 * Create test dependencies for BaseAgent
 */
export function createTestDependencies(overrides: Partial<BaseAgentDependencies> = {}): BaseAgentDependencies {
  return {
    supabase: mockSupabaseClient,
    logger: mockLogger,
    errorHandler: mockErrorHandler,
    ...overrides
  };
}

/**
 * Reset all mocks
 */
export function resetMocks(): void {
  jest.clearAllMocks();
}

/**
 * Test agent implementation for testing BaseAgent functionality
 */
export class TestAgent {
  private initialized = false;
  private processed = false;
  private cleanedUp = false;
  protected config: BaseAgentConfig;
  protected deps: BaseAgentDependencies;

  constructor(config?: Partial<BaseAgentConfig>, deps?: Partial<BaseAgentDependencies>) {
    this.config = createTestConfig(config);
    this.deps = createTestDependencies(deps);
  }

  protected async initialize(): Promise<void> {
    this.initialized = true;
  }

  protected async process(): Promise<void> {
    this.processed = true;
  }

  protected async cleanup(): Promise<void> {
    this.cleanedUp = true;
  }

  protected async collectMetrics() {
    return {
      agentName: this.config.name,
      successCount: 1,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 100,
      memoryUsageMb: 50
    };
  }

  public async checkHealth() {
    return {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      details: {
        initialized: this.initialized,
        processed: this.processed,
        cleanedUp: this.cleanedUp
      }
    };
  }

  // Expose internal state for testing
  public getInternalState() {
    return {
      initialized: this.initialized,
      processed: this.processed,
      cleanedUp: this.cleanedUp
    };
  }
}