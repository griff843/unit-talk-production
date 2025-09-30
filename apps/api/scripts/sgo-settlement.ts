#!/usr/bin/env node

/**
 * SGO Settlement Script
 * 
 * Command-line interface for settling props that were backfilled from SGO
 */

import { program } from 'commander';
import { Client } from '@temporalio/client';
import { createLogger } from '../src/utils/logger';
import { getEnv } from '../src/utils/getEnv';
import { settlementBackfillWorkflow, settlementIdsWorkflow } from '../src/workflows/agents/SettlementAgent';

const logger = createLogger('SGOSettlementScript');
const env = getEnv();

async function connectToTemporal(): Promise<Client> {
  try {
    const client = new Client({
      address: env.TEMPORAL_SERVER_URL
    });
    
    logger.info('Connected to Temporal server', { address: env.TEMPORAL_SERVER_URL });
    return client;
  } catch (error) {
    logger.error('Failed to connect to Temporal server', { error });
    process.exit(1);
  }
}

async function runSettlementBackfill(options: any) {
  const client = await connectToTemporal();

  try {
    logger.info('Starting SGO settlement backfill workflow', {
      league: options.league,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      batchSize: options.batchSize,
      dryRun: options.dryRun
    });

    const workflowId = `sgo-settlement-backfill-${Date.now()}`;
    
    const settlementOptions = {
      league: options.league,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      batchSize: parseInt(options.batchSize),
      dryRun: options.dryRun,
      rateLimit: parseInt(options.rateLimit),
      force: options.force
    };

    const handle = await client.workflow.start(settlementBackfillWorkflow, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [settlementOptions]
    });

    logger.info('Settlement workflow started', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    });

    if (!options.noWait) {
      logger.info('Waiting for settlement to complete...');
      
      const jobId = await handle.result();
      
      logger.info('Settlement completed successfully', {
        workflowId: handle.workflowId,
        jobId
      });
    } else {
      logger.info('Settlement started in background', {
        workflowId: handle.workflowId,
        temporalUI: 'http://localhost:8088'
      });
    }

  } catch (error) {
    logger.error('Settlement failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  } finally {
    await client.connection.close();
  }
}

async function runSettlementIds(ids: string[], options: any) {
  const client = await connectToTemporal();

  try {
    logger.info('Starting SGO settlement for specific IDs', {
      idCount: ids.length,
      batchSize: options.batchSize,
      dryRun: options.dryRun
    });

    const workflowId = `sgo-settlement-ids-${Date.now()}`;
    
    const settlementOptions = {
      ids,
      batchSize: parseInt(options.batchSize),
      dryRun: options.dryRun,
      rateLimit: parseInt(options.rateLimit),
      force: options.force
    };

    const handle = await client.workflow.start(settlementIdsWorkflow, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [settlementOptions]
    });

    logger.info('Settlement workflow started', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    });

    if (!options.noWait) {
      const jobId = await handle.result();
      
      logger.info('Settlement completed successfully', {
        workflowId: handle.workflowId,
        jobId,
        settledIds: ids.length
      });
    }

  } catch (error) {
    logger.error('Settlement failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  } finally {
    await client.connection.close();
  }
}

// CLI Setup
program
  .name('sgo-settlement')
  .description('Settle props backfilled from SportsGameOdds')
  .version('1.0.0');

program
  .command('backfill')
  .description('Run settlement backfill for SGO data')
  .option('-l, --league <league>', 'Filter by league/sport')
  .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
  .option('--date-to <date>', 'End date (YYYY-MM-DD)')
  .option('-b, --batch-size <number>', 'Batch size for processing', '100')
  .option('-r, --rate-limit <number>', 'Rate limit (requests per minute)', '30')
  .option('--dry-run', 'Dry run mode - no writes to database')
  .option('--force', 'Force re-settlement of already settled props')
  .option('--no-wait', 'Start workflow and exit immediately')
  .action(runSettlementBackfill);

program
  .command('ids <ids...>')
  .description('Settle specific prop IDs')
  .option('-b, --batch-size <number>', 'Batch size for processing', '50')
  .option('-r, --rate-limit <number>', 'Rate limit (requests per minute)', '30')
  .option('--dry-run', 'Dry run mode - no writes to database')
  .option('--force', 'Force re-settlement of already settled props')
  .option('--no-wait', 'Start workflow and exit immediately')
  .action((ids, options) => runSettlementIds(ids, options));

program
  .command('unsettled')
  .description('Settle all unsettled SGO props')
  .option('-l, --league <league>', 'Filter by league/sport')
  .option('-b, --batch-size <number>', 'Batch size for processing', '100')
  .option('-r, --rate-limit <number>', 'Rate limit (requests per minute)', '30')
  .option('--dry-run', 'Dry run mode - no writes to database')
  .option('--no-wait', 'Start workflow and exit immediately')
  .action((options) => {
    // Set date range to include all unsettled props
    const extendedOptions = {
      ...options,
      dateFrom: '2020-01-01', // Far back to include all
      dateTo: new Date().toISOString().split('T')[0] // Today
    };
    runSettlementBackfill(extendedOptions);
  });

// Add examples
program.addHelpText('after', `
Examples:
  # Settle all SGO props from last 7 days
  npm run sgo:settlement backfill --date-from=2024-01-01

  # Settle specific sport
  npm run sgo:settlement backfill --league=MLB --date-from=2024-01-01

  # Settle specific prop IDs
  npm run sgo:settlement ids 123 456 789

  # Dry run to see what would be settled
  npm run sgo:settlement unsettled --league=NBA --dry-run

  # Force re-settlement of already settled props
  npm run sgo:settlement backfill --force --date-from=2024-01-01

  # Background settlement
  npm run sgo:settlement unsettled --no-wait
`);

// Parse and run
if (require.main === module) {
  program.parse();
}