#!/usr/bin/env tsx
/**
 * Schema Drift Detection for Supabase
 *
 * Purpose: Detect unauthorized schema changes between Git migrations and Supabase reality
 * Fail-Closed: Exit with error code 1 if any drift detected
 * Scheduled: Run every 6 hours via GitHub Actions
 *
 * Usage:
 *   npx tsx scripts/ops/detect-schema-drift.ts --env dev
 *   npx tsx scripts/ops/detect-schema-drift.ts --env staging --alert
 *   npx tsx scripts/ops/detect-schema-drift.ts --env prod --report
 *
 * Exit Codes:
 *   0 - No drift detected
 *   1 - Drift detected (FAIL)
 *   2 - Error during execution
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

type Environment = 'dev' | 'staging' | 'prod';
type DriftSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
type DifferenceType = 'table' | 'column' | 'index' | 'constraint' | 'function' | 'view';
type DifferenceKind = 'missing' | 'extra' | 'modified';

interface DriftReport {
  timestamp: string;
  environment: Environment;
  driftDetected: boolean;
  differences: SchemaDifference[];
  severity: DriftSeverity;
  totalTables: number;
  totalColumns: number;
  totalIndexes: number;
  schemaVersion?: string;
  gitCommit?: string;
}

interface SchemaDifference {
  type: DifferenceType;
  object: string;
  difference: DifferenceKind;
  expected?: any;
  actual?: any;
  severity: DriftSeverity;
  description: string;
}

interface TableInfo {
  table_name: string;
  table_schema: string;
}

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface IndexInfo {
  schemaname: string;
  tablename: string;
  indexname: string;
  indexdef: string;
}

interface ConstraintInfo {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
}

interface Options {
  env: Environment;
  report: boolean;
  alert: boolean;
  verbose: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function getConnectionString(env: Environment): string | null {
  const envUpper = env.toUpperCase();

  // Try read-only credentials first (preferred)
  const readonly = process.env[`SUPABASE_READONLY_DATABASE_URL_${envUpper}`];
  if (readonly) return readonly;

  // Fallback to direct URL (still read-only usage)
  const direct = process.env[`DATABASE_DIRECT_URL_${envUpper}`];
  if (direct) return direct;

  // Dev fallback
  if (env === 'dev') {
    const fallback = process.env.DATABASE_URL;
    if (fallback) return fallback;
  }

  return null;
}

function getSupabaseCredentials(env: Environment): { url: string; key: string } | null {
  const envUpper = env.toUpperCase();

  const url = process.env[`SUPABASE_URL_${envUpper}`] || (env === 'dev' ? process.env.SUPABASE_URL : null);
  const key = process.env[`SUPABASE_SERVICE_ROLE_KEY_${envUpper}`] || (env === 'dev' ? process.env.SUPABASE_SERVICE_ROLE_KEY : null);

  if (!url || !key) return null;

  return { url, key };
}

// ============================================================================
// SCHEMA QUERYING
// ============================================================================

async function queryActualSchema(env: Environment): Promise<{
  tables: TableInfo[];
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}> {
  const creds = getSupabaseCredentials(env);

  if (!creds) {
    throw new Error(`Missing Supabase credentials for environment: ${env}`);
  }

  const supabase = createClient(creds.url, creds.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n📊 Querying actual schema from Supabase (${env})...`);

  // Query tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name, table_schema')
    .eq('table_schema', 'public')
    .order('table_name');

  if (tablesError) {
    // Fallback: Use RPC or direct query
    console.warn('⚠️  Could not query via Supabase client, using fallback method');
    return queryActualSchemaFallback(env);
  }

  // Query columns
  const { data: columns } = await supabase
    .from('information_schema.columns')
    .select('table_name, column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .order('table_name, ordinal_position');

  // Note: Indexes and constraints may require custom RPC functions or direct psql
  console.log(`✅ Found ${tables?.length || 0} tables, ${columns?.length || 0} columns`);

  return {
    tables: tables || [],
    columns: columns || [],
    indexes: [], // Would need custom RPC
    constraints: [], // Would need custom RPC
  };
}

async function queryActualSchemaFallback(env: Environment): Promise<{
  tables: TableInfo[];
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}> {
  // This would use direct psql connection if Supabase client fails
  // For MVP, return empty structure
  console.warn('⚠️  Fallback schema query not implemented - returning empty schema');
  return {
    tables: [],
    columns: [],
    indexes: [],
    constraints: [],
  };
}

// ============================================================================
// EXPECTED SCHEMA FROM MIGRATIONS
// ============================================================================

function parseExpectedSchemaFromMigrations(): {
  tables: Set<string>;
  columns: Map<string, Set<string>>;
} {
  console.log('\n📂 Parsing expected schema from migrations...');

  const repoRoot = join(__dirname, '..', '..');
  const migrationsPath = join(repoRoot, 'supabase', 'migrations');

  if (!existsSync(migrationsPath)) {
    throw new Error(`Migrations directory not found: ${migrationsPath}`);
  }

  const migrationFiles = glob.sync(join(migrationsPath, '*.sql')).sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  const tables = new Set<string>();
  const columns = new Map<string, Set<string>>();

  // Parse SQL files for CREATE TABLE statements
  migrationFiles.forEach((file) => {
    const sql = readFileSync(file, 'utf-8');

    // Match CREATE TABLE statements (simple regex, not full SQL parser)
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1].toLowerCase();
      tables.add(tableName);
      console.log(`  - Found table: ${tableName}`);
    }

    // Match column definitions (very simplified)
    const columnRegex = /^\s+(\w+)\s+(VARCHAR|INTEGER|TEXT|UUID|TIMESTAMPTZ|BOOLEAN|JSONB|BIGINT|SERIAL)/gim;

    while ((match = columnRegex.exec(sql)) !== null) {
      const columnName = match[1].toLowerCase();
      // Associate with most recent table (simplified)
      if (tables.size > 0) {
        const lastTable = Array.from(tables)[tables.size - 1];
        if (!columns.has(lastTable)) {
          columns.set(lastTable, new Set());
        }
        columns.get(lastTable)!.add(columnName);
      }
    }
  });

  console.log(`✅ Expected schema: ${tables.size} tables parsed`);

  return { tables, columns };
}

// ============================================================================
// DRIFT COMPARISON
// ============================================================================

function compareSchemas(
  expected: { tables: Set<string>; columns: Map<string, Set<string>> },
  actual: { tables: TableInfo[]; columns: ColumnInfo[] }
): SchemaDifference[] {
  console.log('\n🔍 Comparing expected vs actual schemas...');

  const differences: SchemaDifference[] = [];

  const actualTableNames = new Set(actual.tables.map((t) => t.table_name.toLowerCase()));

  // Check for missing tables (in migrations but not in DB)
  expected.tables.forEach((tableName) => {
    if (!actualTableNames.has(tableName)) {
      differences.push({
        type: 'table',
        object: tableName,
        difference: 'missing',
        severity: 'critical',
        description: `Table "${tableName}" defined in migrations but missing from database`,
        expected: { exists: true },
        actual: { exists: false },
      });
    }
  });

  // Check for extra tables (in DB but not in migrations)
  actualTableNames.forEach((tableName) => {
    if (!expected.tables.has(tableName)) {
      // Filter out known system tables
      const systemTables = ['schema_versions', 'schema_migrations', 'auth', 'storage', 'realtime'];
      if (!systemTables.some((st) => tableName.includes(st))) {
        differences.push({
          type: 'table',
          object: tableName,
          difference: 'extra',
          severity: 'high',
          description: `Table "${tableName}" exists in database but not defined in migrations`,
          expected: { exists: false },
          actual: { exists: true },
        });
      }
    }
  });

  // Check columns (simplified - only checks existence, not data types)
  expected.columns.forEach((expectedCols, tableName) => {
    const actualCols = actual.columns
      .filter((c) => c.table_name.toLowerCase() === tableName)
      .map((c) => c.column_name.toLowerCase());

    const actualColSet = new Set(actualCols);

    expectedCols.forEach((colName) => {
      if (!actualColSet.has(colName)) {
        differences.push({
          type: 'column',
          object: `${tableName}.${colName}`,
          difference: 'missing',
          severity: 'high',
          description: `Column "${tableName}.${colName}" defined in migrations but missing from database`,
        });
      }
    });
  });

  console.log(`${differences.length === 0 ? '✅' : '⚠️ '} Found ${differences.length} differences`);

  return differences;
}

// ============================================================================
// SEVERITY ASSESSMENT
// ============================================================================

function assessSeverity(differences: SchemaDifference[]): DriftSeverity {
  if (differences.length === 0) return 'none';

  const hasCritical = differences.some((d) => d.severity === 'critical');
  if (hasCritical) return 'critical';

  const hasHigh = differences.some((d) => d.severity === 'high');
  if (hasHigh) return 'high';

  const hasMedium = differences.some((d) => d.severity === 'medium');
  if (hasMedium) return 'medium';

  return 'low';
}

// ============================================================================
// REPORTING
// ============================================================================

function printReport(report: DriftReport): void {
  console.log('\n========================================');
  console.log('SCHEMA DRIFT DETECTION REPORT');
  console.log('========================================');
  console.log(`Environment: ${report.environment.toUpperCase()}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Drift Detected: ${report.driftDetected ? '❌ YES' : '✅ NO'}`);
  console.log(`Severity: ${report.severity.toUpperCase()}`);
  console.log('----------------------------------------\n');

  if (report.differences.length > 0) {
    console.log('📋 DIFFERENCES FOUND:\n');

    report.differences.forEach((diff, index) => {
      const icon = diff.severity === 'critical' ? '🚨' : diff.severity === 'high' ? '⚠️ ' : 'ℹ️ ';
      console.log(`${index + 1}. ${icon} [${diff.severity.toUpperCase()}] ${diff.type.toUpperCase()}`);
      console.log(`   Object: ${diff.object}`);
      console.log(`   Issue: ${diff.difference.toUpperCase()}`);
      console.log(`   ${diff.description}\n`);
    });

    console.log('----------------------------------------');
    console.log('⚠️  SCHEMA DRIFT DETECTED - ACTION REQUIRED');
    console.log('----------------------------------------\n');
    console.log('Next Steps:');
    console.log('1. Review drift report above');
    console.log('2. Investigate who/what made unauthorized changes');
    console.log('3. Choose resolution path:');
    console.log('   A) Revert unauthorized changes via corrective migration');
    console.log('   B) Capture legitimate changes in new migration');
    console.log('4. Re-run drift detection to verify resolution');
  } else {
    console.log('✅ No drift detected - Schema matches migrations');
  }

  console.log('\n========================================\n');
}

function saveReport(report: DriftReport, options: Options): void {
  if (!options.report) return;

  const repoRoot = join(__dirname, '..', '..');
  const reportsDir = join(repoRoot, 'reports');

  // Create reports directory if it doesn't exist
  if (!existsSync(reportsDir)) {
    require('fs').mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `drift-report-${options.env}-${Date.now()}.json`;
  const filepath = join(reportsDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`📄 Report saved: ${filepath}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: Options = {
    env: 'dev',
    report: false,
    alert: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--env' && args[i + 1]) {
      options.env = args[i + 1] as Environment;
      i++;
    } else if (arg.startsWith('--env=')) {
      options.env = arg.split('=')[1] as Environment;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg === '--alert') {
      options.alert = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  // Validate inputs
  if (!['dev', 'staging', 'prod'].includes(options.env)) {
    console.error(`Invalid environment: ${options.env}. Must be dev, staging, or prod.`);
    process.exit(2);
  }

  console.log('========================================');
  console.log('SCHEMA DRIFT DETECTION');
  console.log('========================================');
  console.log(`Environment: ${options.env.toUpperCase()}`);
  console.log(`Report Mode: ${options.report ? 'ON' : 'OFF'}`);
  console.log(`Alert Mode: ${options.alert ? 'ON' : 'OFF'}`);
  console.log('========================================');

  try {
    // Step 1: Get expected schema from migrations
    const expected = parseExpectedSchemaFromMigrations();

    // Step 2: Query actual schema from Supabase
    const actual = await queryActualSchema(options.env);

    // Step 3: Compare schemas
    const differences = compareSchemas(expected, actual);

    // Step 4: Assess severity
    const severity = assessSeverity(differences);

    // Step 5: Generate report
    const report: DriftReport = {
      timestamp: new Date().toISOString(),
      environment: options.env,
      driftDetected: differences.length > 0,
      differences,
      severity,
      totalTables: actual.tables.length,
      totalColumns: actual.columns.length,
      totalIndexes: actual.indexes.length,
    };

    // Step 6: Print report
    printReport(report);

    // Step 7: Save report if requested
    saveReport(report, options);

    // Step 8: Alert if requested (would integrate with Slack/Discord)
    if (options.alert && report.driftDetected) {
      console.log('⚠️  ALERT: Drift detected - notification would be sent');
      // TODO: Integrate with alerting system
    }

    // Step 9: Exit with appropriate code
    if (report.driftDetected) {
      console.error('\n❌ DRIFT DETECTION FAILED - Exiting with code 1\n');
      process.exit(1); // FAIL-CLOSED
    } else {
      console.log('\n✅ DRIFT DETECTION PASSED - No drift detected\n');
      process.exit(0); // SUCCESS
    }
  } catch (error) {
    console.error('\n❌ ERROR DURING DRIFT DETECTION:\n');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\nExiting with code 2\n');
    process.exit(2); // ERROR
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}

// ============================================================================
// EXPORTS (for testing)
// ============================================================================

export { compareSchemas, assessSeverity, parseExpectedSchemaFromMigrations };
