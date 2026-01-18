/**
 * Apply SQL Migrations via DATABASE_DIRECT_URL
 *
 * Purpose: Apply idempotent migrations in order with verification
 * Charter Compliance: v3.0 - Canonical-first architecture
 *
 * Usage:
 *   npm run migrations:apply
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MIGRATIONS = [
  '20251030_backfill_unified_to_canonical.sql',
  '20251030_unified_picks_readonly.sql',
  '20251030_scoring_infrastructure.sql',
];

interface MigrationResult {
  migration: string;
  success: boolean;
  duration: number;
  error?: string;
}

// ============================================================================
// Initialize Supabase Client
// ============================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// Migration Execution
// ============================================================================
async function executeSQLFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf-8');

  // Note: Supabase JS client doesn't support raw SQL execution for complex migrations
  // We'll need to use DATABASE_DIRECT_URL with pg library or skip this for now
  console.log(`⚠️  Migration requires direct PostgreSQL connection`);
  console.log(`    File: ${filePath}`);
  console.log(`    Use: psql $DATABASE_DIRECT_URL -f ${filePath}`);

  throw new Error('Direct PostgreSQL connection required for SQL migrations');
}

async function applyMigration(migrationFile: string): Promise<MigrationResult> {
  const startTime = Date.now();
  const migrationPath = path.join(process.cwd(), '..', '..', 'supabase', 'migrations', migrationFile);

  console.log(`\n📝 Applying migration: ${migrationFile}`);
  console.log(`   Path: ${migrationPath}`);

  if (!fs.existsSync(migrationPath)) {
    return {
      migration: migrationFile,
      success: false,
      duration: Date.now() - startTime,
      error: 'Migration file not found',
    };
  }

  try {
    await executeSQLFile(migrationPath);

    return {
      migration: migrationFile,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      migration: migrationFile,
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  console.log('🚀 Applying SQL Migrations');
  console.log(`   Total migrations: ${MIGRATIONS.length}\n`);

  const results: MigrationResult[] = [];

  for (const migration of MIGRATIONS) {
    const result = await applyMigration(migration);
    results.push(result);

    if (!result.success) {
      console.error(`❌ Migration failed: ${migration}`);
      console.error(`   Error: ${result.error}`);
      break;
    } else {
      console.log(`✅ Migration successful: ${migration}`);
      console.log(`   Duration: ${result.duration}ms`);
    }
  }

  // Summary
  console.log(`\n📊 Migration Summary:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Successful: ${results.filter(r => r.success).length}`);
  console.log(`   Failed: ${results.filter(r => !r.success).length}`);

  if (results.some(r => !r.success)) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main, applyMigration };
