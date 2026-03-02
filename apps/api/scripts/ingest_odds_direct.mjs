#!/usr/bin/env node
/**
 * Direct Odds Ingestion Script
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * Fetches odds from OddsAPI and inserts directly into provider_offers.
 * Does NOT rely on SQL functions - uses direct Supabase JS client.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

if (!ODDS_API_KEY) {
  console.error('❌ ODDS_API_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// OddsAPI bookmaker key → provider_registry code mapping
const BOOKMAKER_TO_PROVIDER = {
  fanduel: 'fanduel',
  draftkings: 'draftkings',
  betmgm: 'betmgm',
  caesars: 'caesars',
  williamhill_us: 'caesars',
  espnbet: 'espn_bet',
  bet365: 'bet365',
  pinnacle: 'pinnacle',
};

// Market mappings
const MARKET_MAPPINGS = {
  h2h: { market_key: 'game_moneyline', type_key: 'team_moneyline' },
  spreads: { market_key: 'game_spread', type_key: 'team_spread' },
  totals: { market_key: 'game_total', type_key: 'game_total' },
};

// Cache for lookups
const cache = {
  providers: new Map(),
  markets: new Map(),
  marketTypes: new Map(),
  events: new Map(),
};

async function loadCache() {
  console.log('\n📋 Loading cache...');

  // Load providers
  const { data: providers } = await supabase.from('provider_registry').select('id, code');
  for (const p of providers || []) {
    cache.providers.set(p.code, p.id);
  }
  console.log(`   Providers: ${cache.providers.size}`);

  // Load markets
  const { data: markets } = await supabase.from('markets').select('id, canonical_key');
  for (const m of markets || []) {
    cache.markets.set(m.canonical_key, m.id);
  }
  console.log(`   Markets: ${cache.markets.size}`);

  // Load market_types
  const { data: marketTypes } = await supabase.from('market_types').select('id, market_key');
  for (const mt of marketTypes || []) {
    cache.marketTypes.set(mt.market_key, mt.id);
  }
  console.log(`   Market types: ${cache.marketTypes.size}`);

  // Load existing events
  const { data: events } = await supabase.from('events').select('id, external_id');
  for (const e of events || []) {
    if (e.external_id) {
      cache.events.set(e.external_id, e.id);
    }
  }
  console.log(`   Events: ${cache.events.size}`);
}

async function getOrCreateEvent(game) {
  // Check cache first
  if (cache.events.has(game.id)) {
    return cache.events.get(game.id);
  }

  // Check database
  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('external_id', game.id)
    .single();

  if (existing) {
    cache.events.set(game.id, existing.id);
    return existing.id;
  }

  // Create new event
  const sport = game.sport_key.includes('nba') ? 'basketball' :
                game.sport_key.includes('nfl') ? 'football' :
                game.sport_key.includes('mlb') ? 'baseball' :
                game.sport_key.includes('nhl') ? 'hockey' : 'other';

  const league = game.sport_key.includes('nba') ? 'NBA' :
                 game.sport_key.includes('nfl') ? 'NFL' :
                 game.sport_key.includes('mlb') ? 'MLB' :
                 game.sport_key.includes('nhl') ? 'NHL' : game.sport_key;

  const { data: newEvent, error } = await supabase
    .from('events')
    .insert({
      external_id: game.id,
      sport: sport,
      league: league,
      event_type: 'game',
      scheduled_at: game.commence_time,
      status: 'scheduled',
      meta: {
        home_team: game.home_team,
        away_team: game.away_team,
        provider_sport_key: game.sport_key,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.log(`   ⚠ Error creating event for ${game.id}: ${error.message}`);
    return null;
  }

  cache.events.set(game.id, newEvent.id);
  return newEvent.id;
}

async function fetchOdds(sportKey, markets = ['h2h', 'spreads', 'totals']) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set('apiKey', ODDS_API_KEY);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', markets.join(','));
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');

  console.log(`\n📡 Fetching odds for ${sportKey}...`);
  const startTime = Date.now();

  const response = await fetch(url.toString());
  const latencyMs = Date.now() - startTime;
  const remainingCredits = response.headers.get('x-requests-remaining');

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OddsAPI error ${response.status}: ${errorText}`);
  }

  const games = await response.json();
  console.log(`   ✓ Fetched ${games.length} games in ${latencyMs}ms (credits remaining: ${remainingCredits})`);

  // Log credit usage
  await supabase.from('api_credit_log').insert({
    provider: 'odds_api',
    endpoint: `/v4/sports/${sportKey}/odds`,
    credits_used: 1,
    response_status: response.status,
    latency_ms: latencyMs,
    remaining_credits: remainingCredits ? parseInt(remainingCredits, 10) : null,
    meta: { markets, gamesReturned: games.length },
  });

  return games;
}

async function ingestGame(game, snapshotAt) {
  const eventId = await getOrCreateEvent(game);
  if (!eventId) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const bookmaker of game.bookmakers) {
    const providerCode = BOOKMAKER_TO_PROVIDER[bookmaker.key];
    if (!providerCode) {
      continue;
    }

    const providerId = cache.providers.get(providerCode);
    if (!providerId) {
      console.log(`   ⚠ Provider not found: ${providerCode}`);
      continue;
    }

    for (const market of bookmaker.markets) {
      const marketMapping = MARKET_MAPPINGS[market.key];
      if (!marketMapping) continue;

      const marketId = cache.markets.get(marketMapping.market_key);
      const marketTypeId = cache.marketTypes.get(marketMapping.type_key);

      if (!marketId) {
        console.log(`   ⚠ Market not found: ${marketMapping.market_key}`);
        continue;
      }

      for (const outcome of market.outcomes) {
        const offer = {
          event_id: eventId,
          market_id: marketId,
          market_type_id: marketTypeId,
          provider: providerCode,
          provider_id: providerId,
          provider_event_id: game.id,
          provider_market_key: `${market.key}:${outcome.name}`,
          snapshot_at: snapshotAt,
          is_opening: false,
          is_closing: false,
          mapping_confidence: 1.0,
          meta: { bookmaker: bookmaker.title },
        };

        // Set odds based on market type
        if (market.key === 'h2h') {
          if (outcome.name === game.home_team) {
            offer.home_odds = outcome.price;
          } else if (outcome.name === game.away_team) {
            offer.away_odds = outcome.price;
          }
        } else if (market.key === 'spreads') {
          offer.line = outcome.point;
          if (outcome.name === game.home_team) {
            offer.over_odds = outcome.price;
          } else {
            offer.under_odds = outcome.price;
          }
        } else if (market.key === 'totals') {
          offer.line = outcome.point;
          if (outcome.name === 'Over') {
            offer.over_odds = outcome.price;
          } else if (outcome.name === 'Under') {
            offer.under_odds = outcome.price;
          }
        }

        // Insert into provider_offers
        const { error } = await supabase.from('provider_offers').insert(offer);

        if (error) {
          if (error.code === '23505') {
            // Duplicate - skip
            skipped++;
          } else {
            console.log(`   ⚠ Insert error: ${error.message}`);
          }
        } else {
          inserted++;
        }
      }
    }
  }

  return { inserted, skipped };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DIRECT ODDS INGESTION');
  console.log('  Sprint: MARKET-DATA-INGESTION-WIREUP-002');
  console.log('═══════════════════════════════════════════════════════════════');

  // Load cache
  await loadCache();

  // Get initial stats
  const { count: beforeCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });
  console.log(`\n📊 Before: provider_offers = ${beforeCount}`);

  // Sports to ingest
  const sports = ['basketball_nba'];
  const snapshotAt = new Date().toISOString();

  let totalInserted = 0;
  let totalSkipped = 0;
  let eventsCreated = 0;
  const eventsBefore = cache.events.size;

  for (const sportKey of sports) {
    try {
      const games = await fetchOdds(sportKey);

      for (const game of games) {
        const result = await ingestGame(game, snapshotAt);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      }
    } catch (error) {
      console.log(`   ❌ Error ingesting ${sportKey}: ${error.message}`);
    }
  }

  eventsCreated = cache.events.size - eventsBefore;

  // Get final stats
  const { count: afterCount } = await supabase.from('provider_offers').select('id', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📈 Results:`);
  console.log(`   Offers inserted: ${totalInserted}`);
  console.log(`   Offers skipped (duplicate): ${totalSkipped}`);
  console.log(`   Events created: ${eventsCreated}`);
  console.log(`\n📊 After: provider_offers = ${afterCount} (+${afterCount - beforeCount})`);

  // Verification
  console.log('\n✅ VERIFICATION:');
  if (afterCount > 0) {
    console.log(`   ✓ provider_offers > 0: PASS (${afterCount})`);
  } else {
    console.log(`   ✗ provider_offers > 0: FAIL (${afterCount})`);
  }

  // Check multi-book
  const { data: providers } = await supabase
    .from('provider_offers')
    .select('provider_id')
    .limit(100);

  const uniqueProviders = new Set(providers?.map(p => p.provider_id) || []);
  if (uniqueProviders.size >= 2) {
    console.log(`   ✓ Multi-book coverage: PASS (${uniqueProviders.size} providers)`);
  } else {
    console.log(`   ⚠ Multi-book coverage: ${uniqueProviders.size} providers`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
