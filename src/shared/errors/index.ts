export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class DatabaseError extends BaseError {
  constructor(
    message: string,
    public readonly query?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'AUTHENTICATION_ERROR', details);
  }
}

export class AuthorizationError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'AUTHORIZATION_ERROR', details);
  }
}

export class NotFoundError extends BaseError {
  constructor(
    message: string,
    public readonly resource?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'NOT_FOUND_ERROR', details);
  }
}

export class ConflictError extends BaseError {
  constructor(
    message: string,
    public readonly resource?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT_ERROR', details);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

export class RateLimitError extends BaseError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', details);
  }
}

export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly configKey?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}

export class TimeoutError extends BaseError {
  constructor(
    message: string,
    public readonly timeoutMs?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', details);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(
    message: string,
    public readonly rule?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'BUSINESS_LOGIC_ERROR', details);
  }
}

// Error handler utility
export function handleError(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new BaseError(error.message, 'UNKNOWN_ERROR', { originalError: error.name });
  }
  
  return new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', { originalError: String(error) });
}

// Error logging utility
import { logger } from '../logger';

export function logError(error: BaseError, context?: Record<string, unknown>): void {
  logger.error(error.message, {
    code: error.code,
    details: error.details,
    context,
    stack: error.stack
  });
}

// Error response utility for HTTP APIs
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function createErrorResponse(error: BaseError): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details })
    }
  };
}

// Error type guards
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}

export function isExternalServiceError(error: unknown): error is ExternalServiceError {
  return error instanceof ExternalServiceError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isBusinessLogicError(error: unknown): error is BusinessLogicError {
  return error instanceof BusinessLogicError;
}

// Export all error types
// Note: Classes are already exported at declaration, no need to re-export