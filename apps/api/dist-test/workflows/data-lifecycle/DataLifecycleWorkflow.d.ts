/**
 * DataLifecycleWorkflow - Enterprise Data Lifecycle Management
 *
 * Manages HOT → WARM → COLD data archival with enterprise features:
 * - Automated archiving with compression (5-20x reduction)
 * - Data integrity validation and corruption detection
 * - Storage optimization and cost management
 * - Compliance and retention policy enforcement
 * - Performance monitoring and alerting
 *
 * HOT Tier: 7-14 days (PostgreSQL partitioned, sub-second queries)
 * WARM Tier: 2-6 months (Parquet compressed, <5 second queries)
 * COLD Tier: 7+ years (S3 Glacier, compliance archive)
 */
export declare function DataLifecycleWorkflow(params: {
    operation: 'archive_hot_to_warm' | 'archive_warm_to_cold' | 'cleanup_expired' | 'validate_integrity' | 'optimize_storage' | 'full_lifecycle';
    batchSize?: number;
    compressionType?: 'parquet' | 'gzip';
    storageClass?: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
    retentionPolicies?: {
        hotRetentionDays?: number;
        warmRetentionDays?: number;
        coldRetentionYears?: number;
    };
    validationOptions?: {
        checksumValidation?: boolean;
        samplePercentage?: number;
    };
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    operation: string;
    results: {
        archivedRecords?: number;
        compressionRatio?: number;
        spaceSaved?: string;
        performanceImprovement?: number;
        integrityScore?: number;
        estimatedSavings?: number;
    };
    alerts: Array<{
        type: string;
        message: string;
        severity: string;
    }>;
    duration: number;
    errors: string[];
}>;
/**
 * Scheduled DataLifecycleWorkflow - Runs daily at 2 AM for archival
 *
 * Optimized for enterprise data management:
 * - HOT to WARM archival (daily)
 * - WARM to COLD archival (weekly)
 * - Data integrity validation (daily)
 * - Storage optimization (weekly)
 */
export declare function ScheduledDataLifecycleWorkflow(): Promise<void>;
/**
 * Emergency DataLifecycleWorkflow - Triggered by capacity alerts
 *
 * Fast archival for emergency scenarios:
 * - Rapid HOT tier archival when capacity exceeded
 * - Aggressive compression and optimization
 * - Emergency cleanup of expired data
 */
export declare function EmergencyDataLifecycleWorkflow(params: {
    priority: 'high' | 'critical';
    operation: 'emergency_archive' | 'emergency_cleanup';
}): Promise<void>;
//# sourceMappingURL=DataLifecycleWorkflow.d.ts.map