import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import { AgentError } from '../types/agent';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ErrorHandler {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly context: string;

  constructor(context: string, supabase: SupabaseClient) {
    this.context = context;
    this.logger = new Logger(`ErrorHandler:${context}`);
    this.supabase = supabase;
  }

  public async handleError(error: Error, additionalContext?: Record<string, any>): Promise<void> {
    const errorRecord: AgentError = {
      message: error.message,
      code: error.name,
      stack: error.stack,
      context: {
        source: this.context,
        ...additionalContext
      },
      severity: this.determineSeverity(error)
    };

    await this.recordError(errorRecord);

    if (this.isCriticalError(error)) {
      await this.handleCriticalError(errorRecord);
    }
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof ValidationError) return 'low';
    if (error instanceof DatabaseError) return 'high';
    if (error.message.includes('critical')) return 'critical';
    return 'medium';
  }

  private isCriticalError(error: Error): boolean {
    return error instanceof DatabaseError || error.message.includes('critical');
  }

  private async recordError(error: AgentError): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('agent_errors')
        .insert([{
          message: error.message,
          code: error.code,
          stack: error.stack,
          context: error.context,
          severity: error.severity,
          timestamp: new Date().toISOString()
        }]);

      if (dbError) {
        this.logger.error('Failed to record error in database:', { error: dbError.message });
      }
    } catch (err) {
      this.logger.error('Failed to record error:', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async handleCriticalError(error: AgentError): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('critical_errors')
        .insert([{
          message: error.message,
          code: error.code,
          stack: error.stack,
          context: error.context,
          severity: error.severity,
          timestamp: new Date().toISOString()
        }]);

      if (dbError) {
        this.logger.error('Failed to record critical error:', { error: dbError.message });
      }

      await this.triggerCriticalErrorAlerts(error);
    } catch (err) {
      this.logger.error('Failed to handle critical error:', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async triggerCriticalErrorAlerts(error: AgentError): Promise<void> {
    this.logger.warn('Critical error occurred:', { error });
  }

  public async getErrorStats(timeWindowMs = 3600000): Promise<Record<string, number>> {
    try {
      const startTime = new Date(Date.now() - timeWindowMs).toISOString();
      
      const { data, error } = await this.supabase
        .from('agent_errors')
        .select('severity')
        .gte('timestamp', startTime);

      if (error) {
        throw error;
      }

      return (data || []).reduce((acc, curr) => {
        acc[curr.severity] = (acc[curr.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      this.logger.error('Failed to get error stats:', { error: error instanceof Error ? error.message : String(error) });
      return {};
    }
  }
} 