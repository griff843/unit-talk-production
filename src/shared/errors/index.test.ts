import {
  BaseError,
  AgentError,
  DatabaseError,
  NetworkError,
  ValidationError,
  RetryableError,
  ConfigurationError,
  ErrorHandler,
  isAgentError,
  isDatabaseError,
  isNetworkError,
  isRetryableError,
} from './';

describe('Error Classes', () => {
  describe('AgentError', () => {
    it('should create an AgentError with correct properties', () => {
      const error = new AgentError('Test error', 'test-agent');
      expect(error.message).toBe('Test error');
      expect(error.agentName).toBe('test-agent');
      expect(error.code).toBe('AGENT_ERROR');
      expect(error.name).toBe('AgentError');
      expect(error instanceof BaseError).toBe(true);
    });

    it('should create an AgentError with details', () => {
      const details = { agentName: 'test-agent', userId: '123', action: 'test' };
      const error = new AgentError('Test error', 'test-agent', details);
      expect(error.message).toBe('Test error');
      expect(error.agentName).toBe('test-agent');
      expect(error.details).toEqual({ agentName: 'test-agent', userId: '123', action: 'test' });
    });
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with correct properties', () => {
      const error = new DatabaseError('DB connection failed', 'SELECT', 'users');
      expect(error.message).toBe('DB connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.name).toBe('DatabaseError');
      expect(error instanceof BaseError).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should create a NetworkError with correct properties', () => {
      const error = new NetworkError('Request failed', 'http://example.com');
      expect(error.message).toBe('Request failed');
      expect(error.endpoint).toBe('http://example.com');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
      expect(error instanceof BaseError).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with correct properties', () => {
      const details = { value: 'not-an-email' };
      const error = new ValidationError('Invalid input', 'email', details);
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('email');
      expect(error.details).toEqual({ field: 'email', value: 'not-an-email' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error instanceof BaseError).toBe(true);
    });
  });

  describe('RetryableError', () => {
    it('should create a RetryableError with correct properties', () => {
      const error = new RetryableError('Temporary failure', 2, 3);
      expect(error.message).toBe('Temporary failure');
      expect(error.attempt).toBe(2);
      expect(error.maxAttempts).toBe(3);
      expect(error.code).toBe('RETRY_ERROR');
      expect(error.name).toBe('RetryableError');
      expect(error instanceof BaseError).toBe(true);
    });

    it('should create a RetryableError with details', () => {
      const details = { originalError: 'Connection timeout' };
      const error = new RetryableError('Temporary failure', 2, 3, details);
      expect(error.message).toBe('Temporary failure');
      expect(error.attempt).toBe(2);
      expect(error.maxAttempts).toBe(3);
      expect(error.details).toEqual({ attempt: 2, maxAttempts: 3, originalError: 'Connection timeout' });
    });
  });

  describe('ConfigurationError', () => {
    it('should create a ConfigurationError with correct properties', () => {
      const error = new ConfigurationError('Missing API key', 'API_KEY');
      expect(error.message).toBe('Missing API key');
      expect(error.configKey).toBe('API_KEY');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.name).toBe('ConfigurationError');
      expect(error instanceof BaseError).toBe(true);
    });
  });
});

describe('Type Guards', () => {
  describe('isAgentError', () => {
    it('should return true for AgentError instances', () => {
      const error = new AgentError('Test', 'agent');
      expect(isAgentError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = new Error('Test');
      expect(isAgentError(error)).toBe(false);
    });
  });

  describe('isDatabaseError', () => {
    it('should return true for DatabaseError instances', () => {
      const error = new DatabaseError('Test', 'SELECT', 'table');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = new Error('Test');
      expect(isDatabaseError(error)).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for NetworkError instances', () => {
      const error = new NetworkError('Test', 'http://example.com');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = new Error('Test');
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for RetryableError instances', () => {
      const error = new RetryableError('Test', 1, 3);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = new Error('Test');
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      maxRetries: 3,
      backoffMs: 100,
      maxBackoffMs: 1000,
      shouldRetry: (error: Error) => error instanceof RetryableError
    });
  });

  describe('handleError', () => {
    it('should log error information', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new AgentError('Test error', 'test-agent');
      
      errorHandler.handleError(error, { userId: '123' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Error handled:', {
        message: 'Test error',
        name: 'AgentError',
        stack: expect.any(String),
        context: { userId: '123' }
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await errorHandler.withRetry(operation, 'test operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new RetryableError('Temporary failure', attempts, 3);
        }
        return 'success';
      });

      const result = await errorHandler.withRetry(operation, 'test operation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    }, 15000); // 15 second timeout

    it('should not retry non-retryable errors', async () => {
      const error = new AgentError('Non-retryable', 'test-agent');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorHandler.withRetry(operation, 'test operation')).rejects.toThrow('Non-retryable');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw RetryableError after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new RetryableError('Always fails', 1, 3));

      await expect(errorHandler.withRetry(operation, 'test operation')).rejects.toThrow('test operation failed after 3 attempts');
      expect(operation).toHaveBeenCalledTimes(3);
    }, 15000); // 15 second timeout
  });
});