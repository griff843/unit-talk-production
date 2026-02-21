#!/usr/bin/env node
/**
 * SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
 * Seed manual entry events and market types
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MANUAL_EVENTS = [
  { id: '00000000-0000-0000-0001-000000000001', external_id: 'MANUAL_ENTRY_NBA', sport: 'NBA', league: 'NBA', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000002', external_id: 'MANUAL_ENTRY_NFL', sport: 'NFL', league: 'NFL', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000003', external_id: 'MANUAL_ENTRY_MLB', sport: 'MLB', league: 'MLB', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000004', external_id: 'MANUAL_ENTRY_NHL', sport: 'NHL', league: 'NHL', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000005', external_id: 'MANUAL_ENTRY_UFC', sport: 'UFC', league: 'UFC', event_type: 'fight' },
  { id: '00000000-0000-0000-0001-000000000006', external_id: 'MANUAL_ENTRY_NCAAB', sport: 'NCAAB', league: 'NCAAB', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000007', external_id: 'MANUAL_ENTRY_NCAAF', sport: 'NCAAF', league: 'NCAAF', event_type: 'game' },
  { id: '00000000-0000-0000-0001-000000000008', external_id: 'MANUAL_ENTRY_SOCCER', sport: 'SOCCER', league: 'EPL', event_type: 'match' },
  { id: '00000000-0000-0000-0001-000000000009', external_id: 'MANUAL_ENTRY_TENNIS', sport: 'TENNIS', league: 'ATP', event_type: 'match' },
  { id: '00000000-0000-0000-0001-000000000010', external_id: 'MANUAL_ENTRY_GOLF', sport: 'GOLF', league: 'PGA', event_type: 'tournament_round' },
];

async function seedManualEvents() {
  console.log('\n=== SEEDING MANUAL ENTRY EVENTS ===\n');

  for (const event of MANUAL_EVENTS) {
    const { data, error } = await supabase
      .from('canonical_events')
      .upsert({
        id: event.id,
        external_id: event.external_id,
        sport: event.sport,
        league: event.league,
        event_type: event.event_type,
        scheduled_at: '2099-12-31T23:59:59Z',
        status: 'scheduled',
        meta: { manual_entry: true, description: `Sentinel event for manual ${event.sport} picks` }
      }, { onConflict: 'external_id' });

    if (error) {
      console.log(`  ❌ ${event.sport}: ${error.message}`);
    } else {
      console.log(`  ✅ ${event.sport}: ${event.external_id}`);
    }
  }
}

async function getSportsRegistry() {
  const { data, error } = await supabase
    .from('sports_registry')
    .select('id, code')
    .in('code', ['NBA', 'NFL', 'MLB', 'NHL', 'UFC', 'SOCCER', 'TENNIS', 'GOLF']);

  if (error) {
    console.error('Error fetching sports registry:', error.message);
    return {};
  }

  const map = {};
  data.forEach(s => map[s.code] = s.id);
  return map;
}

async function getMarketGroups() {
  const { data, error } = await supabase
    .from('market_groups')
    .select('id, code')
    .in('code', ['specials', 'gl_spread', 'player_props']);

  if (error) {
    console.error('Error fetching market groups:', error.message);
    return {};
  }

  const map = {};
  data.forEach(g => map[g.code] = g.id);
  return map;
}

async function getOutcomeTypes() {
  const { data, error } = await supabase
    .from('outcome_types')
    .select('id, code')
    .in('code', ['yes_no', 'spread', 'over_under', 'outright']);

  if (error) {
    console.error('Error fetching outcome types:', error.message);
    return {};
  }

  const map = {};
  data.forEach(o => map[o.code] = o.id);
  return map;
}

async function seedMarketTypes() {
  console.log('\n=== SEEDING MARKET TYPES ===\n');

  const sports = await getSportsRegistry();
  const groups = await getMarketGroups();
  const outcomes = await getOutcomeTypes();

  console.log('  Sports:', Object.keys(sports).join(', '));
  console.log('  Groups:', Object.keys(groups).join(', '));
  console.log('  Outcomes:', Object.keys(outcomes).join(', '));

  const marketTypes = [
    // MLB NRFI
    {
      market_key: 'nrfi',
      display_name: 'No Runs First Inning',
      sport_id: sports.MLB,
      market_group_id: groups.specials,
      outcome_type_id: outcomes.yes_no,
      participant_scope: 'NONE',
      requires_participant: false,
      requires_line: false
    },
    // MLB YRFI
    {
      market_key: 'yrfi',
      display_name: 'Yes Runs First Inning',
      sport_id: sports.MLB,
      market_group_id: groups.specials,
      outcome_type_id: outcomes.yes_no,
      participant_scope: 'NONE',
      requires_participant: false,
      requires_line: false
    },
    // NHL Puck Line
    {
      market_key: 'puck_line',
      display_name: 'Puck Line',
      sport_id: sports.NHL,
      market_group_id: groups.gl_spread,
      outcome_type_id: outcomes.spread,
      participant_scope: 'EVENT',
      requires_participant: false,
      requires_line: true
    },
    // MLB Run Line
    {
      market_key: 'run_line',
      display_name: 'Run Line',
      sport_id: sports.MLB,
      market_group_id: groups.gl_spread,
      outcome_type_id: outcomes.spread,
      participant_scope: 'EVENT',
      requires_participant: false,
      requires_line: true
    },
    // Generic Player Prop
    {
      market_key: 'player_prop_generic',
      display_name: 'Player Prop',
      sport_id: null,
      market_group_id: groups.player_props,
      outcome_type_id: outcomes.over_under,
      participant_scope: 'PLAYER',
      requires_participant: true,
      requires_line: true
    },
    // First Basket
    {
      market_key: 'first_basket',
      display_name: 'First Basket Scorer',
      sport_id: sports.NBA,
      market_group_id: groups.specials,
      outcome_type_id: outcomes.outright,
      participant_scope: 'PLAYER',
      requires_participant: true,
      requires_line: false
    },
    // Anytime TD
    {
      market_key: 'anytime_td',
      display_name: 'Anytime TD Scorer',
      sport_id: sports.NFL,
      market_group_id: groups.player_props,
      outcome_type_id: outcomes.yes_no,
      participant_scope: 'PLAYER',
      requires_participant: true,
      requires_line: false
    },
  ];

  for (const mt of marketTypes) {
    // Check if exists
    const { data: existing } = await supabase
      .from('market_types')
      .select('id')
      .eq('market_key', mt.market_key)
      .eq('sport_id', mt.sport_id)
      .maybeSingle();

    if (existing) {
      console.log(`  ⏭️  ${mt.market_key} (${mt.sport_id ? 'sport=' + mt.sport_id : 'universal'}): already exists`);
      continue;
    }

    const { data, error } = await supabase
      .from('market_types')
      .insert({
        ...mt,
        supports_alt_lines: mt.requires_line || false,
        supports_live: true,
        is_future: false,
        is_derivative: false,
        active: true
      });

    if (error) {
      console.log(`  ❌ ${mt.market_key}: ${error.message}`);
    } else {
      console.log(`  ✅ ${mt.market_key}: inserted`);
    }
  }
}

async function verifySeeding() {
  console.log('\n=== VERIFICATION ===\n');

  // Check events
  const { data: events, error: eventsError } = await supabase
    .from('canonical_events')
    .select('external_id, sport, status')
    .like('external_id', 'MANUAL_ENTRY_%');

  if (eventsError) {
    console.log('Events check failed:', eventsError.message);
  } else {
    console.log(`Manual Entry Events: ${events.length}`);
    events.forEach(e => console.log(`  - ${e.external_id} (${e.sport}) [${e.status}]`));
  }

  // Check market types
  const { data: marketTypes, error: mtError } = await supabase
    .from('market_types')
    .select('market_key, display_name, sport_id, requires_line')
    .eq('active', true)
    .order('sport_id', { ascending: true, nullsFirst: true });

  if (mtError) {
    console.log('Market types check failed:', mtError.message);
  } else {
    console.log(`\nMarket Types: ${marketTypes.length}`);
    marketTypes.forEach(mt => {
      console.log(`  - ${mt.market_key}: ${mt.display_name} (sport_id=${mt.sport_id || 'universal'}, line=${mt.requires_line})`);
    });
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084                        ║');
  console.log('║  Manual Entry Seeding                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  await seedManualEvents();
  await seedMarketTypes();
  await verifySeeding();

  console.log('\n✓ Seeding complete');
}

main().catch(console.error);
