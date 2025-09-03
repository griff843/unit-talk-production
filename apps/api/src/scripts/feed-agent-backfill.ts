#!/usr/bin/env npx tsx

/**
 * FeedAgent Backfill CLI Script
 * 
 * Usage:
 *   npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02
 *   npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02 --sport=NFL --dryRun
 *   npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02 --maxCalls=10
 */

import { Worker } from '@temporalio/worker';
import { Connection, Client } from '@temporalio/client';
import { FeedAgentBackfillWorkflow, BackfillRequest, getProgressQuery } from '../workflows/FeedAgentBackfillWorkflow';
import * as activities from '../activities/backfill';
import { Logger } from '../utils/logger';

interface CLIArgs {
  start: string;
  end: string;
  sport?: string;
  dryRun?: boolean;
  maxCalls?: number;
  batchSize?: number;
  delayBetweenChunks?: number;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    start: '',
    end: ''
  };

  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--start=')) {
      args.start = arg.split('=')[1];
    } else if (arg.startsWith('--end=')) {
      args.end = arg.split('=')[1];
    } else if (arg.startsWith('--sport=')) {
      args.sport = arg.split('=')[1];
    } else if (arg.startsWith('--maxCalls=')) {
      args.maxCalls = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--batchSize=')) {
      args.batchSize = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delayBetweenChunks=')) {
      args.delayBetweenChunks = parseInt(arg.split('=')[1]);
    } else if (arg === '--dryRun') {
      args.dryRun = true;
    } else if (arg === '--help') {
      args.help = true;
    }
  });

  return args;
}

function showHelp() {
  console.log(`
FeedAgent Backfill Tool - Backfill props for date ranges with safety controls

Usage:
  npx tsx src/scripts/feed-agent-backfill.ts [options]

Options:
  --start=YYYY-MM-DD        Start date (required)
  --end=YYYY-MM-DD          End date (required)
  --sport=SPORT             Filter by sport (optional)
  --dryRun                  Don't persist data, just log what would be done
  --maxCalls=N              Maximum API calls (safety limit)
  --batchSize=N             Props per batch (default: 100)
  --delayBetweenChunks=MS   Delay between chunks in milliseconds (default: 1000)
  --help                    Show this help

Examples:
  # Backfill NFL props for August 1-2, 2025
  npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02 --sport=NFL

  # Dry run backfill with safety limits
  npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02 --dryRun --maxCalls=10

  # Backfill with custom batch size and delays
  npx tsx src/scripts/feed-agent-backfill.ts --start=2025-08-01 --end=2025-08-02 --batchSize=50 --delayBetweenChunks=2000

Safety Features:
  - Idempotent: Won't duplicate existing data
  - Rate limiting: Configurable delays between API calls
  - Dry run: Test without persisting data
  - Max calls limit: Prevent runaway processes
  - Progress tracking: Monitor completion status
  `);
}

async function monitorProgress(client: Client, workflowId: string) {
  const handle = client.workflow.getHandle(workflowId);
  
  console.log('🔄 Monitoring backfill progress...');
  console.log('Press Ctrl+C to cancel the workflow\n');

  const progressInterval = setInterval(async () => {
    try {
      const progress = await handle.query(getProgressQuery);
      
      const percentage = progress.totalHours > 0 
        ? Math.round((progress.completedHours / progress.totalHours) * 100)
        : 0;

      console.log(`📊 Progress: ${progress.completedHours}/${progress.totalHours} hours (${percentage}%)`);
      console.log(`   Props: ${progress.processedProps} processed, ${progress.duplicateProps} duplicates`);
      console.log(`   API calls: ${progress.apiCallCount}, Status: ${progress.status}`);
      
      if (progress.failedHours > 0) {
        console.log(`   ⚠️  Failed hours: ${progress.failedHours}`);
      }
      
      console.log(''); // Empty line for readability

      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
        clearInterval(progressInterval);
        
        if (progress.status === 'completed') {
          console.log('✅ Backfill completed successfully!');
          console.log(`Final results: ${progress.processedProps} props processed from ${progress.totalHours} hours`);
        } else if (progress.status === 'failed') {
          console.log('❌ Backfill failed:', progress.error);
        } else if (progress.status === 'cancelled') {
          console.log('🛑 Backfill was cancelled');
        }
        
        process.exit(0);
      }
    } catch (error) {
      console.error('Error querying progress:', error);
    }
  }, 5000); // Update every 5 seconds

  // Handle Ctrl+C to cancel workflow
  process.on('SIGINT', async () => {
    console.log('\n🛑 Cancelling backfill workflow...');
    clearInterval(progressInterval);
    
    try {
      await handle.signal('cancel');
      console.log('Cancel signal sent. Waiting for workflow to stop...');
      
      // Wait a bit for cancellation to process
      setTimeout(() => {
        console.log('Workflow cancellation initiated.');
        process.exit(0);
      }, 3000);
    } catch (error) {
      console.error('Error cancelling workflow:', error);
      process.exit(1);
    }
  });
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  if (!args.start || !args.end) {
    console.error('❌ Error: --start and --end dates are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    // Validate date format
    const startDate = new Date(args.start);
    const endDate = new Date(args.end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('❌ Error: Invalid date format. Use YYYY-MM-DD');
      process.exit(1);
    }

    if (startDate >= endDate) {
      console.error('❌ Error: Start date must be before end date');
      process.exit(1);
    }

    console.log('🚀 Starting FeedAgent Backfill...');
    console.log(`📅 Date range: ${args.start} to ${args.end}`);
    console.log(`🏈 Sport: ${args.sport || 'all sports'}`);
    console.log(`🧪 Dry run: ${args.dryRun ? 'YES' : 'NO'}`);
    console.log(`🛡️  Max calls: ${args.maxCalls || 'unlimited'}`);
    console.log('');

    // Create Temporal connection
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    const client = new Client({ connection });

    // Create backfill request
    const backfillRequest: BackfillRequest = {
      startDate: args.start,
      endDate: args.end,
      sport: args.sport,
      dryRun: args.dryRun || false,
      maxCalls: args.maxCalls,
      batchSize: args.batchSize || 100,
      delayBetweenChunks: args.delayBetweenChunks || 1000
    };

    // Start workflow
    const workflowId = `feed-backfill-${Date.now()}`;
    const handle = await client.workflow.start(FeedAgentBackfillWorkflow, {
      args: [backfillRequest],
      taskQueue: 'feed-agent',
      workflowId,
    });

    console.log(`✅ Started backfill workflow: ${workflowId}`);
    console.log(`🔗 Workflow URL: http://localhost:8080/namespaces/default/workflows/${workflowId}`);
    console.log('');

    // Monitor progress
    await monitorProgress(client, workflowId);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}