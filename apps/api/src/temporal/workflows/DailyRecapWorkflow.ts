/**
 * Daily Recap Workflow
 *
 * Automated workflow for generating and publishing daily recaps
 * with CLV data, performance metrics, and Discord publishing.
 *
 * Phase 2 Step 5 - Daily Recap Automation
 *
 * Workflow Schedule:
 * - Runs daily at 7:00 AM ET (after previous day's picks are settled)
 * - Can be triggered manually for any date
 *
 * Process Flow:
 * 1. Compute daily recap (total picks, CLV, sport breakdown)
 * 2. Save recap to database (idempotent upsert)
 * 3. Publish to Discord (using daily_recap template)
 * 4. Emit metrics for monitoring
 *
 * Idempotency: Safe to run multiple times - upserts based on recap_date
 * Retry Strategy: Individual activities retry 3x with exponential backoff
 *
 * @module DailyRecapWorkflow
 */

import { proxyActivities, log, condition, sleep, setHandler, defineSignal } from '@temporalio/workflow';
import type {
  ComputeRecapInput,
  ComputeRecapResult,
  SaveRecapInput,
  SaveRecapResult,
  PublishRecapInput,
  PublishRecapResult,
  RecapCycleMetrics,
} from '../activities/DailyRecapActivities';

// Define activity interfaces
interface DailyRecapActivities {
  computeDailyRecapActivity(input: ComputeRecapInput): Promise<ComputeRecapResult>;
  saveDailyRecapActivity(input: SaveRecapInput): Promise<SaveRecapResult>;
  publishDailyRecapToDiscordActivity(input: PublishRecapInput): Promise<PublishRecapResult>;
  emitRecapCycleMetricsActivity(metrics: RecapCycleMetrics): Promise<void>;
}

// Proxy activities with timeout and retry configuration
const recapActivities = proxyActivities<DailyRecapActivities>({
  startToCloseTimeout: '5 minutes', // Generous timeout for recap computation
  retry: {
    initialInterval: '10 seconds',
    maximumInterval: '60 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3, // Retry up to 3 times
  },
});

// Workflow signals for operational control
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const emergencyStopSignal = defineSignal('emergencyStop');

export interface DailyRecapWorkflowParams {
  recapDate?: string; // ISO date string (YYYY-MM-DD), defaults to yesterday ET
  sport?: string; // Optional sport filter
  capper?: string; // Optional capper filter
  publishToDiscord?: boolean; // Whether to publish to Discord (default: true)
  discordChannelId?: string; // Optional Discord channel ID override
}

export interface DailyRecapWorkflowResult {
  workflowId: string;
  startTime: string;
  endTime: string;
  recapDate: string;
  computeSuccess: boolean;
  saveSuccess: boolean;
  publishSuccess: boolean;
  totalPicks: number;
  avgCLV: number;
  winRate: number;
  errors: Array<{
    activity: string;
    error: string;
  }>;
}

/**
 * Daily Recap Workflow
 *
 * Main workflow for automated daily recap generation and publishing.
 * Runs on a schedule or can be triggered manually.
 */
