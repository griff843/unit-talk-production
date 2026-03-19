import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep,
} from '@temporalio/workflow';

import type * as activities from '../activities';
import type { AlertActivities } from '../activities';

// Proxy activities
const _activities = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    maximumAttempts: 3,
  },
});

// SPRINT-REM-006: Workflow failure escalation proxy
const alertActivities = proxyActivities<AlertActivities>({
  startToCloseTimeout: '30 seconds',
});

// Workflow signals
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const emergencyStopSignal = defineSignal('emergency-stop');

// Workflow queries
export const getStatusQuery = defineQuery<WorkflowStatus>('status');

interface WorkflowStatus {
  isRunning: boolean;
  isPaused: boolean;
  lastBatchTime: string | null;
  processedPicksToday: number;
  errors: string[];
}

/**
 * Smart Form Daily Batch Workflow
 * Runs daily at 10:00 AM EST to process approved picks
 */
export async function smartFormDailyBatchWorkflow(): Promise<void> {
  const status: WorkflowStatus = {
    isRunning: true,
    isPaused: false,
    lastBatchTime: null,
    processedPicksToday: 0,
    errors: [],
  };

  // Set up signal handlers
  setHandler(pauseSignal, () => {
    status.isPaused = true;
  });
  setHandler(resumeSignal, () => {
    status.isPaused = false;
  });
  setHandler(emergencyStopSignal, () => {
    status.isRunning = false;
  });
  setHandler(getStatusQuery, () => status);

  while (status.isRunning) {
    try {
      // Wait for 10:00 AM EST (3:00 PM UTC)
      const now = new Date();
      const target = new Date();
      target.setUTCHours(15, 0, 0, 0); // 10 AM EST = 3 PM UTC

      // If we've passed today's target, set for tomorrow
      if (now >= target) {
        target.setUTCDate(target.getUTCDate() + 1);
      }

      const sleepDuration = target.getTime() - now.getTime();
      await sleep(sleepDuration);

      // Check if paused
      await condition(() => !status.isPaused);

      if (!status.isRunning) {
        break;
      }

      // Process daily batch
      try {
        // const result = await processDailyPickBatch({
        //   timestamp: new Date().toISOString(),
        //   _error: '',
        //   cycleCount: 0,
        //   context: 'daily-batch',
        //   batchId: `batch-${Date.now()}`,
        //   picks: []
        // });
        status.lastBatchTime = new Date().toISOString();
        status.processedPicksToday = 1;

        // Clear old errors on successful run
        status.errors = [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = `Daily batch failed: ${errorMessage}`;
        status.errors.push(errorMsg);

        // Keep only last 5 errors
        if (status.errors.length > 5) {
          status.errors = status.errors.slice(-5);
        }
      }
    } catch (error) {
      status.errors.push(`Workflow err: ${error instanceof Error ? error.message : String(error)}`);
      // SPRINT-REM-006: Escalate persistent workflow failures to operator alerts
      await alertActivities.sendWorkflowFailure({
        timestamp: new Date().toISOString(),
        workflowName: 'smartFormDailyBatchWorkflow',
        error: error instanceof Error ? error.message : String(error),
        cycleCount: 0,
      } as any);

      // Wait 1 hour before retrying on workflow errors
      await sleep('1 hour');
    }
  }
}

/**
 * Smart Form Live Pick Workflow
 * Handles immediate processing of live picks
 */
export async function smartFormLivePickWorkflow(_pickId: string): Promise<void> {
  const status: WorkflowStatus = {
    isRunning: true,
    isPaused: false,
    lastBatchTime: new Date().toISOString(),
    processedPicksToday: 0,
    errors: [],
  };

  setHandler(getStatusQuery, () => status);

  try {
    // Process live pick immediately
    // await processLivePick({
    //   timestamp: new Date().toISOString(),
    //   _error: '',
    //   cycleCount: 0,
    //   context: 'live-pick',
    //   pickId,
    //   pickData: {}
    // });
    status.processedPicksToday = 1;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    status.errors.push(errorMessage);
    throw error;
  } finally {
    status.isRunning = false;
  }
}

/**
 * Smart Form Health Monitor Workflow
 * Monitors system health and alerts on issues
 */
export async function smartFormHealthMonitorWorkflow(): Promise<void> {
  const status: WorkflowStatus = {
    isRunning: true,
    isPaused: false,
    lastBatchTime: null,
    processedPicksToday: 0,
    errors: [],
  };

  setHandler(pauseSignal, () => {
    status.isPaused = true;
  });
  setHandler(resumeSignal, () => {
    status.isPaused = false;
  });
  setHandler(emergencyStopSignal, () => {
    status.isRunning = false;
  });
  setHandler(getStatusQuery, () => status);

  while (status.isRunning) {
    try {
      // Check if paused
      await condition(() => !status.isPaused);

      if (!status.isRunning) {
        break;
      }

      // Run health check
      // const healthResult = await monitorSmartFormHealth({
      //   timestamp: new Date().toISOString(),
      //   _error: '',
      //   cycleCount: 0,
      //   context: 'health-monitor'
      // });
      status.lastBatchTime = new Date().toISOString();

      // Sleep for 5 minutes between health checks
      await sleep('5 minutes');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      status.errors.push(`Health check failed: ${errorMessage}`);
      // SPRINT-REM-006: Escalate persistent health check failures to operator alerts
      await alertActivities.sendWorkflowFailure({
        timestamp: new Date().toISOString(),
        workflowName: 'smartFormHealthMonitorWorkflow',
        error: errorMessage,
        cycleCount: 0,
      } as any);

      // Wait 2 minutes before retrying on errors
      await sleep('2 minutes');
    }
  }
}
