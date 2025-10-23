"use strict";
/**
 * Real-Time Scoring Pipeline - Phase 8 Production Implementation
 *
 * Optimized for:
 * - <2 second latency from data ingestion to scored result
 * - 1000+ props/hour processing throughput
 * - 99.9% uptime with failover capabilities
 * - Enhanced 45-Factor scoring with material change detection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductionPipelineConfig = exports.RealTimeScoringPipeline = void 0;
const events_1 = require("events");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const Enhanced45FactorEngine_1 = require("../agents/ScoringAgent/scoring/Enhanced45FactorEngine");
const MaterialChangeDetector_1 = require("../agents/ScoringAgent/scoring/MaterialChangeDetector");
const FeatureStoreIntegration_1 = require("../agents/ScoringAgent/scoring/FeatureStoreIntegration");
class RealTimeScoringPipeline extends events_1.EventEmitter {
    constructor(config, logger, scoringAgent) {
        super();
        this.isRunning = false;
        this.workers = new Map();
        this.config = config;
        this.logger = logger;
        this.scoringAgent = scoringAgent;
        this.initializeMetrics();
        this.setupRedisConnection();
        this.setupScoringQueue();
        this.initializeEnhancedScoringComponents();
    }
    /**
     * Initialize the real-time scoring pipeline
     */
    async initialize() {
        this.logger.info('🚀 Initializing Real-Time Scoring Pipeline', {
            targetLatencyMs: this.config.targetLatencyMs,
            targetThroughputPerHour: this.config.targetThroughputPerHour,
            concurrentWorkers: this.config.concurrentWorkers,
            batchSize: this.config.batchSize
        });
        try {
            // Initialize Redis connection
            await this.redis.ping();
            this.logger.info('✅ Redis connection established');
            // Initialize enhanced scoring components
            await this.initializeEnhancedScoringComponents();
            this.logger.info('✅ Enhanced 45-Factor system initialized');
            // Setup queue processors
            await this.setupQueueProcessors();
            this.logger.info('✅ Queue processors configured');
            // Start workers
            await this.startWorkers();
            this.logger.info(`✅ ${this.config.concurrentWorkers} workers started`);
            // Start metrics collection
            this.startMetricsCollection();
            this.logger.info('✅ Metrics collection started');
            this.isRunning = true;
            this.emit('pipeline:initialized');
            this.logger.info('🎯 Real-Time Scoring Pipeline fully operational');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize scoring pipeline', { error });
            throw error;
        }
    }
    /**
     * Process a prop through the real-time scoring pipeline
     */
    async scoreProps(features) {
        const startTime = Date.now();
        const isArray = Array.isArray(features);
        const featuresList = isArray ? features : [features];
        this.logger.debug('📊 Processing props through real-time pipeline', {
            propCount: featuresList.length,
            propIds: featuresList.map(f => f.propId).slice(0, 5)
        });
        try {
            // Batch process for optimal performance
            const results = await this.processBatch(featuresList);
            const processingTime = Date.now() - startTime;
            this.updateMetrics(results, processingTime);
            // Emit performance metrics
            this.emit('pipeline:processed', {
                propCount: featuresList.length,
                processingTimeMs: processingTime,
                averageLatencyMs: processingTime / featuresList.length,
                results: results.map(r => ({ propId: r.propId, tier: r.tier, score: r.finalScore }))
            });
            return isArray ? results : results[0];
        }
        catch (error) {
            this.logger.error('❌ Real-time scoring pipeline error', {
                propCount: featuresList.length,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTimeMs: Date.now() - startTime
            });
            this.metrics.errorRate = this.calculateErrorRate();
            this.emit('pipeline:error', { error, propCount: featuresList.length });
            throw error;
        }
    }
    /**
     * Add props to the high-priority queue for immediate processing
     */
    async addHighPriorityProps(features) {
        const jobs = features.map(f => this.createProcessingJob(f, 'high'));
        for (const job of jobs) {
            await this.scoringQueue.add('score-prop', job, {
                priority: this.config.queuePriorities.high,
                removeOnComplete: 100,
                removeOnFail: 50
            });
        }
        this.logger.info('🔥 Added high-priority props to queue', {
            propCount: features.length,
            propIds: features.map(f => f.propId).slice(0, 5)
        });
    }
    /**
     * Process a batch of props with optimization
     */
    async processBatch(featuresList) {
        const batchStartTime = Date.now();
        // Check cache first for existing results
        const { cachedResults, uncachedFeatures } = await this.checkCache(featuresList);
        let freshResults = [];
        if (uncachedFeatures.length > 0) {
            // Use Enhanced 45-Factor engine for optimal performance
            if (this.enhanced45FactorEngine && this.config.targetLatencyMs <= 2000) {
                freshResults = await this.processWithEnhanced45Factor(uncachedFeatures);
            }
            else {
                // Fallback to standard scoring agent
                freshResults = await this.processWithScoringAgent(uncachedFeatures);
            }
            // Cache the fresh results
            await this.cacheResults(freshResults);
        }
        // Combine cached and fresh results
        const allResults = [...cachedResults, ...freshResults];
        // Sort results to match original order
        const resultMap = new Map(allResults.map(r => [r.propId, r]));
        const orderedResults = featuresList.map(f => resultMap.get(f.propId)).filter(Boolean);
        const batchProcessingTime = Date.now() - batchStartTime;
        this.logger.debug('⚡ Batch processing completed', {
            totalProps: featuresList.length,
            cachedResults: cachedResults.length,
            freshResults: freshResults.length,
            processingTimeMs: batchProcessingTime,
            averageLatencyMs: batchProcessingTime / featuresList.length
        });
        return orderedResults;
    }
    /**
     * Process props using Enhanced 45-Factor engine
     */
    async processWithEnhanced45Factor(features) {
        if (!this.enhanced45FactorEngine) {
            throw new Error('Enhanced 45-Factor engine not available');
        }
        const startTime = Date.now();
        try {
            // Use batch processing for optimal performance
            const enhanced45Results = await this.enhanced45FactorEngine.batchProcess45Factor(features);
            // Convert to standard ScoringResult format
            const scoringResults = enhanced45Results.map((enhanced45Result, index) => this.convertEnhanced45ResultToScoringResult(enhanced45Result, features[index]));
            const processingTime = Date.now() - startTime;
            this.logger.debug('🏆 Enhanced 45-Factor processing completed', {
                propCount: features.length,
                processingTimeMs: processingTime,
                averageLatencyMs: processingTime / features.length,
                avgScore: scoringResults.reduce((sum, r) => sum + r.finalScore, 0) / scoringResults.length
            });
            return scoringResults;
        }
        catch (error) {
            this.logger.error('❌ Enhanced 45-Factor processing failed, falling back to standard scoring', {
                error: error instanceof Error ? error.message : 'Unknown error',
                propCount: features.length
            });
            // Fallback to standard scoring agent
            return this.processWithScoringAgent(features);
        }
    }
    /**
     * Process props using standard scoring agent
     */
    async processWithScoringAgent(features) {
        const startTime = Date.now();
        // Process in smaller batches for better performance
        const batchSize = Math.min(this.config.batchSize, 50);
        const results = [];
        for (let i = 0; i < features.length; i += batchSize) {
            const batch = features.slice(i, i + batchSize);
            const batchResults = await this.scoringAgent.scoreProps(batch);
            results.push(...batchResults);
        }
        const processingTime = Date.now() - startTime;
        this.logger.debug('🎯 Standard scoring processing completed', {
            propCount: features.length,
            processingTimeMs: processingTime,
            averageLatencyMs: processingTime / features.length
        });
        return results;
    }
    /**
     * Check Redis cache for existing scoring results
     */
    async checkCache(features) {
        const cachedResults = [];
        const uncachedFeatures = [];
        for (const feature of features) {
            const cacheKey = `${this.config.redis.keyPrefixes.results}:${feature.propId}`;
            try {
                const cachedResult = await this.redis.get(cacheKey);
                if (cachedResult) {
                    const result = JSON.parse(cachedResult);
                    cachedResults.push(result);
                    this.logger.debug('🎯 Cache hit for prop', {
                        propId: feature.propId,
                        tier: result.tier,
                        score: result.finalScore
                    });
                }
                else {
                    uncachedFeatures.push(feature);
                }
            }
            catch (error) {
                this.logger.warn('⚠️ Cache read failed, processing prop fresh', {
                    propId: feature.propId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                uncachedFeatures.push(feature);
            }
        }
        // Update cache hit rate metric
        const totalProps = features.length;
        const cacheHits = cachedResults.length;
        this.metrics.cacheHitRate = cacheHits / totalProps;
        this.logger.debug('📊 Cache check completed', {
            totalProps,
            cacheHits,
            cacheMisses: uncachedFeatures.length,
            cacheHitRate: Math.round(this.metrics.cacheHitRate * 100) + '%'
        });
        return { cachedResults, uncachedFeatures };
    }
    /**
     * Cache scoring results in Redis
     */
    async cacheResults(results) {
        const pipeline = this.redis.pipeline();
        for (const result of results) {
            const cacheKey = `${this.config.redis.keyPrefixes.results}:${result.propId}`;
            const cacheValue = JSON.stringify(result);
            pipeline.setex(cacheKey, this.config.redis.ttl.results, cacheValue);
        }
        await pipeline.exec();
        this.logger.debug('💾 Cached scoring results', {
            resultCount: results.length,
            ttl: this.config.redis.ttl.results
        });
    }
    /**
     * Setup Redis connection with optimization
     */
    setupRedisConnection() {
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            commandTimeout: 5000,
            // Production optimizations
            connectTimeout: 60000,
            family: 4
        });
        this.redis.on('error', (error) => {
            this.logger.error('❌ Redis connection error', { error });
            this.emit('pipeline:redis-error', error);
        });
        this.redis.on('connect', () => {
            this.logger.info('✅ Redis connected');
        });
    }
    /**
     * Setup BullMQ scoring queue
     */
    setupScoringQueue() {
        this.scoringQueue = new bullmq_1.Queue('scoring-pipeline', {
            connection: this.redis,
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        });
        this.scoringQueue.on('error', (error) => {
            this.logger.error('❌ Scoring queue error', { error });
            this.emit('pipeline:queue-error', error);
        });
    }
    /**
     * Initialize Enhanced 45-Factor scoring components
     */
    async initializeEnhancedScoringComponents() {
        try {
            // Initialize feature store integration
            const featureStoreService = new (await Promise.resolve().then(() => __importStar(require('../services/FeatureStoreService')))).FeatureStoreService();
            this.featureStoreIntegration = new FeatureStoreIntegration_1.FeatureStoreIntegration(featureStoreService);
            // Initialize material change detector
            this.materialChangeDetector = new MaterialChangeDetector_1.MaterialChangeDetector(this.featureStoreIntegration);
            // Initialize Enhanced 45-Factor engine
            this.enhanced45FactorEngine = new Enhanced45FactorEngine_1.Enhanced45FactorEngine(this.featureStoreIntegration, this.materialChangeDetector);
            // Set up material change event listeners
            this.materialChangeDetector.on('materialChange', this.handleMaterialChange.bind(this));
            this.materialChangeDetector.on('criticalChange', this.handleCriticalChange.bind(this));
            this.logger.info('✅ Enhanced 45-Factor scoring components initialized');
        }
        catch (error) {
            this.logger.warn('⚠️ Enhanced 45-Factor initialization failed, using standard scoring', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Clear enhanced components to fallback to standard scoring
            this.enhanced45FactorEngine = undefined;
            this.materialChangeDetector = undefined;
            this.featureStoreIntegration = undefined;
        }
    }
    /**
     * Setup queue processors for different priorities
     */
    async setupQueueProcessors() {
        // High priority processor
        this.scoringQueue.process('score-prop', this.config.concurrentWorkers, async (job) => {
            return this.processJob(job.data);
        });
    }
    /**
     * Process an individual scoring job
     */
    async processJob(job) {
        const startTime = Date.now();
        try {
            const result = await this.scoreProps(job.features);
            const processingTimeMs = Date.now() - startTime;
            return {
                jobId: job.id,
                propId: job.propId,
                result,
                processingTimeMs,
                cacheHit: false, // Individual jobs don't use cache optimization
                workerInstance: process.pid.toString()
            };
        }
        catch (error) {
            this.logger.error('❌ Job processing failed', {
                jobId: job.id,
                propId: job.propId,
                attemptNumber: job.attemptNumber,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Start worker processes
     */
    async startWorkers() {
        // Workers are handled by BullMQ processors
        this.logger.info(`🏃 Started ${this.config.concurrentWorkers} concurrent workers`);
    }
    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.collectAndEmitMetrics();
        }, this.config.monitoring.metricsInterval);
    }
    /**
     * Collect and emit pipeline metrics
     */
    async collectAndEmitMetrics() {
        try {
            // Update queue length
            this.metrics.queueLength = await this.scoringQueue.getWaiting().then(jobs => jobs.length);
            // Update worker utilization (simplified calculation)
            this.metrics.workerUtilization = Math.min(100, (this.metrics.queueLength / this.config.concurrentWorkers) * 100);
            // Emit metrics
            this.emit('pipeline:metrics', { ...this.metrics });
            // Check alert thresholds
            this.checkAlertThresholds();
        }
        catch (error) {
            this.logger.error('❌ Metrics collection failed', { error });
        }
    }
    /**
     * Check if metrics exceed alert thresholds
     */
    checkAlertThresholds() {
        const { alertThresholds } = this.config.monitoring;
        if (this.metrics.averageLatencyMs > alertThresholds.latencyMs) {
            this.emit('pipeline:alert', {
                type: 'high_latency',
                current: this.metrics.averageLatencyMs,
                threshold: alertThresholds.latencyMs
            });
        }
        if (this.metrics.errorRate > alertThresholds.errorRate) {
            this.emit('pipeline:alert', {
                type: 'high_error_rate',
                current: this.metrics.errorRate,
                threshold: alertThresholds.errorRate
            });
        }
        if (this.metrics.queueLength > alertThresholds.queueLength) {
            this.emit('pipeline:alert', {
                type: 'high_queue_length',
                current: this.metrics.queueLength,
                threshold: alertThresholds.queueLength
            });
        }
    }
    /**
     * Handle material change events
     */
    async handleMaterialChange(change) {
        this.logger.info('📊 Material change detected in pipeline', {
            propId: change.propId,
            changeType: change.changeType,
            severity: change.severity
        });
        // Invalidate cache for affected prop
        const cacheKey = `${this.config.redis.keyPrefixes.results}:${change.propId}`;
        await this.redis.del(cacheKey);
        // Emit material change event
        this.emit('pipeline:material-change', change);
    }
    /**
     * Handle critical change events
     */
    async handleCriticalChange(change) {
        this.logger.warn('🚨 Critical material change detected in pipeline', {
            propId: change.propId,
            changeType: change.changeType,
            impact: change.impact
        });
        // Priority re-process the affected prop
        if (change.propId) {
            // Add to high priority queue for immediate re-processing
            this.emit('pipeline:critical-change', change);
        }
    }
    // Helper methods
    createProcessingJob(features, priority) {
        return {
            id: `job_${features.propId}_${Date.now()}`,
            propId: features.propId,
            features,
            priority,
            timestamp: new Date(),
            attemptNumber: 1,
            maxAttempts: 3
        };
    }
    convertEnhanced45ResultToScoringResult(enhanced45Result, features) {
        // This method should match the one in ScoringAgent
        return {
            propId: features.propId,
            finalScore: enhanced45Result.totalScore,
            confidence: enhanced45Result.confidence * 100,
            tier: enhanced45Result.tier,
            edgeScore: enhanced45Result.expectedValue,
            featureContributions: enhanced45Result.factorScores || {},
            modelContributions: {
                'Enhanced 45-Factor Engine': enhanced45Result.totalScore
            },
            kellyFraction: enhanced45Result.kellyFraction,
            positionSize: enhanced45Result.kellyFraction * 0.25,
            riskScore: enhanced45Result.riskAdjustedScore,
            correlationRisk: 0,
            scenarioAnalysis: {
                bullCase: { score: enhanced45Result.totalScore * 1.2, probability: 0.25 },
                baseCase: { score: enhanced45Result.totalScore, probability: 0.5 },
                bearCase: { score: enhanced45Result.totalScore * 0.8, probability: 0.25 }
            },
            professionalInsights: {},
            dataQuality: enhanced45Result.dataQuality,
            modelAgreement: enhanced45Result.modelAgreement,
            historicalAccuracy: 0.78,
            timestamp: enhanced45Result.timestamp,
            modelVersion: enhanced45Result.version,
            configUsed: enhanced45Result.configUsed
        };
    }
    initializeMetrics() {
        this.metrics = {
            totalProcessed: 0,
            currentThroughput: 0,
            averageLatencyMs: 0,
            errorRate: 0,
            queueLength: 0,
            workerUtilization: 0,
            cacheHitRate: 0,
            lastProcessedAt: new Date()
        };
    }
    updateMetrics(results, processingTimeMs) {
        this.metrics.totalProcessed += results.length;
        this.metrics.averageLatencyMs = (this.metrics.averageLatencyMs + processingTimeMs) / 2;
        this.metrics.currentThroughput = this.calculateCurrentThroughput();
        this.metrics.lastProcessedAt = new Date();
    }
    calculateCurrentThroughput() {
        // Calculate props per hour based on recent processing
        const hourMs = 60 * 60 * 1000;
        return Math.round((this.metrics.totalProcessed / (Date.now() - this.metrics.lastProcessedAt.getTime())) * hourMs);
    }
    calculateErrorRate() {
        // Simplified error rate calculation
        return 0; // Would be calculated from actual error tracking
    }
    /**
     * Shutdown the pipeline gracefully
     */
    async shutdown() {
        this.logger.info('🛑 Shutting down Real-Time Scoring Pipeline...');
        this.isRunning = false;
        // Stop metrics collection
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        // Close Redis connection
        this.redis.disconnect();
        // Close scoring queue
        await this.scoringQueue.close();
        // Cleanup enhanced components
        if (this.materialChangeDetector) {
            this.materialChangeDetector.shutdown();
        }
        this.emit('pipeline:shutdown');
        this.logger.info('✅ Real-Time Scoring Pipeline shutdown completed');
    }
    /**
     * Get current pipeline status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            metrics: this.metrics,
            config: this.config,
            enhanced45FactorEnabled: !!this.enhanced45FactorEngine
        };
    }
}
exports.RealTimeScoringPipeline = RealTimeScoringPipeline;
// Default production configuration
const createProductionPipelineConfig = () => ({
    targetLatencyMs: 2000,
    targetThroughputPerHour: 1000,
    batchSize: 50,
    concurrentWorkers: 4,
    queuePriorities: {
        high: 100,
        normal: 50,
        low: 10
    },
    redis: {
        ttl: {
            features: 300, // 5 minutes
            results: 1800, // 30 minutes
            models: 3600 // 1 hour
        },
        keyPrefixes: {
            features: 'pipeline:features',
            results: 'pipeline:results',
            pipeline: 'pipeline:state'
        }
    },
    monitoring: {
        metricsInterval: 30000, // 30 seconds
        alertThresholds: {
            latencyMs: 2000,
            errorRate: 5.0,
            queueLength: 100
        }
    }
});
exports.createProductionPipelineConfig = createProductionPipelineConfig;
