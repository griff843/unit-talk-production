#!/usr/bin/env tsx
/**
 * Apply Phase 3 alert_events migration to Supabase
 *
 * Usage:
 *   npx tsx scripts/apply-phase3-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function applyMigration() {
  console.log('================================================================================');
  console.log('[Phase 3 Migration] Applying alert_events table migration to Supabase...');
  console.log('================================================================================\n');

  // Check required env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  console.log(`[Config] Supabase URL: ${supabaseUrl}`);
  console.log(`[Config] Service Role Key: ${supabaseKey.substring(0, 20)}...(redacted)\n`);

  // Read migration SQL file
  const migrationPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20251226_phase3_alert_events.sql'
  );

  console.log(`[Migration] Reading SQL from: ${migrationPath}`);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  console.log(`[Migration] Loaded ${migrationSql.length} bytes of SQL\n`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Execute migration
  console.log('[Migration] Executing SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { query: migrationSql });

  if (error) {
    // If exec_sql RPC doesn't exist, try direct query
    console.log('[Migration] exec_sql RPC not available, trying direct execution...');

    // Split SQL into individual statements (rough split by semicolon)
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`[Migration] Executing ${statements.length} SQL statements individually...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;

      console.log(`[Statement ${i + 1}/${statements.length}] ${statement.substring(0, 60)}...`);

      // Note: Supabase JS client doesn't support direct SQL execution for DDL
      // This migration must be applied via Supabase Dashboard SQL Editor
      console.log('⚠️ Supabase JS client cannot execute DDL statements directly.');
      console.log('\n📋 MANUAL MIGRATION REQUIRED:');
      console.log('===========================================================');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the entire migration SQL file:');
      console.log(`   ${migrationPath}`);
      console.log('4. Click "Run" to execute the migration');
      console.log('===========================================================\n');

      console.log('Alternatively, use Supabase CLI:');
      console.log('  supabase db push --db-url="your_connection_string"');
      console.log('\nOr apply via psql:');
      console.log('  psql -h db.cqfnsozknjzvyiziwicl.supabase.co -U postgres -d postgres -f supabase/migrations/20251226_phase3_alert_events.sql\n');

      process.exit(1);
    }

    return;
  }

  console.log('[Migration] ✅ Successfully applied migration!');
  console.log('[Migration] Verifying alert_events table exists...\n');

  // Verify table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('alert_events')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('[Migration] ❌ Table verification failed:', tableError.message);
    console.log('\n💡 The migration SQL may need to be applied manually via Supabase Dashboard.');
    process.exit(1);
  }

  console.log('[Migration] ✅ alert_events table verified successfully!');
  console.log('\n================================================================================');
  console.log('[Phase 3 Migration] COMPLETE');
  console.log('================================================================================');
}

applyMigration().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
