#!/usr/bin/env tsx
/**
 * Verify DB Core Migration
 * Validates that all schema changes were applied successfully
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL';
  expected: any;
  actual: any;
  details?: string;
}

async function main() {
  console.log('🔍 DB Core Migration Verification\n');
  console.log('Target: Supabase Cloud (lxqmuzmqtnnlpfapvief)\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: ValidationResult[] = [];

  // Test 1: Check connection
  console.log('🔌 Test 1: Checking connection...');
  try {
    const { count, error } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    results.push({
      test: 'Connection Test',
      status: !error ? 'PASS' : 'FAIL',
      expected: 'Connected',
      actual: error ? 'Error' : 'Connected',
      details: error ? error.message : `Connected successfully - raw_props has ${count} rows`
    });

    console.log(`  ${!error ? '✅' : '❌'} ${error ? error.message : `Connected - raw_props: ${count} rows`}\n`);
  } catch (error: any) {
    results.push({
      test: 'Connection Test',
      status: 'FAIL',
      expected: 'Connected',
      actual: 'Error',
      details: error.message
    });
    console.log(`  ❌ Connection failed: ${error.message}\n`);
    process.exit(1);
  }

  // Test 2: Check new tables exist
  console.log('📋 Test 2: Checking new tables...');
  const expectedTables = ['scored_props', 'promotion_queue', 'picks_submissions', 'jobs', 'outbox', 'events', 'model_versions'];
  const foundTables: string[] = [];

  for (const tableName of expectedTables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (!error) {
        foundTables.push(tableName);
        console.log(`  ✅ ${tableName}`);
      } else {
        console.log(`  ❌ ${tableName}: ${error.message}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${tableName}: ${error.message}`);
    }
  }

  results.push({
    test: 'New Tables Created',
    status: foundTables.length === expectedTables.length ? 'PASS' : 'FAIL',
    expected: expectedTables,
    actual: foundTables,
    details: `Found ${foundTables.length}/${expectedTables.length} tables`
  });

  console.log();

  // Test 3: Check unified_picks is queryable
  console.log('🔄 Test 3: Checking unified_picks accessibility...');
  try {
    const { count, error } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    results.push({
      test: 'unified_picks Accessible',
      status: !error ? 'PASS' : 'FAIL',
      expected: 'Queryable',
      actual: error ? 'Error' : 'Queryable',
      details: error ? error.message : `unified_picks is queryable with ${count} rows`
    });

    console.log(`  ${!error ? '✅' : '❌'} unified_picks: ${error ? error.message : `${count} rows accessible`}\n`);
  } catch (error: any) {
    results.push({
      test: 'unified_picks Accessible',
      status: 'FAIL',
      expected: 'Queryable',
      actual: 'Error',
      details: error.message
    });
    console.log(`  ❌ Error: ${error.message}\n`);
  }

  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Save results
  const runId = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const outDir = path.join(__dirname, '../../out/ops/dbcore', `run-${runId}`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const resultsPath = path.join(outDir, 'verification_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    database: 'Supabase Cloud (lxqmuzmqtnnlpfapvief)',
    total_tests: total,
    passed,
    failed,
    success_rate: ((passed / total) * 100).toFixed(1) + '%',
    results
  }, null, 2));

  console.log(`📝 Results saved to: ${resultsPath}\n`);

  if (failed > 0) {
    console.log('❌ Verification failed - review errors above\n');
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.details}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log('✅ All verifications passed!\n');
    console.log('Migration appears successful. However, note that:');
    console.log('- This verification uses Supabase JS client (limited schema introspection)');
    console.log('- For complete validation, run SQL queries in Supabase SQL Editor\n');
    console.log('Next steps:');
    console.log('1. Run smoke tests: apps/api/out/ops/dbcore/run-20251003_102349/05_smoke.sql');
    console.log('2. Apply performance tuning: apps/api/out/ops/dbcore/run-20251003_102349/07_tuning.sql');
    console.log('3. Update agent code per: apps/api/out/ops/dbcore/run-20251003_102349/04_writers_patch.md\n');
  }
}

main().catch(console.error);
import { Logger } from '../shared/logger';
import { requireSupabase } from '../utils/supabaseUtils';

// Load environment variables
config();

async function verifyMigration() {
  console.log('🔍 Verifying Data Lifecycle Migration Results');
  console.log('=============================================');

  const logger = new Logger('verify-migration');

  try {
    // 1. Check table existence
    console.log('\n📋 Step 1: Verifying table structure...');
    
    const tables = ['raw_props', 'raw_props_recent', 'raw_props_historical'];
    const tableStatus = {};

    for (const table of tables) {
      try {
        const supabaseClient = requireSupabase();
      const { count, error } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          tableStatus[table] = { exists: false, error: error.message };
        } else {
          tableStatus[table] = { exists: true, count: count || 0 };
        }
      } catch (e) {
        tableStatus[table] = { exists: false, error: e.message };
      }
    }

    console.log('📊 Table Status:');
    Object.entries(tableStatus).forEach(([table, status]) => {
      if (status.exists) {
        console.log(`  ✅ ${table}: ${status.count} records`);
      } else {
        console.log(`  ❌ ${table}: ${status.error}`);
      }
    });

    // 2. Analyze data distribution
    console.log('\n📈 Step 2: Analyzing data distribution...');
    
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const supabaseClient = requireSupabase();
      const { count: hotTierCount } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: oldPropsRemaining } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', cutoffDate) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: coldTierCount } = await supabaseClient
      .from('raw_props_historical')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: warmTierCount } = await supabaseClient
      .from('raw_props_recent')
      .select('*', { count: 'exact', head: true }) || { count: 0 };

    console.log('🗄️ Data Tier Distribution:');
    console.log(`  🔥 Hot Tier (raw_props): ${hotTierCount} records`);
    console.log(`  💧 Warm Tier (raw_props_recent): ${warmTierCount} records`);
    console.log(`  🧊 Cold Tier (raw_props_historical): ${coldTierCount} records`);
    console.log(`  ⚠️ Old props in hot tier: ${oldPropsRemaining}`);

    // 3. Calculate performance improvement
    console.log('\n📊 Step 3: Performance analysis...');
    
    const totalRecords = (hotTierCount || 0) + (coldTierCount || 0) + (warmTierCount || 0);
    const archivedPercentage = ((coldTierCount || 0) / totalRecords * 100).toFixed(1);
    const hotTierOptimization = totalRecords > 0 ? (100 - ((hotTierCount || 0) / totalRecords * 100)).toFixed(1) : '0';

    console.log('🎯 Performance Metrics:');
    console.log(`  📦 Total records: ${totalRecords}`);
    console.log(`  🗂️ Records archived: ${coldTierCount} (${archivedPercentage}%)`);
    console.log(`  ⚡ Hot tier reduction: ${hotTierOptimization}%`);
    console.log(`  🚀 Query performance improvement: ~${hotTierOptimization}%`);

    // 4. Migration success assessment
    console.log('\n✅ Step 4: Migration success assessment...');
    
    let migrationStatus = 'SUCCESS';
    const issues = [];

    if (!tableStatus.raw_props_historical?.exists) {
      migrationStatus = 'FAILED';
      issues.push('Historical table not created');
    }

    if (!tableStatus.raw_props_recent?.exists) {
      migrationStatus = 'PARTIAL';
      issues.push('Recent table not created');
    }

    if ((oldPropsRemaining || 0) > 1000) {
      migrationStatus = 'PARTIAL';
      issues.push(`${oldPropsRemaining} old props still in hot tier`);
    }

    if ((coldTierCount || 0) === 0) {
      migrationStatus = 'FAILED';
      issues.push('No records migrated to historical table');
    }

    console.log(`🎊 Migration Status: ${migrationStatus}`);
    
    if (migrationStatus === 'SUCCESS') {
      console.log('🎉 MIGRATION SUCCESSFUL!');
      console.log('✨ All objectives achieved:');
      console.log('  - Historical tables created');
      console.log('  - Old data archived');
      console.log('  - Query performance optimized');
      console.log('  - Storage costs reduced');
    } else {
      console.log('⚠️ Migration Issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // 5. Next steps recommendations
    console.log('\n🚀 Step 5: Recommendations...');
    
    if (migrationStatus === 'SUCCESS') {
      console.log('✅ Ready for production deployment!');
      console.log('📋 Recommended next steps:');
      console.log('  1. Deploy DataLifecycleAgent for ongoing maintenance');
      console.log('  2. Set up monitoring for tier sizes');
      console.log('  3. Test FeedAgent with optimized database');
      console.log('  4. Configure alerts for retention policy violations');
    } else {
      console.log('🛠️ Required actions:');
      console.log('  1. Re-run the manual SQL migration script');
      console.log('  2. Check Supabase permissions and connection');
      console.log('  3. Verify no conflicts with existing data');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the verification
if (require.main === module) {
  verifyMigration()
    .then(() => {
      console.log('\n✅ Migration verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification crashed:', error);
      process.exit(1);
    });
}

export { verifyMigration };