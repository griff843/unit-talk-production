/**
 * Test Auto-Enqueue Trigger
 * Verifies that picks are automatically enqueued to scoring_queue on insertion
 */

import { createSupabaseClient } from '../utils/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('TriggerTest');

async function main() {
  const supabase = createSupabaseClient();

  console.log('\n' + '='.repeat(80));
  console.log('🧪 AUTO-ENQUEUE TRIGGER TEST');
  console.log('='.repeat(80) + '\n');

  // Step 1: Check if trigger exists
  console.log('📋 STEP 1: Verify Trigger Exists');
  console.log('-'.repeat(80));

  const { data: triggerCheck, error: triggerError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'unified_picks'
        AND trigger_name = 'trigger_auto_enqueue_scoring'
      `
    });

  if (triggerError) {
    console.log('  ⚠️  Cannot verify trigger (exec_sql may not be available)');
    console.log('  Proceeding with insertion test...\n');
  } else if (!triggerCheck || triggerCheck.length === 0) {
    console.log('  ❌ Trigger NOT found!');
    console.log('  Please apply migration: 20250927_add_auto_enqueue_trigger.sql');
    console.log('');
    process.exit(1);
  } else {
    console.log('  ✅ Trigger exists: trigger_auto_enqueue_scoring');
    console.log(`     Event: ${triggerCheck[0].event_manipulation}`);
    console.log('');
  }

  // Step 2: Create test pick
  console.log('📝 STEP 2: Insert Test Pick');
  console.log('-'.repeat(80));

  const testPick = {
    user_id: '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
    pick_type: 'single',
    selection: 'Auto-Enqueue Test Team',
    stake: 1,
    potential_payout: 2.5,
    source: 'trigger-test',
    market: 'h2h',
    matchup: 'Auto-Enqueue Test A @ Test B',
    game_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    odds: -120,
    posted_at: new Date().toISOString(),
    metadata: { trigger_test: true, timestamp: Date.now() }
  };

  const { data: insertedPick, error: insertError } = await supabase
    .from('unified_picks')
    .insert(testPick)
    .select()
    .single();

  if (insertError || !insertedPick) {
    console.log(`  ❌ Failed to insert pick: ${insertError?.message}`);
    process.exit(1);
  }

  const pickId = insertedPick.id;
  console.log(`  ✅ Pick inserted: ${pickId}`);
  console.log(`     Market: ${insertedPick.market}`);
  console.log(`     Odds: ${insertedPick.odds}`);
  console.log(`     Professional Score: ${insertedPick.professional_score || 'null (unscored)'}`);
  console.log('');

  // Step 3: Check if auto-enqueued (wait 1 second for trigger)
  console.log('🔄 STEP 3: Verify Auto-Enqueue');
  console.log('-'.repeat(80));
  console.log('  ⏳ Waiting 1 second for trigger to fire...');

  await new Promise(resolve => setTimeout(resolve, 1000));

  const { data: queueJobs, error: queueError } = await supabase
    .from('scoring_queue')
    .select('*')
    .eq('pick_id', pickId);

  if (queueError) {
    console.log(`  ❌ Failed to check queue: ${queueError.message}`);
    process.exit(1);
  }

  if (!queueJobs || queueJobs.length === 0) {
    console.log('  ❌ AUTO-ENQUEUE FAILED!');
    console.log('  Pick was NOT automatically enqueued to scoring_queue');
    console.log('');
    console.log('  Possible causes:');
    console.log('    1. Trigger not applied to database');
    console.log('    2. Trigger function has error');
    console.log('    3. Unique constraint violation (pick already in queue)');
    console.log('');
    console.log('='.repeat(80));
    console.log('❌ TEST FAILED: Auto-enqueue trigger not working');
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }

  const queueJob = queueJobs[0];
  console.log('  ✅ AUTO-ENQUEUE SUCCESSFUL!');
  console.log(`     Job ID: ${queueJob.id}`);
  console.log(`     Pick ID: ${queueJob.pick_id}`);
  console.log(`     Status: ${queueJob.status}`);
  console.log(`     Created: ${queueJob.created_at}`);
  console.log('');

  // Step 4: Clean up
  console.log('🧹 STEP 4: Cleanup');
  console.log('-'.repeat(80));

  await supabase.from('scoring_queue').delete().eq('id', queueJob.id);
  await supabase.from('unified_picks').delete().eq('id', pickId);

  console.log('  ✅ Test data cleaned up');
  console.log('');

  // Success!
  console.log('='.repeat(80));
  console.log('✅ TEST PASSED: Auto-enqueue trigger is ACTIVE and WORKING');
  console.log('='.repeat(80));
  console.log('\n🎉 Scoring system is fully operational with automatic enqueue!\n');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});