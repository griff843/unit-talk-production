import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../shared/logger';

/**
 * Schema probe utility for checking database table existence
 *
 * Provides lightweight read-only checks without requiring driver instantiation.
 * Used during startup to determine driver availability and prevent restart loops.
 */
export class SchemaProbe {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Check if a specific table exists in the database
   *
   * @param tableName - Name of the table to check
   * @returns Promise<boolean> - true if table exists, false otherwise
   */
  async hasTable(tableName: string): Promise<boolean> {
    try {
      // Query information_schema to check table existence
      // This is a read-only operation that works even if PostgREST hasn't reloaded
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .maybeSingle();

      if (error) {
        // If information_schema query fails, try a simple select as fallback
        logger.debug('information_schema query failed, trying fallback', {
          tableName,
          error: error.message,
        });

        const { error: fallbackError } = await this.supabase.from(tableName).select('*').limit(0);

        // If no error, table exists; if error is "relation does not exist", table doesn't exist
        const tableExists = !fallbackError || !fallbackError.message.includes('does not exist');

        logger.debug('Fallback table check result', {
          tableName,
          exists: tableExists,
          errorMessage: fallbackError?.message,
        });

        return tableExists;
      }

      const exists = !!data;
      logger.debug('Table existence check', { tableName, exists });
      return exists;
    } catch (error) {
      logger.error('Failed to check table existence', {
        tableName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if canonical picks tables are ready
   *
   * Canonical architecture requires both 'picks' and 'pick_publish' tables
   *
   * @returns Promise<boolean> - true if both canonical tables exist
   */
  async canonicalReady(): Promise<boolean> {
    try {
      const [hasPicks, hasPickPublish] = await Promise.all([
        this.hasTable('picks'),
        this.hasTable('pick_publish'),
      ]);

      const ready = hasPicks && hasPickPublish;

      logger.debug('Canonical schema check', {
        hasPicks,
        hasPickPublish,
        ready,
      });

      return ready;
    } catch (error) {
      logger.error('Failed to check canonical schema', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if unified picks table is ready
   *
   * @returns Promise<boolean> - true if unified_picks table exists
   */
  async unifiedReady(): Promise<boolean> {
    return this.hasTable('unified_picks');
  }

  /**
   * Get comprehensive schema status for diagnostics
   *
   * @returns Promise with schema status information
   */
  async getSchemaStatus(): Promise<{
    canonical: { available: boolean; picks: boolean; pick_publish: boolean };
    unified: { available: boolean; unified_picks: boolean };
    timestamp: string;
  }> {
    const [picks, pickPublish, unifiedPicks] = await Promise.all([
      this.hasTable('picks'),
      this.hasTable('pick_publish'),
      this.hasTable('unified_picks'),
    ]);

    return {
      canonical: {
        available: picks && pickPublish,
        picks,
        pick_publish: pickPublish,
      },
      unified: {
        available: unifiedPicks,
        unified_picks: unifiedPicks,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Singleton instance for convenience
 */
let probeInstance: SchemaProbe | null = null;

/**
 * Get or create singleton schema probe instance
 */
export function getSchemaProbe(supabaseClient?: SupabaseClient): SchemaProbe {
  if (!probeInstance || supabaseClient) {
    probeInstance = new SchemaProbe(supabaseClient);
  }
  return probeInstance;
}

/**
 * Convenience function: Check if a table exists
 */
export async function hasTable(tableName: string): Promise<boolean> {
  return getSchemaProbe().hasTable(tableName);
}

/**
 * Convenience function: Check if canonical schema is ready
 */
export async function canonicalReady(): Promise<boolean> {
  return getSchemaProbe().canonicalReady();
}

/**
 * Convenience function: Check if unified schema is ready
 */
export async function unifiedReady(): Promise<boolean> {
  return getSchemaProbe().unifiedReady();
}

/**
 * Convenience function: Get schema status
 */
export async function getSchemaStatus() {
  return getSchemaProbe().getSchemaStatus();
}
