/**
 * Manual Bridge Outbox Processor
 *
 * Processes pending events from bridge_outbox and writes to unified_picks
 * Bypasses BridgeWorker to work around Supabase client initialization issues
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPendingEvents() {
  console.log('🔍 Fetching pending/failed events from bridge_outbox...\n');

  const { data, error} = await supabase
    .from('bridge_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching events:', error.message);
    return [];
  }

  console.log(`✅ Found ${data?.length || 0} pending/failed events\n`);
  return data || [];
}

async function processEventToUnifiedPicks(event: any): Promise<boolean> {
  try {
    console.log(`📝 Processing event ${event.id}...`);
    console.log(`   Event Type: ${event.event_type}`);
    console.log(`   Bet Slip ID: ${event.bet_slip_id}`);

    const eventData = event.event_data;

    // Extract data from event
    const gameSelection = eventData.game_selections?.[0];
    if (!gameSelection) {
      console.error('❌ No game selection found in event data');
      return false;
    }

    // Calculate potential payout from American odds
    const stake = eventData.total_units || 1.0;
    const odds = gameSelection.leg_odds;
    let potentialPayout = stake;

    if (odds > 0) {
      // Positive odds: payout = stake + (stake * (odds / 100))
      potentialPayout = stake + (stake * (odds / 100));
    } else {
      // Negative odds: payout = stake + (stake * (100 / Math.abs(odds)))
      potentialPayout = stake + (stake * (100 / Math.abs(odds)));
    }

    // Create unified_picks entry
    const pickData = {
      id: uuidv4(),
      user_id: eventData.capper_id,
      ticket_id: eventData.bet_slip_id, // Note: unified_picks uses ticket_id not bet_slip_id
      sport: eventData.sport,
      market: gameSelection.stat_type,
      selection: gameSelection.selection,
      line: gameSelection.line,
      odds: gameSelection.leg_odds,
      stake: stake,
      potential_payout: Math.round(potentialPayout * 100) / 100, // Round to 2 decimals
      pick_type: eventData.ticket_type || 'single',
      status: 'pending', // Set to pending for approval
      confidence: Math.round((gameSelection.confidence || 0.8) * 100), // Convert 0-1 to 0-100 integer
      pick_source: 'manual',
      analysis: eventData.notes || '',
      bookmaker_key: 'fanduel', // Default bookmaker
      created_at: new Date().toISOString(),
      metadata: {
        bridge_outbox_id: event.id,
        original_event_type: event.event_type,
        processed_manually: true,
        processed_at: new Date().toISOString(),
      }
    };

    console.log(`   Writing to unified_picks...`);

    const { error: insertError } = await supabase
      .from('unified_picks')
      .insert(pickData);

    if (insertError) {
      console.error(`❌ Failed to write to unified_picks: ${insertError.message}`);

      // Update bridge_outbox with error
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'failed',
          error_message: insertError.message,
          retry_count: event.retry_count + 1,
        })
        .eq('id', event.id);

      return false;
    }

    console.log(`✅ Successfully written to unified_picks (ID: ${pickData.id})`);

    // Update bridge_outbox status to completed
    const { error: updateError } = await supabase
      .from('bridge_outbox')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (updateError) {
      console.error(`⚠️  Failed to update bridge_outbox status: ${updateError.message}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error processing event:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function verifyCommandCenterVisibility() {
  console.log('\n🎯 Verifying Command Center visibility...\n');

  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, ticket_id, sport, market, selection, line, odds, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error querying unified_picks:', error.message);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} pending picks in Command Center:\n`);
  data?.forEach((pick, i) => {
    console.log(`   Pick ${i + 1}:`);
    console.log(`   - ID: ${pick.id}`);
    console.log(`   - Ticket ID: ${pick.ticket_id}`);
    console.log(`   - ${pick.sport} ${pick.market} ${pick.selection} ${pick.line} @ ${pick.odds}`);
    console.log(`   - Status: ${pick.status}`);
    console.log(`   - Created: ${pick.created_at}`);
    console.log('');
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 MANUAL BRIDGE OUTBOX PROCESSOR');
  console.log('='.repeat(70));
  console.log('');

  // Step 1: Get pending events
  const pendingEvents = await getPendingEvents();

  if (pendingEvents.length === 0) {
    console.log('✅ No pending events to process');
    return;
  }

  // Step 2: Process each event
  let processed = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    const success = await processEventToUnifiedPicks(event);
    if (success) {
      processed++;
    } else {
      failed++;
    }
    await delay(1000); // Pause between events
  }

  // Step 3: Print results
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROCESSING RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Successfully Processed: ${processed}/${pendingEvents.length}`);
  console.log(`❌ Failed:                 ${failed}/${pendingEvents.length}`);
  console.log('='.repeat(70));

  // Step 4: Verify Command Center visibility
  if (processed > 0) {
    await verifyCommandCenterVisibility();

    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Open Command Center: http://localhost:3015');
    console.log('   2. Navigate to picks approval page');
    console.log(`   3. Approve the ${processed} test picks`);
    console.log('   4. Verify Discord posting\n');
  }
}

main().catch(error => {
  console.error('\n💥 CRITICAL ERROR:', error);
  process.exit(1);
});
