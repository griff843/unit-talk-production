#!/usr/bin/env node
/**
 * Start Temporal Worker for Automated Pipeline Processing
 */

import { Worker } from '@temporalio/worker';
import { Connection } from '@temporalio/client';
import * as activities from './src/activities';

async function runWorker() {
  console.log('🚀 STARTING TEMPORAL WORKER FOR AUTOMATED PROCESSING');
  console.log('================================================================================\n');

  try {
    // Create connection to Temporal
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'temporal:7233',
    });

    // Create worker
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'unit-talk-pipeline',
      workflowsPath: require.resolve('./src/workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    console.log('✅ Worker started successfully');
    console.log('📋 Task Queue: unit-talk-pipeline');
    console.log('🔄 Listening for workflows...\n');

    // Register shutdown handlers
    process.on('SIGTERM', () => worker.shutdown());
    process.on('SIGINT', () => worker.shutdown());

    // Run the worker
    await worker.run();

  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

runWorker().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});