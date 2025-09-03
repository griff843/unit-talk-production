#!/usr/bin/env node

/**
 * Comprehensive test script for multi-league player enrichment system
 * Tests headshot and physical attributes (height, weight, birthday) enrichment
 * for all supported leagues: MLB, NBA, NFL, NHL
 */

import { PlayerPhysicals } from '../../types/player';
import { getMlbHeadshot, getMlbPhysicals } from '../enrichment/mlbEnrichment';
import { getNbaHeadshot, getNbaPhysicals } from '../enrichment/nbaEnrichment';
import { getNflHeadshot, getNflPhysicals } from '../enrichment/nflEnrichment';
import { getNhlHeadshot, getNhlPhysicals } from '../enrichment/nhlEnrichment';

/**
 * Test data for each league with known players
 */
const testPlayers = {
  MLB: [
    'Mike Trout',
    'Mookie Betts',
    'Aaron Judge',
    'Ronald Acuña Jr.',
    'Shohei Ohtani'
  ],
  NBA: [
    'LeBron James',
    'Stephen Curry',
    'Kevin Durant',
    'Giannis Antetokounmpo',
    'Luka Doncic'
  ],
  NFL: [
    'Tom Brady',
    'Aaron Rodgers',
    'Patrick Mahomes',
    'Josh Allen',
    'Lamar Jackson'
  ],
  NHL: [
    'Connor McDavid',
    'Sidney Crosby',
    'Alexander Ovechkin',
    'Nathan MacKinnon',
    'Leon Draisaitl'
  ]
};

/**
 * Test result interface
 */
interface TestResult {
  player: string;
  league: string;
  headshot: {
    success: boolean;
    url: string | null;
    error?: string;
  };
  physicals: {
    success: boolean;
    data: PlayerPhysicals;
    error?: string;
  };
}

/**
 * Test headshot and physicals for a specific player and league
 */
