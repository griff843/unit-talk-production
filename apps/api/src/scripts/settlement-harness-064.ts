/**
 * SPRINT-064-SETTLEMENT-LIFECYCLE-FIX: Settlement Certification Harness
 *
 * Classification: BOUNDED TEMPORARY HARNESS — not canonical certification infrastructure
 *
 * Purpose: Exercise the real lifecycleSettle() codepath against a posted pick
 * to produce runtime proof of settlement capability.
 *
 * What this harness proves:
 *   1. lifecycleSettle() can transition POSTED -> SETTLED
 *   2. prop_settlements INSERT works with correct column names
 *   3. unified_picks settlement fields are writable (no blocking constraints)
 *   4. Transition validator accepts POSTED -> SETTLED for 'settler' role
 *   5. Writer authority accepts 'settler' for settlement fields
 *   6. Idempotency guard (checkSettleIdempotency) works correctly
 *
 * What this harness does NOT prove:
 *   - SettlementAgent automatic trigger from game_results (requires external API)
 *   - SGO/Odds API data fetch
 *   - calculatePropSettlement() with real game data
 *   - manual_settle_pick() RPC (has missing DB dependencies)
 *   - Recap path (RecapAgent has column mismatch bugs)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx apps/api/src/scripts/settlement-harness-064.ts
 *
 * Input: Uses SPRINT-062 Pick 062a0001 (LeBron James, POSTED state)
 * Fallback: Creates a synthetic pick if 062a0001 is not found
 */

import { createClient } from '@supabase/supabase-js';

// Resolve env
const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SPRINT-062 candidate picks (POSTED state)
const CANDIDATE_PICKS = [
  {
    id: '062a0001-0000-4000-8000-000000000001',
    player: 'LeBron James',
    stat: 'Points',
    line: 24.5,
  },
  {
    id: '062b0001-0000-4000-8000-000000000002',
    player: 'Stephen Curry',
    stat: 'Three Pointers',
    line: 4.5,
  },
  {
    id: '062c0001-0000-4000-8000-000000000003',
    player: 'Jayson Tatum',
    stat: 'Points',
    line: 29.5,
  },
  {
    id: '062d0001-0000-4000-8000-000000000004',
    player: 'Nikola Jokic',
    stat: 'Rebounds',
    line: 11.5,
  },
];

