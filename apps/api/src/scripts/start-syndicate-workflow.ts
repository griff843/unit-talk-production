#!/usr/bin/env tsx

/**
 * Manually start the syndicate scheduler workflow for 1-minute elite updates
 */

import 'dotenv/config';
import { Connection, Client } from '@temporalio/client';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function startSyndicateWorkflow() {
  try {
    const env = getEnv();
    logger.info('🚀 Starting Syndicate Scheduler Workflow for 1-minute elite updates...');

    // Connect to Temporal
    const connection = await Connection.connect({
      address: env.TEMPORAL_SERVER_URL || 'temporal:7233'
    });

    const client = new Client({ connection });

    // Check if workflow is already running
    const workflowId = 'syndicate-scheduler-main';
    
    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      
      logger.info(`📊 Existing workflow status: ${description.status.name}`);
      
      if (description.status.name === 'RUNNING') {
        logger.info('✅ Syndicate scheduler is already running!');
        logger.info(`⏰ Started: ${description.startTime}`);
        logger.info(`🔄 Runtime: ${description.runTime}`);
        return;
      } else {
        logger.info(`⚠️  Workflow exists but status is: ${description.status.name}`);
      }
    } catch (error) {
      logger.info('📋 No existing workflow found, starting new one...');
    }

    // Start the syndicate scheduler workflow
    logger.info('🔄 Starting syndicateSchedulerWorkflow...');
    
    const handle = await client.workflow.start('syndicateSchedulerWorkflow', {
      args: [],
      taskQueue: env.TEMPORAL_TASK_QUEUE || 'unit-talk-queue',
      workflowId: workflowId,
      memo: {
        purpose: 'elite-1-minute-updates',
        startedBy: 'manual-start-script',
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`✅ Syndicate scheduler started!`);
    logger.info(`🆔 Workflow ID: ${handle.workflowId}`);
    logger.info(`🔗 Temporal UI: http://localhost:8088/namespaces/default/workflows/${handle.workflowId}`);

    // Monitor for a few seconds
    logger.info('⏳ Monitoring startup for 10 seconds...');
    
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const description = await handle.describe();
        logger.info(`📊 Status after ${i + 1}s: ${description.status.name}`);
        
        if (description.status.name === 'RUNNING') {
          logger.info('🎯 Workflow is running successfully!');
          break;
        }
      } catch (error) {
        logger.warn(`❌ Could not check status: ${error}`);
      }
    }

    logger.info('\n' + '='.repeat(50));
    logger.info('🏆 SYNDICATE SCHEDULER STATUS');
    logger.info('='.repeat(50));
    logger.info('✅ Elite 1-minute update system activated');
    logger.info('🔄 Processing all leagues in parallel:');
    logger.info('   • MLB, NBA, NFL, NHL, NCAAB, NCAAF');
    logger.info('⚡ Live mode: 1-minute intervals during games');
    logger.info('🕒 Off-peak: 5-minute intervals');
    logger.info('🎯 Auto-grading and promotion active');
    logger.info('📱 Discord alerts ready');
    logger.info('='.repeat(50));

  } catch (error) {
    logger.error('❌ Failed to start syndicate workflow:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startSyndicateWorkflow()
    .then(() => {
      console.log('\n✅ Syndicate workflow startup completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Workflow startup failed:', error);
      process.exit(1);
    });
}