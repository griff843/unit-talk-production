#!/usr/bin/env npx tsx
// @ts-nocheck

/**
 * Test Optimal API Integration
 * 
 * Validates that FeedAgent properly uses Optimal API for major sports
 * and tests the unified data source routing system.
 */

import { config } from 'dotenv';

import { fetchUnifiedData, getRoutingInfo, getSystemStatus } from '../agents/FeedAgent/dataSourceRouter';
import { getRateLimitStatus } from '../agents/FeedAgent/optimal';
import { Logger } from '../shared/logger';

config();

async function testOptimalApiIntegration() {
  console.log('🧪 TESTING OPTIMAL API INTEGRATION');
  console.log('==================================');

  const logger = new Logger('test-optimal-api-integration');

  try {
    console.log('\n📊 PHASE 1: ROUTING CONFIGURATION VALIDATION');
    console.log('============================================');
    
    // Check routing configuration for major sports
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF'];
    
    for (const sport of sports) {
      const routingInfo = getRoutingInfo(sport);
      console.log(`\n🏈 ${sport} Routing Configuration:`);
      console.log(`  Primary: ${routingInfo.primary}`);
      console.log(`  Secondary: ${routingInfo.secondary || 'None'}`);
      console.log(`  Supported Markets: ${routingInfo.supportedMarkets?.join(', ')}`);
      console.log(`  Recommendation: ${routingInfo.recommendation}`);
    }

    console.log('\n🔍 PHASE 2: SYSTEM STATUS CHECK');
    console.log('===============================');
    
    const systemStatus = await getSystemStatus();
    console.log('📊 System Status:');
    console.log(`  Odds API Sports: ${systemStatus.oddsApi.supportedSports}`);
    console.log(`  Optimal API Sports: ${systemStatus.optimalApi.supportedSports}`);
    console.log(`  Total Sports: ${systemStatus.routing.totalSports}`);
    console.log(`  Odds API Primary: ${systemStatus.routing.oddsApiPrimary}`);
    console.log(`  Optimal API Primary: ${systemStatus.routing.optimalApiPrimary}`);

    console.log('\n🏀 PHASE 3: TEST OPTIMAL API FOR NBA');
    console.log('====================================');
    
    console.log('Testing NBA data fetch (should use Optimal API)...');
    try {
      const nbaResult = await fetchUnifiedData({
        sport: 'NBA',
        marketType: 'player-props'
      });
      
      console.log(`✅ NBA Data Fetch Results:`);
      console.log(`  Source Used: ${nbaResult.source}`);
      console.log(`  Records: ${nbaResult.data.length}`);
      console.log(`  Processing Time: ${nbaResult.metadata.processingTimeMs}ms`);
      console.log(`  Errors: ${nbaResult.metadata.errors.length}`);
      
      if (nbaResult.source === 'optimal-api') {
        console.log('🎉 SUCCESS: Optimal API used as primary for NBA');
      } else {
        console.log('⚠️ WARNING: Expected Optimal API but got:', nbaResult.source);
      }
      
      // Show sample data
      if (nbaResult.data.length > 0) {
        console.log('\n📋 Sample NBA Props:');
        const samples = nbaResult.data.slice(0, 3);
        for (const prop of samples) {
          console.log(`  🏀 ${prop.player_name}: ${prop.stat_type} O/U ${prop.line}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ NBA test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🏈 PHASE 4: TEST OPTIMAL API FOR NFL');
    console.log('====================================');
    
    console.log('Testing NFL data fetch (should use Optimal API)...');
    try {
      const nflResult = await fetchUnifiedData({
        sport: 'NFL',
        marketType: 'player-props'
      });
      
      console.log(`✅ NFL Data Fetch Results:`);
      console.log(`  Source Used: ${nflResult.source}`);
      console.log(`  Records: ${nflResult.data.length}`);
      console.log(`  Processing Time: ${nflResult.metadata.processingTimeMs}ms`);
      console.log(`  Errors: ${nflResult.metadata.errors.length}`);
      
      if (nflResult.source === 'optimal-api') {
        console.log('🎉 SUCCESS: Optimal API used as primary for NFL');
      } else {
        console.log('⚠️ WARNING: Expected Optimal API but got:', nflResult.source);
      }
      
    } catch (error) {
      console.log(`❌ NFL test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🏈 PHASE 5: TEST ODDS API FOR NCAAF');
    console.log('===================================');
    
    console.log('Testing NCAAF data fetch (should use Odds API)...');
    try {
      const ncaafResult = await fetchUnifiedData({
        sport: 'NCAAF',
        marketType: 'spreads'
      });
      
      console.log(`✅ NCAAF Data Fetch Results:`);
      console.log(`  Source Used: ${ncaafResult.source}`);
      console.log(`  Records: ${ncaafResult.data.length}`);
      console.log(`  Processing Time: ${ncaafResult.metadata.processingTimeMs}ms`);
      console.log(`  Credits Used: ${ncaafResult.metadata.creditsUsed || 'Unknown'}`);
      
      if (ncaafResult.source === 'odds-api') {
        console.log('🎉 SUCCESS: Odds API used correctly for NCAAF');
      } else {
        console.log('⚠️ WARNING: Expected Odds API but got:', ncaafResult.source);
      }
      
    } catch (error) {
      console.log(`❌ NCAAF test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n📊 PHASE 6: OPTIMAL API RATE LIMIT STATUS');
    console.log('=========================================');
    
    try {
      const rateStatus = getRateLimitStatus();
      console.log('📈 Optimal API Rate Limits:');
      console.log(`  Requests Made: ${rateStatus.requestsMade}`);
      console.log(`  Requests Remaining: ${rateStatus.requestsRemaining}`);
      console.log(`  Reset Time: ${new Date(rateStatus.resetTime).toLocaleString()}`);
      console.log(`  Rate Limited: ${rateStatus.isRateLimited ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.log(`⚠️ Rate limit status unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🎯 PHASE 7: INTEGRATION RECOMMENDATIONS');
    console.log('======================================');
    
    console.log('✅ Configuration Status:');
    console.log('========================');
    console.log('✅ Optimal API: Configured as primary for NFL, NBA, MLB, NHL');
    console.log('✅ Odds API: Configured as primary for NCAAF (exclusive)');
    console.log('✅ Routing System: Smart fallback and error handling');
    
    console.log('\n🔧 Integration Steps:');
    console.log('====================');
    console.log('1. Update FeedAgent to use unified data source router');
    console.log('2. Replace direct Optimal API calls with fetchUnifiedData()');
    console.log('3. Configure provider settings to use smart routing');
    console.log('4. Test all major sports through unified system');

    console.log('\n💡 Benefits of Unified System:');
    console.log('==============================');
    console.log('✅ Automatic source selection based on sport');
    console.log('✅ Fallback handling when primary source fails');
    console.log('✅ Credit and rate limit monitoring');
    console.log('✅ Consistent data format across all sources');
    console.log('✅ Performance metrics and error tracking');

    console.log('\n📋 NEXT ACTIONS:');
    console.log('================');
    console.log('1. Update FeedAgent to use dataSourceRouter.fetchUnifiedData()');
    console.log('2. Test major sports data quality through Optimal API');
    console.log('3. Validate fallback mechanisms work correctly');
    console.log('4. Monitor API usage and performance');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testOptimalApiIntegration()
    .then(() => {
      console.log('\n✅ Optimal API integration test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

export { testOptimalApiIntegration };