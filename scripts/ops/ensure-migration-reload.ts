#!/usr/bin/env node
/**
 * Ensure Migration Reload
 *
 * Scans all Supabase migrations to ensure canonical migrations end with
 * pg_notify('pgrst', 'reload schema') to trigger PostgREST schema cache reload.
 *
 * Charter Compliance:
 * - All canonical migrations MUST trigger PostgREST reload
 * - Idempotent operation (safe to re-run)
 * - Reports which files need updating
 * - Exit codes: 0 (all compliant) / 1 (files need updating)
 *
 * Canonical Migration Detection:
 * - Contains "picks" or "pick_publish" in filename
 * - Contains "canonical" in filename
 * - Has CREATE TABLE statements for picks/pick_publish
 *
 * Usage:
 *   node scripts/ops/ensure-migration-reload.ts
 *   npx tsx scripts/ops/ensure-migration-reload.ts
 *   npm run ops:ensure-reload
 *
 * Date: 2025-10-29
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
const RELOAD_STATEMENT = "SELECT pg_notify('pgrst', 'reload schema');";

// Patterns to identify canonical migrations
const CANONICAL_PATTERNS = [
  /picks/i,
  /pick_publish/i,
  /canonical/i,
];

interface MigrationFile {
  filename: string;
  filepath: string;
  content: string;
  isCanonical: boolean;
  hasReloadStatement: boolean;
  needsUpdate: boolean;
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
 * Check if file is a canonical migration
 */
function isCanonicalMigration(filename: string, content: string): boolean {
  // Check filename patterns
  const filenameMatches = CANONICAL_PATTERNS.some((pattern) => pattern.test(filename));
  if (filenameMatches) return true;

  // Check content patterns
  const hasPicksTable = /CREATE\s+TABLE.*picks/i.test(content);
  const hasPickPublishTable = /CREATE\s+TABLE.*pick_publish/i.test(content);

  return hasPicksTable || hasPickPublishTable;
}

/**
 * Check if migration already has reload statement
 */
function hasReloadStatement(content: string): boolean {
  // Check for pg_notify with 'pgrst' and 'reload schema'
  const patterns = [
    /pg_notify\s*\(\s*['"]pgrst['"]\s*,\s*['"]reload\s+schema['"]\s*\)/i,
    /SELECT\s+pg_notify\s*\(\s*['"]pgrst['"]\s*,\s*['"]reload\s+schema['"]\s*\)/i,
  ];

  return patterns.some((pattern) => pattern.test(content));
}

/**
 * Get all SQL migration files
 */
function getMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith('.sql'));

  return sqlFiles.map((filename) => {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    const isCanonical = isCanonicalMigration(filename, content);
    const hasReload = hasReloadStatement(content);
    const needsUpdate = isCanonical && !hasReload;

    return {
      filename,
      filepath,
      content,
      isCanonical,
      hasReloadStatement: hasReload,
      needsUpdate,
    };
  });
}

/**
 * Add reload statement to migration file
 */
function addReloadStatement(file: MigrationFile): boolean {
  try {
    // Remove trailing whitespace and ensure file ends with newline
    let updatedContent = file.content.trimEnd();

    // Add reload statement with proper formatting
    updatedContent += '\n\n';
    updatedContent += '-- ============================================================================\n';
    updatedContent += '-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)\n';
    updatedContent += '-- ============================================================================\n';
    updatedContent += '-- Trigger PostgREST to reload its schema cache\n';
    updatedContent += '-- This ensures canonical tables are immediately visible via REST API\n';
    updatedContent += RELOAD_STATEMENT + '\n';

    // Write updated content
    fs.writeFileSync(file.filepath, updatedContent, 'utf-8');
    log.success(`Updated: ${file.filename}`);
    return true;
  } catch (error: any) {
    log.error(`Failed to update ${file.filename}: ${error.message}`);
    return false;
  }
}

/**
 * Scan and report migration compliance
 */
function scanMigrations(): {
  total: number;
  canonical: number;
  compliant: number;
  needsUpdate: number;
  files: MigrationFile[];
} {
  const files = getMigrationFiles();
  const canonical = files.filter((f) => f.isCanonical);
  const compliant = canonical.filter((f) => f.hasReloadStatement);
  const needsUpdate = canonical.filter((f) => f.needsUpdate);

  return {
    total: files.length,
    canonical: canonical.length,
    compliant: compliant.length,
    needsUpdate: needsUpdate.length,
    files: needsUpdate,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('MIGRATION RELOAD ENFORCEMENT');
  console.log('='.repeat(80));
  console.log('');

  log.info(`Scanning migrations in: ${MIGRATIONS_DIR}`);
  console.log('');

  const result = scanMigrations();

  console.log('='.repeat(80));
  console.log('SCAN RESULTS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Total migrations:      ${result.total}`);
  console.log(`Canonical migrations:  ${result.canonical}`);
  console.log(`Already compliant:     ${result.compliant}`);
  console.log(`Need updates:          ${result.needsUpdate}`);
  console.log('');

  if (result.needsUpdate === 0) {
    console.log('='.repeat(80));
    log.success('ALL MIGRATIONS COMPLIANT');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ All canonical migrations end with pg_notify statement');
    console.log('');
    process.exit(0);
  }

  // Display files that need updating
  console.log('Files needing pg_notify statement:');
  console.log('');
  result.files.forEach((file) => {
    console.log(`  ❌ ${file.filename}`);
  });
  console.log('');

  // Ask if we should update (in CI, this will fail)
  if (process.env.CI === 'true') {
    console.log('='.repeat(80));
    log.error('MIGRATION COMPLIANCE FAILED IN CI');
    console.log('='.repeat(80));
    console.log('');
    console.log('The following migrations must end with pg_notify statement:');
    result.files.forEach((file) => {
      console.log(`  - ${file.filename}`);
    });
    console.log('');
    console.log('Fix locally by running:');
    console.log('  npm run ops:ensure-reload');
    console.log('');
    process.exit(1);
  }

  // Update files locally
  log.info('Updating migration files...');
  console.log('');

  let updateCount = 0;
  for (const file of result.files) {
    if (addReloadStatement(file)) {
      updateCount++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  log.success(`UPDATED ${updateCount} MIGRATION FILES`);
  console.log('='.repeat(80));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review changes: git diff supabase/migrations/');
  console.log('  2. Verify syntax: psql --dry-run < [migration file]');
  console.log('  3. Commit changes: git add supabase/migrations/ && git commit');
  console.log('  4. Run again to verify: npm run ops:ensure-reload');
  console.log('');
  process.exit(0);
}

main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
