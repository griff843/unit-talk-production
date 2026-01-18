/**
 * Unified Driver Compatibility Shim
 *
 * Provides schema introspection and column mapping for the unified_picks table
 * to support variations in schema (e.g., prediction vs direction, confidence vs confidence_score).
 *
 * Features:
 * - Schema introspection via information_schema
 * - Caching with 5-minute TTL
 * - Column mapping rules with fallbacks
 * - Payload transformation before insert
 * - Auto-reload on unknown column errors
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../shared/logger';
import { forcePostgrestReload } from './pgrest-reload';

/**
 * Column mapping rule
 */
interface ColumnMapping {
  /**
   * Preferred column name
   */
  preferred: string;

  /**
   * Fallback column name
   */
  fallback: string;

  /**
   * Optional transformation function
   */
  transform?: (value: any) => any;
}

/**
 * Schema cache entry
 */
interface SchemaCache {
  columns: Set<string>;
  mappings: Map<string, string>; // source -> target column
  timestamp: number;
  ttl: number; // milliseconds
}

/**
 * Cache for unified_picks schema
 */
let schemaCache: SchemaCache | null = null;

/**
 * Default cache TTL (5 minutes)
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Column mapping rules for unified_picks
 */
const COLUMN_MAPPING_RULES: ColumnMapping[] = [
  {
    preferred: 'prediction',
    fallback: 'direction',
  },
  {
    preferred: 'confidence',
    fallback: 'confidence_score',
  },
  {
    preferred: 'side',
    fallback: 'side',
    transform: (value: any) => {
      // Lowercase side before hash/idempotency
      return typeof value === 'string' ? value.toLowerCase() : value;
    },
  },
];

/**
 * Introspect unified_picks table schema
 *
 * Queries information_schema.columns to get available columns
 * and builds a mapping based on COLUMN_MAPPING_RULES.
 *
 * @param supabase - Supabase client
 * @param forceFresh - Force fresh introspection (bypass cache)
 * @returns Schema cache with columns and mappings
 */
