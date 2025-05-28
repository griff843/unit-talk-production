import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical',
    public readonly context: Record<string, any> = {},
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class DatabaseError extends AgentError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 'high', context, originalError);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', 'medium', context, originalError);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends AgentError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, 'CONFIG_ERROR', 'high', context, originalError);
    this.name = 'ConfigurationError';
  }
}

export class BusinessLogicError extends AgentError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, 'BUSINESS_LOGIC_ERROR', 'high', context, originalError);
    this.name = 'BusinessLogicError';
  }
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  shouldRetry: (error: Error) => boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly logger: Logger;

  private constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: ErrorHandlerConfig
  ) {
    this.logger = new Logger('ErrorHandler');
  }

  public static getInstance(
    supabase: SupabaseClient,
    config: ErrorHandlerConfig
  ): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(supabase, config);
    }
    return ErrorHandler.instance;
  }

  public async handleError(
    error: Error,
    context: {
      agent: string;
      operation: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    const agentError = this.wrapError(error);
    
    await this.logError(agentError, context);
    
    if (this.shouldAlert(agentError)) {
      await this.sendAlert(agentError, context);
    }

    if (this.shouldRetry(agentError)) {
      await this.queueForRetry(agentError, context);
    }
  }

  private wrapError(error: Error): AgentError {
    if (error instanceof AgentError) {
      return error;
    }

    // Determine error type based on message/stack
    if (error.message.includes('database') || error.message.includes('sql')) {
      return new DatabaseError(error.message, {}, error);
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return new ValidationError(error.message, {}, error);
    }
    if (error.message.includes('config')) {
      return new ConfigurationError(error.message, {}, error);
    }

    return new AgentError(
      error.message,
      'UNKNOWN_ERROR',
      'medium',
      {},
      error
    );
  }

  private async logError(
    error: AgentError,
    context: Record<string, any>
  ): Promise<void> {
    this.logger.error('Agent error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      severity: error.severity,
      context: {
        ...context,
        ...error.context
      },
      stack: error.stack
    });

    await this.supabase.from('agent_errors').insert({
      agent: context.agent,
      error_type: error.name,
      error_code: error.code,
      message: error.message,
      severity: error.severity,
      context: {
        ...context,
        ...error.context
      },
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  private shouldAlert(error: AgentError): boolean {
    return error.severity === 'high' || error.severity === 'critical';
  }

  private async sendAlert(
    error: AgentError,
    context: Record<string, any>
  ): Promise<void> {
    await this.supabase.from('agent_alerts').insert({
      agent: context.agent,
      alert_type: 'error',
      severity: error.severity,
      message: error.message,
      context: {
        error_code: error.code,
        ...context,
        ...error.context
      },
      timestamp: new Date().toISOString()
    });
  }

  private shouldRetry(error: AgentError): boolean {
    return this.config.shouldRetry(error);
  }

  private async queueForRetry(
    error: AgentError,
    context: Record<string, any>
  ): Promise<void> {
    await this.supabase.from('retry_queue').insert({
      agent: context.agent,
      operation: context.operation,
      error_context: {
        error_type: error.name,
        error_code: error.code,
        message: error.message,
        ...context,
        ...error.context
      },
      retry_count: 0,
      max_retries: this.config.maxRetries,
      next_retry: new Date(Date.now() + this.config.backoffMs).toISOString(),
      status: 'pending',
      timestamp: new Date().toISOString()
    });
  }
} 