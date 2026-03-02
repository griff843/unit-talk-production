/**
 * LIVE-PIPELINE-HISTORICAL-REPLAY-001
 * Check database for replay candidates
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkReplayCandidates() {
  console.log('=== LIVE-PIPELINE-HISTORICAL-REPLAY-001 ===');
  console.log('=== REPLAY CANDIDATES CHECK ===');
  console.log('Date:', new Date().toISOString());
  console.log('');

  // Query 1: Count ticket_legs
  console.log('--- 1. TICKET_LEGS COUNT ---');
  const { count: ticketLegsCount } = await supabase
    .from('ticket_legs')
    .select('*', { count: 'exact', head: true });
  console.log('Total ticket_legs:', ticketLegsCount ?? 0);

  // Query 2: Count scored_legs
  console.log('');
  console.log('--- 2. SCORED_LEGS COUNT ---');
  const { count: scoredLegsCount } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true });
  console.log('Total scored_legs:', scoredLegsCount ?? 0);

  // Query 3: Count scored_legs with probability primitives
  console.log('');
  console.log('--- 3. SCORED_LEGS WITH PROBABILITY PRIMITIVES ---');
  const { count: withPrimitives } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('p_final', 'is', null);
  console.log('With p_final:', withPrimitives ?? 0);

  // Query 4: Count ticket_legs without scored_legs (unscored)
  console.log('');
  console.log('--- 4. UNSCORED TICKET_LEGS ---');
  // This requires a left join which Supabase JS doesn't support directly
  // Fall back to checking via RPC or select pattern
  const { data: unscoredLegs, error: e4 } = await supabase
    .from('ticket_legs')
    .select(`
      id,
      ticket_id,
      selection,
      provider_line,
      provider_odds,
      event_id,
      market_type_id,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (e4) {
    console.log('Error querying ticket_legs:', e4.message);
  } else {
    console.log('Recent ticket_legs sample:', unscoredLegs?.length ?? 0);
    if (unscoredLegs && unscoredLegs.length > 0) {
      console.log('Sample leg:', JSON.stringify(unscoredLegs[0], null, 2));
    }
  }

  // Query 5: Check provider_offers coverage
  console.log('');
  console.log('--- 5. PROVIDER_OFFERS COVERAGE ---');
  const { count: providerOffersCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });
  console.log('Total provider_offers:', providerOffersCount ?? 0);

  // Query 6: Sample provider_offers
  const { data: sampleOffers } = await supabase
    .from('provider_offers')
    .select('id, event_id, market_type_id, provider, odds_over, odds_under, line, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (sampleOffers && sampleOffers.length > 0) {
    console.log('Recent provider_offers:');
    console.log(JSON.stringify(sampleOffers, null, 2));
  } else {
    console.log('No provider_offers found');
  }

  // Query 7: Check unified_picks for historical data
  console.log('');
  console.log('--- 6. UNIFIED_PICKS (SOURCE OF TRUTH) ---');
  const { count: unifiedPicksCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });
  console.log('Total unified_picks:', unifiedPicksCount ?? 0);

  const { data: samplePicks } = await supabase
    .from('unified_picks')
    .select('id, player_name, selection, line, provider, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (samplePicks && samplePicks.length > 0) {
    console.log('Recent unified_picks:');
    console.log(JSON.stringify(samplePicks, null, 2));
  }

  // Query 8: Check tickets table
  console.log('');
  console.log('--- 7. TICKETS TABLE ---');
  const { count: ticketsCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true });
  console.log('Total tickets:', ticketsCount ?? 0);

  // Query 9: Check canonical_events
  console.log('');
  console.log('--- 8. CANONICAL_EVENTS ---');
  const { count: eventsCount } = await supabase
    .from('canonical_events')
    .select('*', { count: 'exact', head: true });
  console.log('Total canonical_events:', eventsCount ?? 0);

  console.log('');
  console.log('=== CHECK COMPLETE ===');

  // Return summary for proofs
  return {
    ticket_legs: ticketLegsCount ?? 0,
    scored_legs: scoredLegsCount ?? 0,
    scored_with_primitives: withPrimitives ?? 0,
    provider_offers: providerOffersCount ?? 0,
    unified_picks: unifiedPicksCount ?? 0,
    tickets: ticketsCount ?? 0,
    canonical_events: eventsCount ?? 0,
  };
}

checkReplayCandidates()
  .then(summary => {
    console.log('');
    console.log('=== SUMMARY JSON ===');
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
