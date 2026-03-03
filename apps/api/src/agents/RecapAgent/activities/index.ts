/**
 * RecapAgent Temporal Activities (UNIFIED-OPS-002)
 *
 * Provides the activity implementations that recap-workflows.ts proxies.
 * These are registered in the Temporal worker and executed by the workflow engine.
 *
 * Activities delegate to the generateRecapReport function for providerless execution.
 * No external API keys required — operates purely on Supabase settled data.
 */

import { makeLogger } from '../../../utils/logger';

const logger = makeLogger('RecapActivities');

/**
 * Trigger daily recap generation.
 * Called by dailyRecapWorkflow via proxyActivities.
 */
export async function triggerDailyRecap(date?: string): Promise<void> {
  logger.info('triggerDailyRecap activity started', { date });

  try {
    const { generateRecapReport } = await import('../../../scripts/recap/generateRecap');

    const result = await generateRecapReport({
      mode: 'daily',
      date: date || undefined,
    });

    logger.info('Daily recap generated', {
      picks_count: result.picks_count,
      date_range: result.date_range,
      decision: result.summary?.decision?.decision || 'N/A',
    });
  } catch (error) {
    logger.error('triggerDailyRecap activity failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Trigger weekly recap generation.
 * Called by weeklyRecapWorkflow via proxyActivities.
 */
export async function triggerWeeklyRecap(): Promise<void> {
  logger.info('triggerWeeklyRecap activity started');

  try {
    const { generateRecapReport } = await import('../../../scripts/recap/generateRecap');

    const result = await generateRecapReport({
      mode: 'weekly',
    });

    logger.info('Weekly recap generated', {
      picks_count: result.picks_count,
      date_range: result.date_range,
      decision: result.summary?.decision?.decision || 'N/A',
    });
  } catch (error) {
    logger.error('triggerWeeklyRecap activity failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Trigger monthly recap generation.
 * Called by monthlyRecapWorkflow via proxyActivities.
 */
export async function triggerMonthlyRecap(): Promise<void> {
  logger.info('triggerMonthlyRecap activity started');

  try {
    const { generateRecapReport } = await import('../../../scripts/recap/generateRecap');

    const result = await generateRecapReport({
      mode: 'monthly',
    });

    logger.info('Monthly recap generated', {
      picks_count: result.picks_count,
      date_range: result.date_range,
      decision: result.summary?.decision?.decision || 'N/A',
    });
  } catch (error) {
    logger.error('triggerMonthlyRecap activity failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check micro-recap triggers (ROI changes, last pick graded).
 * Called by microRecapWorkflow via proxyActivities.
 */
export async function checkMicroRecapTriggers(): Promise<void> {
  logger.info('checkMicroRecapTriggers activity started');

  try {
    // Micro-recap checks ROI thresholds and last-pick-graded events
    // For providerless mode, we simply check if any new settlements arrived
    // and if ROI delta exceeds threshold
    const { RecapService } = await import('../recapService');
    const service = new RecapService();

    const roiData = await service.checkRoiThreshold();
    if (roiData) {
      logger.info('Micro-recap ROI trigger fired', {
        trigger: roiData.trigger,
        winLoss: roiData.winLoss,
        dailyRoi: roiData.dailyRoi,
      });
    }

    const lastPickData = await service.checkLastPickGraded();
    if (lastPickData) {
      logger.info('Micro-recap last-pick-graded trigger fired', {
        trigger: lastPickData.trigger,
        winLoss: lastPickData.winLoss,
        dailyRoi: lastPickData.dailyRoi,
      });
    }

    if (!roiData && !lastPickData) {
      logger.info('No micro-recap triggers fired');
    }
  } catch (error) {
    logger.error('checkMicroRecapTriggers activity failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Micro-recap failures are non-critical — do not throw
  }
}
