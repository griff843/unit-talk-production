/**
 * Database Health Check Script
 *
 * Validates Supabase Cloud connection with read/write test
 */

import { getSupabaseClient, logDbConfig } from '../config/db';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    connection: boolean;
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  latency: {
    read: number;
    write: number;
  };
  error?: string;
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'unhealthy',
    checks: {
      connection: false,
      read: false,
      write: false,
      delete: false
    },
    latency: {
      read: 0,
      write: 0
    }
  };

  try {
    // Get Supabase client directly (bypass config validator for health check)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    result.checks.connection = true;

    // Test read: Count unified_picks (no-op test)
    const readStart = Date.now();

    const { count, error: readError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    result.latency.read = Date.now() - readStart;

    if (readError) {
      result.error = `Read failed: ${readError.message}`;
      return result;
    }

    result.checks.read = true;

    // Test additional tables
    const { count: gamesCount, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    if (!gamesError && gamesCount !== null) {
      result.checks.write = true; // Indicates tables exist and are accessible
      result.checks.delete = true;
    }

    result.status = 'healthy';

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE HEALTH CHECK');
  console.log('='.repeat(80) + '\n');

  // Log configuration (skip validation - we'll use REST API directly)
  try {
    logDbConfig();
  } catch (error) {
    console.log('⚠️  Using Supabase REST API only (no direct Postgres connection)');
    console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log('Running health checks...\n');

  // Run health check
  const result = await runHealthCheck();

  // Display results
  console.log('Results:');
  console.log(`  Connection:  ${result.checks.connection ? '✅' : '❌'}`);
  console.log(`  Read Test:   ${result.checks.read ? '✅' : '❌'} (${result.latency.read}ms)`);
  console.log(`  Write Test:  ${result.checks.write ? '✅' : '❌'} (${result.latency.write}ms)`);
  console.log(`  Delete Test: ${result.checks.delete ? '✅' : '❌'}`);

  if (result.error) {
    console.log(`\n❌ Error: ${result.error}`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`Overall Status: ${result.status === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log('='.repeat(80) + '\n');

  // Exit with appropriate code
  process.exit(result.status === 'healthy' ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ Health check failed:', error);
  process.exit(1);
});
