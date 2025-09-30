#!/usr/bin/env tsx

/**
 * Test Professional Grading System
 * Manually tests that the professional grading pipeline is working
 */

import 'dotenv/config';
import { ScoringAgent } from './src/agents/ScoringAgent/ScoringAgent';
import { BaseAgentConfig, BaseAgentDependencies } from './src/agents/BaseAgent/types';
import { createSupabaseClient } from './src/services/supabaseClient';
import { createLogger } from './src/utils/logger';

const logger = createLogger('professional-grading-test');

async function testProfessionalGrading() {
  try {
    logger.info('🔬 Testing Professional Grading System...');
    
    // Create dependencies
    const supabase = createSupabaseClient();
    const deps: BaseAgentDependencies = {
      supabase,
      logger
    };
    
    // Create config
    const config: BaseAgentConfig = {
      name: 'test-grading-agent',
      version: '1.0.0'
    };
    
    // Initialize grading agent
    const scoringAgent = new ScoringAgent(config, deps);
    await gradingAgent.initialize();
    
    logger.info('✅ ScoringAgent initialized successfully');
    
    // Test health check
    const health = await gradingAgent.checkHealth();
    logger.info('🏥 Health Check:', health);
    
    // Get count of unprocessed props
    const { data: unprocessedProps, error: countError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null);
      
    if (countError) {
      logger.error('❌ Error counting unprocessed props:', countError);
      return;
    }
    
    logger.info(`📊 Found ${unprocessedProps || 0} unprocessed props ready for professional grading`);
    
    // Test processing a small batch
    logger.info('🎯 Testing professional grading on small batch...');
    
    try {
      await gradingAgent.process();
      logger.info('✅ Professional grading process completed successfully');
    } catch (processError) {
      logger.error('❌ Professional grading process failed:', processError);
    }
    
    // Check if any props were processed
    const { data: processedProps, error: processedError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .not('processed_at', 'is', null);
      
    if (!processedError) {
      logger.info(`📈 Total props processed by professional system: ${processedProps || 0}`);
    }
    
    // Get metrics
    const metrics = await gradingAgent.collectMetrics();
    logger.info('📊 Grading Metrics:', {
      picksProcessed: metrics.picksProcessed,
      picksGraded: metrics.picksGraded,
      promotedToFinal: metrics.promotedToFinal,
      avgGradingTime: metrics.avgGradingTimeMs,
      errorCount: metrics.errorCount
    });
    
    logger.info('🎉 Professional grading system test completed!');
    
  } catch (error) {
    logger.error('💥 Professional grading test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testProfessionalGrading()
    .then(() => {
      logger.info('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testProfessionalGrading };