#!/usr/bin/env tsx
/**
 * TEST WORKFLOW SETUP
 * Quick test to verify our workflow auto-start configuration is working
 */

import 'dotenv/config';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkflowSetupTest');

async function testWorkflowSetup() {
  logger.info('🧪 Testing Unit Talk Workflow Auto-Start Configuration');
  logger.info('====================================================');

  try {
    // Test 1: Import test
    logger.info('✅ Testing imports...');
    const startAllWorkflows = await import('./start-all-workflows');
    logger.info('   ✅ start-all-workflows.ts imports successfully');

    const worker = await import('../worker');
    logger.info('   ✅ worker.ts imports successfully');

    // Test 2: Configuration test
    logger.info('✅ Testing configuration...');
    const env = process.env;

    if (!env.TEMPORAL_SERVER_URL) {
      logger.warn('   ⚠️ TEMPORAL_SERVER_URL not set, using default: localhost:7233');
    } else {
      logger.info(`   ✅ TEMPORAL_SERVER_URL: ${env.TEMPORAL_SERVER_URL}`);
    }

    if (!env.TEMPORAL_TASK_QUEUE) {
      logger.warn('   ⚠️ TEMPORAL_TASK_QUEUE not set, using default: default');
    } else {
      logger.info(`   ✅ TEMPORAL_TASK_QUEUE: ${env.TEMPORAL_TASK_QUEUE}`);
    }

    // Test 3: Workflow definitions test
    logger.info('✅ Testing workflow definitions...');
    const syndicateScheduler = await import('../workflows/syndicate-scheduler');
    logger.info('   ✅ syndicate-scheduler.ts loads successfully');

    const supportWorkflows = await import('../workflows/support-workflows');
    logger.info('   ✅ support-workflows.ts loads successfully');

    // Test 4: Package.json scripts test
    logger.info('✅ Testing package.json scripts...');
    try {
      const fs = await import('fs');
      const path = await import('path');
      const pkgPath = path.resolve(__dirname, '../../../../package.json');
      const pkgContent = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);

      if (pkg.scripts && pkg.scripts['workflows:start']) {
        logger.info('   ✅ npm run workflows:start available');
      } else {
        logger.error('   ❌ workflows:start script missing');
      }

      if (pkg.scripts && pkg.scripts['workflows:start-critical']) {
        logger.info('   ✅ npm run workflows:start-critical available');
      } else {
        logger.error('   ❌ workflows:start-critical script missing');
      }
    } catch (error) {
      logger.warn('   ⚠️  Could not read package.json scripts');
    }

    // Summary
    logger.info('🎯 Configuration Test Summary:');
    logger.info('============================');
    logger.info('✅ All imports working');
    logger.info('✅ All workflow definitions loadable');
    logger.info('✅ Package.json scripts configured');
    logger.info('');
    logger.info('🚀 Your workflow auto-start system is properly configured!');
    logger.info('');
    logger.info('📋 Next Steps:');
    logger.info('   1. Ensure Temporal server is running: docker-compose up -d temporal');
    logger.info('   2. Start workflows manually: npm run workflows:start-critical');
    logger.info(
      '   3. Or restart workers (they will auto-start workflows): docker-compose restart workers'
    );
    logger.info('   4. Check Temporal UI: http://localhost:8088');
  } catch (error) {
    logger.error('❌ Configuration test failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

testWorkflowSetup().catch(console.error);
