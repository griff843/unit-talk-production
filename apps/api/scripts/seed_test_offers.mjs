#!/usr/bin/env node
/**
 * Seed Test Provider Offers
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * Seeds synthetic test data into provider_offers to demonstrate
 * the infrastructure works. For use when OddsAPI key is unavailable.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sample NBA games for testing
const TEST_GAMES = [
  { id: 'test-nba-game-001', home_team: 'Los Angeles Lakers', away_team: 'Boston Celtics' },
  { id: 'test-nba-game-002', home_team: 'Miami Heat', away_team: 'Denver Nuggets' },
  { id: 'test-nba-game-003', home_team: 'Golden State Warriors', away_team: 'Phoenix Suns' },
  { id: 'test-nba-game-004', home_team: 'Dallas Mavericks', away_team: 'Minnesota Timberwolves' },
  { id: 'test-nba-game-005', home_team: 'Milwaukee Bucks', away_team: 'Philadelphia 76ers' },
];

// Sample odds data
const SAMPLE_ODDS = [
  { home_odds: -150, away_odds: +130 },
  { home_odds: +120, away_odds: -140 },
  { home_odds: -110, away_odds: -110 },
  { home_odds: +105, away_odds: -125 },
  { home_odds: -180, away_odds: +155 },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED TEST PROVIDER OFFERS');
  console.log('  Sprint: MARKET-DATA-INGESTION-WIREUP-002');
  console.log('═══════════════════════════════════════════════════════════════');

  // Get providers
  console.log('\n📋 Loading providers...');
  const { data: providers } = await supabase.from('provider_registry').select('id, code');
  console.log(`   Found ${providers?.length || 0} providers`);

  // Get markets
  console.log('\n📋 Loading markets...');
  const { data: markets } = await supabase.from('markets').select('id, canonical_key');
  const marketMap = new Map(markets?.map(m => [m.canonical_key, m.id]) || []);
  console.log(`   Found ${marketMap.size} markets`);

  // Get market_types
  const { data: marketTypes } = await supabase.from('market_types').select('id, market_key');
  const marketTypeMap = new Map(marketTypes?.map(mt => [mt.market_key, mt.id]) || []);
  console.log(`   Found ${marketTypeMap.size} market types`);

  const moneylineMarketId = marketMap.get('game_moneyline');
  const moneylineTypeId = marketTypeMap.get('team_moneyline');

  if (!moneylineMarketId || !moneylineTypeId) {
    console.error('❌ Missing moneyline market or type');
    process.exit(1);
  }

  // Get initial count
  const { count: beforeCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });
  console.log(`\n📊 Before: provider_offers = ${beforeCount}`);

  // Create test events
  console.log('\n📋 Creating test events...');
  const eventIds = new Map();

  for (const game of TEST_GAMES) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('external_id', game.id)
      .single();

    if (existing) {
      eventIds.set(game.id, existing.id);
      console.log(`   Existing event: ${game.id}`);
    } else {
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          external_id: game.id,
          sport: 'basketball',
          league: 'NBA',
          event_type: 'game',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled',
          meta: {
            home_team: game.home_team,
            away_team: game.away_team,
            test_data: true,
          },
        })
        .select('id')
        .single();

      if (error) {
        console.log(`   ⚠ Error creating event: ${error.message}`);
      } else {
        eventIds.set(game.id, newEvent.id);
        console.log(`   Created event: ${game.id}`);
      }
    }
  }

  // Create provider offers
  console.log('\n📋 Creating provider offers...');
  const snapshotAt = new Date().toISOString();
  let inserted = 0;
  let errors = 0;

  // Use multiple providers for multi-book coverage
  const testProviders = providers?.filter(p => ['fanduel', 'draftkings', 'betmgm', 'pinnacle'].includes(p.code)) || [];

  for (let i = 0; i < TEST_GAMES.length; i++) {
    const game = TEST_GAMES[i];
    const eventId = eventIds.get(game.id);
    if (!eventId) continue;

    const odds = SAMPLE_ODDS[i % SAMPLE_ODDS.length];

    for (const provider of testProviders) {
      // Add some variance per provider
      const variance = Math.floor(Math.random() * 10) - 5;

      const offer = {
        event_id: eventId,
        market_id: moneylineMarketId,
        market_type_id: moneylineTypeId,
        provider: provider.code,
        provider_id: provider.id,
        provider_event_id: game.id,
        provider_market_key: `moneyline:${game.home_team}`,
        home_odds: odds.home_odds + variance,
        away_odds: odds.away_odds - variance,
        snapshot_at: snapshotAt,
        is_opening: false,
        is_closing: false,
        mapping_confidence: 1.0,
        meta: { test_data: true },
      };

      const { error } = await supabase.from('provider_offers').insert(offer);

      if (error) {
        if (error.code !== '23505') {
          console.log(`   ⚠ ${provider.code}/${game.id}: ${error.message}`);
          errors++;
        }
      } else {
        console.log(`   ✓ ${provider.code}/${game.id}`);
        inserted++;
      }
    }
  }

  // Get final count
  const { count: afterCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📈 Results:`);
  console.log(`   Offers inserted: ${inserted}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n📊 After: provider_offers = ${afterCount} (+${afterCount - beforeCount})`);

  // Verification
  console.log('\n✅ VERIFICATION:');
  if (afterCount > 0) {
    console.log(`   ✓ provider_offers > 0: PASS (${afterCount})`);
  } else {
    console.log(`   ✗ provider_offers > 0: FAIL (${afterCount})`);
  }

  // Check multi-book
  const { data: providerCheck } = await supabase
    .from('provider_offers')
    .select('provider_id')
    .limit(100);

  const uniqueProviders = new Set(providerCheck?.map(p => p.provider_id) || []);
  if (uniqueProviders.size >= 2) {
    console.log(`   ✓ Multi-book coverage: PASS (${uniqueProviders.size} providers)`);
  } else {
    console.log(`   ⚠ Multi-book coverage: ${uniqueProviders.size} providers`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