async function testPlayerEnrichment(
  playerName: string, 
  league: string,
  headshotFn: (name: string) => Promise<string | null>,
  physicalsFn: (name: string) => Promise<PlayerPhysicals>
): Promise<TestResult> {
  const result: TestResult = {
    player: playerName,
    league,
    headshot: { success: false, url: null },
    physicals: { success: false, data: { height_cm: null, weight_kg: null, birthday: null } }
  };

  // Test headshot enrichment
  try {
    const headshotUrl = await headshotFn(playerName);
    result.headshot.success = headshotUrl !== null;
    result.headshot.url = headshotUrl;
  } catch (error) {
    result.headshot.error = error instanceof Error ? error.message : String(error);
  }

  // Test physical attributes enrichment
  try {
    const physicals = await physicalsFn(playerName);
    result.physicals.data = physicals;
    result.physicals.success = physicals.height_cm !== null || 
                               physicals.weight_kg !== null || 
                               physicals.birthday !== null;
  } catch (error) {
    result.physicals.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Test all players for a specific league
 */
async function testLeague(league: keyof typeof testPlayers): Promise<TestResult[]> {
  console.log(`\n🏟️  Testing ${league} enrichment...`);
  
  const players = testPlayers[league];
  const results: TestResult[] = [];

  // Get the appropriate functions for this league
  let headshotFn: (name: string) => Promise<string | null>;
  let physicalsFn: (name: string) => Promise<PlayerPhysicals>;

  switch (league) {
    case 'MLB':
      headshotFn = getMlbHeadshot;
      physicalsFn = getMlbPhysicals;
      break;
    case 'NBA':
      headshotFn = getNbaHeadshot;
      physicalsFn = getNbaPhysicals;
      break;
    case 'NFL':
      headshotFn = getNflHeadshot;
      physicalsFn = getNflPhysicals;
      break;
    case 'NHL':
      headshotFn = getNhlHeadshot;
      physicalsFn = getNhlPhysicals;
      break;
  }

  // Test each player
  for (const player of players) {
    console.log(`   Testing ${player}...`);
    const result = await testPlayerEnrichment(player, league, headshotFn, physicalsFn);
    results.push(result);
    
    // Brief result summary
    const headshotStatus = result.headshot.success ? '✅' : '❌';
    const physicalsStatus = result.physicals.success ? '✅' : '❌';
    console.log(`      Headshot: ${headshotStatus} | Physicals: ${physicalsStatus}`);
  }

  return results;
}

/**
 * Display detailed test results
 */
function displayResults(allResults: TestResult[]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 DETAILED TEST RESULTS`);
  console.log(`${'='.repeat(80)}`);

  const leagues = ['MLB', 'NBA', 'NFL', 'NHL'];
  
  leagues.forEach(league => {
    const leagueResults = allResults.filter(r => r.league === league);
    if (leagueResults.length === 0) {return;}

    console.log(`\n🏟️  ${league} RESULTS:`);
    console.log(`${'─'.repeat(50)}`);

    leagueResults.forEach(result => {
      console.log(`\n👤 ${result.player}:`);
      
      // Headshot results
      if (result.headshot.success) {
        console.log(`   📸 Headshot: ✅ Found`);
        console.log(`      URL: ${result.headshot.url}`);
      } else {
        console.log(`   📸 Headshot: ❌ Not found`);
        if (result.headshot.error) {
          console.log(`      Error: ${result.headshot.error}`);
        }
      }

      // Physical attributes results
      if (result.physicals.success) {
        console.log(`   📊 Physicals: ✅ Found`);
        const { height_cm, weight_kg, birthday } = result.physicals.data;
        if (height_cm) {console.log(`      Height: ${height_cm} cm`);}
        if (weight_kg) {console.log(`      Weight: ${weight_kg} kg`);}
        if (birthday) {console.log(`      Birthday: ${birthday}`);}
      } else {
        console.log(`   📊 Physicals: ❌ Not found`);
        if (result.physicals.error) {
          console.log(`      Error: ${result.physicals.error}`);
        }
      }
    });
  });
}

/**
 * Display summary statistics
 */
function displaySummary(allResults: TestResult[]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📈 TEST SUMMARY STATISTICS`);
  console.log(`${'='.repeat(80)}`);

  const leagues = ['MLB', 'NBA', 'NFL', 'NHL'];
  
  leagues.forEach(league => {
    const leagueResults = allResults.filter(r => r.league === league);
    if (leagueResults.length === 0) {return;}

    const headshotSuccesses = leagueResults.filter(r => r.headshot.success).length;
    const physicalsSuccesses = leagueResults.filter(r => r.physicals.success).length;
    const total = leagueResults.length;

    const headshotRate = ((headshotSuccesses / total) * 100).toFixed(1);
    const physicalsRate = ((physicalsSuccesses / total) * 100).toFixed(1);

    console.log(`\n🏟️  ${league}:`);
    console.log(`   Players Tested: ${total}`);
    console.log(`   📸 Headshot Success: ${headshotSuccesses}/${total} (${headshotRate}%)`);
    console.log(`   📊 Physicals Success: ${physicalsSuccesses}/${total} (${physicalsRate}%)`);

    // Field-specific breakdown for physicals
    const heightSuccesses = leagueResults.filter(r => r.physicals.data.height_cm !== null).length;
    const weightSuccesses = leagueResults.filter(r => r.physicals.data.weight_kg !== null).length;
    const birthdaySuccesses = leagueResults.filter(r => r.physicals.data.birthday !== null).length;

    console.log(`   📏 Height Found: ${heightSuccesses}/${total} (${((heightSuccesses / total) * 100).toFixed(1)}%)`);
    console.log(`   ⚖️  Weight Found: ${weightSuccesses}/${total} (${((weightSuccesses / total) * 100).toFixed(1)}%)`);
    console.log(`   🎂 Birthday Found: ${birthdaySuccesses}/${total} (${((birthdaySuccesses / total) * 100).toFixed(1)}%)`);
  });

  // Overall statistics
  const totalTests = allResults.length;
  const totalHeadshotSuccesses = allResults.filter(r => r.headshot.success).length;
  const totalPhysicalsSuccesses = allResults.filter(r => r.physicals.success).length;

  console.log(`\n🌟 OVERALL STATISTICS:`);
  console.log(`   Total Players Tested: ${totalTests}`);
  console.log(`   📸 Overall Headshot Success: ${totalHeadshotSuccesses}/${totalTests} (${((totalHeadshotSuccesses / totalTests) * 100).toFixed(1)}%)`);
  console.log(`   📊 Overall Physicals Success: ${totalPhysicalsSuccesses}/${totalTests} (${((totalPhysicalsSuccesses / totalTests) * 100).toFixed(1)}%)`);

  console.log(`\n${'='.repeat(80)}`);
}

/**
 * Main test execution
 */
async function runTests() {
  console.log(`🧪 Multi-League Player Enrichment Test Suite`);
  console.log(`Testing headshots and physical attributes for all supported leagues`);
  console.log(`${'='.repeat(80)}`);

  const startTime = Date.now();
  const allResults: TestResult[] = [];

  try {
    // Test each league
    for (const league of Object.keys(testPlayers) as Array<keyof typeof testPlayers>) {
      const results = await testLeague(league);
      allResults.push(...results);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Display results
    displayResults(allResults);
    displaySummary(allResults);

    console.log(`⏱️  Total test execution time: ${duration} seconds`);
    console.log(`✅ Test suite completed successfully!\n`);

  } catch (error) {
    console.error(`\n❌ Test suite failed:`, error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { runTests, testPlayerEnrichment };