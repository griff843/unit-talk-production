/**
 * DataLifecycleMonitoring - Comprehensive Prometheus metrics for HOT/WARM/COLD architecture
 *
 * Tracks:
 * - HOT data ingestion and processing rates
 * - WARM data archival and compression metrics
 * - COLD data lifecycle and access patterns
 * - Feature computation performance
 * - Steam detection and alert generation
 * - Data quality and integrity metrics
 * - System health and error rates
 */
export declare class DataLifecycleMonitoring {
    private logger;
    private readonly hotDataIngestRate;
    private readonly hotDataIngestionDuration;
    private readonly hotDataCurrentSize;
    private readonly hotDataLatestTimestamp;
    private readonly steamMovesDetected;
    private readonly steamDetectionLatency;
    private readonly archivalWorkflowRuns;
    private readonly archivalDuration;
    private readonly archivedDataVolume;
    private readonly archivedRecordCount;
    private readonly compressionRatio;
    private readonly warmStorageSize;
    private readonly warmFileCount;
    private readonly featureComputationRate;
    private readonly featureComputationDuration;
    private readonly featureQualityScore;
    private readonly featureComputeErrors;
    private readonly featuresPerSecond;
    private readonly gradingWorkflowRuns;
    private readonly gradingDuration;
    private readonly professionalScores;
    private readonly highValueProps;
    private readonly materialChanges;
    private readonly dataIntegrityChecks;
    private readonly workflowFailures;
    private readonly databaseConnectionLatency;
    private readonly alertsGenerated;
    private readonly dataLifecycleHealth;
    constructor(logger: any);
    recordHotDataIngestion(params: {
        sport: string;
        source: string;
        recordCount: number;
        status: 'success' | 'duplicate' | 'error';
        duration: number;
        batchSize: number;
    }): void;
    updateHotDataSize(sport: string, partition: string, recordCount: number): void;
    recordSteamMove(params: {
        sport: string;
        player: string;
        statType: string;
        magnitude: 'low' | 'medium' | 'high' | 'critical';
        detectionLatency?: number;
    }): void;
    recordArchivalWorkflow(params: {
        status: 'success' | 'failure' | 'partial';
        trigger: 'scheduled' | 'manual';
        duration: number;
        archivedBytes: number;
        recordCount: number;
        date: string;
        sport?: string;
        compressionRatio?: number;
    }): void;
    updateWarmStorageMetrics(bucket: string, sizeBytes: number, fileCount: number, ageDays: string): void;
    recordFeatureComputation(params: {
        featureType: string;
        sport: string;
        status: 'success' | 'error';
        duration: number;
        batchSize: number;
        qualityScore?: number;
        errorType?: string;
    }): void;
    updateFeatureComputationRate(workerId: string, featuresPerSecond: number): void;
    recordGradingWorkflow(params: {
        status: 'success' | 'failure';
        scoringMethod: 'weighted' | 'ensemble' | 'neural';
        duration: number;
        batchSize: number;
        scores: number[];
        highValueCount?: number;
        materialChangeCount?: number;
    }): void;
    recordMaterialChange(params: {
        changeType: 'feature' | 'line' | 'odds';
        magnitude: 'medium' | 'high' | 'critical';
    }): void;
    recordDataIntegrityCheck(params: {
        checkType: 'checksum' | 'record_count' | 'schema';
        result: 'pass' | 'fail';
    }): void;
    recordWorkflowFailure(params: {
        workflowType: string;
        failureReason: string;
    }): void;
    recordDatabaseLatency(params: {
        database: string;
        operation: string;
        latency: number;
    }): void;
    recordAlert(params: {
        alertType: 'steam' | 'quality' | 'failure' | 'high_value';
        priority: 'low' | 'medium' | 'high' | 'critical';
        resolved: boolean;
    }): void;
    updateSystemHealth(component: 'hot' | 'warm' | 'cold' | 'features' | 'grading', healthScore: number): void;
    generateHealthReport(): Promise<{
        overall_health: number;
        components: Record<string, {
            health_score: number;
            status: 'healthy' | 'degraded' | 'unhealthy';
            metrics: Record<string, any>;
        }>;
        alerts: Array<{
            type: string;
            message: string;
            priority: string;
        }>;
    }>;
    private calculateComponentHealth;
    private getComponentMetrics;
    getPrometheusMetrics(): string;
    getContentType(): string;
    destroy(): void;
}
//# sourceMappingURL=DataLifecycleMonitoring.d.ts.map