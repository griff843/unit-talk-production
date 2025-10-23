/**
 * Diagnose Odds API Issues
 */

import fetch from 'node-fetch';

const API_KEY = process.env.ODDS_API_KEY || '368a656fdb45af141159b63ae0feef0c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

async function diagnose() {
  console.log('🔍 Diagnosing Odds API issues\n');

  // Test 1: Get available sports
  console.log('1️⃣ Checking available sports...');
  const sportsResp = await fetch(`${BASE_URL}/sports?apiKey=${API_KEY}`);
  const sports = await sportsResp.json() as any[];

  const majorSports = sports.filter((s: any) =>
    ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'].includes(s.key)
  );

  console.log('Major sports status:');
  majorSports.forEach((s: any) => {
    console.log(`  ${s.title} (${s.key}): ${s.active ? '✅ Active' : '❌ Inactive'}`);
  });

  // Test 2: Try NFL with detailed error
  console.log('\n2️⃣ Testing NFL with player props market...');
  const nflUrl = `${BASE_URL}/sports/americanfootball_nfl/odds?regions=us&markets=player_pass_tds&oddsFormat=american&apiKey=${API_KEY}`;
  const nflResp = await fetch(nflUrl);

  if (!nflResp.ok) {
    const errorText = await nflResp.text();
    console.log(`NFL Error (${nflResp.status}):`, errorText);
  } else {
    const data = await nflResp.json();
    console.log(`✅ NFL: ${(data as any[]).length} games available`);
  }

  // Test 3: Check what markets are available
  console.log('\n3️⃣ Testing basic h2h market (should always work)...');
  const activeSport = majorSports.find((s: any) => s.active);

  if (activeSport) {
    console.log(`Testing ${activeSport.title} with h2h market...`);
    const url = `${BASE_URL}/sports/${activeSport.key}/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${API_KEY}`;
    const resp = await fetch(url);

    if (resp.ok) {
      const data = await resp.json() as any[];
      console.log(`✅ ${activeSport.title}: ${data.length} games`);

      if (data.length > 0) {
        const game = data[0];
        console.log('\nSample game:');
        console.log(`  ${game.home_team} vs ${game.away_team}`);
        console.log(`  Start: ${new Date(game.commence_time).toLocaleString()}`);
        console.log(`  Bookmakers: ${game.bookmakers?.length || 0}`);

        if (game.bookmakers && game.bookmakers[0]) {
          const availableMarkets = game.bookmakers[0].markets?.map((m: any) => m.key) || [];
          console.log(`  Available markets: ${availableMarkets.join(', ')}`);
        }
      }
    } else {
      const errorText = await resp.text();
      console.log(`Error (${resp.status}):`, errorText);
    }
  }

  // Test 4: Check API usage
  console.log('\n4️⃣ Checking API usage...');
  const usageResp = await fetch(`${BASE_URL}/sports?apiKey=${API_KEY}`);
  const remaining = usageResp.headers.get('x-requests-remaining');
  const used = usageResp.headers.get('x-requests-used');

  console.log(`Requests remaining: ${remaining || 'Unknown'}`);
  console.log(`Requests used: ${used || 'Unknown'}`);
}

diagnose()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
