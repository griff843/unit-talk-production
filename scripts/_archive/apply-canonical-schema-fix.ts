#!/usr/bin/env npx tsx
/**
 * Apply Canonical Schema Fix Migration
 * Fixes pick_publish.pick_id FK to reference unified_picks instead of picks
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('='.repeat(70));
  console.log('APPLY CANONICAL SCHEMA FIX MIGRATION');
  console.log('='.repeat(70));
  console.log(`Database: ${SUPABASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // Step 1: Check current state
  console.log('\n--- PRE-MIGRATION STATE ---\n');

  // Check if picks is TABLE or VIEW
  const { data: testInsert, error: testError } = await supabase
    .from('picks')
    .insert({
      tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
      user_id: '012602a5-52e8-457e-838e-45f0f43edfc3',
      selection: 'test_migration_check',
      odds: 100,
      stake: 1,
      confidence: 5,
      workflow_stage: 'draft',
      status: 'pending',
    })
    .select()
    .single();

  if (testError) {
    if (testError.message.includes('view') || testError.message.includes('cannot insert')) {
      console.log('[OK] picks is already a VIEW (insert blocked)');
      console.log('Migration may have already been applied.');
    } else {
      console.log(`picks insert failed: ${testError.message}`);
    }
  } else {
    console.log('[WARNING] picks is a WRITABLE TABLE - migration needed');
    // Clean up test record - CANONICAL: delete from unified_picks (picks is a read-only view)
    if (testInsert?.id) {
      await supabase.from('unified_picks').delete().eq('id', testInsert.id);
    }
  }

  // Step 2: Add missing columns to unified_picks
  console.log('\n--- STEP 1: Adding missing columns to unified_picks ---\n');

  const columnsToAdd = [
    { name: 'tenant_id', type: 'UUID' },
    { name: 'selection', type: 'TEXT' },
    { name: 'stake', type: 'NUMERIC(10,2)' },
    { name: 'confidence', type: 'INTEGER' },
    { name: 'status', type: 'TEXT DEFAULT \'pending\'' },
    { name: 'bet_slip_id', type: 'TEXT' },
    { name: 'legacy_pick_id', type: 'UUID' },
  ];

  for (const col of columnsToAdd) {
    // Check if column exists by trying to query it
    const { error: colCheckError } = await supabase
      .from('unified_picks')
      .select(col.name)
      .limit(0);

    if (colCheckError && colCheckError.message.includes('does not exist')) {
      console.log(`Adding column: ${col.name} (${col.type})`);
      // We can't execute raw SQL easily, so we'll note this needs manual application
      console.log(`  [MANUAL] Run: ALTER TABLE unified_picks ADD COLUMN ${col.name} ${col.type};`);
    } else {
      console.log(`[OK] Column exists: ${col.name}`);
    }
  }

  // Step 3: Count picks records to migrate
  console.log('\n--- STEP 2: Counting records to migrate ---\n');

  const { data: picksCount, error: countError } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.log('Error counting picks:', countError.message);
  } else {
    console.log(`picks records: ${picksCount?.length || 0}`);
  }

  const { data: publishCount } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true });

  console.log(`pick_publish records: ${publishCount?.length || 0}`);

  // Step 4: Migrate picks data to unified_picks
  console.log('\n--- STEP 3: Migrating picks data to unified_picks ---\n');

  const { data: allPicks, error: picksError } = await supabase
    .from('picks')
    .select('*');

  if (picksError) {
    console.log('Error fetching picks:', picksError.message);
    if (picksError.message.includes('view')) {
      console.log('[OK] picks is already a VIEW - skipping data migration');
    }
  } else if (allPicks && allPicks.length > 0) {
    console.log(`Migrating ${allPicks.length} records from picks to unified_picks...`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const pick of allPicks) {
      // Check if already migrated
      const { data: existing } = await supabase
        .from('unified_picks')
        .select('id')
        .eq('legacy_pick_id', pick.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert into unified_picks
      const newPickData = {
        legacy_pick_id: pick.id,
        tenant_id: pick.tenant_id,
        user_id: pick.user_id,
        selection: pick.selection,
        odds: pick.odds,
        stake: pick.stake,
        confidence: pick.confidence,
        status: pick.status,
        bet_slip_id: pick.bet_slip_id || pick.metadata?.bet_slip_id || `migrated_${pick.id}`,
        meta: pick.metadata,
        // Required unified_picks fields
        sport: pick.metadata?.league || pick.metadata?.sport || 'NFL',
        market: pick.metadata?.stat_type || 'spread',
        side: pick.selection || 'over',
        workflow_stage: pick.workflow_stage || 'draft',
        game_date: new Date().toISOString().split('T')[0],
        line: pick.metadata?.line || 0,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('unified_picks')
        .insert(newPickData)
        .select()
        .single();

      if (insertError) {
        console.log(`  Failed to migrate pick ${pick.id}: ${insertError.message}`);
        failed++;
      } else {
        migrated++;

        // Update pick_publish to point to new unified_picks ID
        const { error: updateError } = await supabase
          .from('pick_publish')
          .update({ pick_id: inserted.id })
          .eq('pick_id', pick.id);

        if (updateError) {
          console.log(`  Warning: Could not update pick_publish for ${pick.id}: ${updateError.message}`);
        }
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
  } else {
    console.log('No picks records to migrate');
  }

  // Step 5: Verify pick_publish now references unified_picks
  console.log('\n--- STEP 4: Verifying pick_publish references ---\n');

  const { data: publishRecords, error: publishError } = await supabase
    .from('pick_publish')
    .select('id, pick_id')
    .limit(5);

  if (publishError) {
    console.log('Error:', publishError.message);
  } else {
    for (const rec of publishRecords || []) {
      const { data: inUnified } = await supabase
        .from('unified_picks')
        .select('id')
        .eq('id', rec.pick_id)
        .maybeSingle();

      console.log(`pick_publish ${rec.id} → pick_id ${rec.pick_id} → in unified_picks: ${inUnified ? 'YES' : 'NO'}`);
    }
  }

  // Step 6: Instructions for manual SQL steps
  console.log('\n' + '='.repeat(70));
  console.log('MANUAL SQL STEPS REQUIRED');
  console.log('='.repeat(70));
  console.log(`
The following SQL must be run directly in Supabase SQL Editor:

-- 1. Drop existing FK constraint on pick_publish
ALTER TABLE public.pick_publish DROP CONSTRAINT IF EXISTS pick_publish_pick_id_fkey;

-- 2. Add new FK constraint to reference unified_picks
ALTER TABLE public.pick_publish
  ADD CONSTRAINT pick_publish_pick_id_unified_fkey
  FOREIGN KEY (pick_id) REFERENCES public.unified_picks(id) ON DELETE SET NULL;

-- 3. Drop picks TABLE (after verifying data is migrated)
DROP TABLE IF EXISTS public.picks CASCADE;

-- 4. Create picks as VIEW
CREATE OR REPLACE VIEW public.picks AS
SELECT
    id,
    tenant_id,
    user_id,
    game_id,
    bet_slip_id,
    selection,
    odds,
    stake,
    confidence,
    workflow_stage,
    status,
    meta AS metadata,
    created_at,
    updated_at,
    legacy_pick_id AS original_pick_id
FROM public.unified_picks;

-- 5. Add INSTEAD OF triggers to block writes
CREATE OR REPLACE FUNCTION prevent_picks_write()
RETURNS TRIGGER AS \$\$
BEGIN
    RAISE EXCEPTION 'Cannot write to picks view. Use unified_picks table instead.';
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_picks_insert
    INSTEAD OF INSERT ON public.picks
    FOR EACH ROW EXECUTE FUNCTION prevent_picks_write();
`);

  console.log('\n='.repeat(70));
  console.log('Run the above SQL in Supabase SQL Editor to complete the migration');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
