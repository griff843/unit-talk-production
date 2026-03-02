/**
 * MARKET-ID-TRUTH-BRIDGE-003
 * Test the offerFetch fix for market-type-specific odds handling
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { fetchBookOffers, MIN_BOOKS_FOR_CONSENSUS } from '../src/lib/probability';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testFix() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MARKET-ID-TRUTH-BRIDGE-003');
  console.log('  TEST OFFER FETCH FIX');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Date:', new Date().toISOString());

  // Get a sample ticket_leg
  const { data: legs } = await supabase
    .from('ticket_legs')
    .select('id, event_id, market_type_id, participant_id')
    .not('event_id', 'is', null)
    .limit(5);

  if (!legs || legs.length === 0) {
    console.log('ERROR: No ticket_legs found');
    return;
  }

  console.log('\nTesting fetchBookOffers for each leg:');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const leg of legs) {
    console.log(`--- Leg ${leg.id.substring(0, 8)}... ---`);
    console.log(`   event_id: ${leg.event_id.substring(0, 8)}...`);
    console.log(`   market_type_id: ${leg.market_type_id}`);

    const offers = await fetchBookOffers(supabase, {
      eventId: leg.event_id,
      marketTypeId: leg.market_type_id,
      participantId: leg.participant_id,
      maxAgeHours: 24 * 30, // 30 days for testing
    });

    console.log(`   offers found: ${offers.length}`);
    if (offers.length > 0) {
      console.log(
        `   sample odds: ${offers[0].overOdds}/${offers[0].underOdds} (${offers[0].bookName})`
      );
    }
    console.log(`   status: ${offers.length >= MIN_BOOKS_FOR_CONSENSUS ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (offers.length >= MIN_BOOKS_FOR_CONSENSUS) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Test specifically for moneyline market
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TEST MONEYLINE MARKET (market_type_id=1)');
  console.log('═══════════════════════════════════════════════════════════════');

  // Find a leg with moneyline market
  const { data: mlLeg } = await supabase
    .from('ticket_legs')
    .select('id, event_id, market_type_id, participant_id')
    .eq('market_type_id', 1)
    .not('event_id', 'is', null)
    .limit(1)
    .single();

  if (mlLeg) {
    console.log(`\nMoneyline leg: ${mlLeg.id.substring(0, 8)}...`);
    console.log(`event_id: ${mlLeg.event_id}`);

    const mlOffers = await fetchBookOffers(supabase, {
      eventId: mlLeg.event_id,
      marketTypeId: mlLeg.market_type_id,
      participantId: mlLeg.participant_id,
      maxAgeHours: 24 * 30,
    });

    console.log(`\nMoneyline offers found: ${mlOffers.length}`);
    if (mlOffers.length > 0) {
      console.log('Sample offers:');
      mlOffers.slice(0, 4).forEach((o, i) => {
        console.log(`  ${i + 1}. ${o.bookName}: ${o.overOdds}/${o.underOdds}`);
      });
    }

    console.log(
      `\nStatus: ${mlOffers.length >= MIN_BOOKS_FOR_CONSENSUS ? '✅ PASS - >= 2 books' : '❌ FAIL - < 2 books'}`
    );
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Legs with >= 2 books: ${successCount}/${legs.length}`);
  console.log(`Legs with < 2 books: ${failCount}/${legs.length}`);
  console.log(`\nFix status: ${successCount > 0 ? '✅ WORKING' : '❌ NEEDS INVESTIGATION'}`);
}

testFix().catch(console.error);
