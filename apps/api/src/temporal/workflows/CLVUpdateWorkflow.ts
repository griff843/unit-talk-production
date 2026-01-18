/**
 * CLV Update Workflow
 *
 * Automated workflow for fetching closing lines and updating CLV tracking
 * for picks that have passed their game time.
 *
 * Phase 2 - CLV Automation
 *
 * Workflow Schedule:
 * - Runs every 15 minutes during peak hours (9am-12am ET)
 * - Runs hourly during off-peak hours (12am-9am ET)
 *
 * Process Flow:
 * 1. Query for picks needing CLV updates (game started, no closing line)
 * 2. Fetch closing lines from Odds API (primary) or Optimal API (fallback)
 * 3. Update clv_tracking table with closing line and calculated CLV
 * 4. Emit metrics for CLV coverage and distribution
 *
 * Idempotency: Safe to run multiple times - only updates picks without closing lines
 * Retry Strategy: Individual activities retry 3x with exponential backoff
 */

import { proxyActivities, log, condition, sleep, setHandler, defineSignal } from '@temporalio/workflow';
import type {
  PendingCLVPick,
  ClosingLineData,
  CLVUpdateResult,
  CLVCycleMetrics,
} from '../activities/CLVActivities';

// Define activity interfaces
interface CLVActivities {
  queryPendingCLVActivity(): Promise<PendingCLVPick[]>;
  fetchClosingLineActivity(pick: PendingCLVPick): Promise<ClosingLineData | null>;
  updateCLVActivity(closingLineData: ClosingLineData): Promise<CLVUpdateResult>;
  emitCLVCycleMetricsActivity(metrics: CLVCycleMetrics): Promise<void>;
}

// Proxy activities with timeout and retry configuration
const clvActivities = proxyActivities<CLVActivities>({
  startToCloseTimeout: '2 minutes', // Generous timeout for API calls
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3, // Retry up to 3 times
  },
});

// Workflow signals for operational control
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const emergencyStopSignal = defineSignal('emergencyStop');

export interface CLVUpdateWorkflowParams {
  batchSize?: number; // Number of picks to process per cycle (default: 50)
  continueOnErrors?: boolean; // Whether to continue processing on individual failures (default: true)
  enableMetrics?: boolean; // Whether to emit Prometheus metrics (default: true)
}

export interface CLVUpdateWorkflowResult {
  cycleId: string;
  startTime: string;
  endTime: string;
  picksQueried: number;
  closingLinesFetched: number;
  clvUpdatesSuccessful: number;
  clvUpdatesFailed: number;
  errors: Array<{
    pickId: string;
    error: string;
    activity: 'fetch' | 'update';
  }>;
  metrics: {
    clvCoveragePercent: number; // Percentage of picks with CLV calculated
    avgClvPercentage: number; // Average CLV across all picks
    beatClosingLineCount: number; // Count of picks beating closing line
  };
}

/**
 * CLV Update Workflow
 *
 * Main workflow for automated CLV tracking updates.
 * Runs on a schedule to process picks that need closing line data.
 */
