#!/usr/bin/env npx tsx
/**
 * Check Canonical Schema - Verify picks/unified_picks/pick_publish relationships
 *
 * Evidence gathering for canonical architecture:
 * 1. Is public.picks a VIEW or TABLE?
 * 2. What does pick_publish.pick_id FK reference?
 * 3. Can we insert into picks? (should fail if it's a view)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('='.repeat(70));
  console.log('CANONICAL SCHEMA VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Database: ${SUPABASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // Step 1: Check if picks is a VIEW or TABLE
  console.log('\n--- STEP 1: Check if public.picks is VIEW or TABLE ---\n');

  const { data: picksType, error: picksTypeError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'picks';
    `
  });

  if (picksTypeError) {
    console.log('RPC not available, trying alternative method...');

    // Alternative: Check pg_class
    const { data: pgClass, error: pgError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          relname as name,
          CASE relkind
            WHEN 'r' THEN 'TABLE'
            WHEN 'v' THEN 'VIEW'
            WHEN 'm' THEN 'MATERIALIZED VIEW'
            ELSE relkind::text
          END as type
        FROM pg_class
        WHERE relname = 'picks'
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
      `
    });

    if (pgError) {
      console.log('Alternative RPC also failed:', pgError.message);
      console.log('\nUsing inference method...');

      // Inference: Try to get table definition
      // If it has constraints and indexes like a table, it's a table
      // Try inserting and see if it fails with "cannot insert into view"
    } else {
      console.log('Result:', JSON.stringify(pgClass, null, 2));
    }
  } else {
    console.log('information_schema result:', JSON.stringify(picksType, null, 2));
  }

  // Alternative check: Try to describe the object
  console.log('\n--- Checking via column query ---');

  const { data: picksColumns, error: picksColError } = await supabase
    .from('picks')
    .select('*')
    .limit(0);

  if (picksColError) {
    console.log('picks query error:', picksColError.message);
  } else {
    console.log('[OK] picks is accessible (columns query succeeded)');
  }

  // Step 2: Check pick_publish FK constraint
  console.log('\n--- STEP 2: Check pick_publish.pick_id FK reference ---\n');

  // Try to query the constraint directly via RPC
  const { data: fkData, error: fkError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'pick_publish'
        AND kcu.column_name = 'pick_id';
    `
  });

  if (fkError) {
    console.log('FK query via RPC failed:', fkError.message);
  } else {
    console.log('FK Constraint Result:');
    console.log(JSON.stringify(fkData, null, 2));
  }

  // Step 3: Check unified_picks exists and is a TABLE
  console.log('\n--- STEP 3: Check unified_picks is TABLE ---\n');

  const { data: unifiedColumns, error: unifiedError } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (unifiedError) {
    console.log('unified_picks query error:', unifiedError.message);
  } else {
    console.log('[OK] unified_picks is accessible');
    if (unifiedColumns && unifiedColumns.length > 0) {
      console.log('Sample columns:', Object.keys(unifiedColumns[0]).join(', '));
    }
  }

  // Step 4: Try to insert into picks to see if it's writable
  console.log('\n--- STEP 4: Test if picks allows INSERT (should FAIL if view) ---\n');

  const testId = `test_view_check_${Date.now()}`;
  const { data: insertResult, error: insertError } = await supabase
    .from('picks')
    .insert({
      tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
      user_id: '012602a5-52e8-457e-838e-45f0f43edfc3',
      selection: 'test',
      odds: 100,
      stake: 1,
      confidence: 5,
      workflow_stage: 'draft',
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    console.log('INSERT into picks FAILED:');
    console.log(`  Error: ${insertError.message}`);
    console.log(`  Code: ${insertError.code}`);

    if (insertError.message.includes('view') || insertError.message.includes('cannot insert')) {
      console.log('\n[EVIDENCE] picks is a READ-ONLY VIEW (insert rejected)');
    } else {
      console.log('\n[EVIDENCE] picks insert failed for other reason - may still be a table');
    }
  } else {
    console.log('INSERT into picks SUCCEEDED:');
    console.log(`  ID: ${insertResult?.id}`);
    console.log('\n[EVIDENCE] picks is a WRITABLE TABLE (not a view!)');

    // Clean up test record - CANONICAL: delete from unified_picks (picks is a read-only view)
    if (insertResult?.id) {
      await supabase.from('unified_picks').delete().eq('id', insertResult.id);
      console.log('  (test record cleaned up)');
    }
  }

  // Step 5: Check unified_picks columns to understand schema
  console.log('\n--- STEP 5: unified_picks schema ---\n');

  const { data: sampleUnified, error: sampleError } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1)
    .single();

  if (sampleError && sampleError.code !== 'PGRST116') {
    console.log('Error fetching unified_picks sample:', sampleError.message);
  } else if (sampleUnified) {
    console.log('unified_picks columns:');
    Object.keys(sampleUnified).forEach(col => {
      console.log(`  - ${col}: ${typeof sampleUnified[col]}`);
    });
  } else {
    console.log('unified_picks is empty, checking via insert error...');
    const { error: testInsertError } = await supabase
      .from('unified_picks')
      .insert({});
    if (testInsertError) {
      console.log('Required columns (from error):', testInsertError.message);
    }
  }

  // Step 6: Check picks columns to compare
  console.log('\n--- STEP 6: picks schema ---\n');

  const { data: samplePicks, error: samplePicksError } = await supabase
    .from('picks')
    .select('*')
    .limit(1)
    .single();

  if (samplePicksError && samplePicksError.code !== 'PGRST116') {
    console.log('Error fetching picks sample:', samplePicksError.message);
  } else if (samplePicks) {
    console.log('picks columns:');
    Object.keys(samplePicks).forEach(col => {
      console.log(`  - ${col}: ${typeof samplePicks[col]}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SCHEMA VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`
CANONICAL RULES CHECK:
  ✓ unified_picks accessible: ${!unifiedError ? 'YES' : 'NO'}
  ? picks is VIEW (not table): NEEDS MANUAL VERIFICATION
  ? pick_publish.pick_id → unified_picks: NEEDS MANUAL VERIFICATION

NEXT STEPS:
  1. Run SQL directly in Supabase dashboard to confirm picks type
  2. Check FK constraint on pick_publish.pick_id
  3. Create migration if needed to align with canonical rules
`);
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
