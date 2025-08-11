#!/usr/bin/env tsx

/**
 * Simple Shadow Mode Test
 * Quick validation of shadow mode functionality
 */

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { ShadowModeService } from '../shadow/ShadowMode';

const logger = createLogger('shadow-simple-test');

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Simple Shadow Mode Test');
    
    const shadowMode = ShadowModeService.getInstance();
    
    logger.info(`Shadow mode enabled: ${shadowMode.isShadowMode()}`);
    
    // Test basic functionality
    const testPick = {
      sport: 'TEST',
      market: 'simple-test',
      player: 'Test Player',
      tier: 'A'
    };
    
    logger.info('Testing shadow write...');
    await shadowMode.shadowWritePick(testPick, 'instant', ['simple-test']);
    
    logger.info('✅ Shadow write successful');
    
    // Test public action blocking
    const publishBlocked = shadowMode.shouldSkipPublicAction('publish');
    const alertBlocked = shadowMode.shouldSkipPublicAction('alert');
    
    logger.info(`Public actions blocked - Publish: ${publishBlocked}, Alert: ${alertBlocked}`);
    
    logger.info('🎉 Simple test completed successfully');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}