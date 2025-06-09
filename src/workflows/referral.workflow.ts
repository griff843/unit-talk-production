import { proxyActivities } from '@temporalio/workflow';
import { ApplicationFailure, sleep } from '@temporalio/workflow';
import type { ReferralAgentActivities } from '../types/activities';
import { Logger } from '@temporalio/workflow';

// Configure logger
const logger = new Logger('referral.workflow');

// Create proxy for referral activities with appropriate timeouts
const referralActivities = proxyActivities<ReferralAgentActivities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2.0
  }
});

/**
 * Primary workflow for recording a new referral
 * 
 * @param params Configuration parameters for the referral
 * @returns Result of the referral creation
 */
export async function referralWorkflow(params: {
  inviterId: string;
  inviteeId: string;
  channel: 'discord' | 'web' | 'other';
  referralCode?: string;
  meta?: Record<string, any>;
}): Promise<{
  success: boolean;
  eventId?: string;
  error?: string;
}> {
  logger.info('Starting referral workflow', { 
    inviterId: params.inviterId,
    inviteeId: params.inviteeId,
    channel: params.channel
  });
  
  try {
    // Start metrics tracking
    await referralActivities.startMetricsTracking();
    
    // Record the referral
    const result = await referralActivities.recordReferral({
      inviterId: params.inviterId,
      inviteeId: params.inviteeId,
      channel: params.channel,
      referralCode: params.referralCode,
      meta: params.meta
    });
    
    logger.info('Referral workflow completed', { 
      success: result.success,
      eventId: result.eventId
    });
    
    return result;
  } catch (error) {
    // Handle workflow-level errors
    logger.error('Referral workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      params
    });
    
    // Record failure metrics
    await referralActivities.recordReferralFailure({
      inviterId: params.inviterId,
      inviteeId: params.inviteeId,
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
      throw ApplicationFailure.create('Unknown error in referral workflow');
    }
  }
}

/**
 * Workflow for updating a referral's status
 * 
 * @param params Configuration parameters for the status update
 * @returns Success indicator
 */
export async function referralStatusWorkflow(params: {
  inviteeId: string;
  status: 'pending' | 'completed' | 'invalid' | 'duplicate' | 'rewarded';
}): Promise<{
  success: boolean;
  error?: string;
}> {
  logger.info('Starting referral status update workflow', { 
    inviteeId: params.inviteeId,
    status: params.status
  });
  
  try {
    // Update the referral status
    const success = await referralActivities.updateReferralStatus(
      params.inviteeId,
      params.status
    );
    
    if (success) {
      // If status is 'completed', trigger reward processing
      if (params.status === 'completed') {
        // Start reward processing as a separate activity
        // This is done asynchronously to avoid blocking the status update
        await referralActivities.queueRewardProcessing({
          inviteeId: params.inviteeId
        });
      }
      
      logger.info('Referral status updated successfully', {
        inviteeId: params.inviteeId,
        status: params.status
      });
    } else {
      logger.warn('No referral found for status update', {
        inviteeId: params.inviteeId
      });
    }
    
    return { success };
  } catch (error) {
    logger.error('Referral status update failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      params
    });
    
    // Record failure metrics
    await referralActivities.recordStatusUpdateFailure({
      inviteeId: params.inviteeId,
      status: params.status,
      error: error instanceof Error ? error.message : 'Unknown error'
    }).catch(metricError => {
      logger.error('Failed to record failure metrics', { 
        error: metricError instanceof Error ? metricError.message : 'Unknown error'
      });
    });
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: 'Unknown error in referral status update' };
    }
  }
}

/**
 * Workflow for processing rewards for completed referrals
 * 
 * @param params Configuration parameters for reward processing
 * @returns Summary of reward processing
 */
