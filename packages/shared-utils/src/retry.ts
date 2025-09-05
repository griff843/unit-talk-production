/**
 * Retry Pattern Implementation for Unit Talk Platform
 * Provides resilient execution with exponential backoff and jitter
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, nextDelayMs: number) => void;
  name?: string;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTimeMs: number;
  errors: Error[];
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly attempt: number,
    public readonly maxAttempts: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly errors: Error[],
    public readonly totalTimeMs: number
  ) {
    super(message);
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = {
    maxAttempts: config.maxAttempts ?? 3,
    baseDelayMs: config.baseDelayMs ?? 1000,
    maxDelayMs: config.maxDelayMs ?? 30000,
    exponentialBackoff: config.exponentialBackoff ?? true,
    jitter: config.jitter ?? true,
    retryCondition: config.retryCondition ?? defaultRetryCondition,
    ...(config.onRetry !== undefined && { onRetry: config.onRetry }),
    name: config.name ?? 'unknown',
  };

  const errors: Error[] = [];
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await fn();
      const totalTimeMs = Date.now() - startTime;
      
      return {
        result,
        attempts: attempt,
        totalTimeMs,
        errors,
      };
    } catch (error) {
      const currentError = error instanceof Error ? error : new Error(String(error));
      errors.push(currentError);

      // Check if we should retry
      if (attempt === finalConfig.maxAttempts) {
        const totalTimeMs = Date.now() - startTime;
        throw new MaxRetriesExceededError(
          `Max retries (${finalConfig.maxAttempts}) exceeded for operation "${finalConfig.name}". Last error: ${currentError.message}`,
          attempt,
          errors,
          totalTimeMs
        );
      }

      // Check retry condition
      if (!finalConfig.retryCondition!(currentError, attempt)) {
        const totalTimeMs = Date.now() - startTime;
        throw new MaxRetriesExceededError(
          `Retry condition failed for operation "${finalConfig.name}" on attempt ${attempt}. Error: ${currentError.message}`,
          attempt,
          errors,
          totalTimeMs
        );
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(attempt, finalConfig);
      
      // Call onRetry callback
      finalConfig.onRetry?.(currentError, attempt, delayMs);

      // Wait before next attempt
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Unexpected retry loop exit');
}

/**
 * Default retry condition - retries on network errors and 5xx HTTP errors
 */
function defaultRetryCondition(error: Error, _attempt: number): boolean {
  // Don't retry certain types of errors
  if (error.name === 'CircuitBreakerError') {
    return false;
  }

  // Retry on network/connection errors
  if (isNetworkError(error)) {
    return true;
  }

  // Retry on server errors (5xx)
  if (isServerError(error)) {
    return true;
  }

  // Don't retry on client errors (4xx) by default
  return false;
}

/**
 * Check if error is a network/connection error
 */
function isNetworkError(error: Error): boolean {
  const networkErrorMessages = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNABORTED',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENETDOWN',
    'network error',
    'connection failed',
    'timeout',
  ];

  const errorMessage = error.message.toLowerCase();
  return networkErrorMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if error is a server error (5xx)
 */
function isServerError(error: Error): boolean {
  // Check if error has a status code property (common in HTTP libraries)
  const errorWithStatus = error as any;
  if (errorWithStatus.status || errorWithStatus.statusCode || errorWithStatus.code) {
    const status = errorWithStatus.status || errorWithStatus.statusCode || errorWithStatus.code;
    const statusNum = parseInt(String(status), 10);
    return statusNum >= 500 && statusNum < 600;
  }

  // Check error message for server error indicators
  const serverErrorIndicators = [
    '500',
    '501',
    '502',
    '503',
    '504',
    '505',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
  ];

  const errorMessage = error.message.toLowerCase();
  return serverErrorIndicators.some(indicator => errorMessage.includes(indicator));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number;

  if (config.exponentialBackoff) {
    // Exponential backoff: delay = baseDelay * (2 ^ (attempt - 1))
    delay = config.baseDelayMs * Math.pow(2, attempt - 1);
  } else {
    // Linear backoff: delay = baseDelay * attempt
    delay = config.baseDelayMs * attempt;
  }

  // Apply maximum delay cap
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  if (config.jitter) {
    // Add ±25% jitter
    const jitterRange = delay * 0.25;
    const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
    delay += jitterOffset;
  }

  return Math.max(0, Math.round(delay));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 */
export function retry(config: Partial<RetryConfig> = {}) {
  return function <T>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>
  ) {
    const originalMethod = descriptor.value!;
    const operationName = config.name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]): Promise<T> {
      const result = await withRetry(
        () => originalMethod.apply(this, args),
        { ...config, name: operationName }
      );
      return result.result;
    };

    return descriptor;
  };
}

