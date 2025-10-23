/**
 * Real-Time Scoring Pipeline - Phase 8 Production Implementation
 *
 * Optimized for:
 * - <2 second latency from data ingestion to scored result
 * - 1000+ props/hour processing throughput
 * - 99.9% uptime with failover capabilities
 * - Enhanced 45-Factor scoring with material change detection
 */
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { ScoringAgent } from '../agents/ScoringAgent/ScoringAgent';
import { ScoringFeatureSet } from '../types/ScoringFeatureSet';
import { ScoringResult } from '../agents/ScoringAgent/scoring/gradingEngine';
interface RealTimePipelineConfig {
    targetLatencyMs: number;
    targetThroughputPerHour: number;
    batchSize: number;
    concurrentWorkers: number;
    queuePriorities: {
        high: number;
        normal: number;
        low: number;
    };
    redis: {
        ttl: {
            features: number;
            results: number;
            models: number;
        };
        keyPrefixes: {
            features: string;
            results: string;
            pipeline: string;
        };
    };
    monitoring: {
        metricsInterval: number;
        alertThresholds: {
            latencyMs: number;
            errorRate: number;
            queueLength: number;
        };
    };
}
interface PipelineMetrics {
    totalProcessed: number;
    currentThroughput: number;
    averageLatencyMs: number;
    errorRate: number;
    queueLength: number;
    workerUtilization: number;
    cacheHitRate: number;
    lastProcessedAt: Date;
}
interface ProcessingJob {
    id: string;
    propId: string;
    features: ScoringFeatureSet;
    priority: 'high' | 'normal' | 'low';
    timestamp: Date;
    attemptNumber: number;
    maxAttempts: number;
}
interface ProcessingResult {
    jobId: string;
    propId: string;
    result: ScoringResult;
    processingTimeMs: number;
    cacheHit: boolean;
    workerInstance: string;
}
export declare class RealTimeScoringPipeline extends EventEmitter {
    private config;
    private logger;
    private redis;
    private scoringQueue;
    private scoringAgent;
    private enhanced45FactorEngine;
    private materialChangeDetector;
    private featureStoreIntegration;
    private metrics;
    private isRunning;
    private workers;
    private metricsInterval?;
    constructor(config: RealTimePipelineConfig, logger: Logger, scoringAgent: ScoringAgent);
    /**
     * Initialize the real-time scoring pipeline
     */
    initialize(): Promise<void>;
    /**
     * Process a prop through the real-time scoring pipeline
     */
    scoreProps(features: ScoringFeatureSet | ScoringFeatureSet[]): Promise<ScoringResult | ScoringResult[]>;
    /**
     * Add props to the high-priority queue for immediate processing
     */
    addHighPriorityProps(features: ScoringFeatureSet[]): Promise<void>;
    /**
     * Process a batch of props with optimization
     */
    private processBatch;
    /**
     * Process props using Enhanced 45-Factor engine
     */
    private processWithEnhanced45Factor;
    /**
     * Process props using standard scoring agent
     */
    private processWithScoringAgent;
    /**
     * Check Redis cache for existing scoring results
     */
    private checkCache;
    /**
     * Cache scoring results in Redis
     */
    private cacheResults;
    /**
     * Setup Redis connection with optimization
     */
    private setupRedisConnection;
    /**
     * Setup BullMQ scoring queue
     */
    private setupScoringQueue;
    /**
     * Initialize Enhanced 45-Factor scoring components
     */
    private initializeEnhancedScoringComponents;
    /**
     * Setup queue processors for different priorities
     */
    private setupQueueProcessors;
    /**
     * Process an individual scoring job
     */
    private processJob;
    /**
     * Start worker processes
     */
    private startWorkers;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Collect and emit pipeline metrics
     */
    private collectAndEmitMetrics;
    /**
     * Check if metrics exceed alert thresholds
     */
    private checkAlertThresholds;
    /**
     * Handle material change events
     */
    private handleMaterialChange;
    /**
     * Handle critical change events
     */
    private handleCriticalChange;
    private createProcessingJob;
    private convertEnhanced45ResultToScoringResult;
    private initializeMetrics;
    private updateMetrics;
    private calculateCurrentThroughput;
    private calculateErrorRate;
    /**
     * Shutdown the pipeline gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get current pipeline status
     */
    getStatus(): {
        isRunning: boolean;
        metrics: PipelineMetrics;
        config: RealTimePipelineConfig;
        enhanced45FactorEnabled: boolean;
    };
}
export declare const createProductionPipelineConfig: () => RealTimePipelineConfig;
export type { RealTimePipelineConfig, PipelineMetrics, ProcessingJob, ProcessingResult };
//# sourceMappingURL=real-time-scoring-pipeline.d.ts.map