// Test Odds API Connection
import { testOddsApiConnection } from '../src/agents/FeedAgent/oddsApi';

async function main() {
  console.log('[TEST] Testing Odds API connection...\n');

  try {
    const result = await testOddsApiConnection();

    console.log('=== ODDS API CONNECTION TEST ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n================================\n');

    if (result.connected) {
      console.log('✅ API CONNECTION: SUCCESSFUL');
      console.log(`✅ Available Sports: ${result.availableSports}`);
      console.log(`✅ Credit Status: ${result.creditStatus.percentUsed}% used`);
      process.exit(0);
    } else {
      console.log('❌ API CONNECTION: FAILED');
      console.log(`❌ Error: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exit(1);
  }
}

main();
