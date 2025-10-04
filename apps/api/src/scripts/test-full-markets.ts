/**
 * Test script for full market coverage (core + player props)
 */

import { fetchAndWriteCoreMarkets } from '../agents/FeedAgent/oddsApi.js';

async function testFullMarkets() {
  console.log('🧪 Testing Full Market Coverage (Core + Props)\n');

  try {
    // Fetch ALL markets for NFL
    const result = await fetchAndWriteCoreMarkets('americanfootball_nfl', {
      markets: ['h2h', 'spreads', 'totals'], // Core markets only for now
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

    console.log(`\n📊 MARKET BREAKDOWN:`);
    console.log(`  H2H (Moneyline): ${result.marketsProcessed.h2h} markets`);
    console.log(`  Spreads: ${result.marketsProcessed.spreads} markets`);
    console.log(`  Totals: ${result.marketsProcessed.totals} markets`);
    console.log(`  Total Picks: ${result.coreMarketWrites.attemptedWrites}`);

    const avgPerGame = Math.round(result.coreMarketWrites.attemptedWrites / result.eventsFetched);
    console.log(`  Avg Picks/Game: ${avgPerGame}`);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

testFullMarkets().catch(console.error);
