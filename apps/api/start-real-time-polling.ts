/**
 * Real-Time Polling System - Phase 6B
 *
 * Continuously polls Odds API every 15 minutes for all major sports
 * Builds time-series data for line movement tracking
 *
 * Features:
 * - Multi-sport polling (NFL, NBA, MLB, NHL)
 * - 15-minute intervals for line movement history
 * - Writes to raw_props with timestamps
 * - Enables features 2, 3, 5 (velocity, form, CLV)
 */

import fetch from 'node-fetch';
import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Sports configuration
const SPORTS_CONFIG = [
  {
    key: 'americanfootball_nfl',
    name: 'NFL',
    markets: 'player_pass_tds,player_pass_yds,player_rush_yds,player_receiving_yds'
  },
  {
    key: 'basketball_nba',
    name: 'NBA',
    markets: 'player_points,player_rebounds,player_assists,player_threes'
  },
  {
    key: 'baseball_mlb',
    name: 'MLB',
    markets: 'player_hits,player_total_bases,pitcher_strikeouts,pitcher_hits_allowed'
  },
  {
    key: 'icehockey_nhl',
    name: 'NHL',
    markets: 'player_points,player_assists,player_shots_on_goal,goalie_saves'
  }
];

interface OddsAPIEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        description?: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

let pollCount = 0;
let totalPropsIngested = 0;
let lastPollTime: Date | null = null;

/**
 * Fetch props for a single sport from Odds API
 */
async function fetchSportProps(sport: typeof SPORTS_CONFIG[0]): Promise<OddsAPIEvent[]> {
  const url = `${BASE_URL}/sports/${sport.key}/odds?regions=us&markets=${sport.markets}&oddsFormat=american&apiKey=${API_KEY}`;

  console.log(`  📡 Fetching ${sport.name} props...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`  ❌ ${sport.name} API error: ${response.status}`);
      return [];
    }

    const events = await response.json() as OddsAPIEvent[];
    console.log(`  ✅ ${sport.name}: ${events.length} games`);

    return events;
  } catch (error: any) {
    console.error(`  ❌ ${sport.name} fetch error:`, error.message);
    return [];
  }
}

/**
 * Transform Odds API events to raw_props format
 */
function transformToRawProps(events: OddsAPIEvent[], sport: string): any[] {
  const props: any[] = [];
  const timestamp = new Date().toISOString();

  for (const event of events) {
    const matchup = `${event.away_team} vs ${event.home_team}`;

    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        for (const outcome of market.outcomes || []) {
          // Player props have description field
          if (!outcome.description) continue;

          const playerName = outcome.description;
          const line = outcome.point || 0;
          const odds = outcome.price || -110;

          props.push({
            id: randomUUID(),
            sport: sport.toUpperCase(),
            sport_key: event.sport_key,
            player_name: playerName,
            stat_type: market.key,
            line: line,
            odds: odds,
            over_odds: outcome.name === 'Over' ? odds : null,
            under_odds: outcome.name === 'Under' ? odds : null,
            game_date: event.commence_time,
            game_time: event.commence_time,
            matchup: matchup,
            team: event.home_team,
            opponent: event.away_team,
            bookmaker_key: bookmaker.key,
            bookmaker_title: bookmaker.title,
            external_game_id: event.id,
            external_prop_id: `${event.id}_${market.key}_${playerName}`,
            scraped_at: timestamp,
            created_at: timestamp,
            updated_at: timestamp,
            metadata: {
              source: 'real_time_polling',
              poll_count: pollCount,
              market_type: market.key,
              selection: outcome.name
            }
          });
        }
      }
    }
  }

  return props;
}

/**
 * Insert props into raw_props table
 */
async function insertProps(props: any[]): Promise<{ inserted: number; errors: number }> {
  if (props.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < props.length; i += batchSize) {
    const batch = props.slice(i, i + batchSize);

    try {
      const { error } = await supabaseClient!
        .from('raw_props')
        .insert(batch);

      if (error) {
        // Ignore duplicate errors (23505)
        if (error.code !== '23505') {
          console.error(`  ❌ Insert error:`, error.message);
          errors += batch.length;
        }
      } else {
        inserted += batch.length;
      }
    } catch (err: any) {
      console.error(`  ❌ Batch insert failed:`, err.message);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * Single poll cycle - fetch all sports and insert
 */
async function pollCycle() {
  pollCount++;
  const cycleStart = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log(`🔄 Poll Cycle #${pollCount} - ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  let totalEvents = 0;
  let totalProps = 0;

  // Fetch all sports
  for (const sport of SPORTS_CONFIG) {
    const events = await fetchSportProps(sport);
    totalEvents += events.length;

    if (events.length > 0) {
      const props = transformToRawProps(events, sport.name);
      totalProps += props.length;

      const result = await insertProps(props);
      console.log(`  💾 ${sport.name}: +${result.inserted} props (${result.errors} errors)`);

      totalPropsIngested += result.inserted;
    }
  }

  const elapsedMs = Date.now() - cycleStart;
  lastPollTime = new Date();

  console.log('\n📊 Cycle Summary:');
  console.log(`  Games: ${totalEvents}`);
  console.log(`  Props: ${totalProps}`);
  console.log(`  Time: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  Total Ingested: ${totalPropsIngested.toLocaleString()}`);
  console.log(`  Next Poll: ${new Date(Date.now() + POLL_INTERVAL_MS).toLocaleTimeString()}`);
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log('🚀 Starting Real-Time Polling System');
  console.log('=' .repeat(80));
  console.log(`📡 API: The Odds API`);
  console.log(`⏱️  Interval: 15 minutes`);
  console.log(`🏈 Sports: ${SPORTS_CONFIG.map(s => s.name).join(', ')}`);
  console.log(`🎯 Target: Build line movement history for features 2, 3, 5`);
  console.log('='.repeat(80));

  // Initial poll immediately
  try {
    await pollCycle();
  } catch (error: any) {
    console.error('❌ Initial poll failed:', error.message);
  }

  // Set up 15-minute interval
  setInterval(async () => {
    try {
      await pollCycle();
    } catch (error: any) {
      console.error('❌ Poll cycle failed:', error.message);
    }
  }, POLL_INTERVAL_MS);

  console.log('\n✅ Polling system active - press Ctrl+C to stop');
}

// Start the system
startPolling().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down polling system...');
  console.log(`📊 Final Stats:`);
  console.log(`  Total Polls: ${pollCount}`);
  console.log(`  Total Props: ${totalPropsIngested.toLocaleString()}`);
  console.log(`  Last Poll: ${lastPollTime?.toLocaleString() || 'N/A'}`);
  process.exit(0);
});
