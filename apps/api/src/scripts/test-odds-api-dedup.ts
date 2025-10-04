/**
 * Test script for in-memory deduplication with Odds API
 */

import { fetchAndWriteCoreMarkets } from '../agents/FeedAgent/oddsApi.js';

async function testOddsApiDedup() {
  console.log('🧪 Testing Odds API with In-Memory Deduplication\n');

  try {
    // Fetch NFL h2h market for a couple games
    const result = await fetchAndWriteCoreMarkets('americanfootball_nfl', {
      markets: ['h2h'],
      daysFrom: 7,
    });

    console.log('\n✅ FINAL RESULTS:');
    console.log('================');
    console.log(`Events Fetched: ${result.eventsFetched}`);
    console.log(`Markets Processed:`, result.marketsProcessed);
    console.log(`\nDatabase Writes:`);
    console.log(`  Attempted: ${result.coreMarketWrites.attemptedWrites}`);
    console.log(`  Inserted: ${result.coreMarketWrites.inserted}`);
    console.log(`  Skipped (Dedup): ${result.coreMarketWrites.skippedDedup}`);
    console.log(`  Errors: ${result.coreMarketWrites.errors}`);

    if (result.coreMarketWrites.inserted > 0) {
      console.log('\n✅ SUCCESS: Picks successfully inserted!');
    } else if (result.coreMarketWrites.skippedDedup > 0) {
      console.log('\n✅ SUCCESS: Deduplication working (all picks already exist)');
    } else {
      console.log('\n⚠️  No picks inserted or deduplicated');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

testOddsApiDedup().catch(console.error);
