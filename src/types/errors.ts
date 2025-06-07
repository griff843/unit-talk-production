import { z } from 'zod';

// Base error interface
export interface BaseError {
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, any>;
}

// Validation error
export class ValidationError extends Error implements BaseError {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.context = context;
  }
}

// Database error
export class DatabaseError extends Error implements BaseError {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'DatabaseError';
    this.code = 'DATABASE_ERROR';
    this.context = context;
  }
}

// Agent error
export class AgentError extends Error implements BaseError {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'AgentError';
    this.code = 'AGENT_ERROR';
    this.context = context;
  }
}

// Network error
export class NetworkError extends Error implements BaseError {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'NetworkError';
    this.code = 'NETWORK_ERROR';
    this.context = context;
  }
}

// Configuration error
export class ConfigurationError extends Error implements BaseError {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'CONFIG_ERROR';
    this.context = context;
  }
}

// Validation result type
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Error handling utilities
export function isBaseError(error: unknown): error is BaseError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error
  );
}

export function formatError(error: unknown): BaseError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      stack: error.stack,
      context: (error as any).context
    };
  }
  return {
    message: String(error),
    code: 'UNKNOWN_ERROR'
  };
}

// Zod validation helper
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const validData = schema.parse(data);
    return {
      success: true,
      data: validData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => e.message)
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error']
    };
  }
} 