export async function introspectUnifiedSchema(
  supabase: SupabaseClient,
  forceFresh = false
): Promise<SchemaCache> {
  // Return cached schema if valid
  if (schemaCache && !forceFresh) {
    const age = Date.now() - schemaCache.timestamp;
    if (age < schemaCache.ttl) {
      logger.debug('Using cached unified schema', {
        event: 'schema_cache_hit',
        age_ms: age,
        ttl_ms: schemaCache.ttl,
        columns: schemaCache.columns.size,
      });
      return schemaCache;
    }
  }

  logger.info('Introspecting unified_picks schema', {
    event: 'schema_introspection',
    forceFresh,
  });

  try {
    // Query information_schema for unified_picks columns
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'unified_picks');

    if (error) {
      logger.error('Schema introspection failed', {
        event: 'schema_introspection_error',
        error: error.message,
      });
      throw new Error(`Schema introspection failed: ${error.message}`);
    }

    // Build column set
    const columnSet = new Set<string>(
      (columns || []).map((col: any) => col.column_name)
    );

    logger.info('Schema introspection completed', {
      event: 'schema_introspection_success',
      columns: columnSet.size,
      columnList: Array.from(columnSet),
    });

    // Build column mappings based on rules
    const mappings = new Map<string, string>();

    for (const rule of COLUMN_MAPPING_RULES) {
      // Check which column is available
      if (columnSet.has(rule.preferred)) {
        mappings.set(rule.preferred, rule.preferred);
        mappings.set(rule.fallback, rule.preferred); // Map fallback to preferred
      } else if (columnSet.has(rule.fallback)) {
        mappings.set(rule.preferred, rule.fallback); // Map preferred to fallback
        mappings.set(rule.fallback, rule.fallback);
      }
    }

    // Create and cache schema
    schemaCache = {
      columns: columnSet,
      mappings,
      timestamp: Date.now(),
      ttl: DEFAULT_CACHE_TTL,
    };

    logger.debug('Schema cache updated', {
      event: 'schema_cache_updated',
      columns: schemaCache.columns.size,
      mappings: schemaCache.mappings.size,
    });

    return schemaCache;
  } catch (error) {
    logger.error('Schema introspection exception', {
      event: 'schema_introspection_exception',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Transform payload using column mappings
 *
 * Applies mapping rules and transformations to convert a payload
 * to match the actual database schema.
 *
 * @param payload - Original payload
 * @param supabase - Supabase client for schema introspection
 * @param options - Transformation options
 * @returns Transformed payload
 */
export async function transformPayload(
  payload: Record<string, any>,
  supabase: SupabaseClient,
  options: {
    /**
     * Force fresh schema introspection
     */
    forceFresh?: boolean;

    /**
     * Additional context for logging
     */
    context?: Record<string, unknown>;
  } = {}
): Promise<Record<string, any>> {
  const { forceFresh = false, context = {} } = options;

  // Get schema (from cache or introspect)
  const schema = await introspectUnifiedSchema(supabase, forceFresh);

  const transformed: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Check if column needs mapping
    const targetColumn = schema.mappings.get(key) || key;

    // Apply transformation if defined
    const rule = COLUMN_MAPPING_RULES.find(
      r => r.preferred === key || r.fallback === key
    );

    const transformedValue = rule?.transform ? rule.transform(value) : value;

    // Only include if target column exists in schema
    if (schema.columns.has(targetColumn)) {
      transformed[targetColumn] = transformedValue;
    } else {
      logger.warn('Column not found in schema', {
        event: 'column_not_found',
        sourceColumn: key,
        targetColumn,
        availableColumns: Array.from(schema.columns),
        ...context,
      });
    }
  }

  logger.debug('Payload transformed', {
    event: 'payload_transformed',
    originalKeys: Object.keys(payload),
    transformedKeys: Object.keys(transformed),
    mappingsApplied: Object.keys(payload).length - Object.keys(transformed).length,
    ...context,
  });

  return transformed;
}

/**
 * Transform and insert with auto-retry on unknown column errors
 *
 * Combines payload transformation with resilient insert that:
 * 1. Transforms payload using column mappings
 * 2. Attempts insert
 * 3. On unknown column error: reloads schema, refreshes cache, retries once
 *
 * @param payload - Data to insert
 * @param supabase - Supabase client
 * @param tableName - Table name (default: 'unified_picks')
 * @param context - Additional context for logging
 * @returns Insert result
 */
export async function transformAndInsert<T = any>(
  payload: Record<string, any>,
  supabase: SupabaseClient,
  tableName = 'unified_picks',
  context: Record<string, unknown> = {}
): Promise<{
  data: T | null;
  error: any | null;
  reloadAttempted: boolean;
  retryCount: number;
  success: boolean;
}> {
  let retryCount = 0;
  let reloadAttempted = false;

  // First attempt
  try {
    // Transform payload
    const transformed = await transformPayload(payload, supabase, { context });

    logger.debug('Attempting insert with transformed payload', {
      event: 'insert_attempt',
      tableName,
      originalKeys: Object.keys(payload),
      transformedKeys: Object.keys(transformed),
      ...context,
    });

    // Insert
    const { data, error } = await supabase
      .from(tableName)
      .insert(transformed)
      .select()
      .single();

    // Check for unknown column error
    if (error && /column.+(does not exist|unknown)/i.test(error.message)) {
      logger.warn('Unknown column error detected', {
        event: 'unknown_column_error',
        tableName,
        error: error.message,
        ...context,
      });

      // Reload schema and retry
      try {
        await forcePostgrestReload();
        reloadAttempted = true;

        // Refresh cache with fresh introspection
        const freshTransformed = await transformPayload(payload, supabase, {
          forceFresh: true,
          context,
        });

        logger.info('Schema reloaded, retrying insert', {
          event: 'schema_reload_retry',
          tableName,
          ...context,
        });

        // Retry insert
        retryCount = 1;
        const retryResult = await supabase
          .from(tableName)
          .insert(freshTransformed)
          .select()
          .single();

        const retrySuccess = !retryResult.error;
        logger.info('Schema reload retry completed', {
          event: 'schema_reload_retry_complete',
          tableName,
          success: retrySuccess,
          reloadAttempted: true,
          retryCount,
          error: retryResult.error?.message,
          ...context,
        });

        return {
          data: retryResult.data as T | null,
          error: retryResult.error,
          reloadAttempted: true,
          retryCount: 1,
          success: retrySuccess,
        };
      } catch (reloadError) {
        logger.error('Schema reload or retry failed', {
          event: 'schema_reload_retry_failed',
          tableName,
          error: reloadError instanceof Error ? reloadError.message : String(reloadError),
          ...context,
        });

        return {
          data: null,
          error,
          reloadAttempted: false,
          retryCount: 0,
          success: false,
        };
      }
    }

    // No unknown column error - return result
    const success = !error;
    return {
      data: data as T | null,
      error,
      reloadAttempted: false,
      retryCount: 0,
      success,
    };
  } catch (error) {
    logger.error('Transform and insert failed', {
      event: 'transform_insert_error',
      tableName,
      error: error instanceof Error ? error.message : String(error),
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
 * Clear schema cache (useful for testing)
 */
export function clearSchemaCache(): void {
  schemaCache = null;
  logger.debug('Schema cache cleared', {
    event: 'schema_cache_cleared',
  });
}

/**
 * Get current schema cache (for debugging)
 */
export function getSchemaCache(): SchemaCache | null {
  return schemaCache;
}
