/**
 * FeedAgentBackfill Temporal Workflow
 *
 * Pulls props for a date range, chunked by hour, idempotent on external_prop_id.
 * Includes safety flags: --dryRun, --maxCalls
 * After success, triggers Processor and Promoter workflows.
 */

import {
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';

import type * as activities from '../activities/backfill';

const {
  backfillPropsForHour,
  triggerProcessor,
  triggerPromoter,
  validateBackfillRequest,
  checkIdempotency,
  recordBackfillProgress,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '10s',
    maximumInterval: '5m',
    backoffCoefficient: 2.0,
  },
});

export interface BackfillRequest {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  sport?: string; // Optional sport filter
  dryRun?: boolean; // Safety flag - don't persist data
  maxCalls?: number; // Safety flag - limit API calls
  batchSize?: number; // Props per hour chunk
  delayBetweenChunks?: number; // ms delay between chunks
}

export interface BackfillProgress {
  totalHours: number;
  completedHours: number;
  failedHours: number;
  totalProps: number;
  processedProps: number;
  duplicateProps: number;
  apiCallCount: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

// Workflow signals and queries
export const getProgressQuery = defineQuery<BackfillProgress>('getProgress');
export const cancelSignal = defineSignal<[]>('cancel');

export async function FeedAgentBackfillWorkflow(
  request: BackfillRequest
): Promise<BackfillProgress> {
  const workflowId = workflowInfo().workflowId;
  console.log(`[BackfillWorkflow] Starting workflow ${workflowId} with request:`, request);

  // Initialize progress tracking
  const progress: BackfillProgress = {
    totalHours: 0,
    completedHours: 0,
    failedHours: 0,
    totalProps: 0,
    processedProps: 0,
    duplicateProps: 0,
    apiCallCount: 0,
    status: 'running',
  };

  let cancelled = false;

  // Set up signal handlers
  setHandler(cancelSignal, () => {
    cancelled = true;
    progress.status = 'cancelled';
    console.log(`[BackfillWorkflow] Cancellation requested for ${workflowId}`);
  });

  setHandler(getProgressQuery, () => progress);

  try {
    // Step 1: Validate backfill request
    console.log('[BackfillWorkflow] Validating backfill request...');
    const validation = await validateBackfillRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid backfill request: ${validation.error}`);
    }

    // Step 2: Check for existing backfill runs (idempotency)
    const idempotencyCheck = await checkIdempotency(request);
    if (idempotencyCheck.exists && !request.dryRun) {
      console.log('[BackfillWorkflow] Backfill already completed for this date range');
      progress.status = 'completed';
      return progress;
    }

    // Step 3: Calculate hour chunks
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);
    const hourChunks: Date[] = [];

    for (
      let current = new Date(startDate);
      current <= endDate;
      current.setHours(current.getHours() + 1)
    ) {
      hourChunks.push(new Date(current));
    }

    progress.totalHours = hourChunks.length;
    console.log(`[BackfillWorkflow] Processing ${progress.totalHours} hour chunks`);

    // Safety check: Enforce maxCalls limit
    if (request.maxCalls && progress.totalHours > request.maxCalls) {
      throw new Error(
        `Backfill would require ${progress.totalHours} calls, but maxCalls is set to ${request.maxCalls}`
      );
    }

    // Step 4: Process each hour chunk
    for (let i = 0; i < hourChunks.length && !cancelled; i++) {
      const hourChunk = hourChunks[i];

      try {
        console.log(
          `[BackfillWorkflow] Processing hour chunk ${i + 1}/${hourChunks.length}: ${hourChunk.toISOString()}`
        );

        // Backfill props for this hour
        const result = await backfillPropsForHour({
          date: hourChunk.toISOString(),
          sport: request.sport,
          dryRun: request.dryRun || false,
          batchSize: request.batchSize || 100,
        });

        // Update progress
        progress.completedHours++;
        progress.processedProps += result.processedCount;
        progress.duplicateProps += result.duplicateCount;
        progress.totalProps += result.totalCount;
        progress.apiCallCount++;

        // Record progress in database
        await recordBackfillProgress({
          workflowId,
          hourChunk: hourChunk.toISOString(),
          result: {
            ...result,
            hour: hourChunk.toISOString(),
          },
          progress,
        });

        console.log(
          `[BackfillWorkflow] Completed hour chunk: ${result.processedCount} props processed, ${result.duplicateCount} duplicates`
        );
      } catch (error) {
        console.error(
          `[BackfillWorkflow] Failed to process hour chunk ${hourChunk.toISOString()}:`,
          error
        );
        progress.failedHours++;

        // Continue with other chunks unless it's a critical error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('rate limit') || errorMessage.includes('timeout')) {
          // For rate limiting or timeout, wait longer
          console.log('[BackfillWorkflow] Rate limit or timeout detected, waiting 60 seconds...');
          await sleep('60s');
        }
      }

      // Delay between chunks to respect rate limits
      if (i < hourChunks.length - 1 && request.delayBetweenChunks) {
        await sleep(`${request.delayBetweenChunks}ms`);
      }

      // Update progress
      await recordBackfillProgress({
        workflowId,
        hourChunk: hourChunk.toISOString(),
        result: {
          processedCount: 0,
          duplicateCount: 0,
          totalCount: 0,
          hour: hourChunk.toISOString(),
        },
        progress,
      });
    }

    if (cancelled) {
      console.log('[BackfillWorkflow] Workflow was cancelled');
      progress.status = 'cancelled';
      return progress;
    }

    // Step 5: Trigger downstream processing (only if not dry run)
    if (!request.dryRun && progress.processedProps > 0) {
      console.log('[BackfillWorkflow] Triggering downstream Processor and Promoter workflows...');

      try {
        // Trigger Processor workflow
        await triggerProcessor({
          dateRange: { start: request.startDate, end: request.endDate },
          propCount: progress.processedProps,
          source: 'backfill',
        });

        // Trigger Promoter workflow
        await triggerPromoter({
          dateRange: { start: request.startDate, end: request.endDate },
          propCount: progress.processedProps,
          source: 'backfill',
        });

        console.log('[BackfillWorkflow] Successfully triggered downstream workflows');
      } catch (error) {
        console.error('[BackfillWorkflow] Failed to trigger downstream workflows:', error);
        // Don't fail the entire workflow for downstream trigger failures
      }
    }

    // Final status
    progress.status = progress.failedHours > 0 ? 'completed' : 'completed';

    console.log(`[BackfillWorkflow] Completed backfill:`, {
      totalHours: progress.totalHours,
      completedHours: progress.completedHours,
      failedHours: progress.failedHours,
      totalProps: progress.totalProps,
      processedProps: progress.processedProps,
      duplicateProps: progress.duplicateProps,
      apiCallCount: progress.apiCallCount,
      dryRun: request.dryRun,
    });

    return progress;
  } catch (error) {
    console.error('[BackfillWorkflow] Workflow failed:', error);
    progress.status = 'failed';
    progress.error = error instanceof Error ? error.message : 'Unknown error';

    // Record final progress with error
    await recordBackfillProgress({
      workflowId,
      hourChunk: 'workflow-error',
      result: { processedCount: 0, duplicateCount: 0, totalCount: 0, hour: 'workflow-error' },
      progress,
    });

    return progress;
  }
}