export async function clvUpdateWorkflow(
  params: CLVUpdateWorkflowParams = {}
): Promise<CLVUpdateWorkflowResult> {
  const {
    batchSize = 50,
    continueOnErrors = true,
    enableMetrics = true,
  } = params;

  // Workflow state
  let isPaused = false;
  let isEmergencyStopped = false;

  // Set up signal handlers for operational control
  setHandler(pauseSignal, () => {
    log.info('[CLVUpdateWorkflow] Pause signal received');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('[CLVUpdateWorkflow] Resume signal received');
    isPaused = false;
  });

  setHandler(emergencyStopSignal, () => {
    log.warn('[CLVUpdateWorkflow] Emergency stop signal received');
    isEmergencyStopped = true;
  });

  const cycleId = `clv-update-${Date.now()}`;
  const startTime = new Date().toISOString();

  log.info('[CLVUpdateWorkflow] Starting CLV update cycle', {
    cycleId,
    batchSize,
    continueOnErrors,
    enableMetrics,
  });

  // Result tracking
  const result: CLVUpdateWorkflowResult = {
    cycleId,
    startTime,
    endTime: '',
    picksQueried: 0,
    closingLinesFetched: 0,
    clvUpdatesSuccessful: 0,
    clvUpdatesFailed: 0,
    errors: [],
    metrics: {
      clvCoveragePercent: 0,
      avgClvPercentage: 0,
      beatClosingLineCount: 0,
    },
  };

  try {
    // Check for pause/emergency stop before starting
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) {
      log.warn('[CLVUpdateWorkflow] Emergency stopped before processing');
      result.endTime = new Date().toISOString();
      return result;
    }

    // STEP 1: Query for picks needing CLV updates
    log.info('[CLVUpdateWorkflow] Querying for pending CLV updates');
    const pendingPicks = await clvActivities.queryPendingCLVActivity();
    result.picksQueried = pendingPicks.length;

    log.info('[CLVUpdateWorkflow] Found pending picks', {
      count: pendingPicks.length,
    });

    if (pendingPicks.length === 0) {
      log.info('[CLVUpdateWorkflow] No picks needing CLV updates');
      result.endTime = new Date().toISOString();
      return result;
    }

    // Process picks in batches to avoid overwhelming the workflow
    const batches: PendingCLVPick[][] = [];
    for (let i = 0; i < pendingPicks.length; i += batchSize) {
      batches.push(pendingPicks.slice(i, i + batchSize));
    }

    log.info('[CLVUpdateWorkflow] Processing in batches', {
      totalPicks: pendingPicks.length,
      batchCount: batches.length,
      batchSize,
    });

    // Track CLV metrics for final calculation
    const clvValues: number[] = [];
    let totalBeatsClosing = 0;

    // STEP 2: Process each batch
    for (const [batchIndex, batch] of batches.entries()) {
      // Check for pause/emergency stop between batches
      await condition(() => !isPaused || isEmergencyStopped);
      if (isEmergencyStopped) {
        log.warn('[CLVUpdateWorkflow] Emergency stopped during batch processing', {
          batchIndex,
          totalBatches: batches.length,
        });
        break;
      }

      log.info('[CLVUpdateWorkflow] Processing batch', {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        batchSize: batch.length,
      });

      // Process each pick in the batch
      for (const pick of batch) {
        try {
          // STEP 2a: Fetch closing line from external APIs
          log.debug('[CLVUpdateWorkflow] Fetching closing line', {
            pickId: pick.pick_id,
            playerName: pick.player_name,
            statType: pick.stat_type,
          });

          const closingLineData = await clvActivities.fetchClosingLineActivity(pick);

          if (!closingLineData) {
            log.debug('[CLVUpdateWorkflow] No closing line available yet', {
              pickId: pick.pick_id,
            });
            // Not an error - game may not have started yet or no data available
            continue;
          }

          result.closingLinesFetched++;

          // STEP 2b: Update CLV tracking with closing line
          log.debug('[CLVUpdateWorkflow] Updating CLV tracking', {
            pickId: pick.pick_id,
            closingLine: closingLineData.closingLine,
            closingOdds: closingLineData.closingOdds,
            source: closingLineData.source,
          });

          const updateResult = await clvActivities.updateCLVActivity(closingLineData);

          if (updateResult.success) {
            result.clvUpdatesSuccessful++;

            // Track CLV metrics
            if (updateResult.clvPercentage !== undefined) {
              clvValues.push(updateResult.clvPercentage);
            }
            if (updateResult.beatClosingLine) {
              totalBeatsClosing++;
            }

            log.info('[CLVUpdateWorkflow] CLV updated successfully', {
              pickId: pick.pick_id,
              clvPercentage: updateResult.clvPercentage,
              beatClosingLine: updateResult.beatClosingLine,
            });
          } else {
            result.clvUpdatesFailed++;
            result.errors.push({
              pickId: pick.pick_id,
              error: updateResult.error || 'Unknown error',
              activity: 'update',
            });

            log.error('[CLVUpdateWorkflow] CLV update failed', {
              pickId: pick.pick_id,
              error: updateResult.error,
            });

            if (!continueOnErrors) {
              throw new Error(`CLV update failed for pick ${pick.pick_id}: ${updateResult.error}`);
            }
          }
        } catch (error: any) {
          result.clvUpdatesFailed++;
          result.errors.push({
            pickId: pick.pick_id,
            error: error.message,
            activity: 'fetch',
          });

          log.error('[CLVUpdateWorkflow] Error processing pick', {
            pickId: pick.pick_id,
            error: error.message,
          });

          if (!continueOnErrors) {
            throw error;
          }
        }
      }

      // Add small delay between batches to avoid overwhelming external APIs
      if (batchIndex < batches.length - 1) {
        await sleep('2 seconds');
      }
    }

    // STEP 3: Calculate final metrics
    if (enableMetrics && result.picksQueried > 0) {
      const totalWithCLV = result.clvUpdatesSuccessful;
      result.metrics.clvCoveragePercent = (totalWithCLV / result.picksQueried) * 100;

      if (clvValues.length > 0) {
        const sumClv = clvValues.reduce((acc, val) => acc + val, 0);
        result.metrics.avgClvPercentage = sumClv / clvValues.length;
      }

      result.metrics.beatClosingLineCount = totalBeatsClosing;

      log.info('[CLVUpdateWorkflow] CLV metrics calculated', {
        clvCoveragePercent: result.metrics.clvCoveragePercent.toFixed(2),
        avgClvPercentage: result.metrics.avgClvPercentage.toFixed(2),
        beatClosingLineCount: totalBeatsClosing,
        totalPicks: result.picksQueried,
      });

      // Emit metrics via activity (Temporal workflows can't directly access Prometheus)
      const cycleDurationSeconds =
        (new Date().getTime() - new Date(startTime).getTime()) / 1000;

      await clvActivities.emitCLVCycleMetricsActivity({
        picksQueried: result.picksQueried,
        closingLinesFetched: result.closingLinesFetched,
        clvUpdatesSuccessful: result.clvUpdatesSuccessful,
        clvUpdatesFailed: result.clvUpdatesFailed,
        clvCoveragePercent: result.metrics.clvCoveragePercent,
        avgClvPercentage: result.metrics.avgClvPercentage,
        beatClosingLineCount: result.metrics.beatClosingLineCount,
        cycleDurationSeconds,
      });
    }

    result.endTime = new Date().toISOString();

    log.info('[CLVUpdateWorkflow] CLV update cycle completed', {
      cycleId,
      duration: `${(new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000}s`,
      picksQueried: result.picksQueried,
      closingLinesFetched: result.closingLinesFetched,
      successful: result.clvUpdatesSuccessful,
      failed: result.clvUpdatesFailed,
      clvCoverage: `${result.metrics.clvCoveragePercent.toFixed(2)}%`,
      avgClv: `${result.metrics.avgClvPercentage.toFixed(2)}%`,
      beatsClosing: result.metrics.beatClosingLineCount,
    });

    return result;
  } catch (error: any) {
    log.error('[CLVUpdateWorkflow] Fatal error in CLV update cycle', {
      cycleId,
      error: error.message,
      stack: error.stack,
    });

    result.endTime = new Date().toISOString();
    result.errors.push({
      pickId: 'WORKFLOW',
      error: error.message,
      activity: 'fetch',
    });

    throw error;
  }
}

