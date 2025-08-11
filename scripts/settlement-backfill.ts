#!/usr/bin/env npx tsx

/**
 * Settlement Backfill Script
 * 
 * CLI tool to backfill historical MLB pick settlements
 * Safe to re-run, respects final buffer, idempotent operations
 */

import { Command } from 'commander';
import { logger } from '../apps/workers/src/utils/logger';
import { selectUnsettledPicks } from '../apps/workers/src/workflows/agents/ScoringAgent/queue';
import { 
  gradePick,
  updateSettlementHeartbeat,
  getEnvironmentConfig
} from '../apps/workers/src/workflows/agents/ScoringAgent/activities';

interface BackfillOptions {
  league: string;
  max: number;
  lookbackHours: number;
  finalBufferMinutes: number;
  batchSize: number;
  dryRun: boolean;
  verbose: boolean;
}

interface BackfillStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  alreadySettled: number;
  errors: string[];
}

/**
 * Main backfill function
 */
async function runSettlementBackfill(options: BackfillOptions): Promise<BackfillStats> {
  const { league, max, lookbackHours, finalBufferMinutes, batchSize, dryRun, verbose } = options;

  logger.info('Starting settlement backfill', {
    league,
    max,
    lookbackHours,
    finalBufferMinutes,
    batchSize,
    dryRun
  });

  // Check environment configuration
  const config = await getEnvironmentConfig();
  
  if (!config.SCORING_ENABLED && !dryRun) {
    throw new Error('SCORING_ENABLED=false in environment. Use --dry-run to test or set SCORING_ENABLED=true');
  }

  if (dryRun) {
    logger.info('🧪 DRY RUN MODE - No database changes will be made');
  }

  const stats: BackfillStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    alreadySettled: 0,
    errors: []
  };

  const startTime = Date.now();
  let totalProcessed = 0;

  try {
    while (totalProcessed < max) {
      // Calculate remaining capacity for this batch
      const remainingCapacity = max - totalProcessed;
      const currentBatchSize = Math.min(batchSize, remainingCapacity);

      logger.info(`Fetching batch ${Math.floor(totalProcessed / batchSize) + 1}`, {
        currentBatchSize,
        totalProcessed,
        max
      });

      // Select unsettled picks for this batch
      const picks = await selectUnsettledPicks({
        league,
        limit: currentBatchSize,
        lookbackHours,
        finalBufferMinutes
      });

      if (picks.length === 0) {
        logger.info('No more picks to process');
        break;
      }

      logger.info(`Processing batch of ${picks.length} picks`);

      // Process each pick in the batch
      for (const pick of picks) {
        if (totalProcessed >= max) {
          logger.info('Reached maximum pick limit, stopping');
          break;
        }

        try {
          if (verbose) {
            logger.info('Processing pick', {
              id: pick.id,
              player: pick.player,
              market: pick.market,
              line: pick.line,
              team: pick.team
            });
          }

          const result = await gradePick({ pick, dryRun });

          totalProcessed++;
          stats.totalProcessed++;

          if (result.success) {
            if (result.details?.writeResult?.alreadySettled) {
              stats.alreadySettled++;
              if (verbose) {
                logger.info('Pick already settled', { 
                  id: pick.id,
                  actual: result.actual,
                  result: result.result 
                });
              }
            } else {
              stats.successful++;
              logger.info('Pick graded successfully', {
                id: pick.id,
                player: pick.player,
                market: pick.market,
                actual: result.actual,
                result: result.result,
                source: result.source
              });
            }
          } else {
            if (result.skipped) {
              stats.skipped++;
              if (verbose) {
                logger.info('Pick skipped', { 
                  id: pick.id, 
                  reason: result.error 
                });
              }
            } else {
              stats.failed++;
              const errorMsg = `${pick.id}: ${result.error}`;
              stats.errors.push(errorMsg);
              logger.error('Pick grading failed', {
                id: pick.id,
                player: pick.player,
                market: pick.market,
                error: result.error
              });
            }
          }

          // Small delay between picks to be respectful to external APIs
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          stats.failed++;
          const errorMsg = `${pick.id}: ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(errorMsg);
          
          logger.error('Unexpected error processing pick', {
            id: pick.id,
            error: error instanceof Error ? error.message : String(error)
          });
          
          totalProcessed++;
        }
      }

      // If we got fewer picks than requested, we're probably done
      if (picks.length < currentBatchSize) {
        logger.info('Received fewer picks than requested, assuming no more available');
        break;
      }

      // Delay between batches
      if (totalProcessed < max) {
        logger.info('Pausing between batches...', { delayMs: 2000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Update heartbeat with final results
    const pipelineName = `${league.toLowerCase()}_backfill`;
    await updateSettlementHeartbeat({
      pipelineName,
      lastCount: stats.successful,
      lastOk: stats.failed === 0,
      lastError: stats.errors.length > 0 ? `${stats.failed} failures` : null,
      runDetails: {
        ...stats,
        durationMs: Date.now() - startTime,
        league,
        max,
        lookbackHours,
        finalBufferMinutes,
        dryRun,
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Backfill process failed', {
      error: error instanceof Error ? error.message : String(error),
      stats
    });

    // Update heartbeat with error
    await updateSettlementHeartbeat({
      pipelineName: `${league.toLowerCase()}_backfill`,
      lastCount: stats.successful,
      lastOk: false,
      lastError: error instanceof Error ? error.message : String(error),
      runDetails: {
        ...stats,
        durationMs: Date.now() - startTime,
        error: 'backfill_failed',
        league,
        dryRun
      }
    });

    throw error;
  }

  return stats;
}

/**
 * Print summary statistics
 */
function printSummary(stats: BackfillStats, durationMs: number, options: BackfillOptions): void {
  console.log('\n' + '='.repeat(60));
  console.log('🏆 SETTLEMENT BACKFILL SUMMARY');
  console.log('='.repeat(60));
  
  if (options.dryRun) {
    console.log('🧪 DRY RUN MODE - No changes were made to the database');
  }

  console.log(`📊 Statistics:`);
  console.log(`   Total Processed:   ${stats.totalProcessed}`);
  console.log(`   ✅ Successful:      ${stats.successful}`);
  console.log(`   ❌ Failed:          ${stats.failed}`);
  console.log(`   ⏭️  Skipped:         ${stats.skipped}`);
  console.log(`   📝 Already Settled: ${stats.alreadySettled}`);
  
  const successRate = stats.totalProcessed > 0 ? 
    ((stats.successful + stats.alreadySettled) / stats.totalProcessed * 100).toFixed(1) : '0';
  console.log(`   📈 Success Rate:    ${successRate}%`);
  
  console.log(`⏱️  Duration:          ${Math.round(durationMs / 1000)}s`);
  console.log(`🏷️  League:            ${options.league}`);
  console.log(`📅 Lookback:          ${options.lookbackHours}h`);
  console.log(`🔒 Final Buffer:      ${options.finalBufferMinutes}min`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(error => {
      console.log(`   • ${error}`);
    });
    
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log('\n' + '='.repeat(60));
  
  if (options.dryRun) {
    console.log('🚀 To run for real: Remove --dry-run flag');
  } else if (stats.successful > 0) {
    console.log('✅ Backfill completed successfully!');
  }
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('settlement-backfill')
    .description('Backfill historical MLB pick settlements')
    .version('1.0.0')
    .option('--league <league>', 'League to process', 'MLB')
    .option('--max <number>', 'Maximum picks to process', '1000')
    .option('--lookback-hours <hours>', 'Hours to look back for picks', '168')
    .option('--final-buffer-minutes <minutes>', 'Buffer after game completion', '20')
    .option('--batch-size <size>', 'Picks to process per batch', '100')
    .option('--dry-run', 'Test mode - no database changes', false)
    .option('--verbose', 'Verbose logging', false)
    .parse();

  const opts = program.opts();
  
  const options: BackfillOptions = {
    league: opts.league,
    max: parseInt(opts.max),
    lookbackHours: parseInt(opts.lookbackHours),
    finalBufferMinutes: parseInt(opts.finalBufferMinutes),
    batchSize: parseInt(opts.batchSize),
    dryRun: opts.dryRun,
    verbose: opts.verbose
  };

  // Validate options
  if (options.max <= 0 || options.max > 10000) {
    console.error('❌ Max must be between 1 and 10000');
    process.exit(1);
  }

  if (options.lookbackHours <= 0 || options.lookbackHours > 8760) { // 1 year
    console.error('❌ Lookback hours must be between 1 and 8760 (1 year)');
    process.exit(1);
  }

  if (options.batchSize <= 0 || options.batchSize > 1000) {
    console.error('❌ Batch size must be between 1 and 1000');
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    const stats = await runSettlementBackfill(options);
    const durationMs = Date.now() - startTime;
    
    printSummary(stats, durationMs, options);
    
    // Exit with appropriate code
    if (stats.failed > 0) {
      process.exit(1); // Some failures
    } else {
      process.exit(0); // Success
    }

  } catch (error) {
    console.error('\n❌ Backfill failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runSettlementBackfill, type BackfillOptions, type BackfillStats };