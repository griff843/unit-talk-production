/**
 * Database Guard - Fail-Fast SaaS Mode Enforcement
 *
 * Ensures the entire stack uses Supabase Cloud only.
 * Prevents accidental local DB usage in production.
 */

export interface DbGuardResult {
  valid: boolean;
  supabaseUrl: string;
  databaseUrl?: string;
  error?: string;
}

/**
 * Validate that database configuration is SaaS-ready
 *
 * Rules:
 * 1. SUPABASE_URL must be set
 * 2. If DATABASE_URL exists, it must point to *.supabase.co with sslmode=require
 * 3. No local postgres connections allowed
 */
export function validateDbConfig(): DbGuardResult {
  const supabaseUrl = process.env.SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Rule 1: SUPABASE_URL is required
  if (!supabaseUrl) {
    return {
      valid: false,
      supabaseUrl: '',
      error: '🔴 SUPABASE_URL is not set. SaaS mode requires Supabase Cloud configuration.'
    };
  }

  // Rule 2: SUPABASE_URL must be a Supabase Cloud URL
  if (!supabaseUrl.includes('supabase.co')) {
    return {
      valid: false,
      supabaseUrl,
      error: `🔴 SUPABASE_URL must point to Supabase Cloud (*.supabase.co). Got: ${supabaseUrl}`
    };
  }

  // Rule 3: If DATABASE_URL exists, validate it
  if (databaseUrl) {
    const isSupabaseDb = databaseUrl.includes('supabase.co');
    const hasSSL = databaseUrl.includes('sslmode=require');
    const dbHost = extractHost(databaseUrl);

    // Fail-fast on postgres/localhost hosts
    if (dbHost.includes('postgres') || dbHost.includes('localhost') || dbHost === '127.0.0.1') {
      return {
        valid: false,
        supabaseUrl,
        databaseUrl,
        error: [
          '🔴 BLOCKED: Local database detected!',
          '',
          'SaaS mode strictly prohibits local databases.',
          '',
          '  SUPABASE_URL: ' + extractHost(supabaseUrl),
          '  DATABASE_URL: ' + dbHost + ' ← BLOCKED',
          '',
          'Action required:',
          '  1. Remove DATABASE_URL from .env (use Supabase REST only)',
          '  2. Or update to Supabase Postgres: postgresql://postgres.[PROJECT].supabase.co:6543/postgres?sslmode=require',
          '',
          '⛔ System will NOT start with local database configured.'
        ].join('\n')
      };
    }

    if (!isSupabaseDb) {
      return {
        valid: false,
        supabaseUrl,
        databaseUrl,
        error: [
          '🔴 DATABASE_URL mismatch detected!',
          '',
          'SaaS mode requires Supabase Cloud only.',
          '',
          '  SUPABASE_URL: ' + extractHost(supabaseUrl),
          '  DATABASE_URL: ' + extractHost(databaseUrl),
          '',
          'To fix:',
          '  1. Update DATABASE_URL to point to db.*.supabase.co',
          '  2. Or remove DATABASE_URL to use SUPABASE_URL only',
          '  3. Ensure sslmode=require is in the connection string'
        ].join('\n')
      };
    }

    if (!hasSSL) {
      return {
        valid: false,
        supabaseUrl,
        databaseUrl,
        error: [
          '⚠️  DATABASE_URL is missing sslmode=require',
          '',
          'For security, Supabase connections must use SSL.',
          '',
          'Add to your DATABASE_URL: ?sslmode=require'
        ].join('\n')
      };
    }
  }

  // All checks passed
  return {
    valid: true,
    supabaseUrl,
    databaseUrl,
  };
}

/**
 * Extract hostname from URL or connection string for error messages
 */
function extractHost(url: string): string {
  try {
    // Try as URL
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Try as postgres connection string
    const hostMatch = url.match(/@([^:/]+)/);
    return hostMatch ? hostMatch[1] : url.substring(0, 50) + '...';
  }
}

/**
 * Run DB guard and exit if invalid
 * Call this at application bootstrap
 */
export function enforceDbGuard(): void {
  const result = validateDbConfig();

  if (!result.valid) {
    console.error('\n' + '='.repeat(80));
    console.error('DATABASE CONFIGURATION ERROR');
    console.error('='.repeat(80));
    console.error('\n' + result.error);
    console.error('\n' + '='.repeat(80) + '\n');
    process.exit(1);
  }

  // Log successful validation with startup banner
  console.log('\n' + '='.repeat(80));
  console.log('🚀 UNIT TALK - SAAS MODE');
  console.log('='.repeat(80));
  console.log('✅ Database Guard: SaaS mode validated');
  console.log(`   Supabase Host: ${extractHost(result.supabaseUrl)}`);
  if (result.databaseUrl) {
    console.log(`   Postgres Host: ${extractHost(result.databaseUrl)}`);
  }
  console.log(`   Mode: PRODUCTION (Supabase Cloud Only)`);
  console.log('='.repeat(80) + '\n');
}
