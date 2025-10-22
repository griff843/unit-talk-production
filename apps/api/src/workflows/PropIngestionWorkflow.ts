import { proxyActivities, sleep, defineSignal, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities/propIngestion.activities';

// Import activity types
const { 
  validateBatch,
  processChunk,
  enrichProps,
  persistProps,
  notifyDownstream,
  updateMetrics,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '30s',
  },
});

export interface PropBatch {
  id: string;
  source: string;
  props: RawProp[];
  timestamp: Date;
  priority: 'high' | 'normal' | 'low';
}

export interface RawProp {
  id: string;
  sport: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  bookmaker: string;
  game_date: string;
}

export interface IngestionResult {
  batchId: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  duration: number;
  errors: string[];
}

// Define signals for workflow control
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const abortSignal = defineSignal('abort');

/**
 * High-volume prop ingestion workflow
 */
export async function PropIngestionWorkflow(batch: PropBatch): Promise<IngestionResult> {
  const startTime = Date.now();
  const result: IngestionResult = {
    batchId: batch.id,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    duration: 0,
    errors: [],
  };

  // Workflow state
  let isPaused = false;
  let isAborted = false;

  // Set up signal handlers
  setHandler(pauseSignal, () => {
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    isPaused = false;
  });

  setHandler(abortSignal, () => {
    isAborted = true;
  });

  try {
    // Step 1: Validate batch
    const validation = await validateBatch(batch);
    if (!validation.isValid) {
      result.errors.push(`Batch validation failed: ${validation.reason}`);
      return result;
    }

    // Step 2: Chunk processing for parallelization
    const chunkSize = batch.priority === 'high' ? 50 : 100;
    const chunks = chunkArray(batch.props, chunkSize);
    
    // Process chunks in parallel with rate limiting
    const maxConcurrent = batch.priority === 'high' ? 10 : 5;
    const processedChunks: any[] = [];

    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      // Check for pause/abort
      if (isAborted) {
        result.errors.push('Workflow aborted by user');
        break;
      }

      while (isPaused) {
        await sleep('1s');
        if (isAborted) break;
      }

      const chunkBatch = chunks.slice(i, i + maxConcurrent);
      const chunkPromises = chunkBatch.map((chunk, index) => 
        processChunkWithRetry(chunk, batch.id, i + index)
      );

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Collect results
      for (const chunkResult of chunkResults) {
        if (chunkResult.status === 'fulfilled') {
          processedChunks.push(chunkResult.value);
          result.successCount += chunkResult.value.processed;
        } else {
          result.failureCount += chunkSize;
          result.errors.push(chunkResult.reason);
        }
      }

      // Rate limiting between batches
      if (i + maxConcurrent < chunks.length) {
        await sleep(batch.priority === 'high' ? '100ms' : '500ms');
      }
    }

    // Step 3: Enrich props with additional data
    if (processedChunks.length > 0 && !isAborted) {
      try {
        const enrichedProps = await enrichProps(
          processedChunks.flatMap(c => c.props)
        );
        
        // Step 4: Persist to database
        const persistResult = await persistProps(enrichedProps);
        result.totalProcessed = persistResult.count;
        
        // Step 5: Notify downstream systems
        await notifyDownstream({
          batchId: batch.id,
          totalProps: result.totalProcessed,
          source: batch.source,
        });
      } catch (error) {
        result.errors.push(`Enrichment/persistence failed: ${error.message}`);
      }
    }

    // Step 6: Update metrics
    result.duration = Date.now() - startTime;
    await updateMetrics({
      workflowId: batch.id,
      source: batch.source,
      processed: result.totalProcessed,
      duration: result.duration,
      errors: result.errors.length,
    });

  } catch (error) {
    result.errors.push(`Workflow error: ${error.message}`);
  }

  return result;
}

/**
 * Process chunk with retry logic
 */
async function processChunkWithRetry(
  chunk: RawProp[],
  batchId: string,
  chunkIndex: number
): Promise<any> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processChunk({
        props: chunk,
        batchId,
        chunkIndex,
      });
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await sleep(`${Math.pow(2, attempt)}s`);
      }
    }
  }

  throw lastError || new Error('Unknown error in chunk processing');
}

/**
 * Utility to chunk array
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Child workflow for processing individual sports
 */
export async function SportSpecificIngestionWorkflow(
  sport: string,
  props: RawProp[]
): Promise<IngestionResult> {
  // Sport-specific processing logic
  const sportConfig = getSportConfig(sport);
  
  const result: IngestionResult = {
    batchId: `${sport}-${Date.now()}`,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    duration: 0,
    errors: [],
  };

  // Apply sport-specific validation rules
  const validProps = props.filter(prop => 
    validateSportProp(prop, sportConfig)
  );

  if (validProps.length === 0) {
    result.errors.push(`No valid props for sport ${sport}`);
    return result;
  }

  // Process with sport-specific logic
  try {
    const processed = await processChunk({
      props: validProps,
      batchId: result.batchId,
      chunkIndex: 0,
    });

    result.successCount = processed.processed;
    result.totalProcessed = processed.processed;
  } catch (error) {
    result.errors.push(`Sport processing failed: ${error.message}`);
  }

  return result;
}

/**
 * Get sport-specific configuration
 */
function getSportConfig(sport: string): any {
  const configs = {
    NFL: {
      validStatTypes: ['passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns'],
      maxLine: 1000,
    },
    NBA: {
      validStatTypes: ['points', 'rebounds', 'assists', 'threes'],
      maxLine: 100,
    },
    MLB: {
      validStatTypes: ['hits', 'home_runs', 'strikeouts', 'rbi'],
      maxLine: 50,
    },
  };

  return configs[sport] || {};
}

/**
 * Validate prop for specific sport
 */
function validateSportProp(prop: RawProp, config: any): boolean {
  if (config.validStatTypes && !config.validStatTypes.includes(prop.stat_type)) {
    return false;
  }

  if (config.maxLine && prop.line > config.maxLine) {
    return false;
  }

  return true;
}