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
