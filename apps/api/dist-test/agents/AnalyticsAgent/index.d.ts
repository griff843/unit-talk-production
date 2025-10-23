import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
interface AnalyticsMetrics extends BaseMetrics {
    totalAnalyzed: number;
    capperCount: number;
    totalPicks: number;
    avgROI: number;
    avgWinRate: number;
    streakCount: number;
    profitableCappers: number;
    activeStreaks: number;
    totalProcessed: number;
    batchesProcessed: number;
    avgBatchTimeMs: number;
    throughputPerMinute: number;
    cacheHitRate: number;
    lastRunStats: {
        startTime: string;
        endTime: string;
        recordsProcessed: number;
    };
}
export declare class AnalyticsAgent extends BaseAgent {
    metrics: AnalyticsMetrics;
    constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies);
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    collectMetrics(): Promise<AnalyticsMetrics>;
    handleCommand(command: any): Promise<void>;
    private processBatchedAnalytics;
    private fetchCappersForAnalysis;
    private processBatch;
    private fetchPicksForCappers;
    private processCapperAnalytics;
    private calculateAdvancedAnalytics;
    private createBatches;
    private updateProcessingMetrics;
    private calculateROI;
    private storeAnalyticsSummary;
    __test__initialize(): Promise<void>;
    __test__collectMetrics(): Promise<AnalyticsMetrics>;
    __test__checkHealth(): Promise<HealthStatus>;
}
export type { AnalyticsAgentConfig } from './types';
//# sourceMappingURL=index.d.ts.map