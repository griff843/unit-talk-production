/**
 * Auto Re-check Temporal Workflow
 * Orchestrates scheduled pick re-checks with fault tolerance and retry logic
 */

import { 
  proxyActivities, 
  defineSignal, 
  defineQuery, 
  setHandler, 
  condition, 
  sleep 
} from '@temporalio/workflow';
import type { 
  AutoRecheckActivities,
  RecheckWorkflowInput,
  RecheckWorkflowState,
  RecheckCheckpoint 
} from '../activities/autoRecheckActivities';

// Proxy activities with timeout and retry configuration
const {
  initializePickMonitoring,
  executeRecheckPoint,
  validatePickStatus,
  updateOddsTracking,
  generateRecheckAlert,
  finalizeRecheckSchedule,
  handleRecheckFailure
} = proxyActivities<AutoRecheckActivities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 3
  }
});

// Workflow signals
export const pauseRecheckSignal = defineSignal<[]>('pauseRecheck');
export const resumeRecheckSignal = defineSignal<[]>('resumeRecheck');
export const cancelRecheckSignal = defineSignal<[string]>('cancelRecheck');
export const updateConfigSignal = defineSignal<[any]>('updateConfig');

// Workflow queries
export const getRecheckStateQuery = defineQuery<RecheckWorkflowState>('getRecheckState');
export const getNextCheckpointQuery = defineQuery<RecheckCheckpoint | null>('getNextCheckpoint');

/**
 * Main Auto Re-check Workflow
 */
export async function autoRecheckWorkflow(input: RecheckWorkflowInput): Promise<void> {
  // Initialize workflow state
  let state: RecheckWorkflowState = {
    pickId: input.pickId,
    status: 'initializing',
    currentCheckpoint: 0,
    totalCheckpoints: (input.checkpoints || []).length,
    alerts: [],
    currentPhase: 'pre_game',
    completedCheckpoints: [],
    scheduledCheckpoints: input.checkpoints || [],
    errors: [],
    metrics: {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageCheckDuration: 0,
      totalOddsUpdates: 0,
      alertsGenerated: 0
    },
    config: input.config,
    startTime: Date.now(),
    lastUpdate: Date.now()
  };

  // Set up signal and query handlers
  let paused = false;
  let cancelled = false;
  let cancelReason = '';

  setHandler(pauseRecheckSignal, () => {
    paused = true;
    state.status = 'paused';
  });

  setHandler(resumeRecheckSignal, () => {
    paused = false;
    state.status = 'running';
  });

  setHandler(cancelRecheckSignal, (reason: string) => {
    cancelled = true;
    cancelReason = reason;
    state.status = 'cancelled';
  });

  setHandler(updateConfigSignal, (newConfig: any) => {
    state.config = { ...state.config, ...newConfig };
  });

  setHandler(getRecheckStateQuery, () => state);
  setHandler(getNextCheckpointQuery, () => getNextScheduledCheckpoint(state));

  try {
    // Initialize pick monitoring
    state.status = 'initializing';
    await initializePickMonitoring(input.pickId, input.config);
    
    state.status = 'running';
    state.lastUpdate = Date.now();

    // Main workflow loop - process checkpoints
    while (!cancelled && hasRemainingCheckpoints(state)) {
      // Handle pause state
      if (paused) {
        await condition(() => !paused || cancelled);
        if (cancelled) break;
      }

      // Get next checkpoint to process
      const nextCheckpoint = getNextScheduledCheckpoint(state);
      if (!nextCheckpoint) {
        await sleep('30 seconds'); // Wait for next scheduled checkpoint
        continue;
      }

      // Wait until checkpoint time
      const now = Date.now();
      const checkpointTime = new Date(nextCheckpoint.scheduledTime).getTime();
      
      if (checkpointTime > now) {
        const waitTime = checkpointTime - now;
        await sleep(waitTime);
        
        // Check if still valid after wait
        if (cancelled) break;
        if (paused) {
          await condition(() => !paused || cancelled);
          if (cancelled) break;
        }
      }

      // Execute checkpoint
      await executeCheckpoint(state, nextCheckpoint);
    }

    // Determine final status
    if (cancelled) {
      state.status = 'cancelled';
      await handleWorkflowCancellation(state, cancelReason);
    } else {
      state.status = 'completed';
      await finalizeRecheckSchedule(input.pickId, state);
    }

  } catch (error) {
    state.status = 'failed';
    state.errors.push({
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : String(error),
      checkpoint: state.currentPhase,
      recoverable: false
    });

    await handleRecheckFailure(input.pickId, state, error);
  }

  state.lastUpdate = Date.now();
}