/**
 * Specific retry configurations for common scenarios
 */
export const RetryConfigs = {
  // Quick retry for fast operations
  quick: {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    exponentialBackoff: true,
    jitter: true,
  } as Partial<RetryConfig>,

  // Standard retry for API calls
  standard: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBackoff: true,
    jitter: true,
  } as Partial<RetryConfig>,

  // Aggressive retry for critical operations
  aggressive: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBackoff: true,
    jitter: true,
  } as Partial<RetryConfig>,

  // Database operations
  database: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    exponentialBackoff: true,
    jitter: true,
    retryCondition: (error: Error) => {
      // Retry on connection errors and deadlocks
      const retryableErrors = [
        'connection',
        'timeout',
        'deadlock',
        'lock',
        'busy',
        'unavailable'
      ];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
  } as Partial<RetryConfig>,

  // External API calls
  externalApi: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 15000,
    exponentialBackoff: true,
    jitter: true,
    retryCondition: (error: Error, _attempt: number) => {
      // Don't retry 4xx errors (client errors)
      if (isClientError(error)) {
        return false;
      }
      // Retry network and server errors
      return isNetworkError(error) || isServerError(error);
    },
  } as Partial<RetryConfig>,
};

/**
 * Check if error is a client error (4xx)
 */
function isClientError(error: Error): boolean {
  const errorWithStatus = error as any;
  if (errorWithStatus.status || errorWithStatus.statusCode) {
    const status = errorWithStatus.status || errorWithStatus.statusCode;
    const statusNum = parseInt(String(status), 10);
    return statusNum >= 400 && statusNum < 500;
  }
  return false;
}

/**
 * Utility function to create a retryable version of any async function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: any[]) => {
    const result = await withRetry(
      () => fn(...args),
      { ...config, name: config.name || fn.name }
    );
    return result.result;
  }) as T;
}

/**
 * Retry registry for tracking retry statistics
 */
export class RetryRegistry {
  private static instance: RetryRegistry;
  private retryStats = new Map<string, {
    totalAttempts: number;
    successfulOperations: number;
    failedOperations: number;
    totalRetryTime: number;
    lastOperation: Date;
  }>();

  static getInstance(): RetryRegistry {
    if (!RetryRegistry.instance) {
      RetryRegistry.instance = new RetryRegistry();
    }
    return RetryRegistry.instance;
  }

  recordOperation(
    name: string,
    attempts: number,
    success: boolean,
    totalTimeMs: number
  ): void {
    const stats = this.retryStats.get(name) || {
      totalAttempts: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetryTime: 0,
      lastOperation: new Date(),
    };

    stats.totalAttempts += attempts;
    if (success) {
      stats.successfulOperations++;
    } else {
      stats.failedOperations++;
    }
    stats.totalRetryTime += totalTimeMs;
    stats.lastOperation = new Date();

    this.retryStats.set(name, stats);
  }

  getStats(name?: string): Record<string, any> {
    if (name) {
      return this.retryStats.get(name) || {};
    }
    
    const allStats: Record<string, any> = {};
    this.retryStats.forEach((stats, operationName) => {
      allStats[operationName] = {
        ...stats,
        successRate: stats.successfulOperations / (stats.successfulOperations + stats.failedOperations),
        averageAttempts: stats.totalAttempts / (stats.successfulOperations + stats.failedOperations),
        averageRetryTime: stats.totalRetryTime / (stats.successfulOperations + stats.failedOperations),
      };
    });
    
    return allStats;
  }

  clearStats(name?: string): void {
    if (name) {
      this.retryStats.delete(name);
    } else {
      this.retryStats.clear();
    }
  }
}