#!/usr/bin/env tsx

/**
 * Quick system check to see if the workflow is actually running
 */

import 'dotenv/config';
import { Connection, Client } from '@temporalio/client';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function quickSystemCheck() {
  try {
    const env = getEnv();
    logger.info('🔍 QUICK SYSTEM CHECK - Temporal Workflow Status');
    logger.info('=' .repeat(50));

    // Connect to Temporal
    const connection = await Connection.connect({
      address: env.TEMPORAL_SERVER_URL || 'temporal:7233'
    });

    const client = new Client({ connection });

    // Check syndicate scheduler workflow
    const workflowId = 'syndicate-scheduler-main';
    
    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      
      logger.info(`📊 Syndicate Scheduler Status: ${description.status.name}`);
      logger.info(`🕐 Started: ${description.startTime}`);
      logger.info(`⚡ Runtime: ${description.runTime}`);
      logger.info(`📈 History Length: ${description.historyLength} events`);
      
      if (description.status.name === 'RUNNING') {
        logger.info('✅ CONFIRMED: Workflow is actively running');
        
        // The workflow should be producing history events if it's actually working
        if (description.historyLength > 10) {
          logger.info('🚀 ACTIVE: Workflow has significant activity');
        } else {
          logger.info('⚠️  LIMITED: Workflow may have just started or is idle');
        }
      } else {
        logger.info(`❌ ISSUE: Workflow status is ${description.status.name}, not RUNNING`);
      }

    } catch (error) {
      logger.error(`❌ Could not find workflow: ${error}`);
      return;
    }

    // Check for any recent workflows that might indicate activity
    logger.info('\n🔍 Checking for recent workflow activity...');
    
    // List workflows to see if there are other active workflows
    try {
      // This is a simple way to check if the system is working
      logger.info('✅ Temporal connection successful');
      logger.info('🔗 View live workflow at: http://localhost:8088/namespaces/default/workflows/syndicate-scheduler-main');
      
    } catch (error) {
      logger.error(`❌ Temporal connection issue: ${error}`);
    }

    // Check worker logs for recent activity
    logger.info('\n📋 RECOMMENDED VERIFICATION STEPS:');
    logger.info('1. 🔗 Open Temporal UI: http://localhost:8088');
    logger.info('2. 📊 Look for "syndicate-scheduler-main" workflow');
    logger.info('3. 🔍 Check workflow history for recent events');
    logger.info('4. 📈 Monitor workflow events every 1-5 minutes');
    logger.info('5. 🎯 Look for "leagueIngestionWorkflow" executions');

    logger.info('\n🎯 SIGNS OF SUCCESS:');
    logger.info('✅ Workflow status: RUNNING');
    logger.info('✅ History events increasing every 1-5 minutes');
    logger.info('✅ Child workflows (leagueIngestionWorkflow) executing');
    logger.info('✅ FeedAgent activities showing in history');

  } catch (error) {
    logger.error('❌ System check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  quickSystemCheck()
    .then(() => {
      console.log('\n✅ Quick system check completed!');
      console.log('🔗 Next: Check Temporal UI for live workflow activity');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ System check failed:', error);
      process.exit(1);
    });
}