export async function referralRewardWorkflow(params: {
  batchSize?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  rewarded: number;
  failed: number;
}> {
  const { batchSize = 100, dryRun = false } = params;
  
  logger.info('Starting referral reward workflow', { 
    batchSize, 
    dryRun 
  });
  
  try {
    // Fetch completed referrals that need rewards
    const completedReferrals = await referralActivities.getCompletedReferrals({
      batchSize,
      skipRewarded: true
    });
    
    logger.info(`Found ${completedReferrals.length} completed referrals for rewards`);
    
    // Process results
    let rewarded = 0;
    let failed = 0;
    
    // Process each referral with individual error handling
    for (const referral of completedReferrals) {
      try {
        // Skip actual reward issuance in dry run mode
        if (dryRun) {
          logger.info('Dry run - skipping reward issuance', { 
            referralId: referral.id,
            inviterId: referral.inviterId,
            inviteeId: referral.inviteeId
          });
          rewarded++;
          continue;
        }
        
        // Issue reward
        const success = await referralActivities.issueReward({
          inviterId: referral.inviterId,
          referralId: referral.id
        });
        
        if (success) {
          // Update referral status to rewarded
          await referralActivities.updateReferralStatus(
            referral.inviteeId,
            'rewarded'
          );
          
          // Log reward event
          await referralActivities.logReferralEvent({
            inviterId: referral.inviterId,
            inviteeId: referral.inviteeId,
            eventType: 'rewarded',
            timestamp: new Date().toISOString(),
            meta: { referralId: referral.id }
          });
          
          rewarded++;
        } else {
          failed++;
        }
        
        logger.info('Processed reward', { 
          referralId: referral.id,
          success
        });
      } catch (error) {
        failed++;
        if (error instanceof Error) {
          logger.error('Failed to process reward', { 
            referralId: referral.id, 
            error: error.message 
          });
        } else {
          logger.error('Failed to process reward with unknown error', { referralId: referral.id });
        }
        
        // Continue processing other referrals even if one fails
        continue;
      }
      
      // Small delay between processing to avoid rate limiting
      await sleep('100 milliseconds');
    }
    
    // Record metrics
    await referralActivities.recordRewardProcessingMetrics({
      processed: completedReferrals.length,
      rewarded,
      failed
    });
    
    logger.info('Referral reward workflow completed', {
      processed: completedReferrals.length,
      rewarded,
      failed
    });
    
    return {
      processed: completedReferrals.length,
      rewarded,
      failed
    };
  } catch (error) {
    // Handle workflow-level errors
    logger.error('Referral reward workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Re-throw as ApplicationFailure for better handling by Temporal
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in referral reward workflow');
    }
  }
}

/**
 * Scheduled workflow that runs on a regular schedule to process referrals
 * Handles checking pending referrals and processing rewards
 */
export async function scheduledReferralProcessingWorkflow(): Promise<void> {
  logger.info('Starting scheduled referral processing workflow');
  
  try {
    // Check pending referrals that might need status updates
    await referralActivities.checkPendingReferrals();
    
    // Process rewards for completed referrals
    await referralRewardWorkflow({ batchSize: 100 });
    
    // Clean up stale referrals
    const cleanedCount = await referralActivities.cleanupStaleReferrals();
    
    logger.info('Scheduled referral processing completed', {
      cleanedCount
    });
  } catch (error) {
    logger.error('Scheduled referral processing workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in scheduled referral processing workflow');
    }
  }
}

/**
 * Recovery workflow for retrying failed referral operations
 */
export async function referralRecoveryWorkflow(params: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<void> {
  const { startDate, endDate, status } = params;
  
  logger.info('Starting referral recovery workflow', { startDate, endDate, status });
  
  try {
    // Get failed operations within date range
    const failedOperations = await referralActivities.getFailedReferralOperations({
      startDate,
      endDate,
      status
    });
    
    logger.info(`Found ${failedOperations.length} failed operations to recover`);
    
    // Process each failed operation
    for (const operation of failedOperations) {
      try {
        if (operation.type === 'referral_creation') {
          // Retry referral creation
          await referralWorkflow({
            inviterId: operation.inviterId,
            inviteeId: operation.inviteeId,
            channel: operation.channel || 'other',
            referralCode: operation.referralCode,
            meta: { recovery: true, originalId: operation.id }
          });
        } else if (operation.type === 'status_update') {
          // Retry status update
          await referralStatusWorkflow({
            inviteeId: operation.inviteeId,
            status: operation.targetStatus as any
          });
        } else if (operation.type === 'reward_processing') {
          // Retry specific reward
          await referralActivities.issueReward({
            inviterId: operation.inviterId,
            referralId: operation.referralId
          });
        }
      } catch (error) {
        logger.error(`Recovery failed for operation: ${operation.id}`, { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Wait briefly between operations
      await sleep('1 second');
    }
    
    logger.info('Referral recovery workflow completed');
  } catch (error) {
    logger.error('Referral recovery workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in referral recovery workflow');
    }
  }
}

/**
 * Workflow for retrieving referral statistics for a user
 */
export async function referralStatsWorkflow(params: {
  userId: string;
}): Promise<any> {
  logger.info('Starting referral stats workflow', { userId: params.userId });
  
  try {
    const stats = await referralActivities.getReferralStats(params.userId);
    logger.info('Referral stats retrieved successfully');
    return stats;
  } catch (error) {
    logger.error('Failed to retrieve referral stats', {
      userId: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in referral stats workflow');
    }
  }
}