/**
 * Execute a single checkpoint
 */
async function executeCheckpoint(
  state: RecheckWorkflowState,
  checkpoint: RecheckCheckpoint
): Promise<void> {
  const startTime = Date.now();
  
  try {
    state.metrics.totalChecks++;
    
    // Update current phase
    state.currentPhase = checkpoint.type;
    state.lastUpdate = Date.now();

    // Validate pick is still active
    const pickStatus = await validatePickStatus(state.pickId);
    if (pickStatus.cancelled || pickStatus.settled) {
      // Skip remaining checkpoints for settled/cancelled picks
      markRemainingCheckpointsSkipped(state, 'Pick settled or cancelled');
      return;
    }

    // Update odds tracking before executing checkpoint
    await updateOddsTracking(state.pickId, checkpoint.type);
    state.metrics.totalOddsUpdates++;

    // Execute the actual re-check point
    const result = await executeRecheckPoint(
      state.pickId,
      checkpoint,
      state.config
    );

    // Process checkpoint result
    if (result.success) {
      state.metrics.successfulChecks++;
      
      // Mark checkpoint as completed
      checkpoint.status = 'completed';
      checkpoint.completedAt = Date.now();
      checkpoint.result = result;
      
      state.completedCheckpoints.push(checkpoint);

      // Generate alerts if needed
      if (result.alertRequired) {
        await generateRecheckAlert(state.pickId, checkpoint, result);
        state.metrics.alertsGenerated++;
      }

      // Handle specific actions based on checkpoint type
      await handleCheckpointSpecificActions(state, checkpoint, result);

    } else {
      // Handle checkpoint failure
      state.metrics.failedChecks++;
      checkpoint.status = 'failed';
      checkpoint.error = result.error;
      
      state.errors.push({
        timestamp: Date.now(),
        message: result.error || 'Checkpoint execution failed',
        checkpoint: checkpoint.id,
        recoverable: true
      });

      // Attempt recovery if configured
      if (state.config.autoRetry && result.retryable) {
        await attemptCheckpointRecovery(state, checkpoint);
      }
    }

    // Update metrics
    const duration = Date.now() - startTime;
    state.metrics.averageCheckDuration = 
      (state.metrics.averageCheckDuration * (state.metrics.totalChecks - 1) + duration) / state.metrics.totalChecks;

  } catch (error) {
    state.metrics.failedChecks++;
    checkpoint.status = 'failed';
    checkpoint.error = error instanceof Error ? error.message : String(error);
    
    state.errors.push({
      timestamp: Date.now(),
      message: checkpoint.error,
      checkpoint: checkpoint.id,
      recoverable: false
    });

    throw error;
  }

  // Remove completed checkpoint from scheduled list
  state.scheduledCheckpoints = state.scheduledCheckpoints.filter(
    c => c.id !== checkpoint.id
  );
  
  state.lastUpdate = Date.now();
}

/**
 * Handle checkpoint-specific actions
 */