/**
 * Scheduled CLV Update Workflow
 *
 * Wrapper workflow for scheduled execution (cron).
 * Runs continuously with configurable intervals.
 */
export async function scheduledCLVUpdateWorkflow(): Promise<void> {
  let isPaused = false;
  let isEmergencyStopped = false;

  setHandler(pauseSignal, () => {
    log.info('[ScheduledCLVUpdateWorkflow] Pause signal received');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('[ScheduledCLVUpdateWorkflow] Resume signal received');
    isPaused = false;
  });

  setHandler(emergencyStopSignal, () => {
    log.warn('[ScheduledCLVUpdateWorkflow] Emergency stop signal received');
    isEmergencyStopped = true;
  });

  log.info('[ScheduledCLVUpdateWorkflow] Starting scheduled CLV updates');

  while (!isEmergencyStopped) {
    // Wait for resume if paused
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) break;

    try {
      // Determine interval based on time of day
      const now = new Date();
      const hour = now.getUTCHours() - 5; // Convert to ET (approximate)
      const isPeakHours = hour >= 9 && hour < 24; // 9am-12am ET

      // Run CLV update cycle
      const result = await clvUpdateWorkflow({
        batchSize: isPeakHours ? 50 : 100, // Smaller batches during peak hours
        continueOnErrors: true,
        enableMetrics: true,
      });

      log.info('[ScheduledCLVUpdateWorkflow] Cycle completed', {
        cycleId: result.cycleId,
        successful: result.clvUpdatesSuccessful,
        failed: result.clvUpdatesFailed,
      });

      // Wait before next cycle
      const sleepDuration = isPeakHours ? '15 minutes' : '60 minutes';
      log.info('[ScheduledCLVUpdateWorkflow] Waiting before next cycle', {
        sleepDuration,
        isPeakHours,
      });
      await sleep(sleepDuration);
    } catch (error: any) {
      log.error('[ScheduledCLVUpdateWorkflow] Error in cycle', {
        error: error.message,
      });
      // Wait 5 minutes before retrying on error
      await sleep('5 minutes');
    }
  }

  log.info('[ScheduledCLVUpdateWorkflow] Stopped');
}
