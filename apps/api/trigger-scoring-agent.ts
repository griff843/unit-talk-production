#!/usr/bin/env npx tsx

/**
 * TRIGGER SCORING AGENT
 *
 * This script manually triggers the ScoringAgent to process props
 * and validates if Enhanced45FactorEngine is working.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ScoringAgent } from './src/agents/ScoringAgent';
import { BaseAgentConfig } from './src/agents/BaseAgent/types';

// Load environment variables
config();

async function triggerScoringAgent() {
  console.log('🚀 TRIGGERING SCORING AGENT');
  console.log('===========================\n');

  // Force enable Enhanced 45-Factor system
  process.env.USE_ENHANCED_45_FACTOR = 'true';
  process.env.USE_PRO_SCORER = 'true';

  console.log(`Environment Setup:`);
  console.log(`  USE_ENHANCED_45_FACTOR: ${process.env.USE_ENHANCED_45_FACTOR}`);
  console.log(`  USE_PRO_SCORER: ${process.env.USE_PRO_SCORER}`);

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test connection
  console.log('\nTesting Supabase connection...');
  const { data: connectionTest, error: connectionError } = await supabase
    .from('raw_props')
    .select('count')
    .limit(1);

  if (connectionError) {
    throw new Error(`Supabase connection failed: ${connectionError.message}`);
  }
  console.log('✅ Supabase connection successful');

  // Check current prop status
  console.log('\nChecking current prop status...');
  const { data: propStats, error: statsError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT
          COUNT(*) as total_props,
          COUNT(professional_score) as with_professional_score,
          COUNT(tier) as with_tier,
          COUNT(CASE WHEN feature_contributions::text != '{}' THEN 1 END) as with_real_factors
        FROM raw_props;
      `
    });

  if (statsError) {
    console.log('⚠️ Could not get prop stats, continuing...');
  } else {
    console.log(`Current status: ${JSON.stringify(propStats)}`);
  }

  // Create and initialize ScoringAgent
  console.log('\nInitializing ScoringAgent...');
  const config: BaseAgentConfig = {
    name: 'manual-scoring-agent',
    enabled: true,
    interval: 60000,
    maxRetries: 3,
    timeout: 30000
  };

  const deps = {
    supabase,
    logger: console
  };

  const agent = new ScoringAgent(config, deps);

  try {
    await agent.initialize();
    console.log('✅ ScoringAgent initialized successfully');

    // Check Enhanced 45-Factor status
    const enhanced45Status = agent.getEnhanced45FactorStatus();
    console.log('\nEnhanced 45-Factor Status:');
    console.log(JSON.stringify(enhanced45Status, null, 2));

    // Trigger processing
    console.log('\nTriggering ScoringAgent processing...');
    const startTime = Date.now();
    await agent.process();
    const processingTime = Date.now() - startTime;

    console.log(`✅ Processing completed in ${processingTime}ms`);

    // Check results
    console.log('\nChecking results...');
    const { data: newStats } = await supabase
      .from('raw_props')
      .select('professional_score, tier, feature_contributions')
      .not('professional_score', 'is', null)
      .limit(5);

    if (newStats && newStats.length > 0) {
      console.log(`✅ Found ${newStats.length} props with professional scores:`);
      newStats.forEach((prop, index) => {
        console.log(`  ${index + 1}. Score: ${prop.professional_score}, Tier: ${prop.tier}, Factors: ${Object.keys(prop.feature_contributions || {}).length}`);
      });
    } else {
      console.log('⚠️ No props with professional scores found after processing');
    }

    // Cleanup
    await agent.cleanup();
    console.log('\n✅ ScoringAgent cleanup completed');

  } catch (error) {
    console.error('❌ ScoringAgent failed:', error);
    await agent.cleanup().catch(() => {}); // Try cleanup even on error
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  triggerScoringAgent()
    .then(() => {
      console.log('\n🎉 Scoring agent trigger completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Scoring agent trigger failed:', error);
      process.exit(1);
    });
}

export { triggerScoringAgent };