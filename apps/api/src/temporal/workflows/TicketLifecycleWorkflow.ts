/**
 * Ticket Lifecycle Workflow
 *
 * End-to-end orchestration for the complete betting intelligence pipeline:
 * Raw Event → Canonical Mapping → Professional Grading → CLV Tracking → Publishing → Discord
 *
 * Phase 3 - Temporal End-to-End Orchestration
 *
 * This is the central workflow that ties together all Phase 2 components:
 * - Canonical entities (Phase 2 Step 1)
 * - Professional pipeline (Phase 2 Step 3)
 * - CLV automation (Phase 2 Step 2)
 * - Discord publishing (Phase 2 Step 4)
 * - Daily recaps (Phase 2 Step 5)
 *
 * Workflow Schedule: Triggered by events (BridgeWorker, FeedAgent, Manual)
 *
 * Process Flow:
 * 1. Fetch raw event data (from events/bridge_outbox)
 * 2. Map to canonical picks table (idempotent)
 * 3. Run professional grading (8 features)
 * 4. Initiate CLV tracking
 * 5. Create publish record (outbox pattern)
 * 6. Detect and create alerts (parallel)
 *
 * Idempotency: Safe to run multiple times - all operations keyed by bet_slip_id
 * Retry Strategy: Individual activities retry 3x with exponential backoff
 * Compensation: Failed workflows execute compensating actions
 */

import { proxyActivities, log, condition, sleep, setHandler, defineSignal, executeChild } from '@temporalio/workflow';
import type {
  TicketLifecycleInput,
  TicketLifecycleResult,
  FetchRawEventResult,
  CanonicalMappingResult,
  ProfessionalGradingResult,
  CLVTrackingResult,
  PublishingResult,
  AlertDetectionResult,
  TicketLifecycleMetrics,
} from '../activities/TicketLifecycleActivities';

// Define activity interfaces
interface TicketLifecycleActivities {
  // Stage 1: Raw event fetching
  fetchRawEventActivity(input: TicketLifecycleInput): Promise<FetchRawEventResult>;

  // Stage 2: Canonical mapping
  resolveCanonicalIdsActivity(eventData: any): Promise<{ playerId?: string; gameId?: string }>;
  insertCanonicalPickActivity(pickData: any): Promise<CanonicalMappingResult>;

  // Stage 3: Professional grading
  runProfessionalGradingActivity(pickId: string): Promise<ProfessionalGradingResult>;
  updatePickWithGradingActivity(pickId: string, grading: any): Promise<void>;

  // Stage 4: CLV tracking
  initiateCLVTrackingActivity(pickId: string): Promise<CLVTrackingResult>;

  // Stage 5: Publishing
  createPublishRecordActivity(pickId: string, publishMode: string): Promise<PublishingResult>;

  // Stage 6: Alert detection (parallel)
  detectAlertConditionsActivity(pickId: string): Promise<AlertDetectionResult>;
  createAlertRecordsActivity(alerts: any[]): Promise<void>;

  // Metrics & cleanup
  emitTicketLifecycleMetricsActivity(metrics: TicketLifecycleMetrics): Promise<void>;

  // Compensating actions
  deleteCanonicalPickActivity(pickId: string): Promise<void>;
  clearGradingDataActivity(pickId: string): Promise<void>;
  removeCLVTrackingActivity(clvTrackingId: string): Promise<void>;
  cancelPublishRecordActivity(publishId: string): Promise<void>;
}

// Proxy activities with timeout and retry configuration
const lifecycleActivities = proxyActivities<TicketLifecycleActivities>({
  startToCloseTimeout: '2 minutes', // Generous timeout for API calls
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3, // Retry up to 3 times
    nonRetryableErrorTypes: [
      'ValidationError',
      'DuplicateKeyError',
      'PermissionDeniedError'
    ]
  },
});

// Workflow signals for operational control
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const emergencyStopSignal = defineSignal('emergencyStop');

/**
 * Ticket Lifecycle Workflow
 *
 * Main workflow for end-to-end ticket processing.
 * Triggered by BridgeWorker, FeedAgent, or manual operations.
 */
