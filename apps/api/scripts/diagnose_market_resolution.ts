/**
 * MARKET-ID-TRUTH-BRIDGE-003
 * Diagnose Market Resolution Issue
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

async function diagnose() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MARKET RESOLUTION DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  // 1. What event_ids are in provider_offers?
  console.log('\n1) DISTINCT EVENT_IDs in provider_offers:');
  const { data: offerEvents } = await supabase
    .from('provider_offers')
    .select('event_id')
    .limit(100);
  const uniqueOfferEvents = [...new Set((offerEvents || []).map(e => e.event_id))];
  console.log('   ' + uniqueOfferEvents.join('\n   '));

  // 2. What event_ids are in ticket_legs?
  console.log('\n2) DISTINCT EVENT_IDs in ticket_legs:');
  const { data: legEvents } = await supabase
    .from('ticket_legs')
    .select('event_id')
    .not('event_id', 'is', null)
    .limit(100);
  const uniqueLegEvents = [...new Set((legEvents || []).map(e => e.event_id))];
  console.log('   ' + uniqueLegEvents.join('\n   '));

  // 3. Intersection
  const matching = uniqueOfferEvents.filter(e => uniqueLegEvents.includes(e));
  console.log('\n3) MATCHING EVENT_IDs (can join):');
  console.log(`   ${matching.length} matching event_ids`);
  if (matching.length > 0) console.log('   ' + matching.join('\n   '));

  // 4. Check offers with over/under odds
  console.log('\n4) OFFERS WITH over_odds/under_odds (for spread/totals):');
  const { data: ouOffers, count: ouCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact' })
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null)
    .limit(5);
  console.log(`   ${ouCount} offers with over/under odds`);
  if (ouOffers) {
    console.log(
      JSON.stringify(
        ouOffers.map((o: Record<string, unknown>) => ({
          event_id: String(o.event_id).substring(0, 8),
          market_type_id: o.market_type_id,
          provider: o.provider,
          over: o.over_odds,
          under: o.under_odds,
        })),
        null,
        2
      )
    );
  }

  // 5. Check offers with home/away odds (for moneyline)
  console.log('\n5) OFFERS WITH home_odds/away_odds (for moneyline):');
  const { data: haOffers, count: haCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact' })
    .not('home_odds', 'is', null)
    .not('away_odds', 'is', null)
    .limit(5);
  console.log(`   ${haCount} offers with home/away odds`);
  if (haOffers) {
    console.log(
      JSON.stringify(
        haOffers.map((o: Record<string, unknown>) => ({
          event_id: String(o.event_id).substring(0, 8),
          market_type_id: o.market_type_id,
          provider: o.provider,
          home: o.home_odds,
          away: o.away_odds,
        })),
        null,
        2
      )
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n  Issue 1: ticket_legs use placeholder event_ids`);
  console.log(`           (00000000-0000-0000-0001-*)`);
  console.log(`  Issue 2: provider_offers use real event_ids`);
  if (uniqueOfferEvents.length > 0) {
    console.log(`           (${uniqueOfferEvents[0].substring(0, 16)}...)`);
  }
  console.log(
    `  Issue 3: ${matching.length === 0 ? 'No' : matching.length} intersection = ${matching.length} legs can find offers`
  );

  // Return matching event_ids for use in fix
  return { uniqueOfferEvents, uniqueLegEvents, matching };
}

diagnose().catch(console.error);
