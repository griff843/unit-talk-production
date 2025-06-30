import { z } from 'zod';

// Base error interface
export interface BaseError {
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

// Validation error
export class ValidationError extends Error implements BaseError {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    if (context) {
      this.context = context;
    }
  }
}

// Database error
export class DatabaseError extends Error implements BaseError {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DatabaseError';
    this.code = 'DATABASE_ERROR';
    if (context) {
      this.context = context;
    }
  }
}

// Agent error
export class AgentError extends Error implements BaseError {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AgentError';
    this.code = 'AGENT_ERROR';
    if (context) {
      this.context = context;
    }
  }
}

// Workflow error
export class WorkflowError extends Error implements BaseError {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'WorkflowError';
    this.code = 'WORKFLOW_ERROR';
    if (context) {
      this.context = context;
    }
  }
}

// External service error
export class ExternalServiceError extends Error implements BaseError {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ExternalServiceError';
    this.code = 'EXTERNAL_SERVICE_ERROR';
    if (context) {
      this.context = context;
    }
  }
}

// Error handler utility
export function handleError(error: unknown): BaseError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      stack: error.stack || '',
      context: { originalError: error.constructor.name }
    };
  }
  
  return {
    message: String(error),
    code: 'UNKNOWN_ERROR',
    context: { originalValue: error }
  };
}

// Error validation schemas
export const errorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

export const validationErrorSchema = z.object({
  message: z.string(),
  code: z.literal('VALIDATION_ERROR'),
  context: z.record(z.unknown()).optional()
});

export const databaseErrorSchema = z.object({
  message: z.string(),
  code: z.literal('DATABASE_ERROR'),
  context: z.record(z.unknown()).optional()
});

export const agentErrorSchema = z.object({
  message: z.string(),
  code: z.literal('AGENT_ERROR'),
  context: z.record(z.unknown()).optional()
});

export const workflowErrorSchema = z.object({
  message: z.string(),
  code: z.literal('WORKFLOW_ERROR'),
  context: z.record(z.unknown()).optional()
});

export const externalServiceErrorSchema = z.object({
  message: z.string(),
  code: z.literal('EXTERNAL_SERVICE_ERROR'),
  context: z.record(z.unknown()).optional()
});

// Type guards
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

export function isWorkflowError(error: unknown): error is WorkflowError {
  return error instanceof WorkflowError;
}

export function isExternalServiceError(error: unknown): error is ExternalServiceError {
  return error instanceof ExternalServiceError;
}