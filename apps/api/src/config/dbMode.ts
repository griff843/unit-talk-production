/* eslint-disable complexity, max-lines-per-function, no-console */
/**
 * DB Mode Resolver - Fail-Closed Configuration
 *
 * SPRINT-DB-MODE-TRUTH-LOCK-095A
 *
 * Enforces single DB mode with fail-closed behavior.
 * No mixed states allowed. Boot fails on mismatch.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('DBMode');

// ============================================================================
// TYPES
// ============================================================================

export type DbMode = 'cloud' | 'local';

export interface DbModeResolution {
  mode: DbMode;
  host: string;
  dbName: string;
  isLocal: boolean;
  mismatchDetected: boolean;
  mismatchReason: string | null;
  requiredEnvMissing: string[];
  source: 'env' | 'default';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCAL_POSTGRES_HOSTS = ['postgres', 'localhost', '127.0.0.1'];
const LOCAL_DB_PATTERN = /postgresql:\/\/[^@]+@(postgres|localhost|127\.0\.0\.1):\d+\/\w+/;
const SUPABASE_PATTERN = /https:\/\/[a-z0-9]+\.supabase\.co/;

// ============================================================================
// RESOLVER
// ============================================================================

function parseDbUrl(url: string): { host: string; dbName: string } | null {
  try {
    // Handle postgresql:// URLs
    const pgMatch = url.match(/postgresql:\/\/[^@]+@([^:]+):(\d+)\/(\w+)/);
    if (pgMatch) {
      return { host: pgMatch[1], dbName: pgMatch[3] };
    }
    // Handle postgres:// URLs
    const pgMatch2 = url.match(/postgres:\/\/[^@]+@([^:]+):(\d+)\/(\w+)/);
    if (pgMatch2) {
      return { host: pgMatch2[1], dbName: pgMatch2[3] };
    }
    return null;
  } catch {
    return null;
  }
}

function parseSupabaseUrl(url: string): { host: string; dbName: string } | null {
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (match) {
    return { host: `${match[1]}.supabase.co`, dbName: 'supabase' };
  }
  return null;
}

function isLocalHost(host: string): boolean {
  return LOCAL_POSTGRES_HOSTS.includes(host.toLowerCase());
}

/**
 * Resolves the DB mode from environment variables.
 * Returns resolution info WITHOUT failing - use validateDbMode() to fail-closed.
 */
export function resolveDbMode(): DbModeResolution {
  const dbModeEnv = process.env['DB_MODE']?.toLowerCase();
  const mode: DbMode = dbModeEnv === 'local' ? 'local' : 'cloud';
  const source = dbModeEnv ? 'env' : 'default';

  const requiredEnvMissing: string[] = [];
  let mismatchDetected = false;
  let mismatchReason: string | null = null;
  let host = 'unknown';
  let dbName = 'unknown';
  let isLocal = false;

  if (mode === 'cloud') {
    // Cloud mode requires Supabase vars
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    const poolerUrl = process.env['SUPABASE_DB_URL_POOLER'];

    if (!supabaseUrl) requiredEnvMissing.push('SUPABASE_URL');
    if (!supabaseKey) requiredEnvMissing.push('SUPABASE_SERVICE_ROLE_KEY');

    // Parse host/dbName from Supabase URL
    if (supabaseUrl) {
      const parsed = parseSupabaseUrl(supabaseUrl);
      if (parsed) {
        host = parsed.host;
        dbName = parsed.dbName;
      }
    }

    // If pooler URL is set, use it for host info
    if (poolerUrl) {
      const parsed = parseDbUrl(poolerUrl);
      if (parsed) {
        host = parsed.host;
        dbName = parsed.dbName;
      }
    }

    isLocal = false;

    // Check for mismatch: DATABASE_URL pointing to local postgres in cloud mode
    const databaseUrl = process.env['DATABASE_URL'];
    if (databaseUrl && LOCAL_DB_PATTERN.test(databaseUrl)) {
      mismatchDetected = true;
      mismatchReason = 'DATABASE_URL points to local postgres but DB_MODE=cloud';
    }
  } else {
    // Local mode requires DATABASE_URL pointing to local postgres
    const databaseUrl = process.env['DATABASE_URL'];

    if (!databaseUrl) {
      requiredEnvMissing.push('DATABASE_URL');
    } else {
      const parsed = parseDbUrl(databaseUrl);
      if (parsed) {
        host = parsed.host;
        dbName = parsed.dbName;
        isLocal = isLocalHost(parsed.host);

        // Mismatch: DATABASE_URL doesn't point to local postgres in local mode
        if (!isLocal) {
          mismatchDetected = true;
          mismatchReason = `DATABASE_URL points to non-local host "${parsed.host}" but DB_MODE=local`;
        }
      } else {
        mismatchDetected = true;
        mismatchReason = 'DATABASE_URL format is invalid';
      }
    }

    // In local mode, SUPABASE_URL pointing to cloud is a mismatch
    const supabaseUrl = process.env['SUPABASE_URL'];
    if (supabaseUrl && SUPABASE_PATTERN.test(supabaseUrl)) {
      mismatchDetected = true;
      mismatchReason = 'SUPABASE_URL points to cloud Supabase but DB_MODE=local';
    }
  }

  return {
    mode,
    host,
    dbName,
    isLocal,
    mismatchDetected,
    mismatchReason,
    requiredEnvMissing,
    source,
  };
}

/**
 * Validates DB mode and fails boot if misconfigured.
 * Call this at startup to enforce fail-closed behavior.
 */
export function validateDbMode(): DbModeResolution {
  const resolution = resolveDbMode();

  logger.info('DB mode resolution', {
    mode: resolution.mode,
    host: resolution.host,
    dbName: resolution.dbName,
    isLocal: resolution.isLocal,
    source: resolution.source,
    mismatchDetected: resolution.mismatchDetected,
  });

  // Fail-closed: missing required env vars
  if (resolution.requiredEnvMissing.length > 0) {
    logger.error('BOOT FAILED: Missing required environment variables', {
      mode: resolution.mode,
      missing: resolution.requiredEnvMissing,
    });
    console.error('\n========================================');
    console.error('❌ BOOT FAILED - MISSING REQUIRED ENV VARS');
    console.error(`   DB_MODE: ${resolution.mode}`);
    console.error(`   Missing: ${resolution.requiredEnvMissing.join(', ')}`);
    console.error('========================================\n');
    process.exit(1);
  }

  // Fail-closed: mismatch detected
  if (resolution.mismatchDetected) {
    logger.error('BOOT FAILED: DB mode mismatch detected', {
      mode: resolution.mode,
      reason: resolution.mismatchReason,
    });
    console.error('\n========================================');
    console.error('❌ BOOT FAILED - DB MODE MISMATCH');
    console.error(`   DB_MODE: ${resolution.mode}`);
    console.error(`   Reason: ${resolution.mismatchReason}`);
    console.error('========================================\n');
    process.exit(1);
  }

  logger.info('DB mode validated successfully', {
    mode: resolution.mode,
    host: resolution.host,
  });

  return resolution;
}

/**
 * Get current DB mode status for /ops/status endpoint.
 * Does NOT fail - just reports current state.
 */
export function getDbModeStatus(): DbModeResolution {
  return resolveDbMode();
}
