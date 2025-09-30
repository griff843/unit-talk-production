#!/usr/bin/env tsx

import { Client, Connection } from '@temporalio/client';

async function runBackfill() {
  console.log('🚀 Starting SGO Backfill...');

  try {
    // Connect to Temporal
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'temporal:7233'
    });

    const client = new Client({
      connection,
      namespace: 'default'
    });

    // Start the workflow
    const handle = await client.workflow.start('backfillSportsGameOdds', {
      taskQueue: 'unit-talk-dev',
      workflowId: `sgo-backfill-${Date.now()}`,
      args: [{
        sports: ['MLB', 'NFL', 'NBA'],
        days: 7,
        batchSize: 50,
        rateLimit: 60,
        dryRun: false
      }]
    });

    console.log('✅ Workflow started successfully!');
    console.log('Workflow ID:', handle.workflowId);
    console.log('First run ID:', handle.firstExecutionRunId);
    console.log('View in Temporal UI: http://localhost:8088/namespaces/default/workflows/' + handle.workflowId);

    // Wait a bit to see if it starts processing
    console.log('Waiting for workflow to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to describe the workflow
    const description = await handle.describe();
    console.log('Workflow status:', description.status);

    await connection.close();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runBackfill().catch(console.error);