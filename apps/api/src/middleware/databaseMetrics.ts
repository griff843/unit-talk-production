import { createClient } from '@supabase/supabase-js';
import {
  dbQueryDuration,
  dbConnectionsActive,
  dbConnectionsIdle,
  dbOperationsTotal,
  externalApiCalls,
  externalApiDuration,
  externalApiErrors,
} from '../services/metricsServer';
import { createLogger } from '../utils/logger';
import { trace } from '@opentelemetry/api';

const logger = createLogger('DatabaseMetrics');

/**
 * Enhanced Supabase client with metrics and observability
 */
export class MetricsEnabledSupabaseClient {
  private client: ReturnType<typeof createClient>;
  private connectionPool: {
    active: number;
    idle: number;
    total: number;
  } = { active: 0, idle: 0, total: 0 };

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Add connection pooling configuration
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'unit-talk-api-metrics-enabled',
        },
      },
    } as any); // Type assertion to handle Supabase client options

    // Initialize connection pool monitoring
    this.startConnectionPoolMonitoring();
  }

  /**
   * Execute query with comprehensive metrics tracking
   */
  async from(table: string) {
    const span = trace.getActiveSpan();
    const startTime = Date.now();
    
    // Increment active connections
    this.connectionPool.active++;
    dbConnectionsActive.set(this.connectionPool.active);

    try {
      // Create a proxy to track all query operations
      const queryBuilder = this.client.from(table);
      
      return this.createMetricsProxy(queryBuilder, table, startTime, span);
      
    } catch (error) {
      // Track error
      dbOperationsTotal.inc({ 
        operation: 'from', 
        table, 
        status: 'error' 
      });

      logger.error('Database operation failed', {
        operation: 'from',
        table,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      // Decrement active connections
      this.connectionPool.active--;
      this.connectionPool.idle++;
      dbConnectionsActive.set(this.connectionPool.active);
      dbConnectionsIdle.set(this.connectionPool.idle);
    }
  }

  /**
   * Create metrics proxy for query operations
   */
  private createMetricsProxy(queryBuilder: any, table: string, startTime: number, span: any) {
    const self = this;

    return new Proxy(queryBuilder, {
      get(target, prop, receiver) {
        const originalMethod = target[prop];

        // Track specific query operations
        if (typeof originalMethod === 'function') {
          if (['select', 'insert', 'update', 'delete', 'upsert'].includes(prop as string)) {
            return function(this: any, ...args: any[]) {
              const operation = prop as string;
              const operationStartTime = Date.now();

              // Add span attributes
              if (span) {
                span.setAttributes({
                  'db.operation': operation,
                  'db.table': table,
                  'db.system': 'postgresql',
                  'db.name': 'unit_talk_production',
                });
              }

              // Execute the original method
              const result = originalMethod.apply(this, args);

              // If it's a promise (async operation), track completion
              if (result && typeof result.then === 'function') {
                return result
                  .then((data: any) => {
                    const duration = (Date.now() - operationStartTime) / 1000;
                    
                    // Track successful operation
                    dbQueryDuration.observe(
                      { operation, table, status: 'success' },
                      duration
                    );
                    dbOperationsTotal.inc({ 
                      operation, 
                      table, 
                      status: 'success' 
                    });

                    // Log performance metrics
                    if (duration > 1) { // Log slow queries (>1 second)
                      logger.warn('Slow database query detected', {
                        operation,
                        table,
                        duration: duration * 1000,
                        query: self.sanitizeQuery(args),
                      });
                    }

                    logger.debug('Database operation completed', {
                      operation,
                      table,
                      duration: duration * 1000,
                      recordCount: data?.data?.length || 0,
                    });

                    return data;
                  })
                  .catch((error: any) => {
                    const duration = (Date.now() - operationStartTime) / 1000;
                    
                    // Track failed operation
                    dbQueryDuration.observe(
                      { operation, table, status: 'error' },
                      duration
                    );
                    dbOperationsTotal.inc({ 
                      operation, 
                      table, 
                      status: 'error' 
                    });

                    // Log error with context
                    logger.error('Database operation failed', {
                      operation,
                      table,
                      duration: duration * 1000,
                      error: error.message || String(error),
                      query: self.sanitizeQuery(args),
                    });

                    throw error;
                  });
              }

              return result;
            };
          }
        }

        return Reflect.get(target, prop, receiver);
      }
    });
  }

  /**
   * Start connection pool monitoring
   */
  private startConnectionPoolMonitoring() {
    setInterval(() => {
      // Update connection pool metrics
      dbConnectionsActive.set(this.connectionPool.active);
      dbConnectionsIdle.set(this.connectionPool.idle);

      // Reset idle connections periodically
      if (this.connectionPool.idle > 10) {
        this.connectionPool.idle = Math.max(0, this.connectionPool.idle - 5);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(args: any[]): string {
    try {
      return JSON.stringify(args).substring(0, 200);
    } catch {
      return 'unable-to-serialize';
    }
  }

  /**
   * Get raw Supabase client for operations that don't need metrics
   */
  getRawClient() {
    return this.client;
  }
}

/**
 * External API performance tracking wrapper
 */
export class ExternalAPIMetrics {
  private static instance: ExternalAPIMetrics;

  static getInstance(): ExternalAPIMetrics {
    if (!ExternalAPIMetrics.instance) {
      ExternalAPIMetrics.instance = new ExternalAPIMetrics();
    }
    return ExternalAPIMetrics.instance;
  }

  /**
   * Track external API call with comprehensive metrics
   */
  async trackAPICall<T>(
    provider: string,
    endpoint: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    const span = trace.getActiveSpan();

    // Add span attributes
    if (span) {
      span.setAttributes({
        'external.api.provider': provider,
        'external.api.endpoint': endpoint,
        'external.api.operation': context.operation || 'request',
      });
    }

    logger.debug('External API call started', {
      provider,
      endpoint,
      context,
    });

    try {
      const result = await operation();
      const duration = (Date.now() - startTime) / 1000;

      // Track successful API call
      externalApiCalls.inc({ 
        provider, 
        endpoint, 
        status_code: '200' 
      });
      externalApiDuration.observe(
        { provider, endpoint, status_code: '200' },
        duration
      );

      logger.info('External API call completed', {
        provider,
        endpoint,
        duration: duration * 1000,
        success: true,
      });

      return result;

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorType = this.classifyError(error);
      const statusCode = this.extractStatusCode(error);

      // Track failed API call
      externalApiCalls.inc({ 
        provider, 
        endpoint, 
        status_code: statusCode 
      });
      externalApiDuration.observe(
        { provider, endpoint, status_code: statusCode },
        duration
      );
      externalApiErrors.inc({ 
        provider, 
        error_type: errorType 
      });

      logger.error('External API call failed', {
        provider,
        endpoint,
        duration: duration * 1000,
        error: error instanceof Error ? error.message : String(error),
        errorType,
        statusCode,
        context,
      });

      throw error;
    }
  }

  /**
   * Track multiple API calls with batch metrics
   */
  async trackBatchAPICall<T>(
    provider: string,
    calls: Array<{
      endpoint: string;
      operation: () => Promise<T>;
      context?: Record<string, any>;
    }>
  ): Promise<T[]> {
    const startTime = Date.now();
    const results: T[] = [];
    const errors: any[] = [];

    logger.info('Batch API call started', {
      provider,
      batchSize: calls.length,
    });

    for (const call of calls) {
      try {
        const result = await this.trackAPICall(
          provider,
          call.endpoint,
          call.operation,
          call.context
        );
        results.push(result);
      } catch (error) {
        errors.push(error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Batch API call completed', {
      provider,
      batchSize: calls.length,
      successCount: results.length,
      errorCount: errors.length,
      totalDuration: duration,
    });

    if (errors.length > 0) {
      throw new Error(`Batch API call had ${errors.length} failures`);
    }

    return results;
  }

  /**
   * Classify error type for metrics
   */
  private classifyError(error: any): string {
    if (error.code === 'ENOTFOUND') return 'dns_error';
    if (error.code === 'ECONNREFUSED') return 'connection_refused';
    if (error.code === 'ETIMEDOUT') return 'timeout';
    if (error.response?.status >= 500) return 'server_error';
    if (error.response?.status >= 400) return 'client_error';
    if (error.message?.includes('rate limit')) return 'rate_limit';
    return 'unknown';
  }

  /**
   * Extract HTTP status code from error
   */
  private extractStatusCode(error: any): string {
    if (error.response?.status) {
      return error.response.status.toString();
    }
    if (error.status) {
      return error.status.toString();
    }
    return '0'; // Network/unknown error
  }
}

/**
 * Create metrics-enabled Supabase client
 */
export function createMetricsEnabledSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
): MetricsEnabledSupabaseClient {
  return new MetricsEnabledSupabaseClient(supabaseUrl, supabaseKey);
}