/**
 * FeedAgentBackfill Temporal Workflow
 *
 * Pulls props for a date range, chunked by hour, idempotent on external_prop_id.
 * Includes safety flags: --dryRun, --maxCalls
 * After success, triggers Processor and Promoter workflows.
 */
export interface BackfillRequest {
    startDate: string;
    endDate: string;
    sport?: string;
    dryRun?: boolean;
    maxCalls?: number;
    batchSize?: number;
    delayBetweenChunks?: number;
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
export declare const getProgressQuery: import("@temporalio/workflow").QueryDefinition<BackfillProgress, [], string>;
export declare const cancelSignal: import("@temporalio/workflow").SignalDefinition<[], string>;
export declare function FeedAgentBackfillWorkflow(request: BackfillRequest): Promise<BackfillProgress>;
//# sourceMappingURL=FeedAgentBackfillWorkflow.d.ts.map