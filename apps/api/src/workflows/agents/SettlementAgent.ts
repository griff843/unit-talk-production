import { proxyActivities, workflowInfo, log } from '@temporalio/workflow';
import type * as activities from '../../activities/settlementActivities';

// Configure activity proxy with proper timeouts
const {
  fetchUnsetlledPicks,
  fetchPickById,
  settlePick,
  rateLimitDelay
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  heartbeatTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2.0,
    maximumInterval: '30 seconds',
  },
});

export interface SettlementConfig {
  batchSize?: number;
  dryRun?: boolean;
  rateLimit?: number;
  force?: boolean;
  shadow_mode?: boolean;
  freeze_mode?: boolean;
}

export interface BackfillOptions extends SettlementConfig {
  league?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RunIdsOptions extends SettlementConfig {
  ids: string[];
}

export interface SettlementJob {
  jobId: string;
  type: 'backfill' | 'ids' | 'live';
  options: BackfillOptions | RunIdsOptions;
  progress: SettlementProgress;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface SettlementProgress {
  scanned: number;
  settled: number;
  skipped: number;
  errors: number;
  failed: string[];
  eta?: Date;
}

// Removed SettlementAgent class - replaced with activity-based workflows

// Temporal workflow exports
export async function settlementBackfillWorkflow(options: BackfillOptions): Promise<string> {
  const workflowId = workflowInfo().workflowId;
  const jobId = `backfill-${Date.now()}`;

  log.info('Starting settlement backfill workflow', { jobId, options });

  const progress = {
    scanned: 0,
    settled: 0,
    skipped: 0,
    errors: 0,
    failed: [] as string[]
  };

  try {
    // Check runtime config flags
    if (options.freeze_mode) {
      log.warn('Freeze mode enabled - no writes will be performed');
    }

    if (options.shadow_mode || options.dryRun) {
      log.info('Shadow/dry run mode - simulating without writes');
    }

    // Process in batches
    const batchSize = options.batchSize || 100;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of unsettled picks
      const picks = await fetchUnsetlledPicks({
        ...options,
        batchSize
      });

      if (!picks || picks.length === 0) {
        hasMore = false;
        break;
      }

      log.info('Processing batch of picks', { count: picks.length, progress });

      // Process each pick in the batch
      for (const pick of picks) {
        progress.scanned++;

        try {
          const result = await settlePick(pick, options);
          
          if (result.success) {
            progress.settled++;
            log.debug('Pick settled successfully', { 
              pickId: pick.id, 
              outcome: result.outcome,
              actualStat: result.actualStat 
            });
          } else {
            progress.skipped++;
            log.warn('Pick settlement skipped', { 
              pickId: pick.id, 
              reason: result.error 
            });
          }
        } catch (error) {
          progress.errors++;
          progress.failed.push(pick.id);
          log.error('Failed to settle pick', { 
            pickId: pick.id, 
            error: error instanceof Error ? error.message : String(error)
          });
        }

        // Rate limiting
        if (options.rateLimit) {
          await rateLimitDelay(options.rateLimit);
        }
      }

      // Continue if we got a full batch (indicating more data)
      hasMore = picks.length === batchSize;
    }

    log.info('Settlement backfill completed', { jobId, progress });
    return jobId;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Settlement backfill failed', { jobId, error: errorMsg, progress });
    throw error;
  }
}

export async function settlementIdsWorkflow(options: RunIdsOptions): Promise<string> {
  const workflowId = workflowInfo().workflowId;
  const jobId = `ids-${Date.now()}`;

  log.info('Starting settlement IDs workflow', { jobId, options });

  const progress = {
    scanned: 0,
    settled: 0,
    skipped: 0,
    errors: 0,
    failed: [] as string[]
  };

  try {
    const { ids } = options;
    
    for (const id of ids) {
      progress.scanned++;

      // Fetch the specific pick
      const pick = await fetchPickById(id);

      if (!pick) {
        progress.errors++;
        progress.failed.push(id);
        log.error('Pick not found', { id });
        continue;
      }

      try {
        const result = await settlePick(pick, options);
        
        if (result.success) {
          progress.settled++;
          log.info('Pick settled successfully', { 
            pickId: pick.id, 
            outcome: result.outcome,
            actualStat: result.actualStat 
          });
        } else {
          progress.skipped++;
          log.warn('Pick settlement skipped', { 
            pickId: pick.id, 
            reason: result.error 
          });
        }
      } catch (error) {
        progress.errors++;
        progress.failed.push(id);
        log.error('Failed to settle pick', { 
          pickId: id, 
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Rate limiting
      if (options.rateLimit) {
        await rateLimitDelay(options.rateLimit);
      }
    }

    log.info('Settlement IDs workflow completed', { jobId, progress });
    return jobId;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Settlement IDs workflow failed', { jobId, error: errorMsg, progress });
    throw error;
  }
}

// SettlementAgent class for API usage
export class SettlementAgent {
  public store: Map<string, any> = new Map();

  constructor() {
    // Initialize empty
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  getJobStatus(jobId: string): any {
    return this.store.get(jobId);
  }
}