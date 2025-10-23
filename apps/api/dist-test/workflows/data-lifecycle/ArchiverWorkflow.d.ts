/**
 * ArchiverWorkflow - Enterprise Data Lifecycle Management
 *
 * Scheduled daily at 2 AM EST to:
 * 1. Export expired HOT data to compressed Parquet
 * 2. Upload to Supabase Storage (WARM)
 * 3. Update metadata tracking
 * 4. Clean up HOT storage
 * 5. Validate data integrity
 *
 * Features:
 * - Idempotent processing with deduplication
 * - Comprehensive error handling and rollback
 * - Real-time monitoring integration
 * - Parallel processing for 8K+ props
 */
export declare function ArchiverWorkflow(params: {
    targetDate?: string;
    retentionDays?: number;
    batchSize?: number;
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    archivedFiles: string[];
    totalRecords: number;
    totalSizeMb: number;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled ArchiverWorkflow - Runs daily at 2 AM EST
 *
 * Uses Temporal's cron scheduling for enterprise-grade reliability:
 * - Automatic retries on failure
 * - Monitoring and alerting integration
 * - Configurable parameters via schedule
 */
export declare function ScheduledArchiverWorkflow(): Promise<void>;
//# sourceMappingURL=ArchiverWorkflow.d.ts.map