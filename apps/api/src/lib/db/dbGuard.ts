/**
 * Database Guard - Prevents local DB usage in Cloud/E2E mode
 *
 * This guard ensures that when running in production or E2E mode,
 * the system ONLY uses Supabase Cloud via SUPABASE_URL and never
 * accidentally connects to a local PostgreSQL instance.
 */

export function assertNoLocalDb(): void {
  // Check for any leaked local database connection strings
  const leaked =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PGHOST ||
    process.env.PGDATABASE;

  // Determine if we're running in Cloud/E2E mode
  const isCloud = process.env.NODE_ENV === 'production' || process.env.E2E === '1';

  if (isCloud && leaked) {
    const errorMsg = [
      '🚨 CRITICAL: Local DB environment detected in Cloud/E2E mode!',
      '',
      'Found leaked environment variables:',
      leaked && `  - Contains local database connection strings`,
      '',
      'Cloud/E2E mode requires:',
      '  ✓ SUPABASE_URL must be set',
      '  ✓ SUPABASE_SERVICE_ROLE_KEY must be set',
      '  ✗ DATABASE_URL must NOT be set',
      '  ✗ POSTGRES_URL must NOT be set',
      '  ✗ PGHOST must NOT be set',
      '  ✗ PGDATABASE must NOT be set',
      '',
      'Action required:',
      '  1. Use: docker-compose --profile cloud up -d',
      '  2. Ensure .env.cloud is loaded (NOT .env.local)',
      '  3. Verify no DATABASE_URL in environment',
      '',
      'Current environment:',
      `  - NODE_ENV: ${process.env.NODE_ENV}`,
      `  - E2E: ${process.env.E2E}`,
      `  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`,
      `  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`,
    ].filter(Boolean).join('\n');

    throw new Error(errorMsg);
  }

  // If in cloud mode, verify Supabase credentials are present
  if (isCloud) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Cloud/E2E mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set. ' +
        'Check .env.cloud configuration.'
      );
    }

    console.log('✅ DB Guard: Cloud mode verified - using Supabase only');
    console.log(`   - SUPABASE_URL: ${process.env.SUPABASE_URL}`);
    console.log(`   - Service role: configured`);
  } else {
    console.log('✅ DB Guard: Local dev mode - local DB allowed');
  }
}

/**
 * Get the appropriate database client configuration based on environment
 */
export function getDbConfig() {
  const isCloud = process.env.NODE_ENV === 'production' || process.env.E2E === '1';

  if (isCloud) {
    return {
      type: 'supabase' as const,
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    };
  } else {
    return {
      type: 'postgres' as const,
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev',
    };
  }
}