async function handleCheckpointSpecificActions(
  state: RecheckWorkflowState,
  checkpoint: RecheckCheckpoint,
  result: any
): Promise<void> {
  switch (checkpoint.type) {
    case 'pre_game':
      // Handle pre-game specific logic
      if (result.tierAdjustmentRequired) {
        // Trigger tier adjustment workflow
        state.config.tierAdjustmentTriggered = true;
      }
      if (result.positionSizeAdjustment) {
        // Update position sizing
        state.config.adjustedPositionSize = result.newPositionSize;
      }
      break;

    case 'final_validation':
      // Handle final validation before game
      if (result.validationFailed) {
        // May need to cancel pick or suspend
        if (result.severity === 'critical') {
          await generateRecheckAlert(state.pickId, checkpoint, {
            ...result,
            alertType: 'critical_validation_failure'
          });
        }
      }
      break;

    case 'post_game':
      // Handle post-game settlement
      if (result.settlementReady) {
        state.currentPhase = 'settlement';
        // Trigger settlement workflow
      }
      break;

    case 'emergency_check':
      // Handle emergency situations
      if (result.emergencyAction) {
        await generateRecheckAlert(state.pickId, checkpoint, {
          ...result,
          alertType: 'emergency_action_required'
        });
      }
      break;
  }
}

/**
 * Attempt recovery for failed checkpoint
 */
async function attemptCheckpointRecovery(
  state: RecheckWorkflowState,
  checkpoint: RecheckCheckpoint
): Promise<void> {
  const maxRetries = state.config.maxRetries || 2;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    retryCount++;
    
    // Wait before retry
    await sleep(`${Math.pow(2, retryCount)} seconds`);
    
    try {
      const result = await executeRecheckPoint(
        state.pickId,
        checkpoint,
        state.config
      );
      
      if (result.success) {
        checkpoint.status = 'completed';
        checkpoint.retryCount = retryCount;
        state.metrics.successfulChecks++;
        return;
      }
    } catch (error) {
      // Continue to next retry attempt
    }
  }

  // All retries failed
  checkpoint.status = 'failed';
  checkpoint.retryCount = retryCount;
  state.errors.push({
    timestamp: Date.now(),
    message: `Checkpoint recovery failed after ${maxRetries} attempts`,
    checkpoint: checkpoint.id,
    recoverable: false
  });
}

/**
 * Handle workflow cancellation
 */
async function handleWorkflowCancellation(
  state: RecheckWorkflowState,
  reason: string
): Promise<void> {
  // Mark remaining checkpoints as cancelled
  state.scheduledCheckpoints.forEach(checkpoint => {
    checkpoint.status = 'cancelled';
    checkpoint.cancellationReason = reason;
  });

  // Generate cancellation alert
  await generateRecheckAlert(state.pickId, null, {
    alertType: 'workflow_cancelled',
    reason,
    completedCheckpoints: state.completedCheckpoints.length,
    scheduledCheckpoints: state.scheduledCheckpoints.length
  });
}

/**
 * Helper functions
 */
function getNextScheduledCheckpoint(state: RecheckWorkflowState): RecheckCheckpoint | null {
  const now = Date.now();
  const pendingCheckpoints = state.scheduledCheckpoints
    .filter(c => c.status === 'scheduled')
    .filter(c => new Date(c.scheduledTime).getTime() <= now + (5 * 60 * 1000)) // Within 5 minutes
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  return pendingCheckpoints[0] || null;
}

function hasRemainingCheckpoints(state: RecheckWorkflowState): boolean {
  return state.scheduledCheckpoints.some(c => 
    c.status === 'scheduled' || c.status === 'pending'
  );
}

function markRemainingCheckpointsSkipped(state: RecheckWorkflowState, reason: string): void {
  state.scheduledCheckpoints.forEach(checkpoint => {
    if (checkpoint.status === 'scheduled' || checkpoint.status === 'pending') {
      checkpoint.status = 'skipped';
      checkpoint.skipReason = reason;
    }
  });
}

/**
 * Child workflow for handling critical alerts
 */
export async function criticalAlertWorkflow(input: {
  pickId: string;
  alertType: string;
  severity: 'high' | 'critical';
  data: any;
}): Promise<void> {
  // Handle critical alerts that require immediate action
  const { handleCriticalAlert } = proxyActivities<AutoRecheckActivities>({
    startToCloseTimeout: '1 minute',
    retry: {
      initialInterval: '5 seconds',
      maximumAttempts: 2
    }
  });

  await handleCriticalAlert(input.pickId, input.alertType, {
    severity: input.severity,
    data: input.data,
    timestamp: Date.now()
  });
}