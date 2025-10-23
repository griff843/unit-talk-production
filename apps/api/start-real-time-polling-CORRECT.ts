/**
 * Real-Time Polling System - Phase 6B (CORRECT IMPLEMENTATION)
 *
 * Two-step process for player props:
 * 1. Get event IDs from standard odds endpoint
 * 2. Query each event for player props
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

// Sports configuration with player prop markets
const SPORTS_CONFIG = [
  {
    key: 'americanfootball_nfl',
    name: 'NFL',
    markets: [
      'player_pass_tds',
      'player_pass_yds',
      'player_pass_completions',
      'player_rush_yds',
      'player_rush_attempts',
      'player_receiving_yds',
      'player_receptions'
    ]
  },
  {
    key: 'basketball_nba',
    name: 'NBA',
    markets: [
      'player_points',
      'player_rebounds',
      'player_assists',
      'player_threes',
      'player_blocks',
      'player_steals',
      'player_turnovers'
    ]
  },
  {
    key: 'baseball_mlb',
    name: 'MLB',
    markets: [
      'player_hits',
      'player_total_bases',
      'player_rbis',
      'player_runs_scored',
      'pitcher_strikeouts',
      'pitcher_hits_allowed',
      'pitcher_walks'
    ]
  },
  {
    key: 'icehockey_nhl',
    name: 'NHL',
    markets: [
      'player_points',
      'player_assists',
      'player_shots_on_goal',
      'player_power_play_points',
      'goalie_saves'
    ]
  }
];

interface OddsAPIEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

interface PlayerPropOutcome {
  name: string;
  description: string;
  price: number;
  point?: number;
}

interface PlayerPropMarket {
  key: string;
  outcomes: PlayerPropOutcome[];
}

interface EventOddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: PlayerPropMarket[];
  }>;
}

let pollCount = 0;
let totalPropsIngested = 0;
let totalApiCalls = 0;
let lastPollTime: Date | null = null;

/**
 * Step 1: Get event IDs for a sport
 */
async function getEventIds(sport: typeof SPORTS_CONFIG[0]): Promise<OddsAPIEvent[]> {
  const url = `${BASE_URL}/sports/${sport.key}/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${API_KEY}`;

  console.log(`  📡 Fetching ${sport.name} events...`);

  try {
    const response = await fetch(url);
    totalApiCalls++;

    if (!response.ok) {
      console.error(`  ❌ ${sport.name} events error: ${response.status}`);
      return [];
    }

    const events = await response.json() as OddsAPIEvent[];
    console.log(`  ✅ ${sport.name}: ${events.length} events found`);

    return events;
  } catch (error: any) {
    console.error(`  ❌ ${sport.name} fetch error:`, error.message);
    return [];
  }
}

/**
 * Step 2: Get player props for a specific event
 */
async function getEventPlayerProps(
  sport: typeof SPORTS_CONFIG[0],
  eventId: string
): Promise<EventOddsResponse | null> {
  const marketsParam = sport.markets.join(',');
  const url = `${BASE_URL}/sports/${sport.key}/events/${eventId}/odds?regions=us&markets=${marketsParam}&oddsFormat=american&apiKey=${API_KEY}`;

  try {
    const response = await fetch(url);
    totalApiCalls++;

    if (!response.ok) {
      // Silently skip - some events may not have player props
      return null;
    }

    const eventOdds = await response.json() as EventOddsResponse;
    return eventOdds;
  } catch (error: any) {
    // Silently skip errors
    return null;
  }
}

/**
 * Transform event odds to raw_props format
 */
