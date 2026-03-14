#!/usr/bin/env npx tsx
/**
 * SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX: Backfill promotion_band on approved picks
 *
 * Finds unified_picks with workflow_stage='approved' and promotion_band=null,
 * and sets promotion_band='HARD' via lifecycleUpdate(operator_override).
 *
 * These picks were inserted by GradingAgent.promoteFromProviderOffer() before
 * the bug fix landed. They passed meetsPromotionCriteria() and should be HARD
 * band, but the null fallback was written instead.
 *
 * SAFETY GUARANTEES:
 * - Bounded: Only processes approved picks with null promotion_band
 * - Idempotent: Skips picks that already have a non-null promotion_band
 * - Auditable: Logs every pick updated with before/after state
 * - Operator-authority: Uses 'operator_override' writer role
 *
 * USAGE:
 *   npx tsx backfill-promotion-band-null.ts --dry-run   # Preview only
 *   npx tsx backfill-promotion-band-null.ts             # Execute backfill
 */

import { createClient } from '@supabase/supabase-js';

import { lifecycleUpdate } from '../lib/lifecycle';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('=== SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX: Backfill ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'EXECUTE (will write)'}`);
  console.log('');

  // Find approved picks with null promotion_band
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('id, player_name, tier, workflow_stage, promotion_band, created_at, posted_to_discord')
    .eq('workflow_stage', 'approved')
    .is('promotion_band', null)
    .eq('posted_to_discord', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('ERROR: Failed to fetch picks:', error.message);
    process.exit(1);
  }

  if (!picks || picks.length === 0) {
    console.log(
      'No picks found with workflow_stage=approved and promotion_band=null. Nothing to backfill.'
    );
    return;
  }

  console.log(`Found ${picks.length} picks to backfill:\n`);
  for (const pick of picks) {
    console.log(
      `  ${pick.id} | ${pick.player_name || '(no player)'} | tier=${pick.tier} | created=${pick.created_at}`
    );
  }
  console.log('');

  if (isDryRun) {
    console.log('DRY RUN: Would set promotion_band=HARD on all above picks.');
    console.log('Re-run without --dry-run to execute.');
    return;
  }

  // Execute backfill
  let succeeded = 0;
  let failed = 0;

  for (const pick of picks) {
    console.log(`Updating ${pick.id} (${pick.player_name || 'unknown'})...`);
    const { success, error: updateError } = await lifecycleUpdate(
      supabase,
      pick.id,
      { promotion_band: 'HARD' },
      {
        writerRole: 'operator_override',
        traceId: `backfill-promotion-band-null-${pick.id}`,
      }
    );

    if (success) {
      console.log(`  ✅ Updated ${pick.id}: promotion_band null → HARD`);
      succeeded++;
    } else {
      console.error(`  ❌ Failed ${pick.id}: ${updateError}`);
      failed++;
    }
  }

  console.log('');
  console.log(`=== Backfill complete ===`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log('');

  if (failed > 0) {
    console.error('Some picks failed to update. Check errors above.');
    process.exit(1);
  }

  console.log(
    'All picks updated. DiscordPromotionAgent legacy path will now find them on next cycle.'
  );
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
