import { makeLogger } from '../utils/logger';

const logger = makeLogger('WorkflowLogging');

/**
 * WORKFLOW LOGGING ACTIVITIES
 * Activities for logging workflow events, errors, and metrics
 * Used by syndicate-scheduler and related workflows
 */

/**
 * Log grading errors during syndicate workflow execution
 * Called by gradingAndScoringWorkflow when grading fails
 */
export async function logGradingError(params: {
  error: string;
  leagues: string[];
  cycleCount: number;
}): Promise<void> {
  try {
    logger.error('Grading Error:', {
      error: params.error,
      leagues: params.leagues,
      cycleCount: params.cycleCount,
      timestamp: new Date().toISOString(),
    });

    try {
      const { sendOperatorAlert } = await import('./alerts');
      await sendOperatorAlert({
        type: 'system_error',
        message: `Grading Error: ${params.error}`,
        severity: 'high',
        metadata: { leagues: params.leagues, cycleCount: params.cycleCount },
      });
    } catch (alertError) {
      logger.warn('Failed to send grading error alert:', alertError);
    }
  } catch (logErr) {
    logger.error('Failed to log grading error:', logErr);
  }
}

/**
 * Log Discord-related errors during syndicate workflow execution
 * Called by discordAlertWorkflow when Discord operations fail
 */
export async function logDiscordError(params: {
  error: string;
  cycleCount: number;
}): Promise<void> {
  try {
    logger.error('Discord Error:', {
      error: params.error,
      cycleCount: params.cycleCount,
      timestamp: new Date().toISOString(),
    });

    try {
      const { sendOperatorAlert } = await import('./alerts');
      await sendOperatorAlert({
        type: 'system_error',
        message: `Discord Error: ${params.error}`,
        severity: 'high',
        metadata: { cycleCount: params.cycleCount },
      });
    } catch (alertError) {
      logger.warn('Failed to send Discord error alert:', alertError);
    }
  } catch (logErr) {
    logger.error('Failed to log Discord error:', logErr);
  }
}

/**
 * Log Discord delivery metrics for monitoring
 * Called by discordAlertWorkflow after sending alerts
 */
export async function logDiscordMetrics(params: {
  picksCount: number;
  embedsCount: number;
  cycleCount: number;
  deliveryTime: number;
}): Promise<void> {
  try {
    logger.info('Discord Metrics:', {
      picksCount: params.picksCount,
      embedsCount: params.embedsCount,
      cycleCount: params.cycleCount,
      deliveryTime: params.deliveryTime,
      timestamp: new Date().toISOString(),
    });
  } catch (logErr) {
    logger.error('Failed to log Discord metrics:', logErr);
  }
}

/**
 * Log performance warnings when cycles exceed target time
 * Called by syndicateSchedulerWorkflow for slow cycle detection
 */
export async function logPerformanceWarning(params: {
  cycleTime: number;
  maxCycleTime: number;
  cycleCount: number;
  message: string;
}): Promise<void> {
  try {
    logger.warn('Performance Warning:', {
      cycleTime: params.cycleTime,
      maxCycleTime: params.maxCycleTime,
      cycleCount: params.cycleCount,
      message: params.message,
      timestamp: new Date().toISOString(),
    });

    try {
      const { sendOperatorAlert } = await import('./alerts');
      await sendOperatorAlert({
        type: 'system_error',
        message: params.message,
        severity: 'normal',
        metadata: {
          cycleTime: params.cycleTime,
          maxCycleTime: params.maxCycleTime,
          cycleCount: params.cycleCount,
        },
      });
    } catch (alertError) {
      logger.warn('Failed to send performance warning alert:', alertError);
    }
  } catch (logErr) {
    logger.error('Failed to log performance warning:', logErr);
  }
}

/**
 * Log fallback activation when primary ingestion fails
 * Called by leagueIngestionWorkflow when falling back to secondary provider
 */
export async function logFallbackActivation(params: {
  league: string;
  primaryError: string;
  cycleCount: number;
}): Promise<void> {
  try {
    logger.warn('Fallback Activation:', {
      league: params.league,
      primaryError: params.primaryError,
      cycleCount: params.cycleCount,
      timestamp: new Date().toISOString(),
    });
  } catch (logErr) {
    logger.error('Failed to log fallback activation:', logErr);
  }
}

/**
 * Update processing metrics for league ingestion
 * Called by leagueIngestionWorkflow after successful processing
 */
export async function updateProcessingMetrics(params: {
  league: string;
  batchId: string;
  propCount: number;
  cycleCount: number;
  processingTime: number;
}): Promise<void> {
  try {
    logger.info('Processing Metrics:', {
      league: params.league,
      batchId: params.batchId,
      propCount: params.propCount,
      cycleCount: params.cycleCount,
      processingTime: params.processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (logErr) {
    logger.error('Failed to update processing metrics:', logErr);
  }
}
