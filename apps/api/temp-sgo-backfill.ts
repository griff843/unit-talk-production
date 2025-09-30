#!/usr/bin/env tsx

import 'dotenv/config';
import { Client, Connection } from '@temporalio/client';

async function main() {
  console.log('🚀 Starting SGO Backfill Workflow via Temporal Client');

  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'temporal:7233'
    });

    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default'
    });

    const workflowOptions = {
      sports: ['MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA'],
      days: 7,
      batchSize: 50,
      rateLimit: 60,
      dryRun: false
    };

    console.log('Starting backfillSportsGameOdds workflow with options:', workflowOptions);

    const handle = await client.workflow.start('backfillSportsGameOdds', {
      args: [workflowOptions],
      taskQueue: 'unit-talk-dev',
      workflowId: `sgo-backfill-${Date.now()}`
    });

    console.log('✅ SGO Backfill started successfully!');
    console.log('📋 Workflow ID:', handle.workflowId);
    console.log('🔗 Monitor at: http://localhost:8088/namespaces/default/workflows/' + handle.workflowId);

    await connection.close();

  } catch (error) {
    console.error('❌ Failed to start SGO backfill:', error);
    process.exit(1);
  }
}

main();