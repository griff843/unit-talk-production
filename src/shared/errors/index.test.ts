import {
  AgentError,
  DatabaseError,
  NetworkError,
  TimeoutError,
  RetryableError,
  ErrorHandler,
  ErrorHandlerConfig,
  isAgentError,
  isDatabaseError,
  isNetworkError,
  isRetryableError,
} from './';

describe('Error Classes', () => {
  describe('AgentError', () => {
    it('should create agent error with correct properties', () => {
      const error = new AgentError('Agent failed', 'TestAgent', { reason: 'timeout' });
      expect(error.code).toBe('AGENT_ERROR');
      expect(error.agentName).toBe('TestAgent');
      expect(error.details).toEqual({ agentName: 'TestAgent', reason: 'timeout' });
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with correct properties', () => {
      const error = new DatabaseError('Query failed', 'SELECT', 'users');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.operation).toBe('SELECT');
      expect(error.table).toBe('users');
    });
  });

  describe('NetworkError', () => {
    it('should create network error with correct properties', () => {
      const error = new NetworkError('Connection failed', 'https://api.example.com');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.endpoint).toBe('https://api.example.com');
    });
  });
});

describe('ErrorHandler', () => {
  const config: ErrorHandlerConfig = {
    maxRetries: 3,
    backoffMs: 100,
    maxBackoffMs: 1000,
    shouldRetry: (error: Error) => error instanceof NetworkError,
  };

  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler(config);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Failed', 'test'))
        .mockResolvedValueOnce('success');

      const result = await errorHandler.withRetry(operation, 'test operation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    }, 1000);

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Non-retryable'));

      await expect(errorHandler.withRetry(operation, 'test operation'))
        .rejects
        .toThrow('Non-retryable');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw RetryableError after max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new NetworkError('Failed', 'test'));

      await expect(errorHandler.withRetry(operation, 'test operation'))
        .rejects
        .toThrow(RetryableError);
      expect(operation).toHaveBeenCalledTimes(3);
    }, 1000);

    it('should use exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new NetworkError('Failed', 'test'));

      const startTime = Date.now();
      await expect(errorHandler.withRetry(operation, 'test operation'))
        .rejects
        .toThrow();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThanOrEqual(300);
    }, 1000);
  });
});

describe('Type Guards', () => {
  it('should correctly identify AgentError', () => {
    const error = new AgentError('test', 'TestAgent');
    expect(isAgentError(error)).toBe(true);
    expect(isAgentError(new Error())).toBe(false);
  });

  it('should correctly identify DatabaseError', () => {
    const error = new DatabaseError('test', 'SELECT', 'users');
    expect(isDatabaseError(error)).toBe(true);
    expect(isDatabaseError(new Error())).toBe(false);
  });

  it('should correctly identify NetworkError', () => {
    const error = new NetworkError('test', 'https://api.example.com');
    expect(isNetworkError(error)).toBe(true);
    expect(isNetworkError(new Error())).toBe(false);
  });

  it('should correctly identify RetryableError', () => {
    const error = new RetryableError('test', 1, 3);
    expect(isRetryableError(error)).toBe(true);
    expect(isRetryableError(new Error())).toBe(false);
  });
}); 