export async function dailyRecapWorkflow(
  params: DailyRecapWorkflowParams = {}
): Promise<DailyRecapWorkflowResult> {
  const {
    recapDate,
    sport,
    capper,
    publishToDiscord = true,
    discordChannelId,
  } = params;

  // Workflow state
  let isPaused = false;
  let isEmergencyStopped = false;

  // Set up signal handlers for operational control
  setHandler(pauseSignal, () => {
    log.info('[DailyRecapWorkflow] Pause signal received');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('[DailyRecapWorkflow] Resume signal received');
    isPaused = false;
  });

  setHandler(emergencyStopSignal, () => {
    log.warn('[DailyRecapWorkflow] Emergency stop signal received');
    isEmergencyStopped = true;
  });

  const workflowId = `daily-recap-${recapDate || 'yesterday'}-${Date.now()}`;
  const startTime = new Date().toISOString();

  log.info('[DailyRecapWorkflow] Starting daily recap workflow', {
    workflowId,
    recapDate,
    sport,
    capper,
    publishToDiscord,
  });

  // Result tracking
  const result: DailyRecapWorkflowResult = {
    workflowId,
    startTime,
    endTime: '',
    recapDate: recapDate || 'yesterday',
    computeSuccess: false,
    saveSuccess: false,
    publishSuccess: false,
    totalPicks: 0,
    avgCLV: 0,
    winRate: 0,
    errors: [],
  };

  try {
    // Check for pause/emergency stop before starting
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) {
      log.warn('[DailyRecapWorkflow] Emergency stopped before processing');
      result.endTime = new Date().toISOString();
      return result;
    }

    // STEP 1: Compute daily recap
    log.info('[DailyRecapWorkflow] Computing daily recap');
    const computeStartTime = Date.now();

    const computeResult = await recapActivities.computeDailyRecapActivity({
      recapDate,
      sport,
      capper,
    });

    const computeDurationMs = Date.now() - computeStartTime;

    if (!computeResult.success || !computeResult.recap) {
      const error = computeResult.error || 'Failed to compute recap';
      log.error('[DailyRecapWorkflow] Recap computation failed', { error });
      result.errors.push({
        activity: 'compute',
        error,
      });
      result.endTime = new Date().toISOString();
      return result;
    }

    result.computeSuccess = true;
    result.recapDate = new Date(computeResult.recap.recap_date).toISOString().split('T')[0];
    result.totalPicks = computeResult.recap.total_picks;
    result.avgCLV = (computeResult.recap.avg_clv_bps || 0) / 100;
    result.winRate = computeResult.recap.win_rate || 0;

    log.info('[DailyRecapWorkflow] Recap computed successfully', {
      recapDate: result.recapDate,
      totalPicks: result.totalPicks,
      avgCLV: result.avgCLV,
      winRate: result.winRate,
    });

    // Check for pause/emergency stop
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) {
      log.warn('[DailyRecapWorkflow] Emergency stopped after compute');
      result.endTime = new Date().toISOString();
      return result;
    }

    // STEP 2: Save recap to database
    log.info('[DailyRecapWorkflow] Saving daily recap to database');

    const saveResult = await recapActivities.saveDailyRecapActivity({
      recap: computeResult.recap,
    });

    if (!saveResult.success) {
      const error = saveResult.error || 'Failed to save recap';
      log.error('[DailyRecapWorkflow] Recap save failed', { error });
      result.errors.push({
        activity: 'save',
        error,
      });
      // Continue to publish even if save failed (recap is already computed)
    } else {
      result.saveSuccess = true;
      log.info('[DailyRecapWorkflow] Recap saved successfully', {
        recapDate: saveResult.recapDate,
      });
    }

    // Check for pause/emergency stop
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) {
      log.warn('[DailyRecapWorkflow] Emergency stopped after save');
      result.endTime = new Date().toISOString();
      return result;
    }

    // STEP 3: Publish to Discord (optional)
    let publishDurationMs = 0;
    if (publishToDiscord) {
      log.info('[DailyRecapWorkflow] Publishing recap to Discord');
      const publishStartTime = Date.now();

      const publishResult = await recapActivities.publishDailyRecapToDiscordActivity({
        recap: computeResult.recap,
        channelId: discordChannelId,
      });

      publishDurationMs = Date.now() - publishStartTime;

      if (!publishResult.success) {
        const error = publishResult.error || 'Failed to publish to Discord';
        log.error('[DailyRecapWorkflow] Discord publish failed', { error });
        result.errors.push({
          activity: 'publish',
          error,
        });
        // Don't fail workflow if Discord publish fails
      } else {
        result.publishSuccess = true;
        log.info('[DailyRecapWorkflow] Recap published to Discord', {
          messageId: publishResult.messageId,
        });
      }
    } else {
      log.info('[DailyRecapWorkflow] Skipping Discord publish (disabled)');
    }

    // STEP 4: Emit metrics
    log.info('[DailyRecapWorkflow] Emitting recap cycle metrics');

    await recapActivities.emitRecapCycleMetricsActivity({
      recapDate: result.recapDate,
      totalPicks: result.totalPicks,
      avgCLV: result.avgCLV,
      winRate: result.winRate,
      computeDurationMs,
      publishDurationMs: publishToDiscord ? publishDurationMs : undefined,
    });

    result.endTime = new Date().toISOString();

    log.info('[DailyRecapWorkflow] Daily recap workflow completed', {
      workflowId,
      recapDate: result.recapDate,
      duration: `${(new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000}s`,
      totalPicks: result.totalPicks,
      avgCLV: result.avgCLV,
      winRate: (result.winRate * 100).toFixed(1) + '%',
      computeSuccess: result.computeSuccess,
      saveSuccess: result.saveSuccess,
      publishSuccess: result.publishSuccess,
    });

    return result;
  } catch (error: any) {
    log.error('[DailyRecapWorkflow] Fatal error in daily recap workflow', {
      workflowId,
      error: error.message,
      stack: error.stack,
    });

    result.endTime = new Date().toISOString();
    result.errors.push({
      activity: 'workflow',
      error: error.message,
    });

    throw error;
  }
}

/**
 * Scheduled Daily Recap Workflow
 *
 * Wrapper workflow for scheduled execution (cron).
 * Runs daily at 7:00 AM ET to generate previous day's recap.
 */
export async function scheduledDailyRecapWorkflow(): Promise<void> {
  let isPaused = false;
  let isEmergencyStopped = false;

  setHandler(pauseSignal, () => {
    log.info('[ScheduledDailyRecapWorkflow] Pause signal received');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('[ScheduledDailyRecapWorkflow] Resume signal received');
    isPaused = false;
  });

  setHandler(emergencyStopSignal, () => {
    log.warn('[ScheduledDailyRecapWorkflow] Emergency stop signal received');
    isEmergencyStopped = true;
  });

  log.info('[ScheduledDailyRecapWorkflow] Starting scheduled daily recap');

  while (!isEmergencyStopped) {
    // Wait for resume if paused
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) break;

    try {
      // Calculate next run time (7:00 AM ET)
      const now = new Date();
      const etOffset = -5 * 60 * 60 * 1000; // ET is UTC-5 (simplified, doesn't handle DST)
      const etNow = new Date(now.getTime() + etOffset);

      // Next 7:00 AM ET
      let nextRun = new Date(etNow);
      nextRun.setHours(7, 0, 0, 0);

      // If it's already past 7:00 AM today, schedule for tomorrow
      if (etNow.getHours() >= 7) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const msUntilNextRun = nextRun.getTime() - etNow.getTime();

      log.info('[ScheduledDailyRecapWorkflow] Waiting until next run', {
        nextRun: nextRun.toISOString(),
        waitMs: msUntilNextRun,
      });

      // Sleep until next run time
      await sleep(msUntilNextRun);

      // Run daily recap for yesterday
      const result = await dailyRecapWorkflow({
        publishToDiscord: true,
      });

      log.info('[ScheduledDailyRecapWorkflow] Recap completed', {
        recapDate: result.recapDate,
        totalPicks: result.totalPicks,
        success: result.computeSuccess && result.saveSuccess,
      });
    } catch (error: any) {
      log.error('[ScheduledDailyRecapWorkflow] Error in scheduled run', {
        error: error.message,
      });
      // Wait 1 hour before retrying on error
      await sleep('1 hour');
    }
  }

  log.info('[ScheduledDailyRecapWorkflow] Stopped');
}
