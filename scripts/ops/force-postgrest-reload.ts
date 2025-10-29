#!/usr/bin/env node
/**
 * Force PostgREST Schema Reload
 *
 * Sends pg_notify('pgrst', 'reload schema') to force PostgREST to reload its schema cache.
 * This is required after database migrations to ensure new tables are visible via the REST API.
 *
 * Usage:
 *   node scripts/ops/force-postgrest-reload.ts
 *   node scripts/ops/force-postgrest-reload.ts --reason "post-migration"
 *   tsx scripts/ops/force-postgrest-reload.ts --reason "manual refresh"
 *
 * Exit Codes:
 *   0 - Success (reload notification sent)
 *   1 - Failure (connection error, notification failed)
 *
 * Date: 2025-10-29
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_DIRECT_URL =
  process.env.DATABASE_DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;

interface ReloadResult {
  success: boolean;
  timestamp: string;
  reason?: string;
  error?: string;
  databaseUrl: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg: string) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg: string) => console.log(`[\x1b[32mSUCCESS\x1b[0m] ${msg}`),
  error: (msg: string) => console.log(`[\x1b[31mERROR\x1b[0m] ${msg}`),
  warn: (msg: string) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

function getReasonFromArgs(): string | undefined {
  const reasonIndex = process.argv.indexOf('--reason');
  if (reasonIndex !== -1 && process.argv[reasonIndex + 1]) {
    return process.argv[reasonIndex + 1];
  }
  return undefined;
}

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '[NOT SET]';

  try {
    const parsed = new URL(url);
    // Mask password if present
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, just mask the middle portion
    if (url.length > 20) {
      return url.substring(0, 10) + '***' + url.substring(url.length - 10);
    }
    return '***';
  }
}

// ============================================================================
// POSTGREST RELOAD
// ============================================================================

async function forcePostgrestReload(reason?: string): Promise<ReloadResult> {
  const timestamp = new Date().toISOString();
  const maskedUrl = maskDatabaseUrl(DATABASE_DIRECT_URL);

  if (!DATABASE_DIRECT_URL) {
    log.error('DATABASE_DIRECT_URL not configured');
    return {
      success: false,
      timestamp,
      reason,
      error: 'DATABASE_DIRECT_URL environment variable not set',
      databaseUrl: maskedUrl
    };
  }

  const pool = new Pool({
    connectionString: DATABASE_DIRECT_URL,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000
  });

  try {
    log.info('Connecting to PostgreSQL...');

    // Test connection
    const client = await pool.connect();
    log.success('Database connection established');

    try {
      // Send reload notification
      log.info('Sending pg_notify(\'pgrst\', \'reload schema\')...');
      await client.query("NOTIFY pgrst, 'reload schema'");
      log.success('PostgREST reload notification sent');

      return {
        success: true,
        timestamp,
        reason,
        databaseUrl: maskedUrl
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    log.error(`Failed to send reload notification: ${error.message}`);
    return {
      success: false,
      timestamp,
      reason,
      error: error.message,
      databaseUrl: maskedUrl
    };
  } finally {
    await pool.end();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST SCHEMA RELOAD');
  console.log('='.repeat(80));
  console.log('');

  const reason = getReasonFromArgs();
  if (reason) {
    log.info(`Reload reason: ${reason}`);
    console.log('');
  }

  const result = await forcePostgrestReload(reason);

  console.log('');
  console.log('='.repeat(80));
  console.log('RELOAD RESULT');
  console.log('='.repeat(80));
  console.log('');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  if (result.success) {
    console.log('='.repeat(80));
    log.success('RELOAD COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Wait 10 seconds for PostgREST to process the reload');
    console.log('  2. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  3. Test endpoints: curl http://localhost:3010/api/domain/picks/preflight');
    console.log('');
    process.exit(0);
  } else {
    console.log('='.repeat(80));
    log.error('RELOAD FAILED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Check DATABASE_DIRECT_URL is set correctly in .env');
    console.log('  2. Verify PostgreSQL is running: docker compose ps postgres');
    console.log('  3. Check database connection: psql $DATABASE_DIRECT_URL');
    console.log('  4. Verify PostgREST is running and listening for notifications');
    console.log('');
    process.exit(1);
  }
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
