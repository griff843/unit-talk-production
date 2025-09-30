#!/usr/bin/env node

/**
 * SGO Backfill Script
 * 
 * Command-line interface for SportsGameOdds backfill operations
 * during the 7-day trial period.
 * 
 * Usage:
 * npm run db:backfill:sgo -- --days=7 --sports=all
 * npm run db:backfill:sgo:test -- --days=2 --sports=MLB,NBA --dry-run
 * npm run db:backfill:sgo:continuous -- --continuous --days=30
 */

import { program } from 'commander';
import { Client } from '@temporalio/client';
import { createLogger } from '../src/utils/logger';
import { getEnv } from '../src/utils/getEnv';
import { backfillSportsGameOdds, continuousSGOBackfill, backfillSportSpecific } from '../src/workflows/backfillSportsGameOdds';
import type { BackfillSGOOptions } from '../src/activities/backfillSGOActivities';

const logger = createLogger('SGOBackfillScript');
const env = getEnv();

// Supported sports
const SUPPORTED_SPORTS = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'];

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

async function runBackfill(options: BackfillSGOOptions) {
  const client = await connectToTemporal();

  try {
    // Validate sports
    if (options.sports) {
      const invalidSports = options.sports.filter(sport => !SUPPORTED_SPORTS.includes(sport));
      if (invalidSports.length > 0) {
        throw new Error(`Invalid sports: ${invalidSports.join(', ')}. Supported: ${SUPPORTED_SPORTS.join(', ')}`);
      }
    }

    // Validate API key
    if (!process.env.SPORTSGAMEODDS_KEY) {
      throw new Error('SPORTSGAMEODDS_KEY environment variable is required');
    }

    logger.info('Starting SGO backfill workflow', {
      sports: options.sports || 'all',
      days: options.days,
      batchSize: options.batchSize,
      rateLimit: options.rateLimit,
      dryRun: options.dryRun
    });

    const workflowId = `sgo-backfill-${Date.now()}`;
    
    const handle = await client.workflow.start(backfillSportsGameOdds, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [options]
    });

    logger.info('Workflow started', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    });

    if (program.opts().wait !== false) {
      logger.info('Waiting for workflow to complete...');
      
      const result = await handle.result();
      
      logger.info('Backfill completed successfully', {
        workflowId: handle.workflowId,
        result: {
          totalGames: result.processedGames,
          totalProps: result.processedProps,
          duplicatesSkipped: result.duplicatesSkipped,
          errors: result.errors?.length || 0,
          status: result.status
        }
      });

      if (result.errors && result.errors.length > 0) {
        logger.warn('Backfill completed with errors', {
          errorCount: result.errors.length,
          firstFewErrors: result.errors.slice(0, 3)
        });
      }
    } else {
      logger.info('Backfill started in background', {
        workflowId: handle.workflowId,
        temporalUI: 'http://localhost:8088'
      });
    }

  } catch (error) {
    logger.error('Backfill failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  } finally {
    await client.connection.close();
  }
}

async function runContinuousBackfill(options: BackfillSGOOptions) {
  const client = await connectToTemporal();

  try {
    logger.info('Starting continuous SGO backfill workflow', {
      sports: options.sports || 'all',
      maxDays: options.maxDays || 30,
      batchSize: options.batchSize,
      rateLimit: options.rateLimit
    });

    const workflowId = `sgo-continuous-backfill-${Date.now()}`;
    
    const handle = await client.workflow.start(continuousSGOBackfill, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [{ ...options, maxDays: options.maxDays || 30 }]
    });

    logger.info('Continuous workflow started', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      temporalUI: 'http://localhost:8088'
    });

    logger.info('Continuous backfill running in background - use Temporal UI to monitor progress');

  } catch (error) {
    logger.error('Continuous backfill failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  } finally {
    await client.connection.close();
  }
}

