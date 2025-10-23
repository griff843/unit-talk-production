/**
 * Syndicate-Level Scaling Engine
 * Phase 10: Full Production Scaling to 1000+ daily props
 *
 * Handles high-volume operations for syndicate-level betting intelligence
 * Processes 8000+ simultaneous props during peak game days
 * Maintains 55%+ win rate with 5-8% monthly ROI targets
 */
import { EventEmitter } from 'events';
interface SyndicateConfig {
    processing: {
        maxDailyProps: number;
        maxSimultaneousProps: number;
        processingSpeed: number;
        workerThreads: number;
    };
    performance: {
        targetWinRate: number;
        targetMonthlyROI: number;
        maxDrawdown: number;
        systemUptime: number;
    };
    infrastructure: {
        redisCluster: string[];
        databasePool: number;
        cacheTimeout: number;
    };
}
export declare class SyndicateScalingEngine extends EventEmitter {
    private config;
    private redis;
    private dbPool;
    private workers;
    private taskQueue;
    private isScaling;
    private performanceMetrics;
    constructor(config: SyndicateConfig);
    private initializeInfrastructure;
    private initializeWorkerPool;
    /**
     * Process high-volume prop batch (1000+ props)
     * Syndicate-level parallel processing with intelligent load balancing
     */
    processHighVolumeBatch(props: any[]): Promise<{
        processed: number;
        successful: number;
        failed: number;
        avgProcessingTime: number;
        peakThroughput: number;
    }>;
    /**
     * Smart prop prioritization for syndicate-level edge detection
     */
    private prioritizeProps;
    private calculatePropPriority;
    /**
     * Dynamic autoscaling for peak load handling
     */
    private enableAutoscaling;
    private scaleWorkerPool;
    /**
     * Real-time performance tracking for syndicate operations
     */
    private startPerformanceTracking;
    private collectPerformanceMetrics;
    private calculateSystemUptime;
    private checkComponentHealth;
    private handleWorkerMessage;
    private handleWorkerError;
    private handleWorkerExit;
    private restartWorker;
    private distributePropsToWorkers;
    private processChunk;
    private aggregateResults;
    private updatePerformanceMetrics;
    private calculateDeadline;
    private calculateCLV;
    private checkSharpMoney;
    private scaleRedisCluster;
    private enablePriorityQueuing;
    /**
     * Graceful shutdown with data persistence
     */
    shutdown(): Promise<void>;
    private saveState;
}
export declare const SyndicateConfig: SyndicateConfig;
export {};
//# sourceMappingURL=SyndicateScalingEngine.d.ts.map