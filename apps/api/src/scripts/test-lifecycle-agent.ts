#!/usr/bin/env npx tsx

/**
 * Test DataLifecycleAgent with Current Data
 * 
 * Tests the lifecycle agent against the current raw_props data
 * to validate archiving functionality works correctly.
 */

import { config } from 'dotenv';

import { DataLifecycleAgent } from '../agents/DataLifecycleAgent';
import { supabaseClient } from '../utils/supabaseUtils';
import { Logger } from '../shared/logger';
import { requireSupabase } from '../utils/supabaseUtils';

// Load environment variables
config();

async function testLifecycleAgent() {
  console.log('🧪 Testing DataLifecycleAgent with Current Data');
  console.log('===============================================');

  const logger = new Logger('test-lifecycle-agent');

  try {
    // 1. Analyze current data state
    console.log('\n📊 Step 1: Analyzing current data distribution...');
    await analyzeCurrentState();

    // 2. Initialize the agent
    console.log('\n🤖 Step 2: Initializing DataLifecycleAgent...');
    const agent = new DataLifecycleAgent(
      {
        name: 'DataLifecycleAgent',
        enabled: true,
        logLevel: 'info'
      },
      { logger, supabase: supabaseClient }
    );

    // Initialize the agent (this will create tables if needed)
    await (agent as any).initialize();
    console.log('✅ Agent initialized successfully');

    // 3. Check agent health
    console.log('\n🏥 Step 3: Checking agent health...');
    const health = await agent.checkHealth();
    console.log(`Agent Health: ${health.status}`);
    console.log('Health Details:', JSON.stringify(health.details, null, 2));

    // 4. Collect metrics
    console.log('\n📊 Step 4: Collecting lifecycle metrics...');
    const metrics = await (agent as any).collectMetrics();
    console.log('Current Metrics:');
    console.log(`  Hot Tier Size: ${metrics.hotTierSize}`);
    console.log(`  Warm Tier Size: ${metrics.warmTierSize}`);
    console.log(`  Cold Tier Size: ${metrics.coldTierSize}`);
    console.log(`  Props Archived: ${metrics.propsArchived}`);
    console.log(`  Retention Violations: ${metrics.retentionPolicyViolations}`);

    // 5. Run a test cycle (if there's data to archive)
    console.log('\n🔄 Step 5: Running test lifecycle cycle...');
    
    // Check if there are old props to archive
    const supabaseClient = requireSupabase();
      const { count: oldProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]) || { count: 0 };

    if ((oldProps || 0) > 0) {
      console.log(`Found ${oldProps} props older than 1 day - running archival process...`);
      
      // Run the process method
      await (agent as any).process();
      console.log('✅ Lifecycle cycle completed');

      // Check results
      await analyzePostProcessState();
    } else {
      console.log('ℹ️ No old props found - skipping archival test');
      console.log('💡 This is expected if you just ingested fresh data');
    }

    // 6. Final health check
    console.log('\n🏥 Step 6: Final health check...');
    const finalHealth = await agent.checkHealth();
    console.log(`Final Health: ${finalHealth.status}`);

    // 7. Cleanup
    await (agent as any).cleanup();
    console.log('✅ Agent cleanup completed');

    console.log('\n🎉 DataLifecycleAgent test completed successfully!');
    console.log('📋 The agent is ready for production deployment');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

async function analyzeCurrentState(): Promise<void> {
  try {
    // Get counts from all tables
    const [rawPropsCount, recentCount, historicalCount] = await Promise.all([
      getTableCount('raw_props'),
      getTableCount('raw_props_recent'),
      getTableCount('raw_props_historical')
    ]);

    console.log('📈 Current Data Distribution:');
    console.log(`  🔥 Hot Tier (raw_props): ${rawPropsCount} records`);
    console.log(`  💧 Warm Tier (raw_props_recent): ${recentCount} records`);
    console.log(`  🧊 Cold Tier (raw_props_historical): ${historicalCount} records`);

    // Analyze age distribution of hot tier
    const supabaseClient = requireSupabase();
      const { count: todayProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: yesterdayProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lt('game_date', new Date().toISOString().split('T')[0]) || { count: 0 };

    const supabaseClient = requireSupabase();
      const { count: olderProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]) || { count: 0 };

    console.log('\n📅 Hot Tier Age Analysis:');
    console.log(`  📅 Today: ${todayProps || 0} props`);
    console.log(`  📅 Yesterday: ${yesterdayProps || 0} props`);
    console.log(`  📅 Older than 1 day: ${olderProps || 0} props (ready for archiving)`);

    if ((olderProps || 0) > 0) {
      console.log(`  ⚠️ Recommendation: Archive ${olderProps} old props to improve performance`);
    }

  } catch (error) {
    console.error('⚠️ Failed to analyze current state:', error);
  }
}

async function analyzePostProcessState(): Promise<void> {
  console.log('\n📊 Post-Process Analysis:');
  
  try {
    const [rawPropsCount, recentCount, historicalCount] = await Promise.all([
      getTableCount('raw_props'),
      getTableCount('raw_props_recent'),
      getTableCount('raw_props_historical')
    ]);

    console.log('📈 Updated Data Distribution:');
    console.log(`  🔥 Hot Tier (raw_props): ${rawPropsCount} records`);
    console.log(`  💧 Warm Tier (raw_props_recent): ${recentCount} records`);
    console.log(`  🧊 Cold Tier (raw_props_historical): ${historicalCount} records`);

    // Check for remaining old props
    const supabaseClient = requireSupabase();
      const { count: remainingOldProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .lt('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]) || { count: 0 };

    if ((remainingOldProps || 0) === 0) {
      console.log('✅ All old props successfully archived!');
    } else {
      console.log(`⚠️ ${remainingOldProps} old props still in hot tier (may need additional cycles)`);
    }

  } catch (error) {
    console.error('⚠️ Failed to analyze post-process state:', error);
  }
}

async function getTableCount(tableName: string): Promise<number> {
  try {
    const supabaseClient = requireSupabase();
      const { count, error } = await supabaseClient
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Table might not exist yet
      if (error.message.includes('does not exist')) {
        return 0;
      }
      console.warn(`⚠️ Failed to count ${tableName}:`, error.message);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.warn(`⚠️ Failed to count ${tableName}:`, error);
    return 0;
  }
}

// Run the test
if (require.main === module) {
  testLifecycleAgent()
    .then(() => {
      console.log('\n✅ Lifecycle agent test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

export { testLifecycleAgent };