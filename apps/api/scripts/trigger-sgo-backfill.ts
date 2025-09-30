#!/usr/bin/env node

/**
 * Simple SGO Backfill Trigger
 * Bypasses commander.js issues to directly trigger the backfill workflow
 */

import { Client } from '@temporalio/client';
import { createLogger } from '../src/utils/logger';
import { getEnv } from '../src/utils/getEnv';
import { backfillSportsGameOdds } from '../src/workflows/backfillSportsGameOdds';

const logger = createLogger('SGOBackfillTrigger');
const env = getEnv();

async function triggerSGOBackfill() {
  try {
    logger.info('Connecting to Temporal...');

    const client = new Client({
      connection: {
        address: env.TEMPORAL_ADDRESS || 'temporal:7233',
      }
    });

    const options = {
      sports: 'MLB',
      days: 2,
      batchSize: 100,
      rateLimit: 1000,
      dryRun: false
    };

    const workflowId = `sgo-backfill-${Date.now()}`;

    logger.info('Starting SGO backfill workflow...', {
      workflowId,
      options
    });

    const handle = await client.workflow.start(backfillSportsGameOdds, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [options]
    });

    logger.info('SGO backfill workflow started successfully!', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      temporalUI: 'http://localhost:8088'
    });

    logger.info('Waiting for workflow to complete...');
    const result = await handle.result();

    logger.info('SGO backfill completed!', {
      workflowId: handle.workflowId,
      result
    });

  } catch (error) {
    logger.error('SGO backfill failed:', error);
    process.exit(1);
  }
}

triggerSGOBackfill().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});