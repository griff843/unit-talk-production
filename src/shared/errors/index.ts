export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AgentError extends BaseError {
  constructor(
    message: string,
    public readonly agentName: string,
    details?: Record<string, any>
  ) {
    super(message, 'AGENT_ERROR', { agentName, ...details });
  }
}

export class DatabaseError extends BaseError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly table: string,
    details?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', { operation, table, ...details });
  }
}

export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly configKey: string,
    details?: Record<string, any>
  ) {
    super(message, 'CONFIG_ERROR', { configKey, ...details });
  }
}

export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field: string,
    details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
  }
}

export class NetworkError extends BaseError {
  constructor(
    message: string,
    public readonly endpoint: string,
    details?: Record<string, any>
  ) {
    super(message, 'NETWORK_ERROR', { endpoint, ...details });
  }
}

export class TimeoutError extends BaseError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number,
    details?: Record<string, any>
  ) {
    super(message, 'TIMEOUT_ERROR', { operation, timeoutMs, ...details });
  }
}

export class RetryableError extends BaseError {
  constructor(
    message: string,
    public readonly attempt: number,
    public readonly maxAttempts: number,
    details?: Record<string, any>
  ) {
    super(message, 'RETRY_ERROR', { attempt, maxAttempts, ...details });
  }
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  shouldRetry: (error: Error) => boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler | null = null;

  constructor(private readonly config: ErrorHandlerConfig) {}

  static getInstance(config?: ErrorHandlerConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config!);
    }
    return ErrorHandler.instance;
  }

  static resetInstance(): void {
    ErrorHandler.instance = null;
  }

  handleError(error: Error, context?: any): void {
    // Log the error with context
    console.error('Error handled:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context
    });
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if we should retry this error
        if (!this.config.shouldRetry(lastError)) {
          throw lastError;
        }

        // If we've reached max retries, throw RetryableError
        if (attempt >= this.config.maxRetries) {
          throw new RetryableError(
            `${context} failed after ${attempt} attempts`,
            attempt,
            this.config.maxRetries,
            { originalError: lastError.message }
          );
        }

        // Calculate backoff delay
        const backoff = Math.min(
          this.config.backoffMs * Math.pow(2, attempt - 1),
          this.config.maxBackoffMs
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    // This should never happen due to the throw in the loop
    throw lastError || new Error('Unknown error in withRetry');
  }

  shouldRetry(error: Error): boolean {
    // Default retry strategy
    return (
      error instanceof NetworkError ||
      error instanceof TimeoutError ||
      (error instanceof DatabaseError &&
       ['deadlock', 'connection', 'timeout'].some(type =>
         error.message.toLowerCase().includes(type)
       ))
    );
  }
}

// Error type guards
export function isAgentError(error: Error): error is AgentError {
  return error instanceof AgentError;
}

export function isDatabaseError(error: Error): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isNetworkError(error: Error): error is NetworkError {
  return error instanceof NetworkError;
}

export function isRetryableError(error: Error): error is RetryableError {
  return error instanceof RetryableError;
}

// Default error handler configuration
export const defaultErrorConfig: ErrorHandlerConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  shouldRetry: (error: Error) => {
    return (
      isNetworkError(error) ||
      error instanceof TimeoutError ||
      (error instanceof DatabaseError &&
        ['deadlock', 'connection', 'timeout'].some(type =>
          error.message.toLowerCase().includes(type)
        ))
    );
  },
}; 