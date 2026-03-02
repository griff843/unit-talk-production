#!/usr/bin/env node
/**
 * Seed Test Tickets for CCC Validation
 * Sprint: CCC-COMPRESSION-VALIDATION-003
 *
 * Creates ticket_legs with proper event_id and market_type_id references
 * so the V3 scoring replay can compute probability primitives.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED TEST TICKETS FOR CCC VALIDATION');
  console.log('  Sprint: CCC-COMPRESSION-VALIDATION-003');
  console.log('═══════════════════════════════════════════════════════════════');

  // Get event_ids from provider_offers (these have multi-book coverage)
  const { data: offers } = await supabase
    .from('provider_offers')
    .select('event_id, market_type_id')
    .limit(100);

  const eventIds = [...new Set(offers.map(o => o.event_id))];
  const marketTypeIds = [...new Set(offers.map(o => o.market_type_id))];

  console.log(`\n📋 Found ${eventIds.length} events with provider_offers`);
  console.log(`📋 Market types: ${JSON.stringify(marketTypeIds)}`);

  // Create a test capper if needed
  let capperId;
  const { data: cappers } = await supabase.from('cappers').select('id').limit(1);
  if (cappers && cappers.length > 0) {
    capperId = cappers[0].id;
    console.log(`\n✓ Using existing capper: ${capperId}`);
  } else {
    const { data: newCapper, error: capperErr } = await supabase
      .from('cappers')
      .insert({
        discord_id: 'test_capper_001',
        display_name: 'CCC Test Capper',
        tier: 'A'
      })
      .select()
      .single();
    if (capperErr) {
      console.log('⚠ Could not create capper:', capperErr.message);
      capperId = null;
    } else {
      capperId = newCapper.id;
      console.log(`\n✓ Created test capper: ${capperId}`);
    }
  }

  // Create test tickets
  const ticketsToCreate = Math.min(5, eventIds.length);
  console.log(`\n📋 Creating ${ticketsToCreate} test tickets...`);

  let totalLegsCreated = 0;

  for (let i = 0; i < ticketsToCreate; i++) {
    const eventId = eventIds[i];

    // Create ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .insert({
        capper_id: capperId,
        status: 'pending',
        source: 'ccc_test',
        meta: { test: true, sprint: 'CCC-COMPRESSION-VALIDATION-003' }
      })
      .select()
      .single();

    if (ticketErr) {
      console.log(`   ⚠ Ticket ${i + 1} error:`, ticketErr.message);
      continue;
    }

    console.log(`   ✓ Ticket ${i + 1}: ${ticket.id}`);

    // Create 2 legs per ticket (moneyline and spread)
    for (let j = 0; j < marketTypeIds.length && j < 2; j++) {
      const marketTypeId = marketTypeIds[j];
      const selection = j === 0 ? 'home' : 'over';
      const line = j === 1 ? (Math.random() * 10 - 5).toFixed(1) : null;
      const odds = -110 + Math.floor(Math.random() * 30);

      const { error: legErr } = await supabase
        .from('ticket_legs')
        .insert({
          ticket_id: ticket.id,
          leg_index: j,
          event_id: eventId,
          market_type_id: marketTypeId,
          selection: selection,
          provider_line: line ? parseFloat(line) : null,
          provider_odds: odds,
          effective_value: {
            line: line ? parseFloat(line) : null,
            odds: odds,
            provider: 'consensus'
          }
        });

      if (legErr) {
        console.log(`      ⚠ Leg ${j} error:`, legErr.message);
      } else {
        totalLegsCreated++;
      }
    }
  }

  // Verify results
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');

  const { count: ticketCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true });
  const { count: legCount } = await supabase.from('ticket_legs').select('*', { count: 'exact', head: true });
  const { count: legWithEventId } = await supabase.from('ticket_legs').select('*', { count: 'exact', head: true }).not('event_id', 'is', null);

  console.log(`\n📊 Results:`);
  console.log(`   Total tickets: ${ticketCount}`);
  console.log(`   Total ticket_legs: ${legCount}`);
  console.log(`   Legs with event_id: ${legWithEventId}`);
  console.log(`   New legs created: ${totalLegsCreated}`);

  // Sample the new legs
  const { data: sampleLegs } = await supabase
    .from('ticket_legs')
    .select('id, event_id, market_type_id, selection')
    .not('event_id', 'is', null)
    .limit(5);

  console.log(`\n📋 Sample legs with event_id:`);
  console.log(JSON.stringify(sampleLegs, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DONE - Now run replay_v3_scoring_historical.mjs');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
