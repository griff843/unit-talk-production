/**
 * Test Single Event Player Props - Debug Insert Issues
 */

import fetch from 'node-fetch';
import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

async function testSingleEvent() {
  console.log('🔍 Testing single event player props\n');

  // Step 1: Get first NBA event
  console.log('1️⃣ Fetching NBA events...');
  const eventsResp = await fetch(
    `${BASE_URL}/sports/basketball_nba/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${API_KEY}`
  );

  const events = await eventsResp.json() as any[];
  console.log(`Found ${events.length} NBA events`);

  if (events.length === 0) {
    console.log('No events available');
    return;
  }

  const firstEvent = events[0];
  console.log(`\nTest Event: ${firstEvent.home_team} vs ${firstEvent.away_team}`);
  console.log(`Event ID: ${firstEvent.id}`);

  // Step 2: Get player props for this event
  console.log('\n2️⃣ Fetching player props for this event...');
  const markets = 'player_points,player_rebounds,player_assists';
  const propsUrl = `${BASE_URL}/sports/basketball_nba/events/${firstEvent.id}/odds?regions=us&markets=${markets}&oddsFormat=american&apiKey=${API_KEY}`;

  const propsResp = await fetch(propsUrl);

  if (!propsResp.ok) {
    const errorText = await propsResp.text();
    console.log(`Error (${propsResp.status}):`, errorText);
    return;
  }

  const eventOdds = await propsResp.json() as any;
  console.log(`✅ Found props from ${eventOdds.bookmakers?.length || 0} bookmakers`);

  // Step 3: Transform first prop
  if (!eventOdds.bookmakers || eventOdds.bookmakers.length === 0) {
    console.log('No bookmakers found');
    return;
  }

  const firstBookmaker = eventOdds.bookmakers[0];
  console.log(`\nFirst bookmaker: ${firstBookmaker.title}`);
  console.log(`Markets: ${firstBookmaker.markets?.length || 0}`);

  if (!firstBookmaker.markets || firstBookmaker.markets.length === 0) {
    console.log('No markets found');
    return;
  }

  const firstMarket = firstBookmaker.markets[0];
  const firstOutcome = firstMarket.outcomes[0];

  console.log('\n3️⃣ Sample prop:');
  console.log(`  Market: ${firstMarket.key}`);
  console.log(`  Player: ${firstOutcome.description}`);
  console.log(`  Line: ${firstOutcome.point}`);
  console.log(`  Odds: ${firstOutcome.price}`);
  console.log(`  Selection: ${firstOutcome.name}`);

  // Step 4: Try to insert this prop
  console.log('\n4️⃣ Testing insert into raw_props...');

  const timestamp = new Date().toISOString();
  const testProp = {
    id: randomUUID(),
    sport: eventOdds.sport_key,
    sport_key: eventOdds.sport_key,
    player_name: firstOutcome.description,
    stat_type: firstMarket.key,
    line: firstOutcome.point || 0,
    odds: firstOutcome.price || -110,
    over_odds: firstOutcome.name === 'Over' ? firstOutcome.price : null,
    under_odds: firstOutcome.name === 'Under' ? firstOutcome.price : null,
    game_date: eventOdds.commence_time,
    game_time: eventOdds.commence_time,
    matchup: `${eventOdds.away_team} vs ${eventOdds.home_team}`,
    team: eventOdds.home_team,
    opponent: eventOdds.away_team,
    bookmaker_key: firstBookmaker.key,
    bookmaker_title: firstBookmaker.title,
    external_game_id: eventOdds.id,
    external_prop_id: `${eventOdds.id}_${firstMarket.key}_${firstOutcome.description}_${firstBookmaker.key}`,
    scraped_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    metadata: {
      source: 'test_polling',
      market_type: firstMarket.key,
      selection: firstOutcome.name
    }
  };

  console.log('\nProp to insert:');
  console.log(JSON.stringify(testProp, null, 2));

  // Check raw_props schema first
  console.log('\n5️⃣ Checking raw_props schema...');
  const { data: sample } = await supabaseClient!
    .from('raw_props')
    .select('*')
    .limit(1);

  if (sample && sample[0]) {
    console.log('Available columns:', Object.keys(sample[0]).join(', '));
  }

  // Try insert
  console.log('\n6️⃣ Attempting insert...');
  const { data, error } = await supabaseClient!
    .from('raw_props')
    .insert([testProp])
    .select();

  if (error) {
    console.error('❌ Insert failed:');
    console.error('  Code:', error.code);
    console.error('  Message:', error.message);
    console.error('  Details:', error.details);
    console.error('  Hint:', error.hint);
  } else {
    console.log('✅ Insert successful!');
    console.log('  Inserted ID:', data?.[0]?.id);
  }
}

testSingleEvent()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
