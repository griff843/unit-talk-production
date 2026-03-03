// src/agents/PlayerEnrichmentAgent/multi-league-test.ts
// Manual test script for multi-league PlayerEnrichmentAgent
// Run with: node -r ts-node/register src/agents/PlayerEnrichmentAgent/multi-league-test.ts

import { getMlbHeadshot } from '../enrichment/mlbEnrichment';
import { getNbaHeadshot } from '../enrichment/nbaEnrichment';
import { getNflHeadshot } from '../enrichment/nflEnrichment';
import { getNhlHeadshot } from '../enrichment/nhlEnrichment';

/**
 * Test data for each league
 */
const testPlayers = {
  MLB: ['Mike Trout', 'Aaron Judge', 'Mookie Betts', 'NonExistent Player'],
  NBA: ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'NonExistent Player'],
  NFL: ['Tom Brady', 'Aaron Rodgers', 'Patrick Mahomes', 'NonExistent Player'],
  NHL: ['Connor McDavid', 'Sidney Crosby', 'Alexander Ovechkin', 'NonExistent Player'],
};

/**
 * Test a specific league's enrichment function
 */
async function testLeague(
  league: string,
  players: string[],
  enrichmentFn: (name: string) => Promise<string | null>
): Promise<void> {
  console.log(`\n🏆 Testing ${league} Enrichment`);
  console.log('='.repeat(40));

  for (const player of players) {
    try {
      console.log(`\n🔍 Testing: ${player}`);
      const result = await enrichmentFn(player);

      if (result) {
        console.log(`✅ Found headshot: ${result}`);
      } else {
        console.log(`❌ No headshot found`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`💥 Error: ${errorMessage}`);
    }
  }
}

/**
 * Main test function
 */
async function runMultiLeagueTest(): Promise<void> {
  console.log('🚀 Starting Multi-League Player Enrichment Test');
  console.log('='.repeat(50));
  console.log('Testing MLB, NBA, NFL, and NHL headshot enrichment...\n');

  const startTime = Date.now();

  try {
    // Test MLB
    await testLeague('MLB', testPlayers.MLB, getMlbHeadshot);

    // Test NBA
    await testLeague('NBA', testPlayers.NBA, getNbaHeadshot);

    // Test NFL
    await testLeague('NFL', testPlayers.NFL, getNflHeadshot);

    // Test NHL
    await testLeague('NHL', testPlayers.NHL, getNhlHeadshot);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Multi-League Test Completed Successfully!');
    console.log(`⏱️  Total Duration: ${duration} seconds`);
    console.log('='.repeat(50));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 Fatal error during multi-league test:', errorMessage);
    console.error(error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runMultiLeagueTest();
}
