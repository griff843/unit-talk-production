import type { BackfillSGOOptions, BackfillProgress } from '../activities/backfillSGOActivities';
interface ParallelBackfillOptions extends BackfillSGOOptions {
    maxConcurrentSports?: number;
    maxConcurrentDays?: number;
    maxConcurrentGames?: number;
    smartRateLimit?: boolean;
    batchApiCalls?: boolean;
}
interface SportBackfillTask {
    sport: string;
    dateRanges: Array<{
        start: string;
        end: string;
    }>;
    batchSize: number;
    rateLimit: number;
}
interface BatchProgress {
    sport: string;
    dateRange: string;
    gamesProcessed: number;
    propsProcessed: number;
    apiCallsUsed: number;
    duration: number;
    status: 'running' | 'completed' | 'failed';
}
/**
 * MASSIVE PARALLEL SGO BACKFILL WORKFLOW
 *
 * Designed to process 1.4M+ props efficiently using maximum parallelization:
 * - Concurrent sport processing (7 sports simultaneously)
 * - Parallel date range processing within each sport
 * - Batch API calls with intelligent rate limiting
 * - Concurrent settlement processing
 * - Real-time progress tracking and optimization
 *
 * Target: Complete 1.4M props in 6-8 hours
 */
export declare function massiveParallelSGOBackfill(options: ParallelBackfillOptions): Promise<BackfillProgress>;
/**
 * Parallel Sport Backfill Workflow
 * Processes a single sport with concurrent date range processing
 */
export declare function parallelSportBackfill(task: SportBackfillTask, dryRun?: boolean): Promise<BackfillProgress>;
/**
 * Process Date Range Batch
 * Handles concurrent game processing within a date range
 */
export declare function processDateRangeBatch(sport: string, dateRange: {
    start: string;
    end: string;
}, batchSize: number, rateLimit: number, dryRun: boolean): Promise<BatchProgress>;
/**
 * Concurrent Settlement Processor
 * Processes settlement queue in parallel with backfill
 */
export declare function concurrentSettlementProcessor(options: {
    batchSize: number;
    maxConcurrent: number;
}): Promise<{
    settled: number;
    errors: number;
}>;
export {};
//# sourceMappingURL=massiveParallelSGOBackfill.d.ts.map