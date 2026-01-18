/**
 * Canonical Direct Writer
 *
 * Direct SQL fallback for canonical picks inserts when PostgREST visibility fails.
 * Uses node-postgres (pg) with DATABASE_DIRECT_URL for guaranteed writes.
 *
 * Charter Compliance:
 * - Canonical-first: Direct writes to public.picks and public.pick_publish
 * - Self-healing: Transparent fallback when PGRST205/visibility errors occur
 * - Secure: Uses DATABASE_DIRECT_URL with proper connection pooling
 * - Logged: All fallbacks tracked for monitoring
 *
 * Usage Flow:
 * 1. Try Supabase REST API (PostgREST) first
 * 2. On PGRST205 or visibility error, trigger RPC reload + retry once
 * 3. If still failing, fallback to direct SQL (this service)
 * 4. Log fallback for monitoring and alert

 *
 * Date: 2025-10-29
 * Version: 1.0.0
 */

import { Pool, PoolClient, QueryResult } from 'pg';

import { rootLogger as logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CanonicalPick {
  id?: string;
  tenant_id: string;
  user_id: string;
  prop_id?: string | null;
  selection: string;
  odds: number;
  stake: number;
  confidence?: number | null;
  workflow_stage?: string;
  status?: string;
  idempotency_key?: string | null;
  bet_slip_id?: string | null;
  metadata?: Record<string, any>;
}

export interface CanonicalPickPublish {
  id?: string;
  pick_id: string;
  tenant_id: string;
  channel?: string;
  status?: string;
  thread_id?: string | null;
  external_message_id?: string | null;
  discord_channel_id?: string | null;
  scheduled_for?: string | null;
  metadata?: Record<string, any>;
}

export interface DirectWriteResult {
  success: boolean;
  id?: string;
  error?: string;
  fallbackUsed: boolean;
  attemptedVia: 'rest' | 'direct-sql';
}

// ============================================================================
// CANONICAL DIRECT WRITER SERVICE
// ============================================================================

export class CanonicalDirectWriter {
  private pool: Pool | null = null;
  private static instance: CanonicalDirectWriter | null = null;

  private constructor() {
    // Pool is lazily initialized on first use
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CanonicalDirectWriter {
    if (!CanonicalDirectWriter.instance) {
      CanonicalDirectWriter.instance = new CanonicalDirectWriter();
    }
    return CanonicalDirectWriter.instance;
  }

  /**
   * Initialize connection pool (lazy)
   */
  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const databaseUrl =
      process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_DIRECT_URL not configured for CanonicalDirectWriter');
    }

    logger.info('Initializing CanonicalDirectWriter connection pool', {
      // Mask credentials in log
      databaseUrl: this.maskDatabaseUrl(databaseUrl),
    });

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    this.pool.on('error', err => {
      logger.error('Unexpected error on idle database client', {
        error: err.message,
        stack: err.stack,
      });
    });

    return this.pool;
  }

  /**
   * Mask database URL for logging
   */
  private maskDatabaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      if (parsed.username && parsed.username.length > 3) {
        parsed.username = parsed.username.substring(0, 3) + '***';
      }
      return parsed.toString();
    } catch {
      return '***';
    }
  }

  /**
   * Insert pick directly via SQL (fallback)
   */
  // eslint-disable-next-line max-lines-per-function, complexity
  async insertPick(pick: CanonicalPick): Promise<DirectWriteResult> {
    const pool = this.getPool();
    let client: PoolClient | null = null;

    try {
      logger.info('Direct SQL pick insert (fallback)', {
        tenantId: pick.tenant_id,
        userId: pick.user_id,
        idempotencyKey: pick.idempotency_key,
        fallbackReason: 'PostgREST visibility failure',
      });

      client = await pool.connect();

      // Check idempotency (if key provided)
      if (pick.idempotency_key) {
        const existingPick = await client.query(
          `SELECT id FROM public.picks
           WHERE tenant_id = $1 AND idempotency_key = $2`,
          [pick.tenant_id, pick.idempotency_key]
        );

        if (existingPick.rows.length > 0) {
          logger.info('Pick already exists (idempotent)', {
            pickId: existingPick.rows[0].id,
            idempotencyKey: pick.idempotency_key,
          });

          return {
            success: true,
            id: existingPick.rows[0].id,
            fallbackUsed: true,
            attemptedVia: 'direct-sql',
          };
        }
      }

      // Insert pick
      const result: QueryResult = await client.query(
        `INSERT INTO public.picks (
          tenant_id,
          user_id,
          prop_id,
          selection,
          odds,
          stake,
          confidence,
          workflow_stage,
          status,
          idempotency_key,
          bet_slip_id,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id`,
        [
          pick.tenant_id,
          pick.user_id,
          pick.prop_id || null,
          pick.selection,
          pick.odds,
          pick.stake,
          pick.confidence || null,
          pick.workflow_stage || 'draft',
          pick.status || 'pending',
          pick.idempotency_key || null,
          pick.bet_slip_id || null,
          pick.metadata ? JSON.stringify(pick.metadata) : '{}',
        ]
      );

      const pickId = result.rows[0].id;

      logger.info('Direct SQL pick insert successful', {
        pickId,
        tenantId: pick.tenant_id,
        fallbackUsed: true,
      });

      return {
        success: true,
        id: pickId,
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } catch (error) {
      logger.error('Direct SQL pick insert failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        tenantId: pick.tenant_id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Insert pick_publish record directly via SQL (fallback)
   */
  // eslint-disable-next-line max-lines-per-function, complexity
  async insertPickPublish(pickPublish: CanonicalPickPublish): Promise<DirectWriteResult> {
    const pool = this.getPool();
    let client: PoolClient | null = null;

    try {
      logger.info('Direct SQL pick_publish insert (fallback)', {
        pickId: pickPublish.pick_id,
        tenantId: pickPublish.tenant_id,
        channel: pickPublish.channel,
        fallbackReason: 'PostgREST visibility failure',
      });

      client = await pool.connect();

      const result: QueryResult = await client.query(
        `INSERT INTO public.pick_publish (
          pick_id,
          tenant_id,
          channel,
          status,
          thread_id,
          external_message_id,
          discord_channel_id,
          scheduled_for,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id`,
        [
          pickPublish.pick_id,
          pickPublish.tenant_id,
          pickPublish.channel || 'DISCORD',
          pickPublish.status || 'pending',
          pickPublish.thread_id || null,
          pickPublish.external_message_id || null,
          pickPublish.discord_channel_id || null,
          pickPublish.scheduled_for || null,
          pickPublish.metadata ? JSON.stringify(pickPublish.metadata) : '{}',
        ]
      );

      const pickPublishId = result.rows[0].id;

      logger.info('Direct SQL pick_publish insert successful', {
        pickPublishId,
        pickId: pickPublish.pick_id,
        fallbackUsed: true,
      });

      return {
        success: true,
        id: pickPublishId,
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } catch (error) {
      logger.error('Direct SQL pick_publish insert failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        pickId: pickPublish.pick_id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackUsed: true,
        attemptedVia: 'direct-sql',
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const pool = this.getPool();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info('CanonicalDirectWriter connection test: SUCCESS');
      return true;
    } catch (error) {
      logger.error('CanonicalDirectWriter connection test: FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close pool (cleanup)
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('CanonicalDirectWriter pool closed');
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Insert pick via direct SQL (convenience function)
 */
export async function directInsertPick(pick: CanonicalPick): Promise<DirectWriteResult> {
  const writer = CanonicalDirectWriter.getInstance();
  return writer.insertPick(pick);
}

/**
 * Insert pick_publish via direct SQL (convenience function)
 */
export async function directInsertPickPublish(
  pickPublish: CanonicalPickPublish
): Promise<DirectWriteResult> {
  const writer = CanonicalDirectWriter.getInstance();
  return writer.insertPickPublish(pickPublish);
}

/**
 * Test direct database connection (convenience function)
 */
export async function testDirectConnection(): Promise<boolean> {
  const writer = CanonicalDirectWriter.getInstance();
  return writer.testConnection();
}
