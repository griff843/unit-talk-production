/**
 * Feature-Flagged Data Pipeline
 *
 * Orchestrates between HOT/WARM/COLD data architecture and raw_props-only approach
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface DataPipelineResult {
    pipelineId: string;
    mode: 'hot_warm_cold' | 'raw_props_only';
    recordsProcessed: number;
    processingTimeMs: number;
    storageEfficiency: number;
    dataConsistency: number;
    hotDataWrites: number;
    warmDataWrites: number;
    coldDataWrites: number;
    totalStorageUsed: number;
    duplicatesDetected: number;
    dataValidationErrors: number;
    compressionRatio?: number;
    errorCount: number;
    errors: string[];
}
export interface DataPipelineComparison {
    comparisonId: string;
    userId?: string;
    flagEnabled: boolean;
    variant: 'control' | 'treatment';
    abTestGroup?: string;
    rawPropsResult: DataPipelineResult;
    rawPropsLatency: number;
    hotWarmColdResult?: DataPipelineResult;
    hotWarmColdLatency?: number;
    latencyDelta: number;
    storageEfficiencyDelta: number;
    consistencyDelta: number;
    selectedResult: DataPipelineResult;
    selectionReason: string;
    timestamp: string;
    environment: string;
    batchSize: number;
}
export interface HotWarmColdConfig {
    hotRetentionHours: number;
    warmRetentionDays: number;
    coldRetentionMonths: number;
    compressionEnabled: boolean;
    replicationFactor: number;
    consistencyLevel: 'eventual' | 'strong';
}
export declare class FeatureFlaggedDataPipeline {
    private logger;
    private supabase;
    private featureFlagService;
    private abTestingEngine;
    private config;
    private performanceMetrics;
    constructor(supabase: SupabaseClient);
    /**
     * Process data batch using feature-flagged approach
     */
    processBatch(data: any[], context?: {
        userId?: string;
        sessionId?: string;
        metadata?: Record<string, any>;
    }): Promise<DataPipelineComparison>;
    /**
     * Process data using raw props only approach (baseline)
     */
    private processWithRawPropsOnly;
    /**
     * Process data using HOT/WARM/COLD architecture
     */
    private processWithHotWarmCold;
    /**
     * Determine data temperature classification
     */
    private classifyDataTemperature;
    /**
     * Check if data should be stored in hot tier
     */
    private isHotData;
    /**
     * Check if data should be stored in warm tier
     */
    private isWarmData;
    /**
     * Store data in hot tier (prop_ticks_hot table)
     */
    private storeHotData;
    /**
     * Store data in warm tier (prop_ticks_warm table - would need to be created)
     */
    private storeWarmData;
    /**
     * Store data in cold tier (archived/compressed storage)
     */
    private storeColdData;
    /**
     * Calculate storage size (simplified)
     */
    private calculateStorageSize;
    /**
     * Check for duplicates (simplified)
     */
    private hasDuplicate;
    /**
     * Determine which system to use based on A/B test assignment
     */
    private determineSelectionStrategy;
    /**
     * Compare performance between approaches
     */
    private comparePerformance;
    /**
     * Track A/B testing events for both systems
     */
    private trackABTestingEvents;
    /**
     * Update internal performance metrics
     */
    private updatePerformanceMetrics;
    /**
     * Store comparison result for analysis
     */
    private storeComparisonResult;
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring;
    /**
     * Emit performance metrics for monitoring
     */
    private emitPerformanceMetrics;
    /**
     * Reset performance metrics
     */
    private resetPerformanceMetrics;
    /**
     * Get health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: typeof this.performanceMetrics;
        config: HotWarmColdConfig;
    };
    /**
     * Get A/B test analysis for the data pipeline
     */
    getABTestAnalysis(): Promise<any>;
    /**
     * Generate comprehensive data pipeline report
     */
    generateSystemReport(): Promise<any>;
}
//# sourceMappingURL=FeatureFlaggedDataPipeline.d.ts.map