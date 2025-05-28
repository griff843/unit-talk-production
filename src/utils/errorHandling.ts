import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';

export interface ErrorHandlerConfig {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableNotifications?: boolean;
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface ErrorContext {
  agent?: string;
  operation?: string;
  context?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  metadata?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly logger: Logger;

  private constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: ErrorHandlerConfig = {}
  ) {
    this.logger = new Logger('ErrorHandler');
  }

  public static getInstance(
    supabase?: SupabaseClient,
    config?: ErrorHandlerConfig
  ): ErrorHandler {
    if (!ErrorHandler.instance && supabase) {
      ErrorHandler.instance = new ErrorHandler(supabase, config);
    }
    return ErrorHandler.instance;
  }

  public async handleError(error: Error, context: ErrorContext): Promise<void> {
    try {
      // Log the error
      if (this.config.enableLogging !== false) {
        this.logError(error, context);
      }

      // Record in database
      await this.recordError(error, context);

      // Handle based on severity
      if (context.severity === 'critical') {
        await this.handleCriticalError(error, context);
      }

      // Notify if enabled
      if (this.config.enableNotifications) {
        await this.notifyError(error, context);
      }
    } catch (handlingError) {
      // If error handling fails, log to console as last resort
      console.error('Error handler failed:', handlingError);
      console.error('Original error:', error);
    }
  }

  private logError(error: Error, context: ErrorContext): void {
    const message = this.formatErrorMessage(error, context);
    
    switch (context.severity) {
      case 'critical':
        this.logger.error(message, { error, context });
        break;
      case 'high':
        this.logger.error(message, { error, context });
        break;
      case 'medium':
        this.logger.warn(message, { error, context });
        break;
      default:
        this.logger.info(message, { error, context });
    }
  }

  private async recordError(error: Error, context: ErrorContext): Promise<void> {
    try {
      await this.supabase.from('agent_errors').insert({
        agent: context.agent,
        operation: context.operation,
        context: context.context,
        severity: context.severity,
        error_message: error.message,
        error_stack: error.stack,
        status: context.status,
        metadata: context.metadata,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      this.logger.error('Failed to record error in database:', dbError);
    }
  }

  private async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
    // Log to critical errors table
    try {
      await this.supabase.from('critical_errors').insert({
        agent: context.agent,
        operation: context.operation,
        error_message: error.message,
        error_stack: error.stack,
        metadata: context.metadata,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      this.logger.error('Failed to record critical error:', dbError);
    }

    // Additional critical error handling logic can be added here
    // For example: Stop the agent, notify administrators, etc.
  }

  private async notifyError(error: Error, context: ErrorContext): Promise<void> {
    // Implement notification logic (e.g., Discord, email, etc.)
    // This is a placeholder for the notification system
    this.logger.info('Error notification system not implemented yet');
  }

  private formatErrorMessage(error: Error, context: ErrorContext): string {
    const parts = [
      context.agent ? `[${context.agent}]` : '',
      context.operation ? `(${context.operation})` : '',
      context.context ? `{${context.context}}` : '',
      error.message
    ];

    return parts.filter(Boolean).join(' ');
  }

  public async getErrorStats(
    agent?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<any> {
    try {
      let query = this.supabase
        .from('agent_errors')
        .select('*');

      if (agent) {
        query = query.eq('agent', agent);
      }

      if (timeRange) {
        query = query
          .gte('timestamp', timeRange.start.toISOString())
          .lte('timestamp', timeRange.end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        total: data.length,
        bySeverity: data.reduce((acc: any, curr: any) => {
          acc[curr.severity] = (acc[curr.severity] || 0) + 1;
          return acc;
        }, {}),
        byAgent: data.reduce((acc: any, curr: any) => {
          acc[curr.agent] = (acc[curr.agent] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('Failed to get error stats:', error);
      throw error;
    }
  }
} 