import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
/**
 * DataLifecycleAgent
 *
 * Enterprise-grade data lifecycle management for sports betting props.
 * Implements hot-warm-cold storage tiers following SaaS best practices.
 *
 * Architecture:
 * - Hot Tier (prop_ticks_hot): Real-time tick data for 7-14 days
 * - Warm Tier (features_daily_agg): Feature store for 30 days
 * - Cold Tier (prop_ticks_archive): Parquet exports for long-term storage
 *
 * Similar to data management used by:
 * - Stripe (transaction archiving)
 * - Snowflake (time-travel data)
 * - AWS RDS (automated lifecycle policies)
 */
export declare class DataLifecycleAgent extends BaseAgent {
    private lifecycleMetrics;
    private retentionPolicy;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    private analyzeDataDistribution;
    private archiveHotToWarm;
    private archiveWarmToCold;
    private triggerParquetExport;
    private compressHistoricalData;
    private deleteExpiredData;
    private ensureHistoricalTablesExist;
    private calculateCutoffDate;
    private getTableCount;
    private countRecordsToArchive;
    private moveRecordsBatched;
    private checkRetentionViolations;
    private updateTierMetrics;
    private validateRetentionPolicy;
    private loadLifecycleMetrics;
    private generateLifecycleInsights;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map