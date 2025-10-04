#!/usr/bin/env tsx
/**
 * FULL October 2, 2025 Ingestion with ALL Markets
 * 1 API call per event - maximizes efficiency
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import axios from 'axios';
import { syncGameMetadata } from '../../services/GameMetadataSync';
import { transformGamesToUnifiedPicks } from '../../agents/FeedAgent/transform';
import { upsertUnifiedPicksCore } from '../../services/unifiedPicksWriter';

// ALL 59 NFL markets (32 standard + 27 alternates)
const ALL_NFL_MARKETS = [
  'h2h', 'spreads', 'totals',
  // Standard markets (32)
  'player_pass_yds', 'player_pass_tds', 'player_pass_attempts', 'player_pass_completions',
  'player_pass_interceptions', 'player_pass_longest_completion', 'player_pass_yds_q1',
  'player_rush_yds', 'player_rush_tds', 'player_rush_attempts', 'player_rush_longest',
  'player_receptions', 'player_reception_longest', 'player_reception_tds', 'player_reception_yds',
  'player_anytime_td', 'player_1st_td', 'player_last_td', 'player_tds_over',
  'player_pass_rush_yds', 'player_pass_rush_reception_tds', 'player_pass_rush_reception_yds',
  'player_rush_reception_tds', 'player_rush_reception_yds',
  'player_field_goals', 'player_kicking_points', 'player_pats',
  'player_assists', 'player_defensive_interceptions', 'player_sacks',
  'player_solo_tackles', 'player_tackles_assists',
  // Alternate markets (27)
  'player_pass_yds_alternate', 'player_pass_tds_alternate', 'player_pass_attempts_alternate',
  'player_pass_completions_alternate', 'player_pass_interceptions_alternate',
  'player_pass_longest_completion_alternate', 'player_pass_rush_yds_alternate',
  'player_rush_yds_alternate', 'player_rush_tds_alternate', 'player_rush_attempts_alternate',
  'player_rush_longest_alternate', 'player_receptions_alternate',
  'player_reception_longest_alternate', 'player_reception_tds_alternate',
  'player_reception_yds_alternate', 'player_pass_rush_reception_tds_alternate',
  'player_pass_rush_reception_yds_alternate', 'player_rush_reception_tds_alternate',
  'player_rush_reception_yds_alternate', 'player_field_goals_alternate',
  'player_kicking_points_alternate', 'player_pats_alternate', 'player_assists_alternate',
  'player_defensive_interceptions_alternate', 'player_sacks_alternate',
  'player_solo_tackles_alternate', 'player_tackles_assists_alternate'
];

// ALL 19 MLB markets (11 standard + 8 alternates)
const ALL_MLB_MARKETS = [
  'h2h', 'spreads', 'totals',
  // Standard markets
  'batter_home_runs', 'batter_hits', 'batter_total_bases', 'batter_rbis',
  'batter_runs_scored', 'batter_hits_runs_rbis', 'batter_singles',
  'batter_doubles', 'batter_triples', 'batter_walks', 'batter_strikeouts',
  'batter_stolen_bases', 'pitcher_strikeouts', 'pitcher_hits_allowed',
  'pitcher_walks', 'pitcher_earned_runs',
  // Alternate markets
  'batter_home_runs_alternate', 'batter_hits_alternate', 'batter_total_bases_alternate',
  'batter_rbis_alternate', 'batter_runs_scored_alternate', 'pitcher_strikeouts_alternate',
  'pitcher_hits_allowed_alternate', 'pitcher_earned_runs_alternate'
];

async function ingestSport(sportKey: string, allMarkets: string[], sportName: string) {
  console.log(`\n📊 ${sportName.toUpperCase()} - Full Ingestion (${allMarkets.length} markets)`);

  const apiKey = process.env.ODDS_API_KEY;

  // Fetch events for Oct 2 ET (Oct 2 04:00 UTC to Oct 3 04:00 UTC)
  const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events`;
  const eventsResp = await axios.get(eventsUrl, {
    params: {
      apiKey,
      dateFormat: 'iso',
      commenceTimeFrom: '2025-10-02T04:00:00Z',
      commenceTimeTo: '2025-10-03T04:00:00Z'
    }
  });

  const events = eventsResp.data;
  console.log(`  Events found: ${events.length}`);

  if (events.length === 0) {
    return { events: 0, picks: 0 };
  }

  // Fetch odds with ALL markets in a SINGLE call per event
  const allGamesWithOdds: any[] = [];
  const bookmakers = 'draftkings,fanduel,betmgm,caesars';

  console.log(`  Fetching ALL ${allMarkets.length} markets in 1 call per event...`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    try {
      // Rate limiting: 500ms delay between requests (2 req/sec limit)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${event.id}/odds`;
      const oddsResp = await axios.get(oddsUrl, {
        params: {
          apiKey,
          regions: 'us',
          markets: allMarkets.join(','), // ALL markets in one call
          bookmakers,
          oddsFormat: 'american',
          dateFormat: 'iso'
        }
      });

      allGamesWithOdds.push(oddsResp.data);
      console.log(`    ✅ Event ${i + 1}/${events.length}: ${event.away_team} @ ${event.home_team}`);
    } catch (error: any) {
      console.error(`    ❌ Error fetching event ${i + 1}: ${error.message}`);
    }
  }

  console.log(`  API calls made: ${allGamesWithOdds.length} (1 per event)`);

  // Sync game metadata
  await syncGameMetadata(allGamesWithOdds);

  // Transform to unified picks
  const picks = transformGamesToUnifiedPicks(allGamesWithOdds, ['draftkings', 'fanduel', 'betmgm', 'caesars']);
  console.log(`  Picks transformed: ${picks.length}`);

  // Write to database
  const result = await upsertUnifiedPicksCore(picks);
  console.log(`  ✅ Database: ${result.inserted} inserted, ${result.skippedDedup} skipped, ${result.errors} errors`);

  return { events: events.length, picks: result.inserted };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  FULL MULTI-SPORT INGESTION - OCTOBER 2, 2025');
  console.log('  1 API Call Per Event - ALL Markets');
  console.log('══════════════════════════════════════════════════════════');

  const results: Record<string, { events: number; picks: number }> = {};

  // NFL - ALL 59 markets
  try {
    results.nfl = await ingestSport('americanfootball_nfl', ALL_NFL_MARKETS, 'NFL');
  } catch (error: any) {
    console.error('❌ NFL ingestion failed:', error.message);
    results.nfl = { events: 0, picks: 0 };
  }

  // MLB - ALL 19 markets
  try {
    results.mlb = await ingestSport('baseball_mlb', ALL_MLB_MARKETS, 'MLB');
  } catch (error: any) {
    console.error('❌ MLB ingestion failed:', error.message);
    results.mlb = { events: 0, picks: 0 };
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  NFL:`);
  console.log(`    Games: ${results.nfl.events}`);
  console.log(`    Picks: ${results.nfl.picks}`);
  console.log(`    Markets: 59 (32 standard + 27 alternates)`);
  console.log(`\n  MLB:`);
  console.log(`    Games: ${results.mlb.events}`);
  console.log(`    Picks: ${results.mlb.picks}`);
  console.log(`    Markets: 19 (11 standard + 8 alternates)`);
  console.log(`\n  TOTAL PICKS: ${results.nfl.picks + results.mlb.picks}`);
  console.log(`  API CALLS: ${results.nfl.events + results.mlb.events} (1 per event)`);
  console.log('\n══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
