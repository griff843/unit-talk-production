#!/usr/bin/env node
/**
 * Trigger Odds Ingestion Script
 * Sprint: MARKET-DATA-INGESTION-WIREUP-002
 *
 * Manual/scheduler hook to trigger market data ingestion.
 *
 * Usage:
 *   node apps/api/scripts/trigger_odds_ingestion.mjs [--sport <sport>] [--force]
 *
 * Options:
 *   --sport <sport>  Specific sport to ingest (basketball_nba, americanfootball_nfl, etc.)
 *   --force          Force refresh (bypass cache)
 *   --all            Ingest all supported sports
 *
 * Environment:
 *   SUPABASE_URL              Required
 *   SUPABASE_SERVICE_ROLE_KEY Required
 *   ODDS_API_KEY              Required
 */

import { createClient } from '@supabase/supabase-js';

// Configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  sport: null,
  force: false,
  all: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sport' && args[i + 1]) {
    flags.sport = args[++i];
  } else if (args[i] === '--force') {
    flags.force = true;
  } else if (args[i] === '--all') {
    flags.all = true;
  }
}

// Supported sports
const SUPPORTED_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
];

// Bookmaker to provider mapping
const BOOKMAKER_TO_PROVIDER = {
  fanduel: 'fanduel',
  draftkings: 'draftkings',
  betmgm: 'betmgm',
  caesars: 'caesars',
  pointsbetus: 'pointsbet',
  williamhill_us: 'caesars',
  betrivers: 'betrivers',
  espnbet: 'espnbet',
  pinnacle: 'pinnacle',
};

// Market key mapping
const MARKET_KEY_MAP = {
  h2h: 'moneyline',
  spreads: 'spread',
  totals: 'total',
};

/**
 * Validate environment
 */
function validateEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ODDS_API_KEY) missing.push('ODDS_API_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

/**
 * Fetch odds from OddsAPI
 */
async function fetchOdds(sportKey, markets = ['h2h', 'spreads', 'totals']) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set('apiKey', ODDS_API_KEY);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', markets.join(','));
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');

  console.log(`📡 Fetching odds for ${sportKey}...`);
  const startTime = Date.now();

  const response = await fetch(url.toString());
  const latencyMs = Date.now() - startTime;
  const remainingCredits = response.headers.get('x-requests-remaining');

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OddsAPI error ${response.status}: ${errorText}`);
  }

  const games = await response.json();
  console.log(`✓ Fetched ${games.length} games in ${latencyMs}ms (credits remaining: ${remainingCredits})`);

  return { games, remainingCredits, latencyMs };
}

/**
 * Transform games to V3 offer payloads
 */
function transformToPayloads(games) {
  const payloadsByProvider = new Map();

  for (const game of games) {
    for (const bookmaker of game.bookmakers) {
      const providerKey = BOOKMAKER_TO_PROVIDER[bookmaker.key];
      if (!providerKey) continue;

      if (!payloadsByProvider.has(providerKey)) {
        payloadsByProvider.set(providerKey, []);
      }

      const payloads = payloadsByProvider.get(providerKey);

      for (const market of bookmaker.markets) {
        const marketKey = MARKET_KEY_MAP[market.key];
        if (!marketKey) continue;

        for (const outcome of market.outcomes) {
          const payload = {
            provider_event_id: game.id,
            provider_market_key: `${marketKey}:${outcome.name}`,
            sport_key: game.sport_key,
            home_team: game.home_team,
            away_team: game.away_team,
            commence_time: game.commence_time,
            snapshot_at: new Date().toISOString(),
          };

          // Map odds
          if (market.key === 'h2h') {
            if (outcome.name === game.home_team) {
              payload.home_odds = outcome.price;
            } else {
              payload.away_odds = outcome.price;
            }
          } else if (market.key === 'spreads') {
            payload.line = outcome.point;
            if (outcome.name === game.home_team) {
              payload.over_odds = outcome.price;
            } else {
              payload.under_odds = outcome.price;
            }
          } else if (market.key === 'totals') {
            payload.line = outcome.point;
            if (outcome.name === 'Over') {
              payload.over_odds = outcome.price;
            } else {
              payload.under_odds = outcome.price;
            }
          }

          payloads.push(payload);
        }
      }
    }
  }

  return payloadsByProvider;
}

/**
 * Ingest offers for a single provider
 */
async function ingestProvider(supabase, providerKey, offers) {
  const capturedAt = new Date().toISOString();

  const { data, error } = await supabase.rpc('upsert_provider_offers_bootstrap', {
    p_provider_key: providerKey,
    p_captured_at: capturedAt,
    p_offers: offers,
  });

  if (error) {
    console.error(`  ❌ ${providerKey}: ${error.message}`);
    return { inserted: 0, updated: 0 };
  }

  const result = data?.[0] || { inserted_count: 0, updated_count: 0, events_created: 0 };
  console.log(`  ✓ ${providerKey}: ${result.inserted_count} inserted, ${result.updated_count} updated, ${result.events_created} events created`);

  return {
    inserted: result.inserted_count || 0,
    updated: result.updated_count || 0,
    eventsCreated: result.events_created || 0,
  };
}

/**
 * Log credit usage
 */
async function logCreditUsage(supabase, sportKey, latencyMs, remainingCredits) {
  await supabase.from('api_credit_log').insert({
    provider: 'odds_api',
    endpoint: `/v4/sports/${sportKey}/odds`,
    credits_used: 1,
    response_status: 200,
    latency_ms: latencyMs,
    remaining_credits: remainingCredits ? parseInt(remainingCredits, 10) : null,
    meta: { source: 'trigger_odds_ingestion.mjs' },
  });
}

/**
 * Ingest a single sport
 */
async function ingestSport(supabase, sportKey) {
  console.log(`\n🏀 Ingesting ${sportKey}...`);

  try {
    // Fetch odds
    const { games, remainingCredits, latencyMs } = await fetchOdds(sportKey);

    // Log credit usage
    await logCreditUsage(supabase, sportKey, latencyMs, remainingCredits);

    if (games.length === 0) {
      console.log('  ⚠ No games returned');
      return { sportKey, inserted: 0, updated: 0, error: null };
    }

    // Transform to payloads
    const payloadsByProvider = transformToPayloads(games);
    console.log(`  Found ${payloadsByProvider.size} providers with offers`);

    // Ingest each provider
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const [providerKey, offers] of payloadsByProvider) {
      const result = await ingestProvider(supabase, providerKey, offers);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
    }

    return { sportKey, inserted: totalInserted, updated: totalUpdated, error: null };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { sportKey, inserted: 0, updated: 0, error: error.message };
  }
}

/**
 * Get current stats
 */
async function getStats(supabase) {
  const [offersResult, quarantineResult, eventsResult] = await Promise.all([
    supabase.from('provider_offers').select('id', { count: 'exact', head: true }),
    supabase.from('offer_quarantine').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('canonical_events').select('id', { count: 'exact', head: true }),
  ]);

  return {
    provider_offers: offersResult.count || 0,
    offer_quarantine: quarantineResult.count || 0,
    canonical_events: eventsResult.count || 0,
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MARKET DATA INGESTION');
  console.log('  Sprint: MARKET-DATA-INGESTION-WIREUP-002');
  console.log('═══════════════════════════════════════════════════════════════');

  validateEnv();

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get initial stats
  const beforeStats = await getStats(supabase);
  console.log(`\n📊 Before ingestion:`);
  console.log(`   provider_offers: ${beforeStats.provider_offers}`);
  console.log(`   canonical_events: ${beforeStats.canonical_events}`);
  console.log(`   offer_quarantine: ${beforeStats.offer_quarantine}`);

  // Determine sports to ingest
  let sportsToIngest = [];
  if (flags.sport) {
    sportsToIngest = [flags.sport];
  } else if (flags.all) {
    sportsToIngest = SUPPORTED_SPORTS;
  } else {
    // Default: just NBA for efficiency
    sportsToIngest = ['basketball_nba'];
  }

  console.log(`\n🎯 Sports to ingest: ${sportsToIngest.join(', ')}`);

  // Ingest each sport
  const results = [];
  for (const sportKey of sportsToIngest) {
    const result = await ingestSport(supabase, sportKey);
    results.push(result);

    // Rate limit between sports
    if (sportsToIngest.indexOf(sportKey) < sportsToIngest.length - 1) {
      console.log('  ⏳ Waiting 1s for rate limit...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Get final stats
  const afterStats = await getStats(supabase);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const errors = results.filter((r) => r.error);

  console.log(`\n📈 Results:`);
  console.log(`   Total inserted: ${totalInserted}`);
  console.log(`   Total updated: ${totalUpdated}`);
  console.log(`   Errors: ${errors.length}`);

  console.log(`\n📊 After ingestion:`);
  console.log(`   provider_offers: ${afterStats.provider_offers} (+${afterStats.provider_offers - beforeStats.provider_offers})`);
  console.log(`   canonical_events: ${afterStats.canonical_events} (+${afterStats.canonical_events - beforeStats.canonical_events})`);
  console.log(`   offer_quarantine: ${afterStats.offer_quarantine}`);

  // Verification
  console.log('\n✅ VERIFICATION:');
  if (afterStats.provider_offers > 0) {
    console.log(`   ✓ provider_offers > 0: PASS (${afterStats.provider_offers})`);
  } else {
    console.log(`   ✗ provider_offers > 0: FAIL (${afterStats.provider_offers})`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