function transformToRawProps(eventOdds: EventOddsResponse): any[] {
  const props: any[] = [];
  const timestamp = new Date().toISOString();
  const matchup = `${eventOdds.away_team} vs ${eventOdds.home_team}`;

  for (const bookmaker of eventOdds.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      for (const outcome of market.outcomes || []) {
        if (!outcome.description) continue; // Skip non-player outcomes

        const playerName = outcome.description;
        const line = outcome.point || 0;
        const odds = outcome.price || -110;

        props.push({
          id: randomUUID(),
          sport: eventOdds.sport_key,
          sport_key: eventOdds.sport_key,
          player_name: playerName,
          stat_type: market.key,
          line: line,
          odds: odds,
          over_odds: outcome.name === 'Over' ? odds : null,
          under_odds: outcome.name === 'Under' ? odds : null,
          game_date: eventOdds.commence_time,
          game_time: eventOdds.commence_time,
          matchup: matchup,
          team: eventOdds.home_team,
          opponent: eventOdds.away_team,
          bookmaker_key: bookmaker.key,
          bookmaker_title: bookmaker.title,
          external_game_id: eventOdds.id,
          external_prop_id: `${eventOdds.id}_${market.key}_${playerName}_${bookmaker.key}`,
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

  return props;
}

/**
 * Insert props into raw_props table
 */
async function insertProps(props: any[]): Promise<{ inserted: number; errors: number; duplicates: number }> {
  if (props.length === 0) {
    return { inserted: 0, errors: 0, duplicates: 0 };
  }

  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  let duplicates = 0;

  for (let i = 0; i < props.length; i += batchSize) {
    const batch = props.slice(i, i + batchSize);

    try {
      const { error } = await supabaseClient!
        .from('raw_props')
        .insert(batch);

      if (error) {
        if (error.code === '23505') {
          // Duplicate key - expected and OK
          duplicates += batch.length;
        } else {
          console.error(`  ❌ Insert error (${error.code}):`, error.message);
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

  return { inserted, errors, duplicates };
}

/**
 * Process a single sport
 */
async function processSport(sport: typeof SPORTS_CONFIG[0]) {
  console.log(`\n🏈 Processing ${sport.name}...`);

  // Step 1: Get event IDs
  const events = await getEventIds(sport);

  if (events.length === 0) {
    console.log(`  ⚠️  No events found for ${sport.name}`);
    return { events: 0, props: 0, inserted: 0, duplicates: 0 };
  }

  // Step 2: Get player props for each event
  let totalProps = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;

  console.log(`  📊 Fetching player props for ${events.length} events...`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Progress indicator every 5 events
    if (i > 0 && i % 5 === 0) {
      console.log(`    Progress: ${i}/${events.length} events processed...`);
    }

    const eventOdds = await getEventPlayerProps(sport, event.id);

    if (!eventOdds) {
      continue; // No player props for this event
    }

    const props = transformToRawProps(eventOdds);
    totalProps += props.length;

    if (props.length > 0) {
      const result = await insertProps(props);
      totalInserted += result.inserted;
      totalDuplicates += result.duplicates;
    }

    // Rate limiting: 100ms between event requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`  ✅ ${sport.name}: ${totalInserted} new, ${totalDuplicates} dupes (${totalProps} total)`);

  return { events: events.length, props: totalProps, inserted: totalInserted, duplicates: totalDuplicates };
}

/**
 * Single poll cycle - fetch all sports
 */
async function pollCycle() {
  pollCount++;
  const cycleStart = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log(`🔄 Poll Cycle #${pollCount} - ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  const results = {
    totalEvents: 0,
    totalProps: 0,
    totalInserted: 0,
    totalDuplicates: 0
  };

  // Process each sport
  for (const sport of SPORTS_CONFIG) {
    try {
      const sportResult = await processSport(sport);
      results.totalEvents += sportResult.events;
      results.totalProps += sportResult.props;
      results.totalInserted += sportResult.inserted;
      results.totalDuplicates += sportResult.duplicates;
    } catch (error: any) {
      console.error(`❌ ${sport.name} processing failed:`, error.message);
    }
  }

  totalPropsIngested += results.totalInserted;

  const elapsedMs = Date.now() - cycleStart;
  const elapsedMin = (elapsedMs / 60000).toFixed(1);
  lastPollTime = new Date();

  console.log('\n📊 Cycle Summary:');
  console.log(`  Events: ${results.totalEvents}`);
  console.log(`  Props Found: ${results.totalProps}`);
  console.log(`  New Props: ${results.totalInserted}`);
  console.log(`  Duplicates: ${results.totalDuplicates}`);
  console.log(`  API Calls: ${totalApiCalls}`);
  console.log(`  Time: ${elapsedMin} minutes`);
  console.log(`  Total Ingested: ${totalPropsIngested.toLocaleString()}`);
  console.log(`  Next Poll: ${new Date(Date.now() + POLL_INTERVAL_MS).toLocaleTimeString()}`);
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log('🚀 Starting Real-Time Polling System (CORRECT IMPLEMENTATION)');
  console.log('='.repeat(80));
  console.log(`📡 API: The Odds API (Event-based player props)`);
  console.log(`⏱️  Interval: 15 minutes`);
  console.log(`🏈 Sports: ${SPORTS_CONFIG.map(s => s.name).join(', ')}`);
  console.log(`🎯 Target: Build line movement history for features 2, 3, 5`);
  console.log(`💰 Budget: 5M API calls available`);
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
  console.log(`  Total API Calls: ${totalApiCalls.toLocaleString()}`);
  console.log(`  Last Poll: ${lastPollTime?.toLocaleString() || 'N/A'}`);
  process.exit(0);
});
