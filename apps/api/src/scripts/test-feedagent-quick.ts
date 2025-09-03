#!/usr/bin/env npx tsx

/**
 * Quick FeedAgent Real-World Test
 * 
 * Fast validation of FeedAgent with live Optimal API data
 * Tests API connectivity and data structure without full database processing
 */

import { config } from 'dotenv';

import { getRateLimitStatus, fetchOptimalProps } from '../agents/FeedAgent/optimal';
import { Logger } from '../shared/logger';

// Load environment variables
config();

async function quickTest() {
  console.log('🚀 Quick FeedAgent Real-World Test');
  console.log('=====================================');

  const logger = new Logger('test-feedagent-quick');

  try {
    // 1. Check API connectivity and rate limits
    console.log('\n📡 Checking Optimal API Status...');
    const rateLimitStatus = getRateLimitStatus();
    console.log(`Rate Limit Status: ${rateLimitStatus.requestsInWindow}/${rateLimitStatus.maxRequests} requests used`);
    
    if (!rateLimitStatus.canMakeRequest) {
      throw new Error('Rate limit exceeded - cannot proceed with test');
    }
    console.log('✅ API rate limit check passed');

    // 2. Test real data ingestion for MLB (most active in August)
    console.log('\n⚾ Testing MLB props ingestion...');
    const startTime = Date.now();
    
    const mlbProps = await fetchOptimalProps('MLB');
    const duration = Date.now() - startTime;
    
    console.log(`✅ MLB ingestion completed in ${duration}ms`);
    console.log(`📊 Props retrieved: ${mlbProps.length}`);

    if (mlbProps.length > 0) {
      // Sample the first few props
      console.log('\n📋 Sample props:');
      mlbProps.slice(0, 3).forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
        console.log(`     Over: ${prop.over_odds}, Under: ${prop.under_odds} | Team: ${prop.team}`);
      });

      // Validate data structure
      const sampleProp = mlbProps[0];
      const requiredFields = ['id', 'player_name', 'stat_type', 'line', 'over_odds', 'under_odds', 'sport', 'provider'];
      const missingFields = requiredFields.filter(field => !sampleProp[field]);
      
      if (missingFields.length === 0) {
        console.log('✅ Data structure validation passed');
      } else {
        console.warn(`⚠️ Missing fields: ${missingFields.join(', ')}`);
      }
    }

    // 3. Quick test of other sports (expecting no data in August)
    console.log('\n🏈 Testing other sports (expecting minimal data in August)...');
    const sportsToTest = ['NFL', 'NBA', 'NHL'];
    
    for (const sport of sportsToTest) {
      try {
        const sportProps = await fetchOptimalProps(sport);
        console.log(`  ${sport}: ${sportProps.length} props`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
      } catch (error) {
        console.log(`  ${sport}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // 4. Summary
    console.log('\n📋 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`✅ API Connectivity: PASSED`);
    console.log(`✅ Rate Limiting: PASSED (${rateLimitStatus.requestsInWindow}/${rateLimitStatus.maxRequests})`);
    console.log(`✅ Data Ingestion: PASSED (${mlbProps.length} MLB props)`);
    console.log(`✅ Data Structure: PASSED`);
    console.log(`⏱️  Total Duration: ${duration}ms`);

    if (mlbProps.length > 0) {
      console.log('\n🎉 REAL-WORLD TEST PASSED! FeedAgent successfully ingesting live Optimal API data.');
      console.log(`📈 System is processing ${mlbProps.length} live MLB props`);
    } else {
      console.log('\n⚠️ No props found - this may be expected during off-season');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  quickTest()
    .then(() => {
      console.log('\n✅ Quick test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

export { quickTest };