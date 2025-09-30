/**
 * Scoring Queue Worker
 * Consumes jobs from scoring_queue table and processes them via ScoringAgent
 *
 * Usage:
 *   npx tsx src/runner/runScoringWorker.ts              # Continuous mode
 *   npx tsx src/runner/runScoringWorker.ts --once       # Process one batch and exit
 *   npx tsx src/runner/runScoringWorker.ts --batch=100  # Custom batch size
 */

import { createSupabaseClient } from '../utils/supabase';
import { ScoringAgent } from '../agents/ScoringAgent/ScoringAgent';
import { createLogger } from '../utils/logger';

const logger = createLogger('ScoringWorker');

interface QueueJob {
  id: string;
  pick_id: string;
  created_at: string;
}

interface WorkerStats {
  cycles: number;
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  avgProcessingTimeMs: number;
  startTime: Date;
}

class ScoringWorker {
  private supabase = createSupabaseClient();
  private scoringAgent: ScoringAgent;
  private stats: WorkerStats = {
    cycles: 0,
    jobsProcessed: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    avgProcessingTimeMs: 0,
    startTime: new Date()
  };
  private running = true;

  constructor(private batchSize: number = 50, private onceMode: boolean = false) {
    // Initialize ScoringAgent
    this.scoringAgent = new ScoringAgent(
      {
        name: 'ScoringWorker',
        enabled: true,
        interval: 0, // Not used in worker mode
        timeout: 120000
      },
      {
        logger,
        supabase: this.supabase
      }
    );
  }

  async start(): Promise<void> {
    logger.info('🚀 Scoring Worker starting', {
      batchSize: this.batchSize,
      mode: this.onceMode ? 'once' : 'continuous'
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    while (this.running) {
      try {
        await this.processCycle();

        if (this.onceMode) {
          logger.info('Once mode: exiting after single cycle');
          break;
        }

        // Sleep 2s between cycles if no jobs
        await this.sleep(2000);

      } catch (error) {
        logger.error('Worker cycle failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });

        // Backoff on error
        await this.sleep(5000);
      }
    }

    await this.printFinalStats();
  }

  private async processCycle(): Promise<void> {
    const cycleStart = Date.now();
    this.stats.cycles++;

    // Dequeue jobs using RPC
    const { data: jobs, error } = await this.supabase
      .rpc('dequeue_scoring_job', { batch_size: this.batchSize });

    if (error) {
      logger.error('Failed to dequeue jobs', { error: error.message });
      return;
    }

    if (!jobs || jobs.length === 0) {
      logger.debug('No pending jobs in queue');
      return;
    }

    logger.info(`⚡ Processing ${jobs.length} scoring jobs`, {
      cycle: this.stats.cycles,
      queueAge: jobs[0] ? this.calculateAge(jobs[0].created_at) : 0
    });

    // Process jobs in parallel with controlled concurrency
    const results = await this.processJobsBatch(jobs as QueueJob[]);

    // Update stats
    const cycleTime = Date.now() - cycleStart;
    this.stats.jobsProcessed += jobs.length;
    this.stats.jobsSucceeded += results.filter(r => r.success).length;
    this.stats.jobsFailed += results.filter(r => !r.success).length;
    this.stats.avgProcessingTimeMs =
      (this.stats.avgProcessingTimeMs * (this.stats.cycles - 1) + cycleTime) / this.stats.cycles;

    logger.info(`✅ Cycle complete`, {
      cycle: this.stats.cycles,
      processed: jobs.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      cycleTimeMs: cycleTime
    });
  }

  private async processJobsBatch(jobs: QueueJob[]): Promise<Array<{ success: boolean; error?: string }>> {
    // Process with concurrency limit of 2 to avoid connection pool exhaustion
    const concurrency = 2;
    const results: Array<{ success: boolean; error?: string }> = [];

    for (let i = 0; i < jobs.length; i += concurrency) {
      const batch = jobs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(job => this.processJob(job))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async processJob(job: QueueJob): Promise<{ success: boolean; error?: string }> {
    const jobStart = Date.now();

    try {
      // Score the pick
      const result = await this.scoringAgent.scoreSinglePick(job.pick_id);

      if (!result.scored) {
        throw new Error(result.error || 'Scoring failed');
      }

      // Mark job as DONE
      await this.supabase
        .from('scoring_queue')
        .update({
          status: 'DONE',
          error: null
        })
        .eq('id', job.id);

      logger.debug('Job completed', {
        jobId: job.id,
        pickId: job.pick_id,
        professionalScore: result.professionalScore,
        processingTimeMs: Date.now() - jobStart
      });

      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Mark job as ERROR
      await this.supabase
        .from('scoring_queue')
        .update({
          status: 'ERROR',
          error: errorMsg
        })
        .eq('id', job.id);

      logger.warn('Job failed', {
        jobId: job.id,
        pickId: job.pick_id,
        error: errorMsg,
        processingTimeMs: Date.now() - jobStart
      });

      return { success: false, error: errorMsg };
    }
  }

  private calculateAge(createdAt: string): number {
    return Date.now() - new Date(createdAt).getTime();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shutdown(): void {
    logger.info('🛑 Graceful shutdown initiated');
    this.running = false;
  }

  private async printFinalStats(): Promise<void> {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeMinutes = Math.floor(uptime / 60000);

    logger.info('📊 Worker final statistics', {
      uptime: `${uptimeMinutes}m`,
      cycles: this.stats.cycles,
      jobsProcessed: this.stats.jobsProcessed,
      jobsSucceeded: this.stats.jobsSucceeded,
      jobsFailed: this.stats.jobsFailed,
      successRate: this.stats.jobsProcessed > 0
        ? Math.round((this.stats.jobsSucceeded / this.stats.jobsProcessed) * 100)
        : 0,
      avgCycleTimeMs: Math.round(this.stats.avgProcessingTimeMs)
    });
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const onceMode = args.includes('--once');
const batchArg = args.find(arg => arg.startsWith('--batch='));
const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 50;

// Start worker
const worker = new ScoringWorker(batchSize, onceMode);
worker.start().catch((error) => {
  logger.error('Worker startup failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});