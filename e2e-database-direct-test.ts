/**
 * E2E Test - Direct Database Write Test
 *
 * Bypasses Smart Form entirely and writes directly to bridge_outbox
 * Tests the complete pipeline: bridge_outbox → BridgeWorker → unified_picks → Discord
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface TestPick {
  player: string;
  market: string;
  line: number;
  odds: number;
  selection: 'over' | 'under';
}

const TEST_PICKS: TestPick[] = [
  { player: 'Patrick Mahomes', market: 'Passing Yards', line: 275.5, odds: -110, selection: 'over' },
  { player: 'Travis Kelce', market: 'Receiving Yards', line: 65.5, odds: -115, selection: 'over' },
  { player: 'Isiah Pacheco', market: 'Rushing Yards', line: 55.5, odds: -110, selection: 'under' }
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findGriff843UserId(): Promise<string | null> {
  console.log('🔍 Looking up Griff843 user ID...');

  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .ilike('username', 'griff843')
    .single();

  if (error || !data) {
    console.error('❌ Could not find Griff843:', error?.message);
    return null;
  }

  console.log(`✅ Found user: ${data.username} (ID: ${data.id})`);
  return data.id;
}

async function writeToBridgeOutbox(
  capperId: string,
  pick: TestPick,
  pickNumber: number
): Promise<string | null> {
  try {
    console.log(`\n📝 Writing Pick ${pickNumber}/3 to bridge_outbox...`);
    console.log(`   Player: ${pick.player}`);
    console.log(`   Market: ${pick.market} ${pick.selection} ${pick.line}`);
    console.log(`   Odds: ${pick.odds}`);

    const betSlipId = uuidv4();

    const ticketData = {
      bet_slip_id: betSlipId,
      capper_id: capperId,
      sport: 'NFL',
      ticket_type: 'single',
      game_selections: [
        {
          sport: 'NFL',
          stat_type: pick.market,
          line: pick.line,
          leg_odds: pick.odds,
          source: 'manual',
          is_live: false,
          selection: pick.selection,
          confidence: 0.8,
        }
      ],
      status: 'submitted',
      selection_count: 1,
      total_units: 1.0,
      notes: `E2E Test Pick ${pickNumber} - ${pick.player} ${pick.market} ${pick.selection} ${pick.line}`,
    };

    const outboxEntry = {
      event_type: 'ticket_submitted',
      event_data: ticketData,
      bet_slip_id: betSlipId,
      status: 'pending',
      retry_count: 0,
    };

    const { error } = await supabase
      .from('bridge_outbox')
      .insert(outboxEntry);

    if (error) {
      console.error(`❌ Failed to write to bridge_outbox: ${error.message}`);
      return null;
    }

    console.log(`✅ Written to bridge_outbox: ${betSlipId}`);
    return betSlipId;
  } catch (error) {
    console.error(`❌ Error writing pick ${pickNumber}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function verifyBridgeOutbox(betSlipId: string): Promise<boolean> {
  try {
    console.log(`\n🔎 Verifying bridge_outbox entry for ${betSlipId}...`);

    const { data, error } = await supabase
      .from('bridge_outbox')
      .select('*')
      .eq('bet_slip_id', betSlipId)
      .single();

    if (error || !data) {
      console.error(`❌ bridge_outbox entry not found: ${error?.message}`);
      return false;
    }

    console.log(`✅ bridge_outbox entry verified`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Event Type: ${data.event_type}`);
    console.log(`   Retry Count: ${data.retry_count}`);

    return true;
  } catch (error) {
    console.error(`❌ Verification error:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function waitForBridgeWorkerProcessing(betSlipId: string, maxWaitSeconds: number = 30): Promise<boolean> {
  console.log(`\n⏳ Waiting for BridgeWorker to process ${betSlipId}...`);
  console.log(`   Max wait: ${maxWaitSeconds}s`);

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, status, bet_slip_id, created_at')
      .eq('bet_slip_id', betSlipId)
      .maybeSingle();

    if (error) {
      console.error(`❌ Error checking unified_picks: ${error.message}`);
      await delay(2000);
      continue;
    }

    if (data) {
      console.log(`\n✅ Pick processed and written to unified_picks!`);
      console.log(`   Pick ID: ${data.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Created: ${data.created_at}`);
      return true;
    }

    // Also check if bridge_outbox status changed
    const { data: outboxData } = await supabase
      .from('bridge_outbox')
      .select('status, retry_count')
      .eq('bet_slip_id', betSlipId)
      .single();

    if (outboxData) {
      process.stdout.write(`.${outboxData.status[0]}`);
    } else {
      process.stdout.write('.');
    }

    await delay(2000);
  }

  console.error(`\n❌ Timeout: Pick not processed within ${maxWaitSeconds}s`);

  // Show final outbox state
  const { data: finalOutbox } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('bet_slip_id', betSlipId)
    .single();

  if (finalOutbox) {
    console.error(`   Final outbox status: ${finalOutbox.status}`);
    console.error(`   Retry count: ${finalOutbox.retry_count}`);
  }

  return false;
}

async function checkCommandCenterVisibility(betSlipId: string): Promise<boolean> {
  console.log(`\n🎯 Checking Command Center visibility for ${betSlipId}...`);

  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, bet_slip_id, status, created_at')
      .eq('bet_slip_id', betSlipId)
      .single();

    if (error || !data) {
      console.error(`❌ Pick not found in unified_picks: ${error?.message}`);
      return false;
    }

    console.log(`✅ Pick visible in Command Center`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Can be approved: ${data.status === 'pending' || data.status === 'submitted'}`);
    return true;
  } catch (error) {
    console.error(`❌ Error checking Command Center:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function runE2ETest() {
  console.log('='.repeat(70));
  console.log('🚀 E2E DATABASE DIRECT TEST - bridge_outbox → BridgeWorker → unified_picks');
  console.log('='.repeat(70));

  // Step 1: Lookup Griff843
  const capperId = await findGriff843UserId();
  if (!capperId) {
    console.error('\n❌ TEST FAILED: Could not find Griff843 user');
    process.exit(1);
  }

  const results = {
    written: 0,
    outboxVerified: 0,
    bridgeProcessed: 0,
    commandCenterVisible: 0,
  };

  // Step 2: Write 3 picks directly to bridge_outbox
  for (let i = 0; i < TEST_PICKS.length; i++) {
    const pick = TEST_PICKS[i];
    const betSlipId = await writeToBridgeOutbox(capperId, pick, i + 1);

    if (!betSlipId) {
      console.error(`❌ Pick ${i + 1} write failed`);
      continue;
    }

    results.written++;

    // Verify outbox write
    const outboxVerified = await verifyBridgeOutbox(betSlipId);
    if (outboxVerified) {
      results.outboxVerified++;
    }

    // Wait for bridge worker processing
    const bridgeProcessed = await waitForBridgeWorkerProcessing(betSlipId, 30);
    if (bridgeProcessed) {
      results.bridgeProcessed++;

      // Check Command Center visibility
      const commandCenterVisible = await checkCommandCenterVisibility(betSlipId);
      if (commandCenterVisible) {
        results.commandCenterVisible++;
      }
    }

    await delay(2000); // Pause between picks
  }

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('📊 E2E TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Picks Written:          ${results.written}/${TEST_PICKS.length}`);
  console.log(`✅ Outbox Verified:        ${results.outboxVerified}/${TEST_PICKS.length}`);
  console.log(`✅ Bridge Processed:       ${results.bridgeProcessed}/${TEST_PICKS.length}`);
  console.log(`✅ Command Center Visible: ${results.commandCenterVisible}/${TEST_PICKS.length}`);
  console.log('='.repeat(70));

  if (results.written === TEST_PICKS.length &&
      results.outboxVerified === TEST_PICKS.length &&
      results.bridgeProcessed === TEST_PICKS.length &&
      results.commandCenterVisible === TEST_PICKS.length) {
    console.log('\n🎉 ALL TESTS PASSED - GREEN ACROSS THE BOARD!');
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Open Command Center: http://localhost:3015');
    console.log('   2. Navigate to picks approval');
    console.log('   3. Approve the 3 test picks');
    console.log('   4. Verify Discord posting');
    process.exit(0);
  } else {
    console.log('\n⚠️ SOME STEPS INCOMPLETE - Review logs above');
    console.log('\n💡 TROUBLESHOOTING:');
    if (results.bridgeProcessed < TEST_PICKS.length) {
      console.log('   - Check if BridgeWorker is running');
      console.log('   - Check bridge_outbox table for stuck events');
      console.log('   - Review BridgeWorker logs for errors');
    }
    process.exit(1);
  }
}

runE2ETest().catch(error => {
  console.error('\n💥 CRITICAL ERROR:', error);
  process.exit(1);
});
