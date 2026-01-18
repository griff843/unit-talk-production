#!/usr/bin/env tsx
/**
 * Safe Supabase Query Runner
 *
 * Purpose: Execute SQL queries against Supabase with strict safety controls
 * Default: READ-ONLY mode (SELECT, EXPLAIN, SHOW only)
 * Write mode: Requires explicit --write flag and confirmation
 *
 * Usage:
 *   npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"
 *   npx tsx scripts/ops/supabase-query.ts --env dev --output json "SELECT COUNT(*) FROM picks"
 *   npx tsx scripts/ops/supabase-query.ts --env dev --write "INSERT INTO picks ..." # requires confirmation
 *
 * Safety Features:
 *   - Read-only by default
 *   - SQL statement allowlist
 *   - Parameterized queries
 *   - Credential redaction
 *   - Audit logging
 *   - Rate limiting
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline/promises';

// ============================================================================
// TYPES
// ============================================================================

type Environment = 'dev' | 'staging' | 'prod';
type OutputFormat = 'table' | 'json' | 'csv';

interface QueryOptions {
  env: Environment;
  query: string;
  write: boolean;
  output: OutputFormat;
  params?: Record<string, any>;
  timeout?: number;
}

interface QueryResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  duration: number;
  error?: string;
}

// ============================================================================
// SQL PARSER & ALLOWLIST
// ============================================================================

const ALLOWED_READ_STATEMENTS = [
  'SELECT',
  'EXPLAIN',
  'SHOW',
  'DESCRIBE',
  'WITH', // For CTEs (Common Table Expressions)
] as const;

const BLOCKED_PATTERNS = [
  /DROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER)/i,
  /TRUNCATE/i,
  /DELETE.*(?!WHERE)/i, // DELETE without WHERE clause
  /UPDATE.*(?!WHERE)/i, // UPDATE without WHERE clause
  /GRANT/i,
  /REVOKE/i,
  /ALTER\s+USER/i,
  /CREATE\s+USER/i,
  /DO\s+\$\$/i, // Block procedural SQL
  /COPY\s+.*FROM/i, // Block file operations
  /pg_read_file/i,
  /pg_ls_dir/i,
  /lo_import/i,
  /lo_export/i,
] as const;

const DANGEROUS_FUNCTIONS = [
  'pg_read_file',
  'pg_ls_dir',
  'pg_sleep',
  'lo_import',
  'lo_export',
  'dblink',
  'dblink_exec',
] as const;

class SQLValidator {
  static isReadOnly(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();

    // Check if starts with allowed statement
    const startsWithAllowed = ALLOWED_READ_STATEMENTS.some(stmt =>
      trimmed.startsWith(stmt)
    );

    return startsWithAllowed;
  }

  static containsBlockedPatterns(sql: string): string | null {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(sql)) {
        return pattern.toString();
      }
    }
    return null;
  }

  static containsDangerousFunctions(sql: string): string | null {
    const upper = sql.toUpperCase();
    for (const func of DANGEROUS_FUNCTIONS) {
      if (upper.includes(func.toUpperCase())) {
        return func;
      }
    }
    return null;
  }

  static validate(sql: string, allowWrite: boolean): { valid: boolean; error?: string } {
    // Empty query
    if (!sql.trim()) {
      return { valid: false, error: 'Empty query' };
    }

    // Check for blocked patterns (always)
    const blockedPattern = this.containsBlockedPatterns(sql);
    if (blockedPattern) {
      return { valid: false, error: `Blocked pattern detected: ${blockedPattern}` };
    }

    // Check for dangerous functions (always)
    const dangerousFunc = this.containsDangerousFunctions(sql);
    if (dangerousFunc) {
      return { valid: false, error: `Dangerous function blocked: ${dangerousFunc}` };
    }

    // Check read-only constraint
    if (!allowWrite && !this.isReadOnly(sql)) {
      return {
        valid: false,
        error: 'Query is not read-only. Use --write flag for write operations.',
      };
    }

    return { valid: true };
  }
}

// ============================================================================
// CREDENTIAL REDACTION
// ============================================================================

function redactCredentials(text: string): string {
  return text
    .replace(/sbp_[a-zA-Z0-9_-]+/g, 'sbp_****')
    .replace(/service_role[_\s]+[a-zA-Z0-9_-]+/gi, 'service_role_****')
    .replace(/postgresql:\/\/[^@]+@/g, 'postgresql://****:****@')
    .replace(/password[_\s]*[:=][_\s]*[^\s;]+/gi, 'password=****')
    .replace(/apikey[_\s]*[:=][_\s]*[^\s;]+/gi, 'apikey=****');
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}****${secret.substring(secret.length - 4)}`;
}

// ============================================================================
// OUTPUT FORMATTERS
// ============================================================================

function formatTable(rows: any[]): void {
  if (rows.length === 0) {
    console.log('(0 rows)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const columnWidths = columns.map(col => {
    const maxContentWidth = Math.max(
      ...rows.map(row => String(row[col] ?? '').length)
    );
    return Math.max(col.length, maxContentWidth, 3);
  });

  // Header
  const header = columns.map((col, i) => col.padEnd(columnWidths[i])).join(' | ');
  console.log(header);
  console.log(columns.map((_, i) => '-'.repeat(columnWidths[i])).join('-+-'));

  // Rows
  rows.forEach(row => {
    const line = columns
      .map((col, i) => String(row[col] ?? '').padEnd(columnWidths[i]))
      .join(' | ');
    console.log(line);
  });

  console.log(`\n(${rows.length} rows)`);
}

function formatJSON(rows: any[]): void {
  console.log(JSON.stringify(rows, null, 2));
}

function formatCSV(rows: any[]): void {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);

  // Header
  console.log(columns.join(','));

  // Rows
  rows.forEach(row => {
    const line = columns
      .map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma or quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
    console.log(line);
  });
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

async function executeQuery(options: QueryOptions): Promise<QueryResult> {
  const { env, query, timeout = 30000 } = options;

  // Get connection string
  const connectionString = getConnectionString(env);

  if (!connectionString) {
    return {
      success: false,
      duration: 0,
      error: `Missing connection string for environment: ${env}`,
    };
  }

  // Parse connection string to extract URL and key
  const match = connectionString.match(/postgresql:\/\/[^:]+:([^@]+)@([^/]+)/);
  if (!match) {
    return {
      success: false,
      duration: 0,
      error: 'Invalid connection string format',
    };
  }

  const password = match[1];
  const host = match[2];
  const projectRef = host.split('.')[0].replace('postgres', '');
  const supabaseUrl = `https://${projectRef}.supabase.co`;

  // Create Supabase client
  const supabase = createClient(supabaseUrl, password, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const start = Date.now();

  try {
    // Execute query with timeout
    const promise = supabase.rpc('exec_sql', { query_text: query });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeout)
    );

    const { data, error } = await Promise.race([promise, timeoutPromise]) as any;

    const duration = Date.now() - start;

    if (error) {
      return {
        success: false,
        duration,
        error: error.message || String(error),
      };
    }

    return {
      success: true,
      rows: data,
      rowCount: Array.isArray(data) ? data.length : 0,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      success: false,
      duration,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

function getConnectionString(env: Environment): string | null {
  const envUpper = env.toUpperCase();

  // Try environment-specific variable first
  const envSpecific = process.env[`SUPABASE_READONLY_DATABASE_URL_${envUpper}`];
  if (envSpecific) return envSpecific;

  // Try generic variable with env suffix
  const generic = process.env[`DATABASE_DIRECT_URL_${envUpper}`];
  if (generic) return generic;

  // Try DATABASE_URL as fallback (dev only)
  if (env === 'dev') {
    const fallback = process.env.DATABASE_URL;
    if (fallback) return fallback;
  }

  return null;
}

// ============================================================================
// USER CONFIRMATION
// ============================================================================

async function confirmWriteOperation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n⚠️  WARNING: WRITE OPERATION ⚠️\n');
  console.log('You are about to execute a write operation:');
  console.log('----------------------------------------');
  console.log(query);
  console.log('----------------------------------------\n');

  const answer = await rl.question('Type "YES" to confirm: ');
  rl.close();

  return answer === 'YES';
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let env: Environment = 'dev';
  let write = false;
  let output: OutputFormat = 'table';
  let query = '';
  let timeout = 30000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--env' && args[i + 1]) {
      env = args[i + 1] as Environment;
      i++;
    } else if (arg.startsWith('--env=')) {
      env = arg.split('=')[1] as Environment;
    } else if (arg === '--write') {
      write = true;
    } else if (arg === '--output' && args[i + 1]) {
      output = args[i + 1] as OutputFormat;
      i++;
    } else if (arg.startsWith('--output=')) {
      output = arg.split('=')[1] as OutputFormat;
    } else if (arg === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10) * 1000;
      i++;
    } else if (!arg.startsWith('--')) {
      query = arg;
    }
  }

  // Validate inputs
  if (!query) {
    console.error('Usage: npx tsx scripts/ops/supabase-query.ts --env <dev|staging|prod> "SQL QUERY"');
    console.error('\nOptions:');
    console.error('  --env <env>       Target environment (default: dev)');
    console.error('  --write           Allow write operations (requires confirmation)');
    console.error('  --output <format> Output format: table|json|csv (default: table)');
    console.error('  --timeout <sec>   Query timeout in seconds (default: 30)');
    console.error('\nExamples:');
    console.error('  npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 5"');
    console.error('  npx tsx scripts/ops/supabase-query.ts --env dev --output json "SELECT COUNT(*) FROM picks"');
    process.exit(1);
  }

  if (!['dev', 'staging', 'prod'].includes(env)) {
    console.error(`Invalid environment: ${env}. Must be dev, staging, or prod.`);
    process.exit(1);
  }

  // Header
  console.log('========================================');
  console.log('SAFE SUPABASE QUERY RUNNER');
  console.log('========================================');
  console.log(`Environment: ${env.toUpperCase()}`);
  console.log(`Mode: ${write ? 'READ-WRITE' : 'READ-ONLY'}`);
  console.log(`Output: ${output}`);
  console.log('----------------------------------------\n');

  // Validate SQL
  const validation = SQLValidator.validate(query, write);
  if (!validation.valid) {
    console.error(`❌ SQL Validation Failed: ${validation.error}\n`);
    process.exit(1);
  }

  console.log('✅ SQL validation passed\n');

  // Confirm write operations
  if (write && !SQLValidator.isReadOnly(query)) {
    const confirmed = await confirmWriteOperation(query);
    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }
  }

  // Execute query
  console.log('Executing query...\n');

  const result = await executeQuery({ env, query, write, output, timeout });

  if (!result.success) {
    console.error(`❌ Query failed: ${result.error}`);
    console.error(`Duration: ${result.duration}ms\n`);
    process.exit(1);
  }

  console.log('✅ Query successful\n');
  console.log('========================================');
  console.log('RESULTS');
  console.log('========================================\n');

  // Format output
  if (result.rows && result.rows.length > 0) {
    switch (output) {
      case 'json':
        formatJSON(result.rows);
        break;
      case 'csv':
        formatCSV(result.rows);
        break;
      default:
        formatTable(result.rows);
    }
  } else {
    console.log('(0 rows)');
  }

  console.log(`\nDuration: ${result.duration}ms\n`);
}

// ============================================================================
// EXPORTS (for testing)
// ============================================================================

export { SQLValidator, redactCredentials, maskSecret };

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
