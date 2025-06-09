import { proxyActivities } from '@temporalio/workflow';
import { ApplicationFailure, sleep } from '@temporalio/workflow';
import type { FinalizerAgentActivities } from '../types/activities';
import { Logger } from '@temporalio/workflow';

// Configure logger
const logger = new Logger('finalization.workflow');

// Create proxy for finalization activities with appropriate timeouts
const finalizerActivities = proxyActivities<FinalizerAgentActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2.0
  }
});

/**
 * Primary finalization workflow that orchestrates the entire finalization process
 * Handles validation, finalization, and publication of graded picks
 * 
 * @param params Configuration parameters for the finalization process
 * @returns Summary of finalization results
 */
export async function finalizationWorkflow(params: {
  batchSize?: number;
  tierThreshold?: string;
  scoreThreshold?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  finalized: number;
  rejected: number;
  published: number;
  failed: number;
}> {
  const { 
    batchSize = 100, 
    tierThreshold = 'C', 
    scoreThreshold = 12,
    dryRun = false 
  } = params;
  
  logger.info('Starting finalization workflow', { 
    batchSize, 
    tierThreshold, 
    scoreThreshold,
    dryRun 
  });
  
  try {
    // Start metrics tracking
    await finalizerActivities.startMetricsTracking();
    
    // Fetch graded picks ready for finalization
    const gradedPicks = await finalizerActivities.fetchGradedPicksForFinalization({ 
      batchSize, 
      tierThreshold, 
      scoreThreshold 
    });
    
    logger.info(`Fetched ${gradedPicks.length} graded picks for finalization`);
    
    // Process results
    let finalized = 0;
    let rejected = 0;
    let published = 0;
    let failed = 0;
    
    // Process each pick with individual error handling
    for (const pick of gradedPicks) {
      try {
        // Validate the pick meets finalization criteria
        const meetsFinalizationCriteria = await finalizerActivities.meetsFinalizationCriteria(pick);
        
        if (!meetsFinalizationCriteria) {
          logger.warn('Pick does not meet finalization criteria—rejecting', { pickId: pick.id });
          
          if (!dryRun) {
            await finalizerActivities.rejectPick(pick);
          }
          
          rejected++;
          continue;
        }
        
        // Skip actual finalization in dry run mode
        if (dryRun) {
          logger.info('Dry run - skipping finalization', { 
            pickId: pick.id, 
            player: pick.player_name, 
            stat: pick.stat_type 
          });
          finalized++;
          continue;
        }
        
        // Finalize the pick
        const finalizedPick = await finalizerActivities.finalizePick(pick);
        finalized++;
        
        // Attempt to publish the finalized pick
        try {
          await finalizerActivities.publishPick(finalizedPick);
          published++;
        } catch (publishError) {
          logger.error('Failed to publish pick', { 
            pickId: pick.id, 
            error: publishError instanceof Error ? publishError.message : 'Unknown error' 
          });
          // Don't count this as a full failure, just track publishing errors separately
        }
        
        logger.info('Successfully processed pick', { 
          pickId: pick.id, 
          player: pick.player_name, 
          stat: pick.stat_type,
          tier: pick.tier
        });
      } catch (error) {
        failed++;
        if (error instanceof Error) {
          logger.error('Failed to process pick', { 
            pickId: pick.id, 
            error: error.message 
          });
        } else {
          logger.error('Failed to process pick with unknown error', { pickId: pick.id });
        }
        
        // Continue processing other picks even if one fails
        continue;
      }
      
      // Small delay between picks to avoid rate limiting
      await sleep('10 milliseconds');
    }
    
    // Record final metrics
    await finalizerActivities.recordFinalizationMetrics({
      processed: gradedPicks.length,
      finalized,
      rejected,
      published,
      failed
    });
    
    logger.info('Finalization workflow completed', {
      processed: gradedPicks.length,
      finalized,
      rejected,
      published,
      failed
    });
    
    return {
      processed: gradedPicks.length,
      finalized,
      rejected,
      published,
      failed
    };
  } catch (error) {
    // Handle workflow-level errors
    logger.error('Finalization workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Record failure metrics
    await finalizerActivities.recordFinalizationFailure({
      error: error instanceof Error ? error.message : 'Unknown error'
    }).catch(metricError => {
      logger.error('Failed to record failure metrics', { 
        error: metricError instanceof Error ? metricError.message : 'Unknown error'
      });
    });
    
    // Re-throw as ApplicationFailure for better handling by Temporal
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in finalization workflow');
    }
  }
}

/**
 * Scheduled finalization workflow that runs on a regular schedule
 * Handles automatic finalization of all eligible graded picks
 */
export async function scheduledFinalizationWorkflow(params: {
  tierThreshold?: string;
  scoreThreshold?: number;
}): Promise<void> {
  const { tierThreshold = 'C', scoreThreshold = 12 } = params;
  
  logger.info('Starting scheduled finalization workflow', {
    tierThreshold,
    scoreThreshold
  });
  
  try {
    // Run finalization with default batch size
    await finalizationWorkflow({ 
      tierThreshold, 
      scoreThreshold 
    });
    
    logger.info('Scheduled finalization completed successfully');
  } catch (error) {
    logger.error('Scheduled finalization workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in scheduled finalization workflow');
    }
  }
}

/**
 * Recovery workflow for retrying failed finalization operations
 */
export async function finalizationRecoveryWorkflow(params: {
  startDate?: string;
  endDate?: string;
  includeRejected?: boolean;
}): Promise<void> {
  const { startDate, endDate, includeRejected = false } = params;
  
  logger.info('Starting finalization recovery workflow', { 
    startDate, 
    endDate, 
    includeRejected 
  });
  
  try {
    // Get failed operations within date range
    const failedOperations = await finalizerActivities.getFailedFinalizationOperations({
      startDate,
      endDate,
      includeRejected
    });
    
    logger.info(`Found ${failedOperations.length} failed operations to recover`);
    
    // Process each failed operation
    for (const operation of failedOperations) {
      try {
        // Attempt to finalize the specific pick
        await finalizerActivities.finalizePickById(operation.pickId);
      } catch (error) {
        logger.error(`Recovery failed for operation: ${operation.id}`, { 
          pickId: operation.pickId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Wait briefly between operations
      await sleep('1 second');
    }
    
    logger.info('Finalization recovery workflow completed');
  } catch (error) {
    logger.error('Finalization recovery workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in finalization recovery workflow');
    }
  }
}

/**
 * Manual finalization workflow for specific picks
 */
export async function manualFinalizationWorkflow(params: {
  pickIds: string[];
}): Promise<{
  successful: string[];
  failed: string[];
}> {
  const { pickIds } = params;
  
  logger.info(`Starting manual finalization workflow for ${pickIds.length} picks`);
  
  const successful: string[] = [];
  const failed: string[] = [];
  
  for (const pickId of pickIds) {
    try {
      const result = await finalizerActivities.finalizePickById(pickId);
      
      if (result) {
        successful.push(pickId);
        logger.info(`Successfully finalized pick ${pickId}`);
      } else {
        failed.push(pickId);
        logger.warn(`Pick ${pickId} did not meet finalization criteria`);
      }
    } catch (error) {
      failed.push(pickId);
      logger.error(`Failed to finalize pick ${pickId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Wait briefly between operations
    await sleep('500 milliseconds');
  }
  
  logger.info('Manual finalization workflow completed', {
    successful: successful.length,
    failed: failed.length
  });
  
  return {
    successful,
    failed
  };
}
