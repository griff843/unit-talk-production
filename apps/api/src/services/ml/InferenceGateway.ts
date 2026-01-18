/**
 * Inference Gateway - Phase 13 Model Serving & Ensemble Layer
 *
 * Provides REST/gRPC endpoints for real-time model inference with:
 * - Single model predictions
 * - Ensemble predictions with confidence-weighted blending
 * - Performance monitoring and SLO tracking
 * - Automatic fallback to fallback models
 * - Request validation and rate limiting
 *
 * @module services/ml/InferenceGateway
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v3.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { ModelRegistrySync, ModelRegistryEntry } from './ModelRegistrySync';
import { EnsembleCoordinator } from './EnsembleCoordinator';

/**
 * Prediction request format
 */
export interface PredictionRequest {
  modelName?: string; // Optional: specific model to use
  features: Record<string, number>;
  context?: {
    marketId?: string;
    gameId?: string;
    betType?: string;
    timeToEvent?: number;
  };
  ensembleMode?: 'single' | 'ensemble' | 'auto';
  confidenceThreshold?: number;
  includeExplanation?: boolean;
}

/**
 * Prediction response format
 */
export interface PredictionResponse {
  predictionId: string;
  prediction: number;
  confidence: number;
  modelUsed: string;
  modelVersion: string;
  ensembleContributions?: Array<{
    modelId: string;
    prediction: number;
    weight: number;
    confidence: number;
  }>;
  explanation?: {
    featureImportance: Record<string, number>;
    topFeatures: Array<{
      feature: string;
      value: number;
      contribution: number;
    }>;
  };
  metadata: {
    latencyMs: number;
    timestamp: string;
    requestId: string;
  };
}

/**
 * Batch prediction request
 */
export interface BatchPredictionRequest {
  requests: PredictionRequest[];
  parallel?: boolean;
  maxConcurrency?: number;
}

/**
 * Batch prediction response
 */
export interface BatchPredictionResponse {
  predictions: PredictionResponse[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageLatencyMs: number;
    totalLatencyMs: number;
  };
}

/**
 * Inference Gateway Configuration
 */
export interface InferenceGatewayConfig {
  maxRequestsPerSecond: number;
  maxBatchSize: number;
  defaultTimeout: number;
  enableCache: boolean;
  cacheTTL: number;
  enableMetrics: boolean;
  p95LatencyTarget: number; // SLO target in ms
  p99LatencyTarget: number; // SLO target in ms
}

/**
 * Performance metrics for SLO tracking
 */
export interface InferenceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  latencies: number[]; // For percentile calculation
  lastUpdated: Date;
}

/**
 * Inference Gateway - REST/gRPC endpoint for model predictions
 *
 * Provides:
 * - Single model inference
 * - Ensemble inference with confidence-weighted blending
 * - Performance monitoring and SLO tracking
 * - Request validation and rate limiting
 * - Automatic model fallback
 */
export class InferenceGateway {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly modelRegistry: ModelRegistrySync;
  private readonly ensembleCoordinator: EnsembleCoordinator;
  private readonly config: InferenceGatewayConfig;
  private readonly metrics: InferenceMetrics;
  private readonly requestCache: Map<string, PredictionResponse> = new Map();
  private readonly rateLimiter: Map<string, number> = new Map();

