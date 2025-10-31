#!/usr/bin/env node
/* eslint-disable no-console, max-lines-per-function, security/detect-object-injection, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Force PostgREST Schema Reload - Phase 15 Orchestration
 *
 * Triggers PostgREST to reload its schema cache via pg_notify with:
 * - Exponential backoff retry logic (3 attempts: 500ms, 1000ms, 2000ms)
 * - Machine-readable JSON output
 * - CLI argument support for reason and timeout
 * - Structured logging without secrets
 *
 * Usage:
 *   node force-postgrest-reload.js [--reason REASON] [--timeout MS] [--json]
 *
 * Options:
 *   --reason REASON   Reason for reload (default: manual)
 *   --timeout MS      Timeout in milliseconds (default: 5000)
 *   --json            Output JSON only (no logs)
 *
 * Exit codes:
 *   0 - Success (reload triggered successfully)
 *   1 - Failure (all retry attempts exhausted)
 *
 * @date 2025-10-31
 * @charter docs/PRODUCTION_CHARTER.md v3.0
 */

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  reason: 'manual',
  timeout: 5000,
  json: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--reason' && args[i + 1]) {
    flags.reason = args[i + 1];
    i++;
  } else if (args[i] === '--timeout' && args[i + 1]) {
    flags.timeout = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--json') {
    flags.json = true;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg, data = {}) => {
    if (!flags.json) {
      console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`, Object.keys(data).length > 0 ? data : '');
    }
  },
  success: (msg, data = {}) => {
    if (!flags.json) {
      console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`, Object.keys(data).length > 0 ? data : '');
    }
  },
  error: (msg, data = {}) => {
    if (!flags.json) {
      console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`, Object.keys(data).length > 0 ? data : '');
    }
  },
  warn: (msg, data = {}) => {
    if (!flags.json) {
      console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`, Object.keys(data).length > 0 ? data : '');
    }
  },
};

