#!/usr/bin/env tsx

/**
 * Trigger the grading pipeline to process the 23,419 raw_props into unified_picks
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';
import { GradingAgent } from '../agents/GradingAgent';
import { createLogger } from '../utils/logger';
import { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';

const logger = createLogger('GradingPipeline');

async function triggerGradingPipeline() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🎯 Starting Professional Grading Pipeline...');
    logger.info('🔧 System configured for professional scoring (USE_PRO_SCORER=true)');

    // Create GradingAgent instance
    const config: BaseAgentConfig = {
      name: 'GradingAgent',
      enabled: true,
      version: '1.0.0'
    };

    const deps: BaseAgentDependencies = {
      supabase,
      logger
    };

    const gradingAgent = new GradingAgent(config, deps);
    
    // Initialize the agent
    await gradingAgent.initialize();
    logger.info('✅ GradingAgent initialized');

    // Run health check
    const health = await gradingAgent.checkHealth();
    logger.info('🏥 Agent Health Check:', health);

    if (health.status !== 'healthy' && health.status !== 'degraded') {
      throw new Error(`GradingAgent is unhealthy: ${health.status}`);
    }

    // Process pending props
    logger.info('🔄 Processing pending props...');
    await gradingAgent.process();

    // Check results
    const { count: afterGrading, error: afterError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (afterError) {
      logger.error('Error checking unified_picks after grading:', afterError);
    } else {
      logger.info(`📈 unified_picks after grading: ${afterGrading}`);
    }

    // Get some sample results
    const { data: samplePicks, error: sampleError } = await supabase
      .from('unified_picks')
      .select('player_name, stat_type, tier_when_placed, confidence, kelly_bet_size')
      .limit(5);

    if (sampleError) {
      logger.warn('Could not fetch sample picks:', sampleError);
    } else if (samplePicks && samplePicks.length > 0) {
      logger.info('📋 Sample promoted picks:');
      console.table(samplePicks);
    }

    // Clean up
    await gradingAgent.cleanup();
    logger.info('✅ Grading pipeline completed');

  } catch (error) {
    logger.error('❌ Grading pipeline failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  triggerGradingPipeline()
    .then(() => {
      console.log('\n✅ Grading pipeline execution completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Grading pipeline failed:', error);
      process.exit(1);
    });
}