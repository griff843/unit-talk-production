/**
 * Raw Props Direct Writer
 *
 * Direct SQL fallback for updating raw_props processed_* and error_* columns
 * when PostgREST (Supabase REST) has schema visibility issues (e.g. PGRST204).
 *
 * Charter compliance:
 * - Canonical-first and HTTP-first: this is a LAST-RESORT fallback, only used
 *   after REST + RPC-based reload have failed.
 * - Self-healing: mirrors CanonicalDirectWriter pattern for picks.
 * - Docker/Supabase: uses DATABASE_DIRECT_URL with pooled connections.
 *
 * Date: 2025-11-23
 */

import { Pool, PoolClient } from 'pg';
import { logger as sharedLogger } from '../lib/logger';

export interface RawPropsDirectWriteResult {
  success: boolean;
  id?: string;
  error?: string;
  fallbackUsed: boolean;
  attemptedVia: 'rest' | 'direct-sql';
}

class RawPropsDirectWriter {
  private static instance: RawPropsDirectWriter | null = null;
  private pool: Pool | null = null;

  private constructor() {}

  static getInstance(): RawPropsDirectWriter {
    if (!RawPropsDirectWriter.instance) {
      RawPropsDirectWriter.instance = new RawPropsDirectWriter();
    }
    return RawPropsDirectWriter.instance;
  }

  private getPool(): Pool {
    if (this.pool) return this.pool;

    const databaseUrl =
      process.env.DATABASE_DIRECT_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_DIRECT_URL not configured for RawPropsDirectWriter');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      sharedLogger.error('Unexpected error on idle raw_props direct writer client', err);
    });

    return this.pool;
  }

  async markProcessed(id: string): Promise<RawPropsDirectWriteResult> {
    const pool = this.getPool();
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      sharedLogger.info('Direct SQL fallback: marking raw_prop as processed', { id });

      const result = await client.query(
        `UPDATE public.raw_props
         SET processed_at = NOW(), processed_by = 'professional_system'
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: 'raw_prop not found',
          fallbackUsed: true,
          attemptedVia: 'direct-sql',
        };
      }

      return {
        success: true,
        id: result.rows[0].id,
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } catch (error) {
      sharedLogger.error('Direct SQL markProcessed failed for raw_props', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } finally {
      if (client) client.release();
    }
  }

  async markError(id: string, errorMessage: string): Promise<RawPropsDirectWriteResult> {
    const pool = this.getPool();
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      sharedLogger.info('Direct SQL fallback: marking raw_prop with error', { id });

      const result = await client.query(
        `UPDATE public.raw_props
         SET error_message = $2, error_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [id, errorMessage]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: 'raw_prop not found',
          fallbackUsed: true,
          attemptedVia: 'direct-sql',
        };
      }

      return {
        success: true,
        id: result.rows[0].id,
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } catch (error) {
      sharedLogger.error('Direct SQL markError failed for raw_props', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } finally {
      if (client) client.release();
    }
  }
}

export async function directMarkRawPropProcessed(id: string): Promise<RawPropsDirectWriteResult> {
  return RawPropsDirectWriter.getInstance().markProcessed(id);
}

export async function directMarkRawPropError(
  id: string,
  errorMessage: string
): Promise<RawPropsDirectWriteResult> {
  return RawPropsDirectWriter.getInstance().markError(id, errorMessage);
}

