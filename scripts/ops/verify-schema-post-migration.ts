#!/usr/bin/env tsx
/**
 * Verify Supabase Schema Post-Migration
 *
 * Purpose: Ensure expected tables/views exist after migration
 * Usage: npx tsx scripts/ops/verify-schema-post-migration.ts --env dev|staging|prod
 */

import { createClient } from '@supabase/supabase-js';

interface VerificationResult {
  table: string;
  exists: boolean;
  rowCount?: number;
}

const EXPECTED_CANONICAL_TABLES = [
  'picks',
  'pick_publish',
  'users',
  'tenants',
  'props',
  'games',
  'teams',
  'players',
] as const;

const EXPECTED_VIEWS = [
  'vw_recent_picks',
] as const;

async function main() {
  const args = process.argv.slice(2);
  const envFlag = args.find(arg => arg.startsWith('--env='));
  const env = envFlag ? envFlag.split('=')[1] : 'dev';

  console.log('========================================');
  console.log(`SCHEMA VERIFICATION - ${env.toUpperCase()}`);
  console.log('========================================\n');

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env[`SUPABASE_URL_${env.toUpperCase()}`];
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env[`SUPABASE_SERVICE_ROLE_KEY_${env.toUpperCase()}`];

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error(`   SUPABASE_URL or SUPABASE_URL_${env.toUpperCase()}`);
    console.error(`   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY_${env.toUpperCase()}`);
    process.exit(1);
  }

  // Mask sensitive data in output
  const maskedUrl = supabaseUrl.replace(/https:\/\/([^.]+)\.supabase\.co/, 'https://****$1.supabase.co');
  const maskedKey = `${supabaseKey.substring(0, 8)}****`;

  console.log(`URL: ${maskedUrl}`);
  console.log(`Key: ${maskedKey}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const results: VerificationResult[] = [];
  let failed = false;

  // Verify tables
  console.log('Checking canonical tables...\n');

  for (const table of EXPECTED_CANONICAL_TABLES) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`❌ ${table}: ${error.message}`);
        results.push({ table, exists: false });
        failed = true;
      } else {
        console.log(`✅ ${table} (${count ?? 0} rows)`);
        results.push({ table, exists: true, rowCount: count ?? 0 });
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ table, exists: false });
      failed = true;
    }
  }

  // Verify views
  console.log('\nChecking views...\n');

  for (const view of EXPECTED_VIEWS) {
    try {
      const { data, error, count } = await supabase
        .from(view)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.warn(`⚠️  ${view}: ${error.message} (optional)`);
        results.push({ table: view, exists: false });
        // Views are optional, don't fail
      } else {
        console.log(`✅ ${view} (${count ?? 0} rows)`);
        results.push({ table: view, exists: true, rowCount: count ?? 0 });
      }
    } catch (err) {
      console.warn(`⚠️  ${view}: ${err instanceof Error ? err.message : String(err)} (optional)`);
      results.push({ table: view, exists: false });
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================\n');

  const totalChecked = results.length;
  const totalPassed = results.filter(r => r.exists).length;
  const requiredTables = EXPECTED_CANONICAL_TABLES.length;
  const requiredPassed = results.filter(r =>
    EXPECTED_CANONICAL_TABLES.includes(r.table as any) && r.exists
  ).length;

  console.log(`Total checks: ${totalChecked}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalChecked - totalPassed}`);
  console.log(`Required tables: ${requiredPassed}/${requiredTables}\n`);

  if (failed) {
    console.error('❌ SCHEMA VERIFICATION FAILED\n');
    console.error('Some required tables are missing or inaccessible.');
    console.error('Check migration logs and RLS policies.\n');
    process.exit(1);
  }

  console.log('✅ SCHEMA VERIFICATION PASSED\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
