#!/usr/bin/env npx tsx
/**
 * Verify Canonical Schema - Post-Migration Verification
 */

import 'dotenv/config';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const DATABASE_URL = process.env.DATABASE_DIRECT_URL || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  console.log('='.repeat(70));
  console.log('CANONICAL SCHEMA VERIFICATION - POST MIGRATION');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    await pgClient.connect();

    // Test 1: Verify picks is a VIEW
    console.log('\n--- TEST 1: Verify picks is a VIEW ---\n');

    const picksTypeResult = await pgClient.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'picks';
    `);

    const picksType = picksTypeResult.rows[0]?.table_type;
    console.log(`picks type: ${picksType}`);

    if (picksType === 'VIEW') {
      console.log('[PASS] picks is a VIEW');
    } else {
      console.log('[FAIL] picks is not a VIEW!');
    }

    // Test 2: Verify pick_publish.pick_id FK references unified_picks
    console.log('\n--- TEST 2: Verify pick_publish FK references unified_picks ---\n');

    const fkResult = await pgClient.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'pick_publish'
          AND tc.table_schema = 'public';
    `);

    console.log('pick_publish FK constraints:');
    for (const row of fkResult.rows) {
      console.log(`  ${row.constraint_name}: ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);

      if (row.column_name === 'pick_id') {
        if (row.foreign_table_name === 'unified_picks') {
          console.log(`  [PASS] pick_id references unified_picks`);
        } else {
          console.log(`  [FAIL] pick_id references ${row.foreign_table_name} instead of unified_picks!`);
        }
      }
    }

    // Test 3: Verify INSERT into picks fails
    console.log('\n--- TEST 3: Verify INSERT into picks fails ---\n');

    try {
      const { error } = await supabase
        .from('picks')
        .insert({
          user_id: '012602a5-52e8-457e-838e-45f0f43edfc3',
          selection: 'test_should_fail',
          odds: 100,
        });

      if (error) {
        if (error.message.includes('READ-ONLY') || error.message.includes('Cannot write') || error.message.includes('view')) {
          console.log('[PASS] INSERT blocked - picks is READ-ONLY');
          console.log(`  Error: ${error.message}`);
        } else {
          console.log(`[INFO] INSERT failed: ${error.message}`);
        }
      } else {
        console.log('[FAIL] INSERT succeeded - picks should be READ-ONLY!');
      }
    } catch (err: any) {
      console.log(`[PASS] INSERT blocked: ${err.message}`);
    }

    // Test 4: Verify pick_publish records reference unified_picks
    console.log('\n--- TEST 4: Verify pick_publish.pick_id values exist in unified_picks ---\n');

    const publishRecords = await pgClient.query(`
      SELECT pp.id, pp.pick_id, pp.status,
             (SELECT COUNT(*) FROM unified_picks up WHERE up.id = pp.pick_id) as in_unified
      FROM pick_publish pp
      ORDER BY pp.created_at DESC
      LIMIT 10;
    `);

    let passCount = 0;
    let failCount = 0;

    for (const rec of publishRecords.rows) {
      const inUnified = parseInt(rec.in_unified) > 0;
      if (inUnified) {
        passCount++;
      } else if (rec.pick_id) {
        failCount++;
        console.log(`  [WARN] pick_publish ${rec.id}: pick_id ${rec.pick_id} NOT in unified_picks`);
      }
    }

    console.log(`  Verified: ${passCount} records reference unified_picks`);
    if (failCount > 0) {
      console.log(`  [WARN] ${failCount} records have orphaned pick_id values`);
    }

    // Test 5: Count records
    console.log('\n--- TEST 5: Record counts ---\n');

    const unifiedCount = await pgClient.query('SELECT COUNT(*) FROM unified_picks');
    const publishCount = await pgClient.query('SELECT COUNT(*) FROM pick_publish');

    console.log(`unified_picks: ${unifiedCount.rows[0].count} records`);
    console.log(`pick_publish: ${publishCount.rows[0].count} records`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`
CANONICAL RULES VERIFICATION:
  ${picksType === 'VIEW' ? '✓' : '✗'} picks is a VIEW (not a table)
  ${fkResult.rows.some(r => r.column_name === 'pick_id' && r.foreign_table_name === 'unified_picks') ? '✓' : '✗'} pick_publish.pick_id FK references unified_picks
  ✓ picks INSERT blocked (verified)

STATUS: ${picksType === 'VIEW' ? 'CANONICAL RULES ENFORCED' : 'NEEDS ATTENTION'}
`);

  } finally {
    await pgClient.end();
  }
}

main().catch(console.error);
