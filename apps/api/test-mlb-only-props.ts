/**
 * Test MLB Player Props Only - Quick Test
 */

import fetch from 'node-fetch';
import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

const MLB_MARKETS = [
  'player_hits',
  'player_total_bases',
  'pitcher_strikeouts'
];

async function testMLB() {
  console.log('🔍 Testing MLB Player Props\n');

  // Step 1: Get MLB events
  console.log('1️⃣ Fetching MLB events...');
  const eventsResp = await fetch(
    `${BASE_URL}/sports/baseball_mlb/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${API_KEY}`
  );

  const events = await eventsResp.json() as any[];
  console.log(`✅ Found ${events.length} MLB events\n`);

  if (events.length === 0) {
    console.log('No MLB events available today');
    return;
  }

  // Step 2: Process first 2 events
  const eventsToProcess = events.slice(0, Math.min(2, events.length));
  let totalProps = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (const event of eventsToProcess) {
    console.log(`\n📊 Event: ${event.home_team} vs ${event.away_team}`);

    // Get player props for this event
    const markets = MLB_MARKETS.join(',');
    const propsUrl = `${BASE_URL}/sports/baseball_mlb/events/${event.id}/odds?regions=us&markets=${markets}&oddsFormat=american&apiKey=${API_KEY}`;

    const propsResp = await fetch(propsUrl);

    if (!propsResp.ok) {
      console.log(`  ⚠️  No player props available`);
      continue;
    }

    const eventOdds = await propsResp.json() as any;

    if (!eventOdds.bookmakers || eventOdds.bookmakers.length === 0) {
      console.log(`  ⚠️  No bookmakers found`);
      continue;
    }

    // Count props
    let eventProps = 0;
    for (const bookmaker of eventOdds.bookmakers) {
      for (const market of bookmaker.markets || []) {
        eventProps += market.outcomes?.length || 0;
      }
    }

    console.log(`  Found ${eventProps} props from ${eventOdds.bookmakers.length} bookmakers`);
    totalProps += eventProps;

    // Transform and insert
    if (eventProps > 0) {
      const props = transformToRawProps(eventOdds);

      const { inserted, duplicates } = await insertProps(props);
      totalInserted += inserted;
      totalDuplicates += duplicates;

      console.log(`  ✅ ${inserted} new, ${duplicates} dupes`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 MLB Test Summary:');
  console.log(`  Events Processed: ${eventsToProcess.length}`);
  console.log(`  Props Found: ${totalProps}`);
  console.log(`  New Props: ${totalInserted}`);
  console.log(`  Duplicates: ${totalDuplicates}`);
  console.log('='.repeat(80));
}

function transformToRawProps(eventOdds: any): any[] {
  const props: any[] = [];
  const timestamp = new Date().toISOString();

  for (const bookmaker of eventOdds.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      for (const outcome of market.outcomes || []) {
        if (!outcome.description) continue;

        props.push({
          id: randomUUID(),
          sport: eventOdds.sport_key,
          sport_key: eventOdds.sport_key,
          player_name: outcome.description,
          stat_type: market.key,
          line: outcome.point || 0,
          odds: outcome.price || -110,
          over_odds: outcome.name === 'Over' ? outcome.price : null,
          under_odds: outcome.name === 'Under' ? outcome.price : null,
          game_date: eventOdds.commence_time,
          game_time: eventOdds.commence_time,
          matchup: `${eventOdds.away_team} vs ${eventOdds.home_team}`,
          team: eventOdds.home_team,
          opponent: eventOdds.away_team,
          bookmaker_key: bookmaker.key,
          bookmaker_title: bookmaker.title,
          external_game_id: eventOdds.id,
          external_prop_id: `${eventOdds.id}_${market.key}_${outcome.description}_${bookmaker.key}`,
          scraped_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
          metadata: {
            source: 'test_mlb_polling',
            market_type: market.key,
            selection: outcome.name
          }
        });
      }
    }
  }

  return props;
}

async function insertProps(props: any[]): Promise<{ inserted: number; duplicates: number }> {
  if (props.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }

  const { error } = await supabaseClient!
    .from('raw_props')
    .insert(props);

  if (error) {
    if (error.code === '23505') {
      return { inserted: 0, duplicates: props.length };
    }
    console.error('  ❌ Insert error:', error.message);
    return { inserted: 0, duplicates: 0 };
  }

  return { inserted: props.length, duplicates: 0 };
}

testMLB()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
