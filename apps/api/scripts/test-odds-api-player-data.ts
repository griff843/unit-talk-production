import { fetchOdds } from '../src/agents/FeedAgent/oddsApi';
import 'dotenv/config';

/**
 * TEST ODDS API PLAYER DATA
 * 
 * Check if Odds API provides player data for NBA, WNBA, NCAAF
 * Since Optimal API doesn't have these leagues
 */

async function testOddsApiPlayerData() {
  console.log('🎯 TESTING ODDS API PLAYER DATA');
  console.log('='.repeat(60));

  const targetSports = [
    { key: 'basketball_nba', name: 'NBA', missing: 'Critical for headshots' },
    { key: 'basketball_wnba', name: 'WNBA', missing: 'Completely missing' },
    { key: 'americanfootball_ncaaf', name: 'NCAAF', missing: 'Completely missing' },
    { key: 'icehockey_nhl', name: 'NHL', missing: 'Unknown coverage' }
  ];

  for (const sport of targetSports) {
    console.log(`\n🏈 TESTING ${sport.name} (${sport.key})`);
    console.log('-'.repeat(40));
    console.log(`Status: ${sport.missing}`);

    try {
      // Test fetching current odds to see data structure
      console.log(`📡 Fetching ${sport.name} odds data...`);
      
      const data = await fetchOdds(sport.key as any, ['h2h']);
      
      if (!data || data.length === 0) {
        console.log(`❌ No ${sport.name} data available`);
        continue;
      }

      console.log(`✅ Found ${data.length} ${sport.name} events`);

      // Analyze first event for player data
      const sampleEvent = data[0];
      console.log(`\n📋 SAMPLE ${sport.name} EVENT:`);
      console.log(`  Event: ${sampleEvent.away_team || sampleEvent.teams?.[0]} @ ${sampleEvent.home_team || sampleEvent.teams?.[1]}`);
      console.log(`  Event ID: ${sampleEvent.id}`);
      console.log(`  Commence Time: ${sampleEvent.commence_time}`);
      
      // Check for player-related data
      console.log(`\n🔍 ANALYZING DATA STRUCTURE:`);
      const keys = Object.keys(sampleEvent);
      console.log(`  Available fields: ${keys.join(', ')}`);
      
      // Look for bookmaker data
      if (sampleEvent.bookmakers && sampleEvent.bookmakers.length > 0) {
        const sampleBookmaker = sampleEvent.bookmakers[0];
        console.log(`\n📊 BOOKMAKER DATA SAMPLE:`);
        console.log(`  Bookmaker: ${sampleBookmaker.title}`);
        console.log(`  Markets: ${sampleBookmaker.markets?.length || 0}`);
        
        if (sampleBookmaker.markets && sampleBookmaker.markets.length > 0) {
          const sampleMarket = sampleBookmaker.markets[0];
          console.log(`  Sample Market: ${sampleMarket.key}`);
          console.log(`  Outcomes: ${sampleMarket.outcomes?.length || 0}`);
          
          if (sampleMarket.outcomes && sampleMarket.outcomes.length > 0) {
            console.log(`  Sample Outcomes:`)
            sampleMarket.outcomes.forEach((outcome: any, index: number) => {
              console.log(`    ${index + 1}. ${outcome.name}: ${outcome.price} (${outcome.point || 'no point'})`);
            });
          }
        }
      }

      // Check if this could contain player data
      const hasPlayerData = JSON.stringify(sampleEvent).toLowerCase().includes('player');
      console.log(`\n🎯 PLAYER DATA ASSESSMENT:`);
      console.log(`  Contains "player" references: ${hasPlayerData ? '✅' : '❌'}`);
      console.log(`  Suitable for player population: ${hasPlayerData ? '✅ Possibly' : '❌ No'}`);

    } catch (error) {
      console.log(`💥 Error testing ${sport.name}:`, error instanceof Error ? error.message : error);
    }

    // Small delay between sports
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 ODDS API PLAYER DATA ANALYSIS COMPLETE');
  console.log('='.repeat(60));

  console.log('\n💡 FINDINGS:');
  console.log('📊 The Odds API typically provides:');
  console.log('  ✅ Game/match data (teams, times, IDs)');
  console.log('  ✅ Betting markets (spreads, totals, moneylines)'); 
  console.log('  ❓ Player props (sport-dependent)');
  console.log('  ❌ Individual player databases (unlikely)');

  console.log('\n🚨 CRITICAL INSIGHT:');
  console.log('  ❌ Odds API does NOT provide player databases');
  console.log('  ✅ It provides betting data on games');
  console.log('  🎯 We need ALTERNATIVE SOURCES for NBA/WNBA/NCAAF players');

  console.log('\n📋 RECOMMENDATIONS:');
  console.log('  1. ✅ Keep existing NBA headshot system (works with current DB)');
  console.log('  2. 🔍 Find NBA/WNBA/NCAAF player data sources (ESPN API, etc.)');
  console.log('  3. ✅ Use Optimal API for WNBA when events available');
  console.log('  4. ❌ Odds API not suitable for player database population');
}

// Run the test
testOddsApiPlayerData();