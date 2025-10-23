import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';
const COMMAND_CENTER_URL = 'http://localhost:3015';
const SMART_FORM_API_URL = 'http://localhost:3021';

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

async function submitPickDirectlyToAPI(
  capperId: string,
  pick: TestPick,
  pickNumber: number
): Promise<string | null> {
  try {
    console.log(`\n📝 Submitting Pick ${pickNumber}/3 via API...`);
    console.log(`   Player: ${pick.player}`);
    console.log(`   Market: ${pick.market} ${pick.selection} ${pick.line}`);
    console.log(`   Odds: ${pick.odds}`);

    const ticketData = {
      capper_id: capperId,
      sport: 'NFL',
      ticket_type: 'single',
      selections: [
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
      total_units: 1.0,
      notes: `E2E Test Pick ${pickNumber} - ${pick.player} ${pick.market} ${pick.selection} ${pick.line}`,
    };

    const response = await fetch(`${SMART_FORM_API_URL}/api/submit-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticketData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`✅ API response: ${result.bet_slip_id}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Processing: ${result.processing_status}`);

    return result.bet_slip_id;
  } catch (error) {
    console.error(`❌ Error submitting pick ${pickNumber}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function verifyDatabaseWrite(betSlipId: string): Promise<boolean> {
  try {
    console.log(`\n🔎 Verifying database write for ${betSlipId}...`);

    // Check bridge_outbox
    const { data: outboxData, error: outboxError } = await supabase
      .from('bridge_outbox')
      .select('*')
      .eq('bet_slip_id', betSlipId)
      .single();

    if (outboxError || !outboxData) {
      console.error(`❌ bridge_outbox entry not found: ${outboxError?.message}`);
      return false;
    }

    console.log(`✅ bridge_outbox entry found`);
    console.log(`   Status: ${outboxData.status}`);
    console.log(`   Event Type: ${outboxData.event_type}`);

    return true;
  } catch (error) {
    console.error(`❌ Database verification error:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function waitForBridgeWorkerProcessing(betSlipId: string, maxWaitSeconds: number = 30): Promise<boolean> {
  console.log(`\n⏳ Waiting for BridgeWorker to process ${betSlipId}...`);

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, status, bet_slip_id')
      .eq('bet_slip_id', betSlipId)
      .maybeSingle();

    if (error) {
      console.error(`❌ Error checking unified_picks: ${error.message}`);
      await delay(2000);
      continue;
    }

    if (data) {
      console.log(`✅ Pick processed and written to unified_picks`);
      console.log(`   Pick ID: ${data.id}`);
      console.log(`   Status: ${data.status}`);
      return true;
    }

    await delay(2000);
    process.stdout.write('.');
  }

  console.error(`\n❌ Timeout: Pick not processed within ${maxWaitSeconds}s`);
  return false;
}

async function runE2ETest() {
  console.log('='.repeat(70));
  console.log('🚀 E2E API DIRECT TEST - Smart Form → Database → Discord');
  console.log('='.repeat(70));

  // Step 1: Lookup Griff843
  const capperId = await findGriff843UserId();
  if (!capperId) {
    console.error('\n❌ TEST FAILED: Could not find Griff843 user');
    process.exit(1);
  }

  const results = {
    submitted: 0,
    databaseVerified: 0,
    bridgeProcessed: 0,
  };

  // Step 2: Submit 3 picks via API
  for (let i = 0; i < TEST_PICKS.length; i++) {
    const pick = TEST_PICKS[i];
    const betSlipId = await submitPickDirectlyToAPI(capperId, pick, i + 1);

    if (!betSlipId) {
      console.error(`❌ Pick ${i + 1} submission failed`);
      continue;
    }

    results.submitted++;

    // Verify database write
    const dbVerified = await verifyDatabaseWrite(betSlipId);
    if (dbVerified) {
      results.databaseVerified++;
    }

    // Wait for bridge worker processing
    const bridgeProcessed = await waitForBridgeWorkerProcessing(betSlipId, 30);
    if (bridgeProcessed) {
      results.bridgeProcessed++;
    }

    await delay(2000); // Pause between picks
  }

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('📊 E2E TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Picks Submitted:        ${results.submitted}/${TEST_PICKS.length}`);
  console.log(`✅ Database Verified:      ${results.databaseVerified}/${TEST_PICKS.length}`);
  console.log(`✅ Bridge Processed:       ${results.bridgeProcessed}/${TEST_PICKS.length}`);
  console.log('='.repeat(70));

  if (results.submitted === TEST_PICKS.length &&
      results.databaseVerified === TEST_PICKS.length &&
      results.bridgeProcessed === TEST_PICKS.length) {
    console.log('\n🎉 ALL TESTS PASSED - GREEN ACROSS THE BOARD!');
    process.exit(0);
  } else {
    console.log('\n⚠️ SOME STEPS INCOMPLETE - Review logs above');
    process.exit(1);
  }
}

runE2ETest().catch(error => {
  console.error('\n💥 CRITICAL ERROR:', error);
  process.exit(1);
});