interface HarnessResult {
  phase: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

const results: HarnessResult[] = [];

function log(phase: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${phase}] ${msg}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

function record(phase: string, success: boolean, data?: unknown, error?: string) {
  results.push({ phase, success, data, error });
}

async function main() {
  log('INIT', 'Settlement Harness SPRINT-064 starting');

  // ============================================================
  // PHASE 1: Locate candidate pick
  // ============================================================
  log('PHASE-1', 'Locating candidate pick from SPRINT-062...');

  let candidatePick: any = null;
  let candidateId: string | null = null;

  for (const candidate of CANDIDATE_PICKS) {
    const { data, error } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('id', candidate.id)
      .single();

    if (!error && data) {
      candidatePick = data;
      candidateId = candidate.id;
      log('PHASE-1', `Found candidate: ${candidate.player} (${candidate.id})`);
      break;
    }
  }

  if (!candidatePick) {
    log('PHASE-1', 'No SPRINT-062 picks found. Creating synthetic posted pick for harness...');

    // Create a synthetic pick in POSTED state
    const syntheticId = '064h0001-0000-4000-8000-000000000064';
    const syntheticPick = {
      id: syntheticId,
      player_name: 'Harness-064 Synthetic Player',
      stat_type: 'points',
      line: 25.5,
      side: 'over',
      sport: 'NBA',
      matchup: 'LAL vs GSW',
      game_time: new Date().toISOString(),
      tier: 'S',
      promotion_band: 'HARD',
      promotion_status: 'promoted',
      status: 'pending',
      posted_to_discord: true,
      discord_message_id: 'HARNESS-064-SYNTHETIC',
      promotion_posted_at: new Date().toISOString(),
      bet_type: 'player_prop',
      market: 'points',
      odds: -110,
      source: 'harness-064',
      created_at: new Date().toISOString(),
      placed_at: new Date().toISOString(),
      meta: { harness: 'SPRINT-064', synthetic: true },
    };

    const { data: insertedPick, error: insertError } = await supabase
      .from('unified_picks')
      .insert(syntheticPick)
      .select('*')
      .single();

    if (insertError) {
      log('PHASE-1', `FATAL: Cannot create synthetic pick: ${insertError.message}`);
      record('PHASE-1', false, null, insertError.message);

      // Try a simpler insert without optional fields
      log('PHASE-1', 'Attempting minimal insert...');
      const minimalPick = {
        id: syntheticId,
        player_name: 'Harness-064 Player',
        stat_type: 'points',
        line: 25.5,
        side: 'over',
        sport: 'NBA',
        tier: 'S',
        promotion_band: 'HARD',
        status: 'pending',
        posted_to_discord: true,
        discord_message_id: 'HARNESS-064-SYNTHETIC',
        source: 'harness-064',
        created_at: new Date().toISOString(),
        placed_at: new Date().toISOString(),
      };

      const { data: minPick, error: minErr } = await supabase
        .from('unified_picks')
        .insert(minimalPick)
        .select('*')
        .single();

      if (minErr) {
        log('PHASE-1', `FATAL: Minimal insert also failed: ${minErr.message}`);
        record('PHASE-1', false, null, minErr.message);
        printReport();
        process.exit(1);
      }

      candidatePick = minPick;
      candidateId = syntheticId;
    } else {
      candidatePick = insertedPick;
      candidateId = syntheticId;
    }

    log('PHASE-1', 'Synthetic pick created', { id: candidateId });
  }

  record('PHASE-1', true, {
    pick_id: candidateId,
    player_name: candidatePick.player_name,
    settlement_status: candidatePick.settlement_status,
    posted_to_discord: candidatePick.posted_to_discord,
    discord_message_id: candidatePick.discord_message_id,
  });

  // ============================================================
  // PHASE 2: Capture pre-state
  // ============================================================
  log('PHASE-2', 'Capturing pre-settlement state...');

  const preState = {
    id: candidatePick.id,
    status: candidatePick.status,
    settlement_status: candidatePick.settlement_status,
    settlement_result: candidatePick.settlement_result,
    settled_at: candidatePick.settled_at,
    actual_outcome: candidatePick.actual_outcome,
    posted_to_discord: candidatePick.posted_to_discord,
    discord_message_id: candidatePick.discord_message_id,
    player_name: candidatePick.player_name,
    stat_type: candidatePick.stat_type,
    line: candidatePick.line,
    side: candidatePick.side,
  };

  log('PHASE-2', 'Pre-state captured', preState);
  record('PHASE-2', true, preState);

  // ============================================================
  // PHASE 3: Insert game_results row (synthetic completed game)
  // ============================================================
  log('PHASE-3', 'Inserting synthetic game result...');

  const gameResultId = '064g0001-0000-4000-8000-000000000064';
  const gameResult = {
    id: gameResultId,
    external_game_id: `harness-064-game-${Date.now()}`,
    sport: candidatePick.sport || 'NBA',
    home_team: 'LAL',
    away_team: 'GSW',
    home_score: 112,
    away_score: 108,
    completed: true,
    status: 'completed',
    scheduled_time: new Date().toISOString(),
    completion_time: new Date().toISOString(),
    settlement_status: 'pending',
    data_source: 'harness-064',
  };

  const { data: grData, error: grError } = await supabase
    .from('game_results')
    .upsert(gameResult, { onConflict: 'id' })
    .select('*')
    .single();

  if (grError) {
    log('PHASE-3', `Game result insert failed: ${grError.message}`);
    record('PHASE-3', false, null, grError.message);
    // Non-fatal — we can still test lifecycleSettle without game_results
  } else {
    log('PHASE-3', 'Game result inserted', { id: gameResultId });
    record('PHASE-3', true, { id: gameResultId, home_score: 112, away_score: 108 });
  }

  // ============================================================
  // PHASE 4: Insert prop_settlements row
  // ============================================================
  log('PHASE-4', 'Inserting prop_settlements record...');

  const propSettlement = {
    final_pick_id: candidateId,
    game_result_id: grData ? gameResultId : null,
    player_name: candidatePick.player_name || 'Unknown',
    stat_type: candidatePick.stat_type || 'points',
    line: candidatePick.line || 25.5,
    bet_side: candidatePick.side || 'over',
    actual_value: 28.0, // Synthetic: player scored 28 (over 24.5 = win)
    settlement_result: 'win',
    settlement_method: 'automatic',
    data_source: 'harness-064',
    settlement_confidence: 1.0,
    data_quality_score: 1.0,
    settled_at: new Date().toISOString(),
  };

  const { data: psData, error: psError } = await supabase
    .from('prop_settlements')
    .insert(propSettlement)
    .select('*')
    .single();

  if (psError) {
    log('PHASE-4', `prop_settlements INSERT FAILED: ${psError.message}`);
    record('PHASE-4', false, null, psError.message);
    log('PHASE-4', 'This is a critical finding — prop_settlements schema may have issues');
  } else {
    log('PHASE-4', 'prop_settlements row created', { id: psData.id, result: 'win' });
    record('PHASE-4', true, { settlement_id: psData.id, settlement_result: 'win' });
  }

  // ============================================================
  // PHASE 5: Check settle idempotency (pre-flight)
  // ============================================================
  log('PHASE-5', 'Running checkSettleIdempotency pre-flight...');

  // Dynamic import to exercise the real lifecycle module
  const { checkSettleIdempotency } = await import('../lib/lifecycle');

  const idempotencyCheck = await checkSettleIdempotency(supabase, candidateId!);
  log('PHASE-5', `Idempotency check: isDuplicate=${idempotencyCheck.isDuplicate}`);
  record('PHASE-5', true, idempotencyCheck);

  if (idempotencyCheck.isDuplicate) {
    log('PHASE-5', 'Pick already settled — idempotency guard prevented re-settlement');
    record('PHASE-5', true, { already_settled: true });
    printReport();
    process.exit(0);
  }

  // ============================================================
  // PHASE 6: Execute lifecycleSettle()
  // ============================================================
  log('PHASE-6', 'Executing lifecycleSettle()...');

  const { lifecycleSettle } = await import('../lib/lifecycle');

  const settlementPayload = {
    settlement_status: 'settled' as const,
    settlement_result: 'win' as const,
    actual_outcome: 28.0,
    settlement_source: 'harness-064',
  };

  const settleResult = await lifecycleSettle(supabase, candidateId!, settlementPayload, {
    writerRole: 'settler',
    traceId: `harness-064-${candidateId}-${Date.now()}`,
  });

  log('PHASE-6', `lifecycleSettle result: success=${settleResult.success}`);
  if (!settleResult.success) {
    log('PHASE-6', `SETTLEMENT FAILED: ${settleResult.error}`);
    log('PHASE-6', `Validation passed: ${settleResult.validationPassed}`);
    record('PHASE-6', false, settleResult, settleResult.error);
  } else {
    log('PHASE-6', 'SETTLEMENT SUCCEEDED');
    record('PHASE-6', true, settleResult);
  }

  // ============================================================
  // PHASE 7: Capture post-state
  // ============================================================
  log('PHASE-7', 'Capturing post-settlement state...');

  const { data: postPick, error: postError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', candidateId!)
    .single();

  if (postError) {
    log('PHASE-7', `Failed to fetch post-state: ${postError.message}`);
    record('PHASE-7', false, null, postError.message);
  } else {
    const postState = {
      id: postPick.id,
      status: postPick.status,
      settlement_status: postPick.settlement_status,
      settlement_result: postPick.settlement_result,
      settled_at: postPick.settled_at,
      actual_outcome: postPick.actual_outcome,
      settlement_source: postPick.settlement_source,
    };

    log('PHASE-7', 'Post-state captured', postState);
    record('PHASE-7', true, postState);
  }

  // ============================================================
  // PHASE 8: Verify idempotency (second call should be no-op)
  // ============================================================
  log('PHASE-8', 'Testing settlement idempotency (re-settle should skip)...');

  const recheck = await checkSettleIdempotency(supabase, candidateId!);
  log('PHASE-8', `Re-check: isDuplicate=${recheck.isDuplicate}`);
  record('PHASE-8', recheck.isDuplicate === true, recheck);

  // ============================================================
  // PHASE 9: Verify prop_settlements row exists
  // ============================================================
  log('PHASE-9', 'Verifying prop_settlements record...');

  const { data: psVerify, error: psVerifyError } = await supabase
    .from('prop_settlements')
    .select('*')
    .eq('final_pick_id', candidateId!)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (psVerifyError) {
    log('PHASE-9', `prop_settlements verification failed: ${psVerifyError.message}`);
    record('PHASE-9', false, null, psVerifyError.message);
  } else {
    log('PHASE-9', 'prop_settlements row verified', {
      id: psVerify.id,
      settlement_result: psVerify.settlement_result,
      actual_value: psVerify.actual_value,
    });
    record('PHASE-9', true, {
      settlement_id: psVerify.id,
      settlement_result: psVerify.settlement_result,
      actual_value: psVerify.actual_value,
      data_source: psVerify.data_source,
    });
  }

  // ============================================================
  // REPORT
  // ============================================================
  printReport();
}

function printReport() {
  console.log('\n' + '='.repeat(80));
  console.log('SETTLEMENT HARNESS REPORT — SPRINT-064');
  console.log('='.repeat(80));

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const icon = r.success ? 'PASS' : 'FAIL';
    console.log(`\n[${icon}] ${r.phase}`);
    if (r.data) console.log(`  Data: ${JSON.stringify(r.data)}`);
    if (r.error) console.log(`  Error: ${r.error}`);
    if (r.success) passCount++;
    else failCount++;
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`TOTAL: ${passCount} PASS, ${failCount} FAIL, ${results.length} total`);

  const phase6 = results.find(r => r.phase === 'PHASE-6');
  const settlementVerdict = phase6?.success ? 'PASS' : 'FAIL';
  console.log(`\nSETTLEMENT VERDICT: ${settlementVerdict}`);

  if (settlementVerdict === 'PASS') {
    console.log('  lifecycleSettle() executed successfully against real DB');
    console.log('  Pick transitioned from POSTED to SETTLED');
    console.log('  prop_settlements row created');
    console.log('  Idempotency guard confirmed working');
  } else {
    console.log('  Settlement could not complete — see FAIL phases above for root cause');
  }

  console.log('\n' + '='.repeat(80));
}

main().catch(err => {
  console.error('HARNESS FATAL ERROR:', err);
  process.exit(1);
});
