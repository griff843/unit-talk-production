import { Worker } from '@temporalio/worker';
import * as activities from './activities/backfillSGOActivities';

/**
 * Production-grade Temporal Worker for SGO Backfill Operations
 *
 * This worker handles the BackfillSportsGameOdds workflow for processing
 * historical sports data from SportsGameOdds API.
 */
async function run() {
  // Create a Temporal Worker with SGO backfill capabilities
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'backfill-worker',

    // Production-grade worker configuration
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 5,

    // Default timeouts for activities and workflows are now set in the workflow/activity definitions

    // Shutdown configuration
    shutdownGraceTime: '30 seconds',
  });

  console.log('🚀 SGO Backfill Worker started successfully');
  console.log('📋 Registered workflows:', [
    'BackfillSportsGameOdds'
  ]);
  console.log('📋 Registered activities:', [
    'fetchSGOEventsForDay',
    'checkExistingData',
    'insertGamesFromEvents',
    'insertPropsFromEvents'
  ]);
  console.log('📋 Task queue: backfill-worker');
  console.log('✅ Worker ready to process SGO backfill workflows...');

  // Run the worker
  await worker.run();
}

// Start the worker
run().catch((err) => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});