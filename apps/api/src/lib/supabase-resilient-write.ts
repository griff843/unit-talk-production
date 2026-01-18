/**
 * Self-Healing Supabase REST Writes
 *
 * Provides resilient write operations with automatic schema reload and retry
 * on column/relation errors. Implements production-grade error handling with
 * structured logging and telemetry.
 *
 * Features:
 * - Auto-detect schema errors (column/relation does not exist)
 * - Force PostgREST schema reload via pg_notify
 * - Single retry after successful reload
 * - First-request schema reload header
 * - Structured logging with event tracking
 */

import { SupabaseClient, PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';
import { forcePostgrestReload } from './pgrest-reload';
import { logger } from '../shared/logger';

/**
 * Track if this is the first request after boot
 */
let isFirstRequest = true;

/**
 * Schema error patterns that trigger reload
 */
const SCHEMA_ERROR_PATTERN = /(column|relation).+(does not exist|unknown)/i;

/**
 * Options for resilient write operations
 */
export interface ResilientWriteOptions {
  /**
   * Operation name for logging/telemetry
   */
  operation: string;

  /**
   * Whether to force schema reload on first request
   * @default true
   */
  reloadOnFirstRequest?: boolean;

  /**
   * Whether to retry after schema reload
   * @default true
   */
  retryAfterReload?: boolean;

  /**
   * Additional context for logging
   */
  context?: Record<string, unknown>;
}

/**
 * Result of a resilient write operation
 */
export interface ResilientWriteResult<T> {
  data: T | null;
  error: any | null;
  reloadAttempted: boolean;
  retryCount: number;
  success: boolean;
}

/**
 * Execute a Supabase write operation with self-healing schema reload
 *
 * This function wraps any Supabase write operation (insert, update, upsert) and:
 * 1. Sets schema reload header on first request
 * 2. Detects schema errors (column/relation does not exist)
 * 3. Forces PostgREST schema reload
 * 4. Retries the operation once after reload
 *
 * @example
 * ```typescript
 * const result = await resilientWrite(
 *   async (client) => client.from('picks').insert(data),
 *   supabase,
 *   { operation: 'picks.insert', context: { pickId: 'abc123' } }
 * );
 *
 * if (result.success) {
 *   console.log('Write succeeded:', result.data);
 * } else {
 *   console.error('Write failed:', result.error);
 * }
 * ```
 */
export async function resilientWrite<T>(
  /**
   * Function that performs the write operation
   * Receives a SupabaseClient and returns a PostgrestSingleResponse or PostgrestResponse
   */
  writeOperation: (client: SupabaseClient) => Promise<PostgrestSingleResponse<T> | PostgrestResponse<T>>,
  /**
   * Supabase client instance
   */
  supabase: SupabaseClient,
  /**
   * Options for the resilient write
   */
  options: ResilientWriteOptions
): Promise<ResilientWriteResult<T>> {
  const {
    operation,
    reloadOnFirstRequest = true,
    retryAfterReload = true,
    context = {},
  } = options;

  let reloadAttempted = false;
  let retryCount = 0;

  // Set schema reload header on first request after boot
  if (isFirstRequest && reloadOnFirstRequest) {
    try {
      // @ts-ignore - Accessing internal headers
      if (supabase.rest && supabase.rest.headers) {
        // @ts-ignore
        supabase.rest.headers['x-supabase-reload-schema'] = 'true';
      }
      isFirstRequest = false;

      logger.info('First request - schema reload header set', {
        event: 'first_request_schema_reload',
        operation,
        ...context,
      });
    } catch (error) {
      // Non-critical - log and continue
      logger.warn('Failed to set schema reload header', {
        error: error instanceof Error ? error.message : String(error),
        operation,
      });
    }
  }

  // First attempt
  try {
    const response = await writeOperation(supabase);

    // Check for schema errors
    if (response.error && SCHEMA_ERROR_PATTERN.test(response.error.message || '')) {
      logger.warn('Schema error detected', {
        event: 'schema_error_detected',
        operation,
        error: response.error.message,
        ...context,
      });

      // Attempt schema reload and retry
      if (retryAfterReload) {
        try {
          const reloadResult = await forcePostgrestReload({ reason: `schema_error:${operation}` });
          reloadAttempted = reloadResult.success;

          logger.info('Schema reload completed, retrying operation', {
            event: 'schema_reload_retry',
            operation,
            reloadSuccess: reloadResult.success,
            ...context,
          });

          // Retry the operation
          retryCount = 1;
          const retryResponse = await writeOperation(supabase);

          // Log retry result
          const retrySuccess = !retryResponse.error;
          logger.info('Schema reload retry completed', {
            event: 'schema_reload_retry',
            operation,
            success: retrySuccess,
            reloadAttempted: true,
            retryCount,
            error: retryResponse.error?.message,
            ...context,
          });

          return {
            data: retryResponse.data as T | null,
            error: retryResponse.error,
            reloadAttempted: true,
            retryCount: 1,
            success: retrySuccess,
          };
        } catch (reloadError) {
          logger.error('Schema reload failed', {
            event: 'schema_reload_failed',
            operation,
            error: reloadError instanceof Error ? reloadError.message : String(reloadError),
            ...context,
          });

          // Return original error if reload fails
          return {
            data: null,
            error: response.error,
            reloadAttempted: false,
            retryCount: 0,
            success: false,
          };
        }
      }
    }

    // No schema error or retry disabled - return response
    const success = !response.error;
    if (success) {
      logger.debug('Write operation succeeded', {
        event: 'write_success',
        operation,
        reloadAttempted: false,
        retryCount: 0,
        ...context,
      });
    } else {
      logger.error('Write operation failed', {
        event: 'write_error',
        operation,
        error: response.error?.message,
        reloadAttempted: false,
        retryCount: 0,
        ...context,
      });
    }

    return {
      data: response.data as T | null,
      error: response.error,
      reloadAttempted: false,
      retryCount: 0,
      success,
    };
  } catch (error) {
    // Unexpected error during write operation
    logger.error('Unexpected error during write operation', {
      event: 'write_unexpected_error',
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });

    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      reloadAttempted: false,
      retryCount: 0,
      success: false,
    };
  }
}

/**
 * Reset the first request flag (useful for testing)
 */
export function resetFirstRequestFlag(): void {
  isFirstRequest = true;
}

/**
 * Check if an error is a schema-related error
 */
export function isSchemaError(error: any): boolean {
  if (!error) return false;
  const message = error.message || error.msg || String(error);
  return SCHEMA_ERROR_PATTERN.test(message);
}