export async function ticketLifecycleWorkflow(
  input: TicketLifecycleInput
): Promise<TicketLifecycleResult> {
  // Workflow state
  let isPaused = false;
  let isEmergencyStopped = false;

  // Set up signal handlers for operational control
  setHandler(pauseSignal, () => {
    log.info('[TicketLifecycleWorkflow] Pause signal received');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('[TicketLifecycleWorkflow] Resume signal received');
    isPaused = false;
  });

  setHandler(emergencyStopSignal, () => {
    log.warn('[TicketLifecycleWorkflow] Emergency stop signal received');
    isEmergencyStopped = true;
  });

  const workflowId = `ticket-lifecycle-${input.betSlipId}-${Date.now()}`;
  const startTime = new Date().toISOString();

  log.info('[TicketLifecycleWorkflow] Starting ticket lifecycle workflow', {
    workflowId,
    betSlipId: input.betSlipId,
    source: input.source,
    tenantId: input.tenantId,
  });

  // Result tracking
  const result: TicketLifecycleResult = {
    workflowId,
    betSlipId: input.betSlipId,
    startTime,
    endTime: '',
    duration: 0,
    canonicalMapping: { success: false },
    professionalGrading: { success: false },
    clvTracking: { success: false },
    publishing: { success: false },
    overallSuccess: false,
    errors: [],
  };

  // Saga pattern for compensating actions
  const compensatingActions: Array<() => Promise<void>> = [];

  try {
    // Check for pause/emergency stop before starting
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) {
      log.warn('[TicketLifecycleWorkflow] Emergency stopped before processing');
      result.endTime = new Date().toISOString();
      result.duration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
      return result;
    }

    // ===== STAGE 1: FETCH RAW EVENT =====
    log.info('[TicketLifecycleWorkflow] Stage 1: Fetching raw event data');
    const stageStartTime = Date.now();

    const rawEvent = await lifecycleActivities.fetchRawEventActivity(input);

    if (!rawEvent.success || !rawEvent.data) {
      const error = rawEvent.error || 'Failed to fetch raw event';
      log.error('[TicketLifecycleWorkflow] Stage 1 failed', { error });
      result.errors.push({
        stage: 'fetch_raw_event',
        activity: 'fetchRawEventActivity',
        error,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Stage 1 failed: ${error}`);
    }

    log.info('[TicketLifecycleWorkflow] Stage 1 completed', {
      duration: Date.now() - stageStartTime,
      hasData: !!rawEvent.data,
    });

    // ===== STAGE 2: CANONICAL MAPPING =====
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) throw new Error('Emergency stopped at Stage 2');

    log.info('[TicketLifecycleWorkflow] Stage 2: Canonical mapping');
    const stage2StartTime = Date.now();

    // Resolve canonical IDs for player/game
    const canonicalIds = await lifecycleActivities.resolveCanonicalIdsActivity(rawEvent.data);

    // Insert into canonical picks table
    const pickData = {
      ...rawEvent.data,
      tenant_id: input.tenantId,
      user_id: input.userId,
      bet_slip_id: input.betSlipId,
      idempotency_key: input.betSlipId, // Use betSlipId as idempotency key
      prop_id: canonicalIds.playerId,
      game_id: canonicalIds.gameId,
      workflow_stage: 'pending_review',
      status: 'pending',
      metadata: {
        ...rawEvent.data.metadata,
        source: input.source,
        workflow_id: workflowId,
      },
    };

    const canonicalResult = await lifecycleActivities.insertCanonicalPickActivity(pickData);

    if (!canonicalResult.success || !canonicalResult.pickId) {
      const error = canonicalResult.error || 'Failed to insert canonical pick';
      log.error('[TicketLifecycleWorkflow] Stage 2 failed', { error });
      result.canonicalMapping = { success: false, error };
      result.errors.push({
        stage: 'canonical_mapping',
        activity: 'insertCanonicalPickActivity',
        error,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Stage 2 failed: ${error}`);
    }

    // Add compensating action
    compensatingActions.push(async () => {
      log.info('[TicketLifecycleWorkflow] Compensating: Deleting canonical pick', {
        pickId: canonicalResult.pickId,
      });
      await lifecycleActivities.deleteCanonicalPickActivity(canonicalResult.pickId!);
    });

    result.canonicalMapping = {
      success: true,
      pickId: canonicalResult.pickId,
      canonicalPlayerId: canonicalIds.playerId,
    };

    log.info('[TicketLifecycleWorkflow] Stage 2 completed', {
      duration: Date.now() - stage2StartTime,
      pickId: canonicalResult.pickId,
    });

    // ===== STAGE 3: PROFESSIONAL GRADING =====
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) throw new Error('Emergency stopped at Stage 3');

    if (!input.skipProfessionalGrading) {
      log.info('[TicketLifecycleWorkflow] Stage 3: Professional grading');
      const stage3StartTime = Date.now();

      const gradingResult = await lifecycleActivities.runProfessionalGradingActivity(
        canonicalResult.pickId!
      );

      if (!gradingResult.success) {
        const error = gradingResult.error || 'Professional grading failed';
        log.error('[TicketLifecycleWorkflow] Stage 3 failed', { error });
        result.professionalGrading = { success: false, error };
        result.errors.push({
          stage: 'professional_grading',
          activity: 'runProfessionalGradingActivity',
          error,
          timestamp: new Date().toISOString(),
        });
        // Don't throw - continue with warning
        log.warn('[TicketLifecycleWorkflow] Continuing without professional grading');
      } else {
        // Update pick with grading results
        await lifecycleActivities.updatePickWithGradingActivity(
          canonicalResult.pickId!,
          gradingResult
        );

        // Add compensating action
        compensatingActions.push(async () => {
          log.info('[TicketLifecycleWorkflow] Compensating: Clearing grading data', {
            pickId: canonicalResult.pickId,
          });
          await lifecycleActivities.clearGradingDataActivity(canonicalResult.pickId!);
        });

        result.professionalGrading = {
          success: true,
          tier: gradingResult.tier,
          professionalScore: gradingResult.professionalScore,
          confidence: gradingResult.confidence,
          features: gradingResult.features,
        };

        log.info('[TicketLifecycleWorkflow] Stage 3 completed', {
          duration: Date.now() - stage3StartTime,
          tier: gradingResult.tier,
          professionalScore: gradingResult.professionalScore,
        });
      }
    } else {
      log.info('[TicketLifecycleWorkflow] Stage 3 skipped (skipProfessionalGrading=true)');
      result.professionalGrading = { success: true };
    }

    // ===== STAGE 4: CLV TRACKING =====
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) throw new Error('Emergency stopped at Stage 4');

    if (!input.skipCLVTracking) {
      log.info('[TicketLifecycleWorkflow] Stage 4: CLV tracking initiation');
      const stage4StartTime = Date.now();

      const clvResult = await lifecycleActivities.initiateCLVTrackingActivity(
        canonicalResult.pickId!
      );

      if (!clvResult.success) {
        const error = clvResult.error || 'CLV tracking initiation failed';
        log.error('[TicketLifecycleWorkflow] Stage 4 failed', { error });
        result.clvTracking = { success: false, error };
        result.errors.push({
          stage: 'clv_tracking',
          activity: 'initiateCLVTrackingActivity',
          error,
          timestamp: new Date().toISOString(),
        });
        // Don't throw - continue with warning
        log.warn('[TicketLifecycleWorkflow] Continuing without CLV tracking');
      } else {
        // Add compensating action
        compensatingActions.push(async () => {
          log.info('[TicketLifecycleWorkflow] Compensating: Removing CLV tracking', {
            clvTrackingId: clvResult.clvTrackingId,
          });
          await lifecycleActivities.removeCLVTrackingActivity(clvResult.clvTrackingId!);
        });

        result.clvTracking = {
          success: true,
          clvTrackingId: clvResult.clvTrackingId,
          initialEdge: clvResult.initialEdge,
        };

        log.info('[TicketLifecycleWorkflow] Stage 4 completed', {
          duration: Date.now() - stage4StartTime,
          clvTrackingId: clvResult.clvTrackingId,
        });
      }
    } else {
      log.info('[TicketLifecycleWorkflow] Stage 4 skipped (skipCLVTracking=true)');
      result.clvTracking = { success: true };
    }

    // ===== STAGE 5: PUBLISHING =====
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) throw new Error('Emergency stopped at Stage 5');

    log.info('[TicketLifecycleWorkflow] Stage 5: Publishing (outbox pattern)');
    const stage5StartTime = Date.now();

    const publishResult = await lifecycleActivities.createPublishRecordActivity(
      canonicalResult.pickId!,
      input.publishMode || 'live'
    );

    if (!publishResult.success) {
      const error = publishResult.error || 'Publishing record creation failed';
      log.error('[TicketLifecycleWorkflow] Stage 5 failed', { error });
      result.publishing = { success: false, error };
      result.errors.push({
        stage: 'publishing',
        activity: 'createPublishRecordActivity',
        error,
        timestamp: new Date().toISOString(),
      });
      // Don't throw - continue with warning
      log.warn('[TicketLifecycleWorkflow] Continuing without publishing');
    } else {
      // Add compensating action
      compensatingActions.push(async () => {
        log.info('[TicketLifecycleWorkflow] Compensating: Cancelling publish record', {
          publishId: publishResult.publishId,
        });
        await lifecycleActivities.cancelPublishRecordActivity(publishResult.publishId!);
      });

      result.publishing = {
        success: true,
        publishId: publishResult.publishId,
      };

      log.info('[TicketLifecycleWorkflow] Stage 5 completed', {
        duration: Date.now() - stage5StartTime,
        publishId: publishResult.publishId,
      });
    }

    // ===== STAGE 6: ALERT DETECTION (PARALLEL) =====
    await condition(() => !isPaused || isEmergencyStopped);
    if (isEmergencyStopped) throw new Error('Emergency stopped at Stage 6');

    log.info('[TicketLifecycleWorkflow] Stage 6: Alert detection (parallel)');
    const stage6StartTime = Date.now();

    // This runs in parallel - don't block on failure
    try {
      const alertResult = await lifecycleActivities.detectAlertConditionsActivity(
        canonicalResult.pickId!
      );

      if (alertResult.alerts && alertResult.alerts.length > 0) {
        await lifecycleActivities.createAlertRecordsActivity(alertResult.alerts);

        log.info('[TicketLifecycleWorkflow] Stage 6 completed', {
          duration: Date.now() - stage6StartTime,
          alertCount: alertResult.alerts.length,
        });
      } else {
        log.info('[TicketLifecycleWorkflow] Stage 6: No alerts detected');
      }
    } catch (error: any) {
      log.warn('[TicketLifecycleWorkflow] Stage 6 failed (non-critical)', {
        error: error.message,
      });
      // Don't fail workflow on alert detection errors
    }

    // ===== WORKFLOW COMPLETION =====
    result.overallSuccess = true;
    result.endTime = new Date().toISOString();
    result.duration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    // Emit metrics
    await lifecycleActivities.emitTicketLifecycleMetricsActivity({
      workflowId,
      betSlipId: input.betSlipId,
      source: input.source,
      duration: result.duration,
      stages: {
        canonicalMapping: result.canonicalMapping.success,
        professionalGrading: result.professionalGrading.success,
        clvTracking: result.clvTracking.success,
        publishing: result.publishing.success,
      },
      tier: result.professionalGrading.tier,
      professionalScore: result.professionalGrading.professionalScore,
    });

    log.info('[TicketLifecycleWorkflow] Workflow completed successfully', {
      workflowId,
      duration: result.duration,
      pickId: result.canonicalMapping.pickId,
      tier: result.professionalGrading.tier,
    });

    return result;
  } catch (error: any) {
    log.error('[TicketLifecycleWorkflow] Fatal error in workflow', {
      workflowId,
      error: error.message,
      stack: error.stack,
    });

    // Execute compensating actions in reverse order
    log.info('[TicketLifecycleWorkflow] Executing compensating actions', {
      count: compensatingActions.length,
    });

    for (let i = compensatingActions.length - 1; i >= 0; i--) {
      try {
        await compensatingActions[i]();
      } catch (compensationError: any) {
        log.error('[TicketLifecycleWorkflow] Compensation failed', {
          index: i,
          error: compensationError.message,
        });
        // Continue with other compensations even if one fails
      }
    }

    result.overallSuccess = false;
    result.failureStage = result.errors[result.errors.length - 1]?.stage || 'unknown';
    result.endTime = new Date().toISOString();
    result.duration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    // Emit failure metrics
    await lifecycleActivities.emitTicketLifecycleMetricsActivity({
      workflowId,
      betSlipId: input.betSlipId,
      source: input.source,
      duration: result.duration,
      stages: {
        canonicalMapping: result.canonicalMapping.success,
        professionalGrading: result.professionalGrading.success,
        clvTracking: result.clvTracking.success,
        publishing: result.publishing.success,
      },
      success: false,
      failureStage: result.failureStage,
    });

    throw error;
  }
}