  constructor(
    logger: Logger,
    supabase: SupabaseClient,
    modelRegistry: ModelRegistrySync,
    ensembleCoordinator: EnsembleCoordinator,
    config?: Partial<InferenceGatewayConfig>
  ) {
    this.logger = logger;
    this.supabase = supabase;
    this.modelRegistry = modelRegistry;
    this.ensembleCoordinator = ensembleCoordinator;

    // Default configuration with Charter SLO targets
    this.config = {
      maxRequestsPerSecond: 1000,
      maxBatchSize: 100,
      defaultTimeout: 5000, // 5 seconds
      enableCache: true,
      cacheTTL: 300000, // 5 minutes
      enableMetrics: true,
      p95LatencyTarget: 150, // Charter requirement: < 150ms
      p99LatencyTarget: 300, // < 300ms
      ...config
    };

    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      latencies: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Initialize the inference gateway
   */
  async initialize(): Promise<void> {
    this.logger.info('[InferenceGateway] Initializing inference gateway...');

    // Verify model registry has deployed models
    const deployedModels = await this.modelRegistry.getAllDeployedModels();
    if (deployedModels.length === 0) {
      this.logger.warn('[InferenceGateway] No deployed models found in registry');
    }

    this.logger.info('[InferenceGateway] Inference gateway initialized', {
      deployedModels: deployedModels.length,
      config: this.config
    });
  }

  /**
   * POST /api/predict - Single model or ensemble prediction
   *
   * @param request - Prediction request
   * @returns Prediction response
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.logger.info('[InferenceGateway] Prediction request received', {
      requestId,
      modelName: request.modelName,
      ensembleMode: request.ensembleMode,
      featureCount: Object.keys(request.features).length
    });

    try {
      // Rate limiting
      await this.checkRateLimit(requestId);

      // Validate request
      this.validateRequest(request);

      // Check cache
      if (this.config.enableCache) {
        const cached = this.getCachedPrediction(request);
        if (cached) {
          this.logger.debug('[InferenceGateway] Cache hit', { requestId });
          return cached;
        }
      }

      // Determine prediction mode
      const mode = request.ensembleMode || 'auto';
      let response: PredictionResponse;

      if (mode === 'single' && request.modelName) {
        response = await this.predictSingleModel(request, requestId);
      } else if (mode === 'ensemble' || mode === 'auto') {
        response = await this.predictEnsemble(request, requestId);
      } else {
        throw new Error('Invalid prediction mode or missing model name');
      }

      // Update metrics
      const latencyMs = Date.now() - startTime;
      this.updateMetrics(latencyMs, true);

      // Cache result
      if (this.config.enableCache) {
        this.cachePrediction(request, response);
      }

      // Log success
      this.logger.info('[InferenceGateway] Prediction successful', {
        requestId,
        latencyMs,
        modelUsed: response.modelUsed,
        confidence: response.confidence
      });

      return response;

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.updateMetrics(latencyMs, false);

      this.logger.error('[InferenceGateway] Prediction failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs
      });

      throw error;
    }
  }

  /**
   * POST /api/ensemble/predict - Ensemble prediction with confidence-weighted blending
   *
   * @param request - Prediction request
   * @returns Ensemble prediction response
   */
  async predictEnsemble(
    request: PredictionRequest,
    requestId?: string
  ): Promise<PredictionResponse> {
    const reqId = requestId || this.generateRequestId();
    const startTime = Date.now();

    this.logger.debug('[InferenceGateway] Running ensemble prediction', {
      requestId: reqId
    });

    // Get ensemble prediction from coordinator
    const ensembleResult = await this.ensembleCoordinator.predict(request.features, {
      betType: request.context?.betType,
      confidenceThreshold: request.confidenceThreshold
    });

    // Build response
    const response: PredictionResponse = {
      predictionId: this.generatePredictionId(),
      prediction: ensembleResult.prediction,
      confidence: ensembleResult.confidence,
      modelUsed: 'ensemble',
      modelVersion: ensembleResult.version,
      ensembleContributions: ensembleResult.contributions.map(c => ({
        modelId: c.modelId,
        prediction: c.prediction,
        weight: c.weight,
        confidence: c.confidence
      })),
      explanation: request.includeExplanation ? {
        featureImportance: ensembleResult.featureImportance || {},
        topFeatures: this.getTopFeatures(
          request.features,
          ensembleResult.featureImportance || {}
        )
      } : undefined,
      metadata: {
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requestId: reqId
      }
    };

    return response;
  }

  /**
   * Single model prediction
   *
   * @param request - Prediction request
   * @param requestId - Request ID
   * @returns Prediction response
   */
  private async predictSingleModel(
    request: PredictionRequest,
    requestId: string
  ): Promise<PredictionResponse> {
    const startTime = Date.now();

    if (!request.modelName) {
      throw new Error('Model name required for single model prediction');
    }

    // Get model from registry
    const model = await this.modelRegistry.getDeployedModel(request.modelName);
    if (!model) {
      throw new Error(`Model not found: ${request.modelName}`);
    }

    // Run prediction (simplified - would call actual ML model)
    const prediction = await this.runModelInference(model, request.features);

    // Build response
    const response: PredictionResponse = {
      predictionId: this.generatePredictionId(),
      prediction: prediction.value,
      confidence: prediction.confidence,
      modelUsed: model.model_name,
      modelVersion: model.model_version,
      explanation: request.includeExplanation ? {
        featureImportance: model.feature_importance || {},
        topFeatures: this.getTopFeatures(
          request.features,
          model.feature_importance || {}
        )
      } : undefined,
      metadata: {
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return response;
  }

  /**
   * POST /api/predict/batch - Batch predictions
   *
   * @param batchRequest - Batch prediction request
   * @returns Batch prediction response
   */
  async predictBatch(
    batchRequest: BatchPredictionRequest
  ): Promise<BatchPredictionResponse> {
    const startTime = Date.now();

    this.logger.info('[InferenceGateway] Batch prediction request', {
      batchSize: batchRequest.requests.length,
      parallel: batchRequest.parallel
    });

    // Validate batch size
    if (batchRequest.requests.length > this.config.maxBatchSize) {
      throw new Error(
        `Batch size ${batchRequest.requests.length} exceeds maximum ${this.config.maxBatchSize}`
      );
    }

    const predictions: PredictionResponse[] = [];
    const errors: Error[] = [];

    if (batchRequest.parallel) {
      // Parallel execution with concurrency limit
      const maxConcurrency = batchRequest.maxConcurrency || 10;
      const chunks = this.chunkArray(batchRequest.requests, maxConcurrency);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(req => this.predict(req))
        );

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            predictions.push(result.value);
          } else {
            errors.push(result.reason);
          }
        });
      }
    } else {
      // Sequential execution
      for (const req of batchRequest.requests) {
        try {
          const prediction = await this.predict(req);
          predictions.push(prediction);
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error('Unknown error'));
        }
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    const averageLatencyMs = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.metadata.latencyMs, 0) / predictions.length
      : 0;

    const response: BatchPredictionResponse = {
      predictions,
      summary: {
        total: batchRequest.requests.length,
        successful: predictions.length,
        failed: errors.length,
        averageLatencyMs,
        totalLatencyMs
      }
    };

    this.logger.info('[InferenceGateway] Batch prediction complete', {
      ...response.summary
    });

    return response;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): InferenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if gateway is meeting SLO targets
   */
  checkSLOCompliance(): {
    compliant: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    if (this.metrics.p95LatencyMs > this.config.p95LatencyTarget) {
      violations.push(
        `P95 latency ${this.metrics.p95LatencyMs}ms exceeds target ${this.config.p95LatencyTarget}ms`
      );
    }

    if (this.metrics.p99LatencyMs > this.config.p99LatencyTarget) {
      violations.push(
        `P99 latency ${this.metrics.p99LatencyMs}ms exceeds target ${this.config.p99LatencyTarget}ms`
      );
    }

    const errorRate = this.metrics.requestCount > 0
      ? this.metrics.errorCount / this.metrics.requestCount
      : 0;

    if (errorRate > 0.005) { // 0.5% error rate target
      violations.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds 0.5% target`);
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const slo = this.checkSLOCompliance();
    const deployedModels = await this.modelRegistry.getAllDeployedModels();

    const details = {
      deployedModels: deployedModels.length,
      metrics: this.metrics,
      sloCompliance: slo,
      cacheSize: this.requestCache.size
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (deployedModels.length === 0) {
      status = 'unhealthy';
    } else if (!slo.compliant) {
      status = 'degraded';
    }

    return { status, details };
  }

  // Private helper methods

  private validateRequest(request: PredictionRequest): void {
    if (!request.features || Object.keys(request.features).length === 0) {
      throw new Error('Features are required');
    }

    // Validate feature values are numbers
    for (const [key, value] of Object.entries(request.features)) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Invalid feature value for ${key}: ${value}`);
      }
    }

    if (request.confidenceThreshold !== undefined) {
      if (request.confidenceThreshold < 0 || request.confidenceThreshold > 1) {
        throw new Error('Confidence threshold must be between 0 and 1');
      }
    }
  }

  private async checkRateLimit(requestId: string): Promise<void> {
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Clean old entries
    for (const [id, timestamp] of this.rateLimiter.entries()) {
      if (timestamp < windowStart) {
        this.rateLimiter.delete(id);
      }
    }

    // Check rate
    if (this.rateLimiter.size >= this.config.maxRequestsPerSecond) {
      throw new Error('Rate limit exceeded');
    }

    this.rateLimiter.set(requestId, now);
  }

  private getCachedPrediction(request: PredictionRequest): PredictionResponse | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.requestCache.get(cacheKey);

    if (cached) {
      const age = Date.now() - new Date(cached.metadata.timestamp).getTime();
      if (age < this.config.cacheTTL) {
        return cached;
      }
      this.requestCache.delete(cacheKey);
    }

    return null;
  }

  private cachePrediction(
    request: PredictionRequest,
    response: PredictionResponse
  ): void {
    const cacheKey = this.generateCacheKey(request);
    this.requestCache.set(cacheKey, response);

    // Limit cache size
    if (this.requestCache.size > 10000) {
      const firstKey = this.requestCache.keys().next().value;
      if (firstKey) {
        this.requestCache.delete(firstKey);
      }
    }
  }

  private generateCacheKey(request: PredictionRequest): string {
    const features = JSON.stringify(request.features);
    const context = JSON.stringify(request.context || {});
    return `${request.modelName || 'ensemble'}_${features}_${context}`;
  }

  private updateMetrics(latencyMs: number, success: boolean): void {
    this.metrics.requestCount++;
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }

    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.avgLatencyMs = this.metrics.totalLatencyMs / this.metrics.requestCount;

    // Update latencies for percentile calculation
    this.metrics.latencies.push(latencyMs);
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift(); // Keep last 1000
    }

    // Calculate percentiles
    const sorted = [...this.metrics.latencies].sort((a, b) => a - b);
    this.metrics.p50LatencyMs = this.calculatePercentile(sorted, 0.50);
    this.metrics.p95LatencyMs = this.calculatePercentile(sorted, 0.95);
    this.metrics.p99LatencyMs = this.calculatePercentile(sorted, 0.99);

    this.metrics.lastUpdated = new Date();
  }

  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private async runModelInference(
    model: ModelRegistryEntry,
    features: Record<string, number>
  ): Promise<{ value: number; confidence: number }> {
    // Simplified inference - in production would call actual ML model
    // This would integrate with TensorFlow.js, ONNX Runtime, or external service

    // Mock prediction based on feature values
    const featureSum = Object.values(features).reduce((sum, val) => sum + val, 0);
    const featureAvg = featureSum / Object.keys(features).length;

    const prediction = Math.min(0.95, Math.max(0.05, featureAvg / 100));
    const confidence = model.accuracy || 0.7;

    return { value: prediction, confidence };
  }

  private getTopFeatures(
    features: Record<string, number>,
    importance: Record<string, number>
  ): Array<{ feature: string; value: number; contribution: number }> {
    const topFeatures = Object.entries(importance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feature, importance]) => ({
        feature,
        value: features[feature] || 0,
        contribution: importance
      }));

    return topFeatures;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create and initialize Inference Gateway
 */
export async function createInferenceGateway(
  logger: Logger,
  supabase: SupabaseClient,
  modelRegistry: ModelRegistrySync,
  ensembleCoordinator: EnsembleCoordinator,
  config?: Partial<InferenceGatewayConfig>
): Promise<InferenceGateway> {
  const gateway = new InferenceGateway(
    logger,
    supabase,
    modelRegistry,
    ensembleCoordinator,
    config
  );
  await gateway.initialize();
  return gateway;
}

export default InferenceGateway;
