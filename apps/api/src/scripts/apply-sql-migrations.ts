/**
 * Apply SQL Migrations via DATABASE_DIRECT_URL with pg library
 *
 * Purpose: Apply idempotent migrations in order with verification
 * Charter Compliance: v3.0 - Canonical-first architecture
 *
 * Usage:
 *   npm run migrations:apply
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================
const DATABASE_DIRECT_URL = process.env.DATABASE_DIRECT_URL!;

// Backfill is handled by TypeScript script (apps/api/src/scripts/backfill.ts)
// Only apply readonly and scoring infrastructure migrations
const MIGRATIONS = [
  '20251030_unified_picks_readonly.sql',
  '20251030_scoring_infrastructure.sql',
];

interface MigrationResult {
  migration: string;
  success: boolean;
  duration: number;
  error?: string;
  hash?: string;
}

// ============================================================================
// Database Connection
// ============================================================================
const pool = new Pool({
  connectionString: DATABASE_DIRECT_URL,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================================================
// Migration Execution
// ============================================================================
async function executeSQLFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf-8');
  const client = await pool.connect();

  try {
    console.log(`   Executing SQL...`);
    await client.query(sql);
    console.log(`   ✓ SQL executed successfully`);
  } finally {
    client.release();
  }
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

    // Calculate file hash for verification
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      migration: migrationFile,
      success: true,
      duration: Date.now() - startTime,
      hash,
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
// Verification
// ============================================================================
async function verifyPostMigration(): Promise<void> {
  console.log(`\n🔍 Verifying post-migration state...`);

  const client = await pool.connect();
  try {
    // Check canonical tables
    const { rows } = await client.query(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_name IN ('picks', 'pick_publish', 'unified_picks', 'internal_scores', 'score_audit_log', 'capper_calibration', 'backfill_metrics')
      ORDER BY table_name;
    `);

    console.log(`\n   📊 Table Status:`);
    rows.forEach(row => {
      console.log(`      ${row.table_name}: ${row.column_count} columns`);
    });

    // Check unified_picks RLS status
    const { rows: rlsRows } = await client.query(`
      SELECT
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE tablename = 'unified_picks';
    `);

    if (rlsRows.length > 0) {
      console.log(`\n   🔒 RLS Status for unified_picks: ${rlsRows[0].rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    }

    // Check policies on unified_picks
    const { rows: policyRows } = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'unified_picks';
    `);

    if (policyRows.length > 0) {
      console.log(`\n   📜 Policies on unified_picks:`);
      policyRows.forEach(p => {
        console.log(`      ${p.policyname} (${p.cmd})`);
      });
    }

    console.log(`\n   ✅ Post-migration verification complete`);
  } finally {
    client.release();
  }
}

// ============================================================================
// Artifacts
// ============================================================================
function exportArtifacts(results: MigrationResult[]): void {
  const metricsDir = path.join(process.cwd(), '..', '..', 'out', 'ops', 'cutover', 'metrics', '101');
  fs.mkdirSync(metricsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFile = path.join(metricsDir, `MIGRATION_RESULTS_${timestamp}.json`);
  const mdFile = path.join(metricsDir, `MIGRATION_SUMMARY_${timestamp}.md`);

  // JSON results
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // Markdown summary
  const report = `# Migration Application Summary

**Date**: ${new Date().toISOString()}
**Charter Version**: v3.0
**Migrations Applied**: ${results.length}

## Results

${results.map(r => `
### ${r.migration}
- **Status**: ${r.success ? '✅ SUCCESS' : '❌ FAILED'}
- **Duration**: ${r.duration}ms
${r.hash ? `- **Hash**: \`${r.hash}\`` : ''}
${r.error ? `- **Error**: ${r.error}` : ''}
`).join('\n')}

## Summary
- **Total**: ${results.length}
- **Successful**: ${results.filter(r => r.success).length}
- **Failed**: ${results.filter(r => !r.success).length}

## Next Steps
1. Run backfill: \`npm run backfill -- --batch-size=5000\`
2. Verify PostgREST visibility: \`npm run ops:verify-pgrst\`
3. Test with canonical driver: \`PICK_DRIVER=canonical\`
4. Verify unified_picks is read-only: Test INSERT/UPDATE/DELETE operations
5. Run E2E tests: \`npm run test:e2e\`

---
**Generated by**: apps/api/src/scripts/apply-sql-migrations.ts
`;

  fs.writeFileSync(mdFile, report);

  console.log(`\n📊 Artifacts exported:`);
  console.log(`   JSON: ${jsonFile}`);
  console.log(`   Markdown: ${mdFile}`);
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  console.log('🚀 Applying SQL Migrations via DATABASE_DIRECT_URL');
  console.log(`   Total migrations: ${MIGRATIONS.length}\n`);

  const results: MigrationResult[] = [];

  try {
    for (const migration of MIGRATIONS) {
      const result = await applyMigration(migration);
      results.push(result);

      if (!result.success) {
        console.error(`\n❌ Migration failed: ${migration}`);
        console.error(`   Error: ${result.error}`);
        break;
      } else {
        console.log(`✅ Migration successful: ${migration}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Hash: ${result.hash}`);
      }
    }

    // Verify post-migration state
    if (results.every(r => r.success)) {
      await verifyPostMigration();
    }

    // Export artifacts
    exportArtifacts(results);

    // Summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Successful: ${results.filter(r => r.success).length}`);
    console.log(`   Failed: ${results.filter(r => !r.success).length}`);

    if (results.some(r => !r.success)) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main, applyMigration };
