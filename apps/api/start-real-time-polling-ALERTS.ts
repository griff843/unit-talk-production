/**
 * Real-Time Polling System - ALERT MODE (60-Second Intervals)
 *
 * Optimizations: NONE - Speed prioritized over budget
 * - NO event caching (fresh data every cycle)
 * - NO game window filtering (all upcoming games)
 * - 60-second (1-minute) intervals for real-time alert detection
 *
 * Expected usage: 103,680 calls/day | 3.1M calls/month
 * Budget: 5M monthly (refreshes monthly) - 38% buffer for settlement
 * Purpose: Real-time hedge alerts, injury alerts, line movement detection
 */

import fetch from 'node-fetch';
import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';
const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds (1 minute) - ALERT MODE

// Sports configuration - ALL ENABLED for comprehensive coverage
const SPORTS_CONFIG = [
  {
    key: 'americanfootball_nfl',
    name: 'NFL',
    markets: [
      'player_pass_tds',
      'player_pass_yds',
      'player_pass_completions',
      'player_rush_yds',
      'player_receiving_yds',
      'player_receptions'
    ],
    enabled: true
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
      'player_steals'
    ],
    enabled: true
  },
  {
    key: 'baseball_mlb',
    name: 'MLB',
    markets: [
      'player_hits',
      'player_total_bases',
      'player_rbis',
      'pitcher_strikeouts'
    ],
    enabled: true // Re-enabled for when season starts
  },
  {
    key: 'icehockey_nhl',
    name: 'NHL',
    markets: [
      'player_points',
      'player_assists',
      'player_shots_on_goal',
      'player_blocked_shots'
    ],
    enabled: true // Re-enabled for when season starts
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

let pollCount = 0;
let totalPropsIngested = 0;
let totalApiCalls = 0;
let totalLineChanges = 0;
let lastPollTime: Date | null = null;

/**
 * Get event IDs - NO CACHING for real-time alerts
 */
async function getEventIds(sport: typeof SPORTS_CONFIG[0]): Promise<OddsAPIEvent[]> {
  const url = `${BASE_URL}/sports/${sport.key}/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${API_KEY}`;

  console.log(`  📡 ${sport.name}: Fetching fresh events...`);

  try {
    const response = await fetch(url);
    totalApiCalls++;

    if (!response.ok) {
      console.error(`  ❌ ${sport.name} events error: ${response.status}`);
      return [];
    }

    const events = await response.json() as OddsAPIEvent[];

    // NO FILTERING - Get all upcoming games for comprehensive coverage
    console.log(`  ✅ ${sport.name}: ${events.length} events found`);

    return events;
  } catch (error: any) {
    console.error(`  ❌ ${sport.name} fetch error:`, error.message);
    return [];
  }
}

/**
 * Get player props for a specific event
 */
async function getEventPlayerProps(
  sport: typeof SPORTS_CONFIG[0],
  eventId: string
): Promise<any | null> {
  const marketsParam = sport.markets.join(',');
  const url = `${BASE_URL}/sports/${sport.key}/events/${eventId}/odds?regions=us&markets=${marketsParam}&oddsFormat=american&apiKey=${API_KEY}`;

  try {
    const response = await fetch(url);
    totalApiCalls++;

    if (!response.ok) {
      return null;
    }

    const eventOdds = await response.json();
    return eventOdds;
  } catch (error: any) {
    return null;
  }
}

/**
 * Transform event odds to raw_props format
 */
function transformToRawProps(eventOdds: any): any[] {
  const props: any[] = [];
  const timestamp = new Date().toISOString();
  const matchup = `${eventOdds.away_team} vs ${eventOdds.home_team}`;

  for (const bookmaker of eventOdds.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      for (const outcome of market.outcomes || []) {
        if (!outcome.description) continue;

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
            source: 'alert_polling',
            poll_count: pollCount,
            market_type: market.key,
            selection: outcome.name,
            alert_mode: true
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
async function insertProps(props: any[]): Promise<{ inserted: number; errors: number; duplicates: number; lineChanges: number }> {
  if (props.length === 0) {
    return { inserted: 0, errors: 0, duplicates: 0, lineChanges: 0 };
  }

  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  let duplicates = 0;
  let lineChanges = 0;

  for (let i = 0; i < props.length; i += batchSize) {
    const batch = props.slice(i, i + batchSize);

    try {
      const { error } = await supabaseClient!
        .from('raw_props')
        .insert(batch);

      if (error) {
        if (error.code === '23505') {
          // Duplicate - this indicates line hasn't changed
          duplicates += batch.length;
        } else {
          console.error(`  ❌ Insert error (${error.code}):`, error.message);
          errors += batch.length;
        }
      } else {
        // Successfully inserted - this indicates new data or line change
        inserted += batch.length;
        lineChanges += batch.length; // Count as potential line changes
      }
    } catch (err: any) {
      console.error(`  ❌ Batch insert failed:`, err.message);
      errors += batch.length;
    }
  }

  return { inserted, errors, duplicates, lineChanges };
}

/**
 * Process a single sport
 */
async function processSport(sport: typeof SPORTS_CONFIG[0]) {
  if (!sport.enabled) {
    return { events: 0, props: 0, inserted: 0, duplicates: 0, lineChanges: 0, apiCalls: 0 };
  }

  console.log(`\n🏈 Processing ${sport.name}...`);

  const apiCallsBefore = totalApiCalls;

  // Step 1: Get event IDs (NO CACHING)
  const events = await getEventIds(sport);

  if (events.length === 0) {
    console.log(`  ⚠️  No events available`);
    return { events: 0, props: 0, inserted: 0, duplicates: 0, lineChanges: 0, apiCalls: totalApiCalls - apiCallsBefore };
  }

  // Step 2: Get player props for each event
  let totalProps = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let sportLineChanges = 0;

  console.log(`  📊 Fetching player props for ${events.length} events...`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (i > 0 && i % 10 === 0) {
      console.log(`    Progress: ${i}/${events.length} events processed...`);
    }

    const eventOdds = await getEventPlayerProps(sport, event.id);

    if (!eventOdds) {
      continue;
    }

    const props = transformToRawProps(eventOdds);
    totalProps += props.length;

    if (props.length > 0) {
      const result = await insertProps(props);
      totalInserted += result.inserted;
      totalDuplicates += result.duplicates;
      sportLineChanges += result.lineChanges;
    }

    // Minimal rate limiting: 50ms between event requests
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const apiCallsUsed = totalApiCalls - apiCallsBefore;
  console.log(`  ✅ ${sport.name}: ${totalInserted} new, ${totalDuplicates} dupes, ${sportLineChanges} line changes | ${apiCallsUsed} API calls`);

  return { events: events.length, props: totalProps, inserted: totalInserted, duplicates: totalDuplicates, lineChanges: sportLineChanges, apiCalls: apiCallsUsed };
}

/**
 * Single poll cycle - 30 SECOND ALERT MODE
 */
async function pollCycle() {
  pollCount++;
  const cycleStart = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log(`🚨 ALERT POLL #${pollCount} - ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  const results = {
    totalEvents: 0,
    totalProps: 0,
    totalInserted: 0,
    totalDuplicates: 0,
    totalLineChanges: 0,
    cycleApiCalls: 0
  };

  // Process each sport
  for (const sport of SPORTS_CONFIG) {
    try {
      const sportResult = await processSport(sport);
      results.totalEvents += sportResult.events;
      results.totalProps += sportResult.props;
      results.totalInserted += sportResult.inserted;
      results.totalDuplicates += sportResult.duplicates;
      results.totalLineChanges += sportResult.lineChanges;
      results.cycleApiCalls += sportResult.apiCalls;
    } catch (error: any) {
      console.error(`❌ ${sport.name} processing failed:`, error.message);
    }
  }

  totalPropsIngested += results.totalInserted;
  totalLineChanges += results.totalLineChanges;

  const elapsedMs = Date.now() - cycleStart;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  lastPollTime = new Date();

  console.log('\n📊 Cycle Summary:');
  console.log(`  Events: ${results.totalEvents}`);
  console.log(`  Props Found: ${results.totalProps}`);
  console.log(`  New Props: ${results.totalInserted}`);
  console.log(`  Line Changes: ${results.totalLineChanges} 🔔`);
  console.log(`  Duplicates: ${results.totalDuplicates}`);
  console.log(`  API Calls (this cycle): ${results.cycleApiCalls}`);
  console.log(`  Total API Calls: ${totalApiCalls.toLocaleString()}`);
  console.log(`  Time: ${elapsedSec} seconds`);
  console.log(`  Total Ingested: ${totalPropsIngested.toLocaleString()}`);
  console.log(`  Next Poll: ${new Date(Date.now() + POLL_INTERVAL_MS).toLocaleTimeString()}`);

  // Alert statistics
  const estimatedDailyUsage = results.cycleApiCalls * 1440; // 1440 cycles per day (60s/1-min intervals)
  const estimatedMonthlyUsage = estimatedDailyUsage * 30;
  console.log(`\n🚨 Alert Mode Stats:`);
  console.log(`  Estimated daily usage: ${estimatedDailyUsage.toLocaleString()} API calls`);
  console.log(`  Estimated monthly usage: ${estimatedMonthlyUsage.toLocaleString()} API calls`);
  console.log(`  Monthly budget: 5,000,000 calls`);
  console.log(`  Budget remaining: ${(5000000 - estimatedMonthlyUsage).toLocaleString()} calls (${Math.round((5000000 - estimatedMonthlyUsage) / 5000000 * 100)}%)`);
  console.log(`  Line changes detected: ${totalLineChanges.toLocaleString()}`);
}

/**
 * Main polling loop - 60-SECOND (1-MINUTE) INTERVALS
 */
async function startPolling() {
  console.log('🚨 Starting ALERT MODE - Real-Time Polling System');
  console.log('='.repeat(80));
  console.log(`📡 API: The Odds API (Event-based player props)`);
  console.log(`⏱️  Interval: 60 SECONDS (1 MINUTE) - ALERT MODE`);
  console.log(`🏈 Sports: ${SPORTS_CONFIG.filter(s => s.enabled).map(s => s.name).join(', ')}`);
  console.log(`🎯 Configuration:`);
  console.log(`   - NO event caching (fresh every cycle)`);
  console.log(`   - NO game filtering (all upcoming games)`);
  console.log(`   - Optimized for: Hedge alerts, injury alerts, line movement`);
  console.log(`💰 Budget: 5M API calls | Est: 103K calls/day | 3.1M/month (38% buffer)`);
  console.log('='.repeat(80));

  // Initial poll immediately
  try {
    await pollCycle();
  } catch (error: any) {
    console.error('❌ Initial poll failed:', error.message);
  }

  // Set up 60-SECOND (1-MINUTE) interval
  setInterval(async () => {
    try {
      await pollCycle();
    } catch (error: any) {
      console.error('❌ Poll cycle failed:', error.message);
    }
  }, POLL_INTERVAL_MS);

  console.log('\n✅ ALERT MODE active - 60-second (1-minute) polling - press Ctrl+C to stop');
}

// Start the system
startPolling().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down alert polling system...');
  console.log(`📊 Final Stats:`);
  console.log(`  Total Polls: ${pollCount}`);
  console.log(`  Total Props: ${totalPropsIngested.toLocaleString()}`);
  console.log(`  Total API Calls: ${totalApiCalls.toLocaleString()}`);
  console.log(`  Line Changes: ${totalLineChanges.toLocaleString()}`);
  console.log(`  Last Poll: ${lastPollTime?.toLocaleString() || 'N/A'}`);
  process.exit(0);
});