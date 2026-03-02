/**
 * MARKET-ID-TRUTH-BRIDGE-003
 * Debug participant_id mismatch for moneyline markets
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debug() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEBUG PARTICIPANT_ID MISMATCH');
  console.log('═══════════════════════════════════════════════════════════════');

  // 1. Get a moneyline ticket_leg
  const { data: mlLeg } = await supabase
    .from('ticket_legs')
    .select('id, event_id, market_type_id, participant_id, selection')
    .eq('market_type_id', 1)
    .not('event_id', 'is', null)
    .limit(1)
    .single();

  if (!mlLeg) {
    console.log('ERROR: No moneyline ticket_leg found');
    return;
  }

  console.log('\n1) MONEYLINE TICKET_LEG:');
  console.log(`   id: ${mlLeg.id}`);
  console.log(`   event_id: ${mlLeg.event_id}`);
  console.log(`   market_type_id: ${mlLeg.market_type_id}`);
  console.log(`   participant_id: ${mlLeg.participant_id}`);
  console.log(`   selection: ${mlLeg.selection}`);

  // 2. Check offers for this event with market_type_id=1
  const { data: offers } = await supabase
    .from('view_provider_offers_current_v3')
    .select(
      'id, event_id, market_type_id, participant_id, provider, home_odds, away_odds, over_odds, under_odds'
    )
    .eq('event_id', mlLeg.event_id)
    .eq('market_type_id', 1)
    .limit(10);

  console.log('\n2) OFFERS FOR THIS EVENT (market_type_id=1):');
  console.log(`   Count: ${offers ? offers.length : 0}`);
  if (offers && offers.length > 0) {
    offers.forEach((o, i) => {
      console.log(
        `   ${i + 1}. provider=${o.provider}, participant_id=${o.participant_id}, home=${o.home_odds}, away=${o.away_odds}`
      );
    });
  }

  // 3. Check what participant_id values exist in offers for this event
  const { data: participantIds } = await supabase
    .from('view_provider_offers_current_v3')
    .select('participant_id')
    .eq('event_id', mlLeg.event_id)
    .eq('market_type_id', 1);

  const uniqueParticipantIds = [...new Set((participantIds || []).map(p => p.participant_id))];
  console.log('\n3) DISTINCT PARTICIPANT_IDs IN OFFERS:');
  uniqueParticipantIds.forEach(p => console.log(`   ${p}`));

  // 4. Check if leg's participant_id matches any offer participant_id
  const legParticipantId = mlLeg.participant_id;
  const hasMatch = uniqueParticipantIds.includes(legParticipantId);
  console.log(`\n4) MATCH CHECK:`);
  console.log(`   Leg participant_id: ${legParticipantId}`);
  console.log(`   Offer participant_ids: ${uniqueParticipantIds.join(', ')}`);
  console.log(`   Match found: ${hasMatch ? '✅ YES' : '❌ NO'}`);

  // 5. Root cause diagnosis
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  if (!hasMatch && legParticipantId) {
    console.log(
      '  ISSUE: ticket_leg has participant_id but offers have different/null participant_id'
    );
    console.log(
      '  FIX: For moneyline markets, ignore participant_id filter or map to team selection'
    );
  } else if (!offers || offers.length === 0) {
    console.log('  ISSUE: No offers with home_odds/away_odds for this event');
    console.log('  Check if offers exist with over_odds/under_odds instead');
  }

  // 6. Check ALL offers for this event (regardless of market_type or odds columns)
  console.log('\n5) ALL OFFERS FOR THIS EVENT (any market type):');
  const { data: allOffers } = await supabase
    .from('view_provider_offers_current_v3')
    .select('market_type_id, provider, home_odds, away_odds, over_odds, under_odds, participant_id')
    .eq('event_id', mlLeg.event_id)
    .limit(20);

  if (allOffers && allOffers.length > 0) {
    allOffers.forEach((o, i) => {
      const partId = o.participant_id ? String(o.participant_id).substring(0, 8) : 'null';
      console.log(
        `   ${i + 1}. mkt=${o.market_type_id}, provider=${o.provider}, home=${o.home_odds}, away=${o.away_odds}, over=${o.over_odds}, under=${o.under_odds}, part=${partId}`
      );
    });
  } else {
    console.log('   No offers found at all for this event');
  }
}

debug().catch(console.error);
