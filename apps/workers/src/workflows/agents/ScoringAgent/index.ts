/**
 * ScoringAgent - MLB Settlement Pipeline Workflow
 * 
 * Main Temporal workflow for automated settlement of MLB picks.
 * Runs on a schedule to grade unsettled picks using MLB StatsAPI + ESPN fallback.
 */

import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';
import { logger } from '../../../utils/logger';

// Proxy activities with proper timeouts
const {
  selectUnsettledPicks,
  gradePick,
  updateSettlementHeartbeat,
  getEnvironmentConfig
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '60s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

export interface ScoringWorkflowParams {
  league: string;
  batchSize?: number;
  lookbackHours?: number;
  finalBufferMinutes?: number;
  dryRun?: boolean;
}

export interface PickGradingResult {
  pickId: string;
  success: boolean;
  actual?: number;
  result?: 'WIN' | 'LOSS' | 'PUSH';
  source?: string;
  error?: string;
  details?: any;
}

export async function scoringWorkflow(params: ScoringWorkflowParams): Promise<{
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: PickGradingResult[];
}> {
  const {
    league,
    batchSize = 200,
    lookbackHours = 24,
    finalBufferMinutes = 20,
    dryRun = false
  } = params;

  logger.info('ScoringAgent workflow started', { 
    league, 
    batchSize, 
    lookbackHours,
    finalBufferMinutes,
    dryRun 
  });

  const startTime = Date.now();
  const results: PickGradingResult[] = [];
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  try {
    // Get environment configuration
    const config = await getEnvironmentConfig();
    
    if (!config.SCORING_ENABLED) {
      logger.info('Scoring is disabled via configuration');
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: []
      };
    }

    // Process in batches until no more picks to grade
    let hasMorePicks = true;
    let batchNumber = 1;

    while (hasMorePicks) {
      logger.info(`Processing batch ${batchNumber}`, { league, batchSize });

      // Select unsettled picks for this league
      const picks = await selectUnsettledPicks({
        league,
        limit: batchSize,
        lookbackHours,
        finalBufferMinutes
      });

      if (picks.length === 0) {
        logger.info('No more picks to grade', { league });
        hasMorePicks = false;
        break;
      }

      logger.info(`Found ${picks.length} picks to grade in batch ${batchNumber}`);

      // Grade each pick
      for (const pick of picks) {
        try {
          logger.debug('Grading pick', { 
            pickId: pick.id, 
            player: pick.player, 
            market: pick.market 
          });

          const gradingResult = await gradePick({
            pick,
            dryRun
          });

          results.push({
            pickId: pick.id,
            success: gradingResult.success,
            actual: gradingResult.actual,
            result: gradingResult.result,
            source: gradingResult.source,
            error: gradingResult.error,
            details: gradingResult.details
          });

          if (gradingResult.success) {
            totalSuccessful++;
          } else if (gradingResult.skipped) {
            totalSkipped++;
          } else {
            totalFailed++;
          }

          totalProcessed++;

          // Small delay between picks to be respectful to external APIs
          await sleep('100ms');

        } catch (error) {
          logger.error('Error grading pick', { 
            pickId: pick.id, 
            error: error instanceof Error ? error.message : String(error) 
          });

          results.push({
            pickId: pick.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });

          totalFailed++;
          totalProcessed++;
        }
      }

      // Break if we processed fewer picks than batch size (no more available)
      if (picks.length < batchSize) {
        hasMorePicks = false;
      }

      batchNumber++;

      // Sleep between batches to avoid overwhelming external services
      if (hasMorePicks) {
        await sleep('2s');
      }
    }

    // Update heartbeat with results
    await updateSettlementHeartbeat({
      pipelineName: `${league.toLowerCase()}_settlement`,
      lastCount: totalSuccessful,
      lastOk: totalFailed === 0,
      lastError: totalFailed > 0 ? `${totalFailed} picks failed to grade` : null,
      runDetails: {
        totalProcessed,
        totalSuccessful, 
        totalFailed,
        totalSkipped,
        durationMs: Date.now() - startTime,
        batchesProcessed: batchNumber - 1,
        league,
        dryRun
      }
    });

    const summary = {
      processed: totalProcessed,
      successful: totalSuccessful,
      failed: totalFailed,
      skipped: totalSkipped,
      results
    };

    logger.info('ScoringAgent workflow completed', {
      ...summary,
      durationMs: Date.now() - startTime,
      league
    });

    return summary;

  } catch (error) {
    logger.error('ScoringAgent workflow failed', {
      error: error instanceof Error ? error.message : String(error),
      league,
      totalProcessed,
      totalSuccessful,
      totalFailed
    });

    // Update heartbeat with error
    await updateSettlementHeartbeat({
      pipelineName: `${league.toLowerCase()}_settlement`,
      lastCount: totalSuccessful,
      lastOk: false,
      lastError: error instanceof Error ? error.message : String(error),
      runDetails: {
        totalProcessed,
        totalSuccessful,
        totalFailed,
        totalSkipped,
        durationMs: Date.now() - startTime,
        error: 'workflow_failed',
        league,
        dryRun
      }
    });

    throw error;
  }
}

/**
 * Cron workflow for scheduled settlement runs
 * Runs every 10 minutes during baseball season
 */
export async function scheduledScoringWorkflow(): Promise<void> {
  const leagues = ['MLB']; // Can expand to other leagues later
  
  for (const league of leagues) {
    try {
      await scoringWorkflow({
        league,
        batchSize: 200,
        lookbackHours: 24,
        finalBufferMinutes: 20,
        dryRun: false
      });
    } catch (error) {
      logger.error(`Scheduled scoring failed for ${league}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with other leagues even if one fails
    }
  }
}