/**
 * Regrading Workflow
 *
 * Re-run professional grading after new data becomes available.
 * Triggered by: line movement, injury news, manual request, pre-game check.
 */
export async function regradingWorkflow(input: {
  pickId: string;
  reason: 'manual' | 'line_movement' | 'injury' | 'pre_game_check';
  previousScore: number;
  newData?: Record<string, any>;
}): Promise<{ updated: boolean; newScore: number; tierChanged: boolean }> {
  log.info('[RegradingWorkflow] Starting regrading', {
    pickId: input.pickId,
    reason: input.reason,
    previousScore: input.previousScore,
  });

  // Fetch current pick data (activity not shown for brevity)
  const pick = await lifecycleActivities.fetchRawEventActivity({ betSlipId: input.pickId } as any);

  // Re-run professional grading with new data
  const newGrading = await lifecycleActivities.runProfessionalGradingActivity(input.pickId);

  if (!newGrading.success) {
    log.error('[RegradingWorkflow] Regrading failed', { error: newGrading.error });
    return { updated: false, newScore: input.previousScore, tierChanged: false };
  }

  // Compare scores
  const scoreDiff = Math.abs(newGrading.professionalScore! - input.previousScore);
  const tierChanged = newGrading.tier !== pick.data?.tier;

  if (scoreDiff > 0.5 || tierChanged) {
    // Update pick with new grading
    await lifecycleActivities.updatePickWithGradingActivity(input.pickId, newGrading);

    log.info('[RegradingWorkflow] Pick regraded successfully', {
      pickId: input.pickId,
      oldScore: input.previousScore,
      newScore: newGrading.professionalScore,
      tierChanged,
    });

    return {
      updated: true,
      newScore: newGrading.professionalScore!,
      tierChanged,
    };
  }

  log.info('[RegradingWorkflow] No significant change detected', {
    pickId: input.pickId,
    scoreDiff,
  });

  return {
    updated: false,
    newScore: newGrading.professionalScore!,
    tierChanged: false,
  };
}

/**
 * Replay Workflow
 *
 * Replay historical events through the pipeline for backfill or testing.
 * Use Cases: backfilling scores, recalculating CLV, testing new features, data migration.
 */
export async function replayWorkflow(input: {
  startDate: string; // ISO date
  endDate: string; // ISO date
  filters?: {
    sport?: string;
    capper?: string;
    tier?: string;
  };
  dryRun?: boolean; // Test without writing
  batchSize?: number; // Default: 100
}): Promise<{
  total: number;
  processed: number;
  failed: number;
  errors: Array<{ pickId: string; error: string }>;
}> {
  log.info('[ReplayWorkflow] Starting historical replay', {
    startDate: input.startDate,
    endDate: input.endDate,
    dryRun: input.dryRun,
  });

  const results = {
    total: 0,
    processed: 0,
    failed: 0,
    errors: [] as Array<{ pickId: string; error: string }>,
  };

  // Note: fetchHistoricalBatchesActivity would need to be implemented
  // This is a conceptual example

  log.info('[ReplayWorkflow] Replay completed', results);

  return results;
}
