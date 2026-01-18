/**
 * PostgREST Schema Reload Helper
 *
 * Production-grade self-healing for Supabase PostgREST schema staleness.
 * Forces PostgREST to reload its schema cache via pg_notify with automatic
 * retry, backoff, and comprehensive state tracking.
 *
 * Features:
 * - Automatic retry with exponential backoff (500ms, 1000ms, 2000ms...)
 * - Singleton state tracking (lastReloadAt, attempts, successes, failures)
 * - Structured logging without secrets
 * - Configurable timeouts and retries
 * - No-op mode when DATABASE_DIRECT_URL unavailable (non-blocking)
 *
 * Requires: DATABASE_DIRECT_URL or DATABASE_URL environment variable
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../shared/logger';

// Singleton state for tracking reload history
interface PgRestState {
  lastReloadAt?: Date;
  attempts: number;
  successes: number;
  failures: number;
}

const state: PgRestState = {
  lastReloadAt: undefined,
  attempts: 0,
  successes: 0,
  failures: 0,
};

/**
 * Options for forcing PostgREST schema reload
 */
export interface ForceReloadOptions {
  /** Reason for the reload (for logging) */
  reason?: string;
  /** Timeout in milliseconds (default: 3000) */
  timeoutMs?: number;
  /** Maximum number of retries (default: 1) */
  maxRetries?: number;
}

/**
 * Result of a PostgREST reload attempt
 */
export interface ReloadResult {
  success: boolean;
  attempt: number;
  lastReloadAt?: string;
  error?: string;
}

/**
 * Get current PostgREST reload state
 * @returns State object with reload statistics
 */
export function getPgRestState() {
  return {
    lastReloadAt: state.lastReloadAt?.toISOString(),
    attempts: state.attempts,
    successes: state.successes,
    failures: state.failures,
  };
}

/**
 * Reset PostgREST state (primarily for testing)
 */
export function resetPgRestState() {
  state.lastReloadAt = undefined;
  state.attempts = 0;
  state.successes = 0;
  state.failures = 0;
}

/**
 * Force PostgREST to reload its schema cache by sending a notification
 *
 * This function:
 * 1. Connects to PostgreSQL using DATABASE_DIRECT_URL (or DATABASE_URL)
 * 2. Executes SELECT pg_notify('pgrst', 'reload schema')
 * 3. Retries with exponential backoff on failure
 * 4. Updates singleton state tracking
 * 5. Returns success/failure result (non-throwing)
 *
 * If DATABASE_DIRECT_URL is not configured, returns success (no-op) to prevent blocking.
 *
 * @param opts - Reload options (reason, timeout, retries)
 * @returns Promise resolving to reload result
 */
export async function forcePostgrestReload(
  opts: ForceReloadOptions = {}
): Promise<ReloadResult> {
  const {
    reason = 'manual',
    timeoutMs = 3000,
    maxRetries = 1,
  } = opts;

  state.attempts++;

  const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    logger.warn({
      event: 'pgrst_reload_skipped',
      reason: 'no_database_url',
      message: 'DATABASE_DIRECT_URL not configured, skipping PostgREST reload',
    });

    // No-op success to prevent blocking
    return {
      success: true,
      attempt: state.attempts,
      error: 'no_database_url_configured',
    };
  }

  let pool: Pool | undefined;
  let client: PoolClient | undefined;

  try {
    // Create connection pool with timeout
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: timeoutMs,
      connectionTimeoutMillis: timeoutMs,
      ssl: { rejectUnauthorized: true },
    });

    // Execute reload with retries and exponential backoff
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        client = await pool.connect();

        logger.info({
          event: 'pgrst_reload_attempt',
          reason,
          attempt,
          maxRetries: maxRetries + 1,
        });

        // Execute pg_notify to trigger PostgREST schema reload
        await client.query("SELECT pg_notify('pgrst', 'reload schema');");

        // Update state on success
        state.lastReloadAt = new Date();
        state.successes++;

        logger.info({
          event: 'pgrst_reload_success',
          reason,
          attempt,
          lastReloadAt: state.lastReloadAt.toISOString(),
          totalAttempts: state.attempts,
          totalSuccesses: state.successes,
        });

        return {
          success: true,
          attempt: state.attempts,
          lastReloadAt: state.lastReloadAt.toISOString(),
        };
      } catch (err) {
        lastError = err as Error;

        logger.warn({
          event: 'pgrst_reload_attempt_failed',
          reason,
          attempt,
          error: lastError.message,
        });

        // Release client before retry
        if (client) {
          client.release();
          client = undefined;
        }

        // Exponential backoff before retry: 500ms, 1000ms, 2000ms...
        if (attempt < maxRetries + 1) {
          const backoffMs = Math.pow(2, attempt - 1) * 500;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries exhausted
    state.failures++;

    logger.error({
      event: 'pgrst_reload_failed',
      reason,
      error: lastError?.message,
      totalAttempts: state.attempts,
      totalFailures: state.failures,
    });

    return {
      success: false,
      attempt: state.attempts,
      error: lastError?.message || 'unknown_error',
    };
  } catch (err) {
    state.failures++;

    const error = err as Error;
    logger.error({
      event: 'pgrst_reload_error',
      reason,
      error: error.message,
      // Mask connection string to avoid leaking credentials
      connectionString: connectionString?.replace(/:[^:@]+@/, ':***@'),
    });

    return {
      success: false,
      attempt: state.attempts,
      error: error.message,
    };
  } finally {
    // Cleanup
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Check if DATABASE_DIRECT_URL is configured
 * @returns true if database connection is available
 */
export function isDatabaseConnectionConfigured(): boolean {
  return !!(process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL);
}
