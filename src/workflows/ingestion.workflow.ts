import { proxyActivities } from '@temporalio/workflow';
import { ApplicationFailure, sleep } from '@temporalio/workflow';
import type { IngestionAgentActivities } from '../types/activities';
import { Logger } from '@temporalio/workflow';

// Configure logger
const logger = new Logger('ingestion.workflow');

// Create proxy for ingestion activities with appropriate timeouts
const ingestionActivities = proxyActivities<IngestionAgentActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2.0
  }
});

/**
 * Primary ingestion workflow that orchestrates the entire ingestion process
 * Handles fetching, validation, deduplication, normalization, and storage of props
 * 
 * @param params Configuration parameters for the ingestion process
 * @returns Summary of ingestion results
 */
export async function ingestionWorkflow(params: {
  source?: string;
  batchSize?: number;
  retryFailedOnly?: boolean;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  ingested: number;
  skipped: number;
  failed: number;
}> {
  const { source, batchSize = 100, retryFailedOnly = false, dryRun = false } = params;
  
  logger.info('Starting ingestion workflow', { source, batchSize, retryFailedOnly, dryRun });
  
  try {
    // Start metrics tracking
    await ingestionActivities.startMetricsTracking();
    
    // Fetch raw props from provider(s)
    const rawProps = await ingestionActivities.fetchRawProps({ 
      source, 
      batchSize, 
      retryFailedOnly 
    });
    
    logger.info(`Fetched ${rawProps.length} raw props for processing`);
    
    // Process results
    let ingested = 0;
    let skipped = 0;
    let failed = 0;
    
    // Process each prop with individual error handling
    for (const prop of rawProps) {
      try {
        // Validate the prop
        const isValid = await ingestionActivities.validateRawProp(prop);
        if (!isValid) {
          logger.warn('Invalid prop shape—skipping', { propId: prop.id });
          skipped++;
          continue;
        }
        
        // Check for duplicates
        const isDuplicate = await ingestionActivities.isDuplicateRawProp(prop);
        if (isDuplicate) {
          logger.info('Duplicate prop—skipping', { propId: prop.id });
          skipped++;
          continue;
        }
        
        // Normalize the prop
        const normalized = await ingestionActivities.normalizeRawProp(prop);
        
        // Skip actual insertion in dry run mode
        if (dryRun) {
          logger.info('Dry run - skipping database insertion', { 
            propId: prop.id, 
            player: normalized.player_name, 
            stat: normalized.stat_type 
          });
          ingested++;
          continue;
        }
        
        // Insert into database
        await ingestionActivities.insertRawProp(normalized);
        ingested++;
        
        logger.info('Successfully processed prop', { 
          propId: prop.id, 
          player: normalized.player_name, 
          stat: normalized.stat_type 
        });
      } catch (error) {
        failed++;
        if (error instanceof Error) {
          logger.error('Failed to process prop', { 
            propId: prop.id, 
            error: error.message 
          });
        } else {
          logger.error('Failed to process prop with unknown error', { propId: prop.id });
        }
        
        // Continue processing other props even if one fails
        continue;
      }
      
      // Small delay between props to avoid rate limiting
      await sleep('10 milliseconds');
    }
    
    // Record final metrics
    await ingestionActivities.recordIngestionMetrics({
      processed: rawProps.length,
      ingested,
      skipped,
      failed
    });
    
    logger.info('Ingestion workflow completed', {
      processed: rawProps.length,
      ingested,
      skipped,
      failed
    });
    
    return {
      processed: rawProps.length,
      ingested,
      skipped,
      failed
    };
  } catch (error) {
    // Handle workflow-level errors
    logger.error('Ingestion workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Record failure metrics
    await ingestionActivities.recordIngestionFailure({
      source,
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
      throw ApplicationFailure.create('Unknown error in ingestion workflow');
    }
  }
}

/**
 * Scheduled ingestion workflow that runs on a regular schedule
 * Handles automatic ingestion from all configured sources
 */
export async function scheduledIngestionWorkflow(): Promise<void> {
  logger.info('Starting scheduled ingestion workflow');
  
  try {
    // Get configured sources
    const sources = await ingestionActivities.getConfiguredSources();
    
    // Process each source sequentially
    for (const source of sources) {
      try {
        logger.info(`Processing source: ${source}`);
        
        // Run ingestion for this source
        await ingestionWorkflow({ source });
        
        // Wait briefly between sources
        await sleep('1 second');
      } catch (error) {
        // Log but continue with other sources
        logger.error(`Failed to process source: ${source}`, { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    logger.info('Scheduled ingestion completed for all sources');
  } catch (error) {
    logger.error('Scheduled ingestion workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in scheduled ingestion workflow');
    }
  }
}

/**
 * Recovery workflow for retrying failed ingestion operations
 */
export async function ingestionRecoveryWorkflow(params: {
  startDate?: string;
  endDate?: string;
  sources?: string[];
}): Promise<void> {
  const { startDate, endDate, sources } = params;
  
  logger.info('Starting ingestion recovery workflow', { startDate, endDate, sources });
  
  try {
    // Get failed operations within date range
    const failedOperations = await ingestionActivities.getFailedIngestionOperations({
      startDate,
      endDate,
      sources
    });
    
    logger.info(`Found ${failedOperations.length} failed operations to recover`);
    
    // Process each failed operation
    for (const operation of failedOperations) {
      try {
        await ingestionWorkflow({
          source: operation.source,
          retryFailedOnly: true
        });
      } catch (error) {
        logger.error(`Recovery failed for operation: ${operation.id}`, { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Wait briefly between operations
      await sleep('1 second');
    }
    
    logger.info('Ingestion recovery workflow completed');
  } catch (error) {
    logger.error('Ingestion recovery workflow failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (error instanceof Error) {
      throw ApplicationFailure.fromError(error);
    } else {
      throw ApplicationFailure.create('Unknown error in ingestion recovery workflow');
    }
  }
}