function outputResult(result) {
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mask sensitive data in connection strings
function maskConnectionString(connStr) {
  if (!connStr) return '[not configured]';
  return connStr.replace(/:[^:@]+@/, ':***@');
}

// ============================================================================
// SETUP
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const error = {
    success: false,
    error: 'missing_credentials',
    message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found',
  };
  outputResult(error);
  log.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// POSTGREST RELOAD WITH EXPONENTIAL BACKOFF
// ============================================================================

/**
 * Call pgrst_reload() RPC function with exponential backoff retry logic
 * This uses the production-ready RPC created in 20251030_seed_user_and_rls_rpc.sql
 */
async function rpcReloadWithRetry() {
  const startTime = Date.now();
  const maxRetries = 3;
  const backoffBase = 500; // ms

  log.info(`Starting PostgREST reload via RPC (reason: ${flags.reason})`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Attempt ${attempt}/${maxRetries}: Calling pgrst_reload()...`);

      const { data, error } = await supabase.rpc('pgrst_reload');

      if (error) {
        throw new Error(error.message);
      }

      // Success!
      const duration = Date.now() - startTime;
      log.success('PostgREST reload successful', {
        attempt,
        duration: `${duration}ms`,
        reloadId: data.reload_id,
      });

      return {
        success: true,
        attempt,
        attempts: attempt,
        lastReloadAt: data.reloaded_at,
        reloadId: data.reload_id,
        reason: flags.reason,
        durationMs: duration,
      };
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        const duration = Date.now() - startTime;
        log.error(`All ${maxRetries} attempts failed`, {
          lastError: err.message,
          duration: `${duration}ms`,
        });

        return {
          success: false,
          attempt,
          attempts: maxRetries,
          error: err.message,
          reason: flags.reason,
          durationMs: duration,
        };
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const backoffMs = Math.pow(2, attempt - 1) * backoffBase;
      log.warn(`Attempt ${attempt} failed, retrying in ${backoffMs}ms`, {
        error: err.message,
      });

      await sleep(backoffMs);
    }
  }
}

/**
 * Fallback to direct SQL if RPC is not available
 * Uses DATABASE_DIRECT_URL per Charter compliance
 */
async function directSqlReload() {
  const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    log.warn('DATABASE_DIRECT_URL not configured, cannot use direct SQL fallback');
    return {
      success: false,
      error: 'no_database_connection',
      message: 'DATABASE_DIRECT_URL not configured',
    };
  }

  log.info('Attempting direct SQL pg_notify fallback');

  let pool = null;
  const startTime = Date.now();

  try {
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: flags.timeout,
      connectionTimeoutMillis: flags.timeout,
      ssl: { rejectUnauthorized: true },
    });

    await pool.query("SELECT pg_notify('pgrst', 'reload schema');");

    const duration = Date.now() - startTime;

    log.success('Direct SQL reload successful', {
      connection: maskConnectionString(connectionString),
      duration: `${duration}ms`,
    });

    return {
      success: true,
      method: 'direct_sql',
      lastReloadAt: new Date().toISOString(),
      reason: flags.reason,
      durationMs: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    log.error('Direct SQL reload failed', {
      error: err.message,
      connection: maskConnectionString(connectionString),
    });

    return {
      success: false,
      method: 'direct_sql',
      error: err.message,
      reason: flags.reason,
      durationMs: duration,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Verify that schema reload was successful by checking picks table visibility
 */
async function verifySchemaReload() {
  log.info('Waiting for schema propagation (2 seconds)...');
  await sleep(2000);

  log.info('Verifying schema reload...');

  try {
    const { error } = await supabase.from('picks').select('id').limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        log.warn('Schema verification failed - picks table not visible', {
          error: error.message,
        });
        return { verified: false, error: error.message };
      }
    }

    log.success('Schema verification passed - picks table accessible');
    return { verified: true };
  } catch (err) {
    log.warn('Schema verification error', { error: err.message });
    return { verified: false, error: err.message };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();

  if (!flags.json) {
    console.log('\n' + '='.repeat(80));
    console.log('POSTGREST SCHEMA RELOAD - Phase 15');
    console.log('='.repeat(80) + '\n');
    console.log(`Reason: ${flags.reason}`);
    console.log(`Timeout: ${flags.timeout}ms\n`);
  }

  // Method 1: Try RPC-based reload (preferred)
  let result = await rpcReloadWithRetry();

  // Method 2: Fallback to direct SQL if RPC fails
  if (!result.success) {
    log.warn('RPC reload failed, attempting direct SQL fallback');
    result = await directSqlReload();
  }

  // Verification (only if reload succeeded)
  if (result.success) {
    const verification = await verifySchemaReload();
    result.verification = verification;

    if (!verification.verified) {
      result.success = false;
      result.error = 'verification_failed';
      result.message = 'Reload triggered but schema not yet visible';
    }
  }

  // Final result
  const totalDuration = Date.now() - startTime;
  result.totalDurationMs = totalDuration;

  outputResult(result);

  if (!flags.json) {
    console.log('\n' + '='.repeat(80));
    if (result.success) {
      log.success('RELOAD COMPLETE');
      console.log('\nNext Steps:');
      console.log('  1. Verify schema: node scripts/ops/verify-pgrst-visible.ts');
      console.log('  2. Run E2E tests: node scripts/ops/phase13-manual-e2e.js');
    } else {
      log.error('RELOAD FAILED');
      console.log('\nTroubleshooting:');
      console.log("  1. Check RPC exists: SELECT * FROM pg_proc WHERE proname = 'pgrst_reload';");
      console.log('  2. Verify DATABASE_DIRECT_URL is set in .env');
      console.log('  3. Check Supabase project logs');
    }
    console.log('='.repeat(80) + '\n');
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  const output = {
    success: false,
    error: 'fatal_error',
    message: error.message,
    stack: error.stack,
  };
  outputResult(output);
  log.error('Fatal error during reload', { error: error.message });
  process.exit(1);
});
