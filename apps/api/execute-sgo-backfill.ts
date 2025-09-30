#!/usr/bin/env tsx

import 'dotenv/config';
import { Client, Connection } from '@temporalio/client';
import { createLogger } from './src/utils/logger';

const logger = createLogger('SGO-Backfill-Executor');

async function main() {
  logger.info('🚀 Starting SGO Backfill Workflow');

  try {
    // Connect to Temporal server
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });

    // Start the SGO backfill workflow
    const workflowOptions = {
      days: 7,
      sports: ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'],
      batchSize: 50,
      enableProgress: true,
      enableSettlement: true
    };

    logger.info('Starting backfillSportsGameOdds workflow with options:', workflowOptions);

    try {
      const workflowHandle = await client.workflow.start('backfillSportsGameOdds', {
        args: [workflowOptions],
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-dev',
        workflowId: `sgo-backfill-${Date.now()}`,
      });

      console.log('✅ Workflow handle created successfully');

      logger.info(`✅ SGO Backfill workflow started successfully`);
    logger.info(`📋 Workflow ID: ${workflowHandle.workflowId}`);
    logger.info(`🔗 Workflow URL: http://localhost:8088/namespaces/default/workflows/${workflowHandle.workflowId}`);

    // Optionally wait for completion
    if (process.argv.includes('--wait')) {
      logger.info('⏳ Waiting for workflow completion...');
      const result = await workflowHandle.result();
      logger.info('✅ SGO Backfill completed:', result);
    } else {
      logger.info('🎯 Workflow started in background. Use --wait to wait for completion.');
    }

      // Close connection
      await connection.close();

    } catch (error: any) {
    logger.error('❌ Failed to execute SGO backfill workflow:', error);
    process.exit(1);
  }
}

main();