async function runSportSpecificBackfill(sport: string, days: number) {
  if (!SUPPORTED_SPORTS.includes(sport)) {
    logger.error(`Invalid sport: ${sport}. Supported: ${SUPPORTED_SPORTS.join(', ')}`);
    process.exit(1);
  }

  const client = await connectToTemporal();

  try {
    logger.info('Starting sport-specific SGO backfill', { sport, days });

    const workflowId = `sgo-backfill-${sport.toLowerCase()}-${Date.now()}`;
    
    const handle = await client.workflow.start(backfillSportSpecific, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [sport, days]
    });

    logger.info('Sport-specific workflow started', {
      sport,
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    });

    if (program.opts().wait !== false) {
      const result = await handle.result();
      
      logger.info('Sport-specific backfill completed', {
        sport,
        result: {
          totalGames: result.processedGames,
          totalProps: result.processedProps,
          duplicatesSkipped: result.duplicatesSkipped,
          errors: result.errors?.length || 0,
          status: result.status
        }
      });
    }

  } catch (error) {
    logger.error('Sport-specific backfill failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  } finally {
    await client.connection.close();
  }
}

// CLI Setup
program
  .name('sgo-backfill')
  .description('SportsGameOdds backfill during 7-day trial period')
  .version('1.0.0');

program
  .option('-d, --days <number>', 'Number of days to backfill', '7')
  .option('-s, --sports <sports>', 'Comma-separated list of sports (or "all")', 'all')
  .option('-b, --batch-size <number>', 'Batch size for processing', '100')
  .option('-r, --rate-limit <number>', 'Rate limit (requests per minute)', '60')
  .option('--dry-run', 'Dry run mode - no writes to database')
  .option('--continuous', 'Run continuous backfill workflow')
  .option('--sport <sport>', 'Single sport to backfill')
  .option('--no-wait', 'Start workflow and exit immediately')
  .action(async (options) => {
    try {
      // Parse options
      const days = parseInt(options.days);
      const batchSize = parseInt(options.batchSize);
      const rateLimit = parseInt(options.rateLimit);

      if (isNaN(days) || days < 1 || days > 30) {
        logger.error('Days must be between 1 and 30');
        process.exit(1);
      }

      if (isNaN(batchSize) || batchSize < 1 || batchSize > 1000) {
        logger.error('Batch size must be between 1 and 1000');
        process.exit(1);
      }

      if (isNaN(rateLimit) || rateLimit < 1 || rateLimit > 300) {
        logger.error('Rate limit must be between 1 and 300 requests per minute');
        process.exit(1);
      }

      // Parse sports
      let sports: string[] | undefined;
      if (options.sports && options.sports !== 'all') {
        sports = options.sports.split(',').map((s: string) => s.trim().toUpperCase());
      }

      const backfillOptions: BackfillSGOOptions = {
        sports,
        days,
        batchSize,
        rateLimit,
        dryRun: options.dryRun
      };

      // Route to appropriate handler
      if (options.continuous) {
        await runContinuousBackfill(backfillOptions);
      } else if (options.sport) {
        await runSportSpecificBackfill(options.sport.toUpperCase(), days);
      } else {
        await runBackfill(backfillOptions);
      }

    } catch (error) {
      logger.error('Script failed', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// Add examples
program.addHelpText('after', `
Examples:
  # Backfill 7 days of all sports (trial default)
  npm run db:backfill:sgo

  # Test with 2 days of MLB and NBA only (dry run)
  npm run db:backfill:sgo:test

  # Continuous backfill for 30 days
  npm run db:backfill:sgo:continuous

  # Single sport backfill
  SPORT=MLB npm run db:backfill:sgo:sport

  # Custom options
  npm run sgo:backfill -- --days=5 --sports=NFL,NBA --batch-size=50 --rate-limit=30

  # Background execution
  npm run sgo:backfill -- --days=7 --no-wait

  # Trial quota-safe settings
  npm run sgo:backfill -- --days=7 --rate-limit=30 --batch-size=50
`);

// Parse and run
if (require.main === module) {
  program.parse();
}