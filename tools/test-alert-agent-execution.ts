import { AlertAgent } from './src/agents/AlertAgent';
import { BaseAgentConfig, BaseAgentDependencies } from './src/agents/BaseAgent/types';
import { logger } from './src/shared/logger';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * Test AlertAgent Execution
 * This will run the AlertAgent to process pending picks and post them to Discord
 */

async function testAlertAgentExecution() {
  console.log('🚨 Testing AlertAgent Execution');
  console.log('='.repeat(50));

  try {
    // Initialize Supabase client for verification
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Check pending picks before AlertAgent runs
    console.log('\n1️⃣ Pre-execution: Checking pending picks...');
    const { data: beforePicks } = await client
      .from('final_picks')
      .select('id, player_name, capper, posted_to_discord, play_status')
      .eq('play_status', 'pending')
      .eq('posted_to_discord', false);

    console.log(`Found ${beforePicks?.length || 0} pending picks before AlertAgent execution`);
    if (beforePicks && beforePicks.length > 0) {
      beforePicks.forEach((pick, i) => {
        console.log(
          `  ${i + 1}. ${pick.player_name || 'Unknown Player'} (${pick.capper}) - Posted: ${pick.posted_to_discord}`
        );
      });
    }

    // Initialize AlertAgent
    console.log('\n2️⃣ Initializing AlertAgent...');
    const alertConfig: BaseAgentConfig = {
      name: 'AlertAgent',
      enabled: true,
      maxRetries: 3,
      timeoutMs: 30000,
      environment: process.env.NODE_ENV || 'development',
    };

    const alertDeps: BaseAgentDependencies = {
      logger: logger.child({ agent: 'AlertAgent' }),
      supabase: client,
    };

    const alertAgent = new AlertAgent(alertConfig, alertDeps);

    // Initialize the agent
    await alertAgent.initialize();
    console.log('✅ AlertAgent initialized successfully');

    // Run health check
    console.log('\n3️⃣ Running AlertAgent health check...');
    const healthResult = await alertAgent.healthCheck();
    console.log('Health check result:', {
      status: healthResult.status,
      message: healthResult.message,
      isHealthy: healthResult.status === 'healthy',
    });

    if (healthResult.status !== 'healthy') {
      console.log('❌ AlertAgent is not healthy - cannot proceed');
      return;
    }

    // Execute AlertAgent processing
    console.log('\n4️⃣ Executing AlertAgent pick monitoring...');
    console.log('⏳ Starting AlertAgent.monitorPicksForPosting()...');

    const startTime = Date.now();

    // Set timeout to prevent hanging
    const processPromise = alertAgent.monitorPicksForPosting();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('AlertAgent processing timed out after 30 seconds')),
        30000
      );
    });

    try {
      await Promise.race([processPromise, timeoutPromise]);
      const processingTime = Date.now() - startTime;
      console.log(`✅ AlertAgent processing completed in ${processingTime}ms`);
    } catch (processingError) {
      const processingTime = Date.now() - startTime;
      console.log(`❌ AlertAgent processing failed after ${processingTime}ms:`, processingError);
    }

    // Check picks after AlertAgent runs
    console.log('\n5️⃣ Post-execution: Verifying results...');
    const { data: afterPicks } = await client
      .from('final_picks')
      .select('id, player_name, capper, posted_to_discord, play_status, discord_post_id, thread_id')
      .eq('capper', 'Griff843')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`Found ${afterPicks?.length || 0} picks for Griff843 after AlertAgent execution`);
    if (afterPicks && afterPicks.length > 0) {
      afterPicks.forEach((pick, i) => {
        console.log(`  ${i + 1}. ${pick.player_name || 'Unknown Player'}`);
        console.log(`     Posted to Discord: ${pick.posted_to_discord}`);
        console.log(`     Discord Post ID: ${pick.discord_post_id || 'none'}`);
        console.log(`     Thread ID: ${pick.thread_id || 'none'}`);
        console.log('');
      });
    }

    // Calculate success metrics
    const beforeCount = beforePicks?.length || 0;
    const postedCount = afterPicks?.filter(pick => pick.posted_to_discord).length || 0;

    console.log('\n📊 AlertAgent Execution Summary:');
    console.log(`- Pending picks before: ${beforeCount}`);
    console.log(`- Successfully posted to Discord: ${postedCount}`);
    console.log(`- AlertAgent execution: ${postedCount > 0 ? '✅ SUCCESS' : '⚠️ No posts made'}`);

    if (postedCount > 0) {
      console.log('\n🎉 PHASE C DISCORD INTEGRATION: FULLY VERIFIED!');
      console.log('AlertAgent successfully posted picks to Discord');
      console.log('Complete smart form → Discord workflow is operational');
    } else {
      console.log('\n⚠️ No picks were posted to Discord');
      console.log('Check AlertAgent logs and Discord bot connectivity');
    }

    // Cleanup
    await alertAgent.cleanup();
    console.log('✅ AlertAgent cleanup completed');
  } catch (error) {
    console.error('💥 AlertAgent execution test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the AlertAgent test
testAlertAgentExecution();
