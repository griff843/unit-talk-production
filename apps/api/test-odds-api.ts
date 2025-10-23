/**
 * Test Odds API Connection
 *
 * Verifies API key works and checks available sports/markets
 */

import fetch from 'node-fetch';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

async function testConnection() {
  console.log('🔍 Testing Odds API Connection\n');
  console.log('API Key:', API_KEY.substring(0, 8) + '...');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Get available sports
    console.log('📊 Test 1: Fetching available sports...');
    const sportsResponse = await fetch(`${BASE_URL}/sports?apiKey=${API_KEY}`);

    if (!sportsResponse.ok) {
      throw new Error(`API Error: ${sportsResponse.status} ${sportsResponse.statusText}`);
    }

    const sports = await sportsResponse.json();
    console.log(`✅ Found ${sports.length} sports available\n`);

    // Show major sports
    const majorSports = sports.filter((s: any) =>
      ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'].includes(s.key)
    );

    console.log('🏈 Major Sports Available:');
    majorSports.forEach((sport: any) => {
      console.log(`  - ${sport.title} (${sport.key}): ${sport.active ? '✅ Active' : '❌ Inactive'}`);
    });

    // Test 2: Get odds for NFL (most likely to have games)
    console.log('\n📊 Test 2: Fetching NFL player props...');
    const nflKey = 'americanfootball_nfl';
    const oddsResponse = await fetch(
      `${BASE_URL}/sports/${nflKey}/odds?apiKey=${API_KEY}&regions=us&markets=player_pass_tds,player_pass_yds,player_rush_yds&oddsFormat=american`
    );

    if (!oddsResponse.ok) {
      console.log(`⚠️  NFL odds not available: ${oddsResponse.status}`);
    } else {
      const odds = await oddsResponse.json();
      console.log(`✅ Found ${odds.length} NFL games with odds`);

      if (odds.length > 0) {
        const game = odds[0];
        console.log('\n📋 Sample Game:');
        console.log(`  ${game.home_team} vs ${game.away_team}`);
        console.log(`  Start: ${new Date(game.commence_time).toLocaleString()}`);
        console.log(`  Markets: ${game.bookmakers?.[0]?.markets?.length || 0} available`);

        // Count total player props
        let totalProps = 0;
        game.bookmakers?.forEach((book: any) => {
          book.markets?.forEach((market: any) => {
            totalProps += market.outcomes?.length || 0;
          });
        });
        console.log(`  Props: ${totalProps} player props`);
      }
    }

    // Test 3: Check remaining requests
    const remainingRequests = oddsResponse.headers.get('x-requests-remaining');
    const requestsUsed = oddsResponse.headers.get('x-requests-used');

    console.log('\n💳 API Usage:');
    console.log(`  Requests Remaining: ${remainingRequests || 'Unknown'}`);
    console.log(`  Requests Used: ${requestsUsed || 'Unknown'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ API CONNECTION SUCCESSFUL');
    console.log('='.repeat(80));

    return {
      success: true,
      sports: majorSports,
      remainingRequests: remainingRequests ? parseInt(remainingRequests) : null
    };

  } catch (error: any) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ API CONNECTION FAILED');
    console.log('='.repeat(80));
    console.error('\nError:', error.message);
    console.error('\nDetails:', error);

    return {
      success: false,
      error: error.message
    };
  }
}

testConnection()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
