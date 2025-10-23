/**
 * Backfill Activities for FeedAgentBackfillWorkflow
 *
 * Provides activities for date range backfilling with safety controls,
 * idempotency checks, and downstream workflow triggering.
 */
export interface BackfillHourRequest {
    date: string;
    sport?: string;
    dryRun: boolean;
    batchSize: number;
}
export interface BackfillHourResult {
    processedCount: number;
    duplicateCount: number;
    totalCount: number;
    hour: string;
    error?: string;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export interface IdempotencyResult {
    exists: boolean;
    completedAt?: string;
}
/**
 * Validate backfill request parameters
 */
export declare function validateBackfillRequest(request: any): Promise<ValidationResult>;
/**
 * Check if backfill already exists for this date range (idempotency)
 */
export declare function checkIdempotency(request: any): Promise<IdempotencyResult>;
/**
 * Backfill props for a specific hour
 */
export declare function backfillPropsForHour(request: BackfillHourRequest): Promise<BackfillHourResult>;
/**
 * Record backfill progress in database
 */
export declare function recordBackfillProgress(params: {
    workflowId: string;
    hourChunk: string;
    result: BackfillHourResult;
    progress: any;
}): Promise<void>;
/**
 * Trigger Processor workflow after successful backfill
 */
export declare function triggerProcessor(params: {
    dateRange: {
        start: string;
        end: string;
    };
    propCount: number;
    source: string;
}): Promise<void>;
/**
 * Trigger Promoter workflow after successful backfill
 */
export declare function triggerPromoter(params: {
    dateRange: {
        start: string;
        end: string;
    };
    propCount: number;
    source: string;
}): Promise<void>;
//# sourceMappingURL=backfill.d.ts.map