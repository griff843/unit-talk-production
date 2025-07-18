import { z } from 'zod';
import { ValidationError } from '../../types/validation/index';

// Base error data interface
export interface BaseAgentErrorData {
  agentName: string;
  operation: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// Base agent error class
export class AgentError extends Error {
  public agentName: string;
  public operation: string;
  public details?: Record<string, unknown>;
  public timestamp: string;
  public severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(message: string, data: BaseAgentErrorData) {
    super(message);
    this.name = 'AgentError';
    this.agentName = data.agentName;
    this.operation = data.operation;
    this.details = data.details;
    this.timestamp = data.timestamp || new Date().toISOString().toISOString();
    this.severity = data.severity || 'medium';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      agentName: this.agentName,
      operation: this.operation,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity
    };
  }
}

// Validation error
export class ValidationError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { zodError?: z.ZodError }) {
    super(message, data);
    this.name = 'ValidationError';
    if (data.zodError) {
      this.details = {
        ...this.details,
        zodErrors: data.zodError.errors
      };
    }
  }
}

// Processing error
export class ProcessingError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData) {
    super(message, data);
    this.name = 'ProcessingError';
  }
}

// Network error
export class NetworkError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { statusCode?: number; endpoint?: string }) {
    super(message, data);
    this.name = 'NetworkError';
    this.details = {
      ...this.details,
      statusCode: data.statusCode,
      endpoint: data.endpoint
    };
  }
}

// Database error
export class DatabaseError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { table?: string; operation?: string }) {
    super(message, data);
    this.name = 'DatabaseError';
    this.details = {
      ...this.details,
      table: data.table,
      operation: data.operation
    };
  }
}

// Temporal workflow error
export class WorkflowError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { workflowId?: string; activityName?: string }) {
    super(message, data);
    this.name = 'WorkflowError';
    this.details = {
      ...this.details,
      workflowId: data.workflowId,
      activityName: data.activityName
    };
  }
}

// Configuration error
export class ConfigurationError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { configKey?: string }) {
    super(message, data);
    this.name = 'ConfigurationError';
    this.details = {
      ...this.details,
      configKey: data.configKey
    };
  }
}

// Rate limit error
export class RateLimitError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { limit?: number; resetTime?: string }) {
    super(message, data);
    this.name = 'RateLimitError';
    this.details = {
      ...this.details,
      limit: data.limit,
      resetTime: data.resetTime
    };
  }
}

// External service error
export class ExternalServiceError extends AgentError {
  constructor(message: string, data: BaseAgentErrorData & { service?: string; endpoint?: string }) {
    super(message, data);
    this.name = 'ExternalServiceError';
    this.details = {
      ...this.details,
      service: data.service,
      endpoint: data.endpoint
    };
  }
}

// Error factory
export const createAgentError = (type: string, message: string, data: BaseAgentErrorData): AgentError => {
  switch (type) {
    case 'validation':
      return new ValidationError(message, data);
    case 'processing':
      return new ProcessingError(message, data);
    case 'network':
      return new NetworkError(message, data as BaseAgentErrorData & { statusCode?: number; endpoint?: string });
    case 'database':
      return new DatabaseError(message, data as BaseAgentErrorData & { table?: string; operation?: string });
    case 'workflow':
      return new WorkflowError(message, data as BaseAgentErrorData & { workflowId?: string; activityName?: string });
    case 'configuration':
      return new ConfigurationError(message, data as BaseAgentErrorData & { configKey?: string });
    case 'rateLimit':
      return new RateLimitError(message, data as BaseAgentErrorData & { limit?: number; resetTime?: string });
    case 'externalService':
      return new ExternalServiceError(message, data as BaseAgentErrorData & { service?: string; endpoint?: string });
    default:
      return new AgentError(message, data);
  }
}; 