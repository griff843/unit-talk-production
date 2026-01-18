#!/usr/bin/env tsx
/**
 * Database Smoke Tests Post-Migration
 *
 * Purpose: Run basic read/write operations to verify database health
 * Usage: npx tsx scripts/ops/smoke-test-db.ts --env dev|staging|prod [--comprehensive]
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

interface SmokeTest {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const envFlag = args.find(arg => arg.startsWith('--env='));
  const env = envFlag ? envFlag.split('=')[1] : 'dev';
  const comprehensive = args.includes('--comprehensive');

  console.log('========================================');
  console.log(`SMOKE TESTS - ${env.toUpperCase()}`);
  console.log(`Mode: ${comprehensive ? 'COMPREHENSIVE' : 'BASIC'}`);
  console.log('========================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env[`SUPABASE_URL_${env.toUpperCase()}`];
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env[`SUPABASE_SERVICE_ROLE_KEY_${env.toUpperCase()}`];

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tests: SmokeTest[] = [];

  // Test 1: Basic connectivity
  await runTest('Database connectivity', async () => {
    const { data, error } = await supabase.from('picks').select('id').limit(1);
    if (error) throw new Error(error.message);
    return true;
  }, tests);

  // Test 2: Count picks
  await runTest('Count picks table', async () => {
    const { count, error } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    console.log(`   Found ${count ?? 0} picks`);
    return true;
  }, tests);

  // Test 3: Count pick_publish
  await runTest('Count pick_publish table', async () => {
    const { count, error } = await supabase
      .from('pick_publish')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    console.log(`   Found ${count ?? 0} publish records`);
    return true;
  }, tests);

  // Test 4: Query users
  await runTest('Query users table', async () => {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    console.log(`   Found ${count ?? 0} users`);
    return true;
  }, tests);

  // Comprehensive tests (only in comprehensive mode or non-prod)
  if (comprehensive || env !== 'prod') {
    console.log('\n--- Comprehensive Tests ---\n');

    // Test 5: Write test (dev/staging only)
    if (env !== 'prod') {
      await runTest('Write test (create test tenant)', async () => {
        const testId = randomUUID();
        const { error: insertError } = await supabase
          .from('tenants')
          .insert({
            id: testId,
            name: `smoke-test-${Date.now()}`,
            slug: `smoke-test-${Date.now()}`,
            status: 'active',
          });

        if (insertError) throw new Error(insertError.message);

        // Cleanup
        const { error: deleteError } = await supabase
          .from('tenants')
          .delete()
          .eq('id', testId);

        if (deleteError) throw new Error(`Cleanup failed: ${deleteError.message}`);

        return true;
      }, tests);
    }

    // Test 6: RPC function test (if exists)
    await runTest('RPC function test', async () => {
      try {
        const { error } = await supabase.rpc('get_tenant_by_slug', {
          slug_input: 'unit-talk'
        });
        // RPC may not exist, don't fail if missing
        if (error && !error.message.includes('does not exist')) {
          throw new Error(error.message);
        }
        return true;
      } catch (err) {
        if (err instanceof Error && err.message.includes('does not exist')) {
          console.log('   (RPC function not found, skipping)');
          return true;
        }
        throw err;
      }
    }, tests);

    // Test 7: Foreign key integrity
    await runTest('Foreign key integrity check', async () => {
      const { data, error } = await supabase
        .from('picks')
        .select('id, user_id, tenant_id')
        .not('user_id', 'is', null)
        .limit(1);

      if (error) throw new Error(error.message);

      if (data && data.length > 0) {
        const pick = data[0];

        // Verify user exists
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('id', pick.user_id)
          .single();

        if (userError) throw new Error(`User FK broken: ${userError.message}`);

        // Verify tenant exists
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id')
          .eq('id', pick.tenant_id)
          .single();

        if (tenantError) throw new Error(`Tenant FK broken: ${tenantError.message}`);

        console.log('   Foreign key integrity verified');
      } else {
        console.log('   (No picks with user_id to test)');
      }

      return true;
    }, tests);
  }

  // Summary
  console.log('\n========================================');
  console.log('SMOKE TEST SUMMARY');
  console.log('========================================\n');

  const totalTests = tests.length;
  const passedTests = tests.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;

  const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / totalTests;

  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Average duration: ${avgDuration.toFixed(2)}ms\n`);

  if (failedTests > 0) {
    console.error('❌ SMOKE TESTS FAILED\n');
    console.error('Failed tests:');
    tests.filter(t => !t.passed).forEach(t => {
      console.error(`  - ${t.name}: ${t.error}`);
    });
    console.error('');
    process.exit(1);
  }

  console.log('✅ ALL SMOKE TESTS PASSED\n');
  process.exit(0);
}

async function runTest(
  name: string,
  testFn: () => Promise<boolean>,
  results: SmokeTest[]
): Promise<void> {
  const start = Date.now();

  try {
    process.stdout.write(`${name}... `);
    await testFn();
    const duration = Date.now() - start;
    console.log(`✅ (${duration}ms)`);
    results.push({ name, passed: true, duration });
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    console.log(`❌ (${duration}ms)`);
    console.error(`   Error: ${error}`);
    results.push({ name, passed: false, duration, error });
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
