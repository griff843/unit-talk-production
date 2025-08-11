import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

import { BaseAgentConfig } from '../agents/BaseAgent/types';
import { IngestionAgent } from '../agents/IngestionAgent';
import { ErrorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * Test script to run the IngestionAgent with Optimal API integration
 * This will fetch props from Optimal API and populate the raw_props table
 */

// Load Supabase credentials from environment
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

// Check for Optimal API key
const optimalApiKey = process.env['OPTIMAL_API_KEY'];
if (!optimalApiKey) {
  console.error('❌ Missing OPTIMAL_API_KEY environment variable. Please set it to test Optimal integration.');
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');
console.log(`📊 Supabase URL: ${supabaseUrl}`);
console.log(`🔑 Optimal API Key: ${optimalApiKey.substring(0, 8)}...`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize error handler
const errorHandler = new ErrorHandler(logger);

// Define IngestionAgent configuration with Optimal provider
const ingestionConfig: BaseAgentConfig & any = {
  name: 'IngestionAgent-OptimalTest',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60
  },
  // IngestionAgent specific config
  providers: [
    {
      name: 'Optimal',
      enabled: true,
      url: 'https://api.optimal.com',
      apiKey: optimalApiKey,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimit: {
        requests: 900,
        window: 3600000 // 1 hour
      }
    }
  ],
  batchSize: 100,
  processingTimeout: 300000,
  duplicateCheckEnabled: true,
  duplicateCheckWindow: 86400000, // 24 hours
  validationEnabled: true,
  normalizationEnabled: true
};

const deps = {
  supabase,
  logger,
  errorHandler
};

/**
 * Check raw_props table before and after ingestion
 */
async function checkRawPropsTable(label: string) {
  try {
    const { error, count } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`❌ Error checking raw_props table (${label}):`, error);
      return 0;
    }
    
    console.log(`📊 Raw props count (${label}): ${count || 0}`);
    return count || 0;
    
  } catch (error) {
    console.error(`❌ Exception checking raw_props table (${label}):`, error);
    return 0;
  }
}

/**
 * Show recent props from the table
 */
async function showRecentProps(limit: number = 5) {
  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('player_name, stat_type, line, provider, scraped_at, sport')
      .order('scraped_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Error fetching recent props:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('📭 No props found in the table');
      return;
    }
    
    console.log(`\n📋 Recent ${data.length} props:`);
    data.forEach((prop, index) => {
      console.log(`  ${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.provider}) [${prop.sport}]`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Exception fetching recent props:', error);
  }
}

/**
 * Test the Optimal API rate limit status
 */
async function testOptimalRateLimit() {
  try {
    const { getRateLimitStatus } = await import('../agents/FeedAgent/optimal');
    const status = getRateLimitStatus();
    
    console.log('🚦 Optimal API Rate Limit Status:');
    console.log(`  Requests in window: ${status.requestsInWindow}/${status.maxRequests}`);
    console.log(`  Can make request: ${status.canMakeRequest ? '✅' : '❌'}`);
    console.log(`  Window: ${Math.round(status.windowMs / 1000 / 60)} minutes`);
    
    return status.canMakeRequest;
    
  } catch (error) {
    console.error('❌ Error checking Optimal rate limit:', error);
    return false;
  }
}

/**
 * Main test function
 */
async function runOptimalIngestionTest() {
  console.log('\n🚀 Starting Optimal API Ingestion Test');
  console.log('=====================================\n');

  try {
    // Check initial state
    console.log('1️⃣ Checking initial state...');
    const initialCount = await checkRawPropsTable('before ingestion');
    await showRecentProps(3);

    // Test Optimal API rate limit
    console.log('2️⃣ Testing Optimal API rate limit...');
    const canMakeRequest = await testOptimalRateLimit();

    if (!canMakeRequest) {
      console.log('⚠️ Rate limit exceeded. Waiting before proceeding...');
      // You could add a delay here if needed
    }

    // Create and run IngestionAgent
    console.log('3️⃣ Creating IngestionAgent with Optimal provider...');
    console.log('Provider configuration:', JSON.stringify(ingestionConfig.providers, null, 2));
    const ingestionAgent = new IngestionAgent(ingestionConfig, deps);

    console.log('4️⃣ Starting ingestion process...');
    const startTime = Date.now();

    // Start the agent (this initializes it)
    await ingestionAgent.start();

    // Run the actual processing
    await ingestionAgent.run();

    const duration = Date.now() - startTime;
    console.log(`✅ Ingestion completed in ${duration}ms`);

    // Check final state
    console.log('5️⃣ Checking final state...');
    const finalCount = await checkRawPropsTable('after ingestion');
    const newProps = finalCount - initialCount;

    console.log(`\n📈 Results:`);
    console.log(`  Initial props: ${initialCount}`);
    console.log(`  Final props: ${finalCount}`);
    console.log(`  New props added: ${newProps}`);

    if (newProps > 0) {
      console.log('🎉 SUCCESS: Props were successfully ingested from Optimal API!');
      await showRecentProps(10);
    } else {
      console.log('⚠️ No new props were added. This could be due to:');
      console.log('  - No props available for today');
      console.log('  - Rate limit exceeded');
      console.log('  - API configuration issues');
      console.log('  - Duplicate filtering');
    }

    // Stop the agent
    await ingestionAgent.stop();

  } catch (error) {
    console.error('❌ Test failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }

    process.exit(1);
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  // Add any cleanup logic here if needed
  console.log('✅ Cleanup completed');
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received SIGINT, cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Received SIGTERM, cleaning up...');
  await cleanup();
  process.exit(0);
});

// Run the test
if (require.main === module) {
  runOptimalIngestionTest()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { runOptimalIngestionTest };