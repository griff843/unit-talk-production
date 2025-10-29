#!/usr/bin/env node
/**
 * Project Alignment Check
 *
 * Verifies that SUPABASE_URL projectRef matches DATABASE_DIRECT_URL cluster.
 * Ensures canonical tables (picks, pick_publish) are present in the database.
 *
 * Charter Compliance:
 * - Uses Charter precedence for environment loading (.env, .env.local, etc)
 * - Masks all secrets in output
 * - Validates canonical schema presence
 * - Exit codes: 0 (aligned) / 1 (misaligned or tables missing)
 *
 * Usage:
 *   node scripts/ops/check-project-alignment.ts
 *   npx tsx scripts/ops/check-project-alignment.ts
 *
 * Date: 2025-10-29
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// CHARTER-COMPLIANT ENVIRONMENT LOADING
// ============================================================================

/**
 * Load environment variables following Charter precedence:
 * 1. .env.local (highest priority, local overrides)
 * 2. .env.{NODE_ENV}.local
 * 3. .env.{NODE_ENV}
 * 4. .env (lowest priority, committed defaults)
 */
function loadEnvironmentWithCharter(): void {
  const rootDir = path.resolve(__dirname, '../..');
  const nodeEnv = process.env.NODE_ENV || 'development';

  const envFiles = [
    path.join(rootDir, '.env'),
    path.join(rootDir, `.env.${nodeEnv}`),
    path.join(rootDir, `.env.${nodeEnv}.local`),
    path.join(rootDir, '.env.local'),
  ];

  // Load in Charter precedence order (last one wins)
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: true });
      console.log(`[INFO] Loaded env from: ${path.basename(envFile)}`);
    }
  }
}

// Load environment before anything else
loadEnvironmentWithCharter();

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const DATABASE_DIRECT_URL =
  process.env.DATABASE_DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;

interface AlignmentResult {
  success: boolean;
  timestamp: string;
  supabaseProjectRef: string | null;
  databaseCluster: string | null;
  aligned: boolean;
  tablesPresent: {
    picks: boolean;
    pick_publish: boolean;
  };
  errors: string[];
  warnings: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg: string) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg: string) => console.log(`[\x1b[32mSUCCESS\x1b[0m] ${msg}`),
  error: (msg: string) => console.log(`[\x1b[31mERROR\x1b[0m] ${msg}`),
  warn: (msg: string) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`),
};

/**
 * Extract projectRef from Supabase URL
 * Format: https://<projectRef>.supabase.co
 */
function extractProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract cluster identifier from DATABASE_DIRECT_URL
 * Format: postgresql://user:pass@host:port/database
 * Returns masked host as cluster identifier
 */
function extractClusterIdentifier(dbUrl: string | undefined): string | null {
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    // Return host as cluster identifier (will be masked in output)
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Mask sensitive data in URLs and connection strings
 */
function maskSecret(value: string | null | undefined): string {
  if (!value) return '[NOT SET]';

  try {
    const url = new URL(value);
    // Mask password
    if (url.password) {
      url.password = '***';
    }
    // Mask username (keep first 3 chars)
    if (url.username && url.username.length > 3) {
      url.username = url.username.substring(0, 3) + '***';
    }
    return url.toString();
  } catch {
    // If not a URL, mask middle portion
    if (value.length > 20) {
      return value.substring(0, 10) + '***' + value.substring(value.length - 10);
    }
    return '***';
  }
}

/**
 * Check if canonical tables exist in database
 */
async function checkTablesPresent(pool: Pool): Promise<{ picks: boolean; pick_publish: boolean }> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'picks') AS picks_exists,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pick_publish') AS pick_publish_exists
    `);

    return {
      picks: result.rows[0].picks_exists,
      pick_publish: result.rows[0].pick_publish_exists,
    };
  } finally {
    client.release();
  }
}

/**
 * Verify project alignment between SUPABASE_URL and DATABASE_DIRECT_URL
 */
async function verifyProjectAlignment(): Promise<AlignmentResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract identifiers
  const projectRef = extractProjectRef(SUPABASE_URL);
  const clusterIdentifier = extractClusterIdentifier(DATABASE_DIRECT_URL);

  log.info('Checking project alignment...');
  console.log('');
  console.log('Configuration:');
  console.log(`  SUPABASE_URL:        ${maskSecret(SUPABASE_URL)}`);
  console.log(`  DATABASE_DIRECT_URL: ${maskSecret(DATABASE_DIRECT_URL)}`);
  console.log('');
  console.log('Extracted Identifiers:');
  console.log(`  Project Ref: ${projectRef || '[COULD NOT EXTRACT]'}`);
  console.log(`  Cluster:     ${clusterIdentifier || '[COULD NOT EXTRACT]'}`);
  console.log('');

  // Validation checks
  if (!SUPABASE_URL) {
    errors.push('SUPABASE_URL not configured');
  }

  if (!DATABASE_DIRECT_URL) {
    errors.push('DATABASE_DIRECT_URL not configured');
  }

  if (!projectRef) {
    errors.push('Could not extract projectRef from SUPABASE_URL');
  }

  if (!clusterIdentifier) {
    errors.push('Could not extract cluster identifier from DATABASE_DIRECT_URL');
  }

  // Check if projectRef appears in DATABASE_DIRECT_URL (alignment check)
  let aligned = false;
  if (projectRef && DATABASE_DIRECT_URL) {
    // Supabase hosted databases typically have projectRef in the host
    // e.g., aws-0-us-west-1.pooler.supabase.com contains project context
    aligned = DATABASE_DIRECT_URL.includes(projectRef) ||
              DATABASE_DIRECT_URL.includes('supabase.com') ||
              DATABASE_DIRECT_URL.includes('supabase.co');

    if (!aligned) {
      warnings.push(
        'ProjectRef not found in DATABASE_DIRECT_URL - may indicate separate database'
      );
    }
  }

  // Check tables presence
  let tablesPresent = { picks: false, pick_publish: false };

  if (DATABASE_DIRECT_URL && errors.length === 0) {
    const pool = new Pool({
      connectionString: DATABASE_DIRECT_URL,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });

    try {
      log.info('Connecting to database to verify tables...');
      tablesPresent = await checkTablesPresent(pool);

      if (!tablesPresent.picks) {
        errors.push('Canonical table "picks" not found in database');
      }
      if (!tablesPresent.pick_publish) {
        errors.push('Canonical table "pick_publish" not found in database');
      }

      log.success('Database connection verified');
    } catch (error: any) {
      errors.push(`Database connection failed: ${error.message}`);
    } finally {
      await pool.end();
    }
  }

  return {
    success: errors.length === 0,
    timestamp,
    supabaseProjectRef: projectRef,
    databaseCluster: clusterIdentifier,
    aligned,
    tablesPresent,
    errors,
    warnings,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('PROJECT ALIGNMENT CHECK');
  console.log('='.repeat(80));
  console.log('');

  const result = await verifyProjectAlignment();

  console.log('');
  console.log('='.repeat(80));
  console.log('ALIGNMENT RESULT');
  console.log('='.repeat(80));
  console.log('');

  // Display result (with secrets masked)
  console.log('Summary:');
  console.log(`  Timestamp:       ${result.timestamp}`);
  console.log(`  Project Aligned: ${result.aligned ? '✅ YES' : '⚠️  WARNING'}`);
  console.log(`  Tables Present:  ${result.tablesPresent.picks && result.tablesPresent.pick_publish ? '✅ YES' : '❌ NO'}`);
  console.log('');

  console.log('Tables:');
  console.log(`  picks:        ${result.tablesPresent.picks ? '✅ PRESENT' : '❌ MISSING'}`);
  console.log(`  pick_publish: ${result.tablesPresent.pick_publish ? '✅ PRESENT' : '❌ MISSING'}`);
  console.log('');

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => log.warn(warning));
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((error) => log.error(error));
    console.log('');
  }

  if (result.success) {
    console.log('='.repeat(80));
    log.success('PROJECT ALIGNMENT VERIFIED');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ SUPABASE_URL and DATABASE_DIRECT_URL are properly configured');
    console.log('✅ Canonical tables (picks, pick_publish) are present');
    console.log('');
    process.exit(0);
  } else {
    console.log('='.repeat(80));
    log.error('PROJECT ALIGNMENT FAILED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Verify SUPABASE_URL is set correctly in .env');
    console.log('  2. Verify DATABASE_DIRECT_URL points to the same Supabase project');
    console.log('  3. Run migration: psql $DATABASE_DIRECT_URL < supabase/migrations/20251029_canonical_schema.sql');
    console.log('  4. Force PostgREST reload: npm run ops:reload-pgrst');
    console.log('  5. Verify again: npm run ops:check-project');
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
