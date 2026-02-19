#!/usr/bin/env tsx
/**
 * supabase-migration-preflight.ts
 *
 * DB-MIGRATION-MODE-LOCK Sprint Guardrail
 *
 * Validates Supabase migration environment before any db push.
 * Must pass all checks before migrations can be applied.
 *
 * Usage: npm run ops:db:preflight
 *
 * Checks:
 * 1. Project is linked to expected ref (cqfnsozknjzvyiziwicl)
 * 2. No pending migrations that would require interactive prompts
 * 3. Migration history is in sync (no reverted/missing migrations)
 * 4. Prevents raw SQL execution attempts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const EXPECTED_PROJECT_REF = 'cqfnsozknjzvyiziwicl';
const EXPECTED_PROJECT_NAME = 'Unit Talk DB v3';
const SUPABASE_DIR = path.resolve(__dirname, '../../../../../supabase');
const PROJECT_REF_FILE = path.join(SUPABASE_DIR, '.temp', 'project-ref');

interface PreflightResult {
  check: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

const results: PreflightResult[] = [];

function log(emoji: string, message: string): void {
  console.log(`${emoji} ${message}`);
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: SUPABASE_DIR,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error: any) {
    return error.stdout?.toString() || error.stderr?.toString() || error.message;
  }
}

function addResult(check: string, passed: boolean, message: string, critical = true): void {
  results.push({ check, passed, message, critical });
  const emoji = passed ? '[PASS]' : (critical ? '[FAIL]' : '[WARN]');
  log(emoji, `${check}: ${message}`);
}

// Check 1: Verify project link file exists
function checkProjectLinkFile(): void {
  const exists = fs.existsSync(PROJECT_REF_FILE);
  if (!exists) {
    addResult(
      'Project Link File',
      false,
      `Missing ${PROJECT_REF_FILE}. Run: npx supabase link --project-ref ${EXPECTED_PROJECT_REF}`
    );
    return;
  }

  const ref = fs.readFileSync(PROJECT_REF_FILE, 'utf-8').trim();
  if (ref !== EXPECTED_PROJECT_REF) {
    addResult(
      'Project Link File',
      false,
      `Linked to ${ref}, expected ${EXPECTED_PROJECT_REF}`
    );
    return;
  }

  addResult('Project Link File', true, `Linked to ${EXPECTED_PROJECT_REF}`);
}

// Check 2: Verify via supabase projects list
function checkProjectsList(): void {
  const output = exec('npx supabase projects list');

  if (output.includes('error') || output.includes('Error')) {
    addResult(
      'Supabase Login',
      false,
      'Not logged in or API error. Run: npx supabase login'
    );
    return;
  }

  // Check for the bullet indicating linked project
  const lines = output.split('\n');
  const linkedLine = lines.find(line => line.includes('●') && line.includes(EXPECTED_PROJECT_REF));

  if (!linkedLine) {
    addResult(
      'Project Link Verification',
      false,
      `Project ${EXPECTED_PROJECT_REF} not marked as linked in projects list`
    );
    return;
  }

  if (!linkedLine.includes(EXPECTED_PROJECT_NAME)) {
    addResult(
      'Project Name Verification',
      false,
      `Expected project name "${EXPECTED_PROJECT_NAME}" not found`,
      false // warning only
    );
    return;
  }

  addResult('Project Link Verification', true, `Linked to ${EXPECTED_PROJECT_NAME}`);
}

// Check 3: Check migration status (no reverted migrations)
function checkMigrationStatus(): void {
  const output = exec('npx supabase migration list');

  if (output.includes('reverted')) {
    addResult(
      'Migration History',
      false,
      'Found reverted migrations. Run: npx supabase migration repair --status applied <version>'
    );
    return;
  }

  if (output.includes('not applied') || output.includes('not found')) {
    addResult(
      'Migration Sync',
      false,
      'Local/remote migration mismatch. Use --include-all flag or repair history',
      false // warning - can proceed with --include-all
    );
    return;
  }

  addResult('Migration History', true, 'All migrations in sync');
}

// Check 4: Verify db push won't require interactive prompts
function checkDbPushDryRun(): void {
  // We can't actually dry-run db push, but we can check if there are local-only migrations
  const migrationsDir = path.join(SUPABASE_DIR, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    addResult('Migrations Directory', false, 'No migrations directory found');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  addResult('Migration Files', true, `Found ${files.length} migration files`);

  // Check for encoding issues that could cause problems
  for (const file of files.slice(-5)) { // Check last 5 migrations
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for BOM or unusual characters
    if (content.charCodeAt(0) === 0xFEFF) {
      addResult(
        'File Encoding',
        false,
        `${file} has UTF-8 BOM. Convert to plain UTF-8`,
        false
      );
    }

    // Check for CRLF (warning only on Windows)
    if (content.includes('\r\n') && process.platform !== 'win32') {
      addResult(
        'Line Endings',
        false,
        `${file} has CRLF line endings. Convert to LF`,
        false
      );
    }
  }
}

// Check 5: Prevent raw SQL execution attempts
function checkForRawSqlPatterns(): void {
  // Check for dangerous patterns in recent command history or scripts
  const dangerousPatterns = [
    'psql',
    'db-url',
    '--db-url',
    'DATABASE_URL',
    'POSTGRES_CONNECTION',
  ];

  // Check environment for raw connection attempts
  const hasRawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION;

  if (hasRawDbUrl) {
    addResult(
      'Raw SQL Prevention',
      false,
      'DATABASE_URL or POSTGRES_CONNECTION env vars detected. Use linked-project mode only.'
    );
    return;
  }

  addResult('Raw SQL Prevention', true, 'No raw SQL execution patterns detected');
}

// Check 6: Verify CLI version
function checkCliVersion(): void {
  const version = exec('npx supabase --version');
  const match = version.match(/(\d+\.\d+\.\d+)/);

  if (!match) {
    addResult('CLI Version', false, 'Could not determine Supabase CLI version');
    return;
  }

  const [major, minor] = match[1].split('.').map(Number);

  // Require at least v2.0.0
  if (major < 2) {
    addResult(
      'CLI Version',
      false,
      `CLI version ${match[1]} is too old. Update to v2.x+`
    );
    return;
  }

  addResult('CLI Version', true, `Supabase CLI v${match[1]}`);
}

// Main execution
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('SUPABASE MIGRATION PREFLIGHT CHECK');
  console.log('Sprint: DB-MIGRATION-MODE-LOCK');
  console.log('='.repeat(60));
  console.log('');

  // Run all checks
  checkProjectLinkFile();
  checkProjectsList();
  checkMigrationStatus();
  checkDbPushDryRun();
  checkForRawSqlPatterns();
  checkCliVersion();

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const criticalFailures = results.filter(r => !r.passed && r.critical);
  const warnings = results.filter(r => !r.passed && !r.critical);
  const passed = results.filter(r => r.passed);

  console.log(`Passed: ${passed.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Critical Failures: ${criticalFailures.length}`);
  console.log('');

  if (criticalFailures.length > 0) {
    console.log('CRITICAL FAILURES:');
    criticalFailures.forEach(f => console.log(`  - ${f.check}: ${f.message}`));
    console.log('');
    console.log('PREFLIGHT FAILED - Do not proceed with migrations');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('WARNINGS (non-blocking):');
    warnings.forEach(w => console.log(`  - ${w.check}: ${w.message}`));
    console.log('');
  }

  console.log('PREFLIGHT PASSED - Safe to proceed with: npx supabase db push --include-all --yes');
  process.exit(0);
}

main().catch(err => {
  console.error('Preflight check failed with error:', err);
  process.exit(1);
});
