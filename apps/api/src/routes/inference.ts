/**
 * Inference API Routes - Phase 13 Model Serving & Ensemble Layer
 *
 * REST endpoints for model inference:
 * - POST /api/predict - Single model or ensemble prediction
 * - POST /api/ensemble/predict - Ensemble prediction
 * - POST /api/predict/batch - Batch predictions
 * - GET /api/inference/health - Health check
 * - GET /api/inference/metrics - Performance metrics
 *
 * @module routes/inference
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v3.0
 */

import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import { InferenceGateway, PredictionRequest, BatchPredictionRequest } from '../services/ml/InferenceGateway';
import { EnsembleCoordinator } from '../services/ml/EnsembleCoordinator';
import { ContinuousEvaluator } from '../services/ml/ContinuousEvaluator';
import { ModelRegistrySync } from '../services/ml/ModelRegistrySync';

/**
 * Create inference routes
 */
export function createInferenceRoutes(
  logger: Logger,
  supabase: SupabaseClient,
  inferenceGateway: InferenceGateway,
  ensembleCoordinator: EnsembleCoordinator,
  continuousEvaluator: ContinuousEvaluator,
  modelRegistry: ModelRegistrySync
): Router {
  const router = Router();

  /**
   * POST /api/predict
   *
   * Single model or ensemble prediction
   *
   * Body:
   * {
   *   modelName?: string,
   *   features: { feature1: number, feature2: number, ... },
   *   context?: { marketId, gameId, betType, timeToEvent },
   *   ensembleMode?: 'single' | 'ensemble' | 'auto',
   *   confidenceThreshold?: number,
   *   includeExplanation?: boolean
   * }
   *
   * Response:
   * {
   *   predictionId: string,
   *   prediction: number,
   *   confidence: number,
   *   modelUsed: string,
   *   modelVersion: string,
   *   ensembleContributions?: [...],
   *   explanation?: {...},
   *   metadata: { latencyMs, timestamp, requestId }
   * }
   */
  router.post('/predict', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const request: PredictionRequest = req.body;

      // Validate request
      if (!request.features || Object.keys(request.features).length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Features are required'
        });
      }

      // Generate prediction
      const prediction = await inferenceGateway.predict(request);

      // Log for monitoring
      logger.info('[Inference API] Prediction request', {
        modelUsed: prediction.modelUsed,
        confidence: prediction.confidence,
        latencyMs: Date.now() - startTime
      });

      return res.status(200).json(prediction);

    } catch (error) {
      logger.error('[Inference API] Prediction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Prediction failed'
      });
    }
  });

  /**
   * POST /api/ensemble/predict
   *
   * Ensemble prediction with confidence-weighted blending
   */
  router.post('/ensemble/predict', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { features, context, confidenceThreshold, includeExplanation } = req.body;

      if (!features || Object.keys(features).length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Features are required'
        });
      }

      // Generate ensemble prediction
      const request: PredictionRequest = {
        features,
        context,
        ensembleMode: 'ensemble',
        confidenceThreshold,
        includeExplanation
      };

      const prediction = await inferenceGateway.predictEnsemble(request);

      logger.info('[Inference API] Ensemble prediction', {
        modelsUsed: prediction.ensembleContributions?.length || 0,
        confidence: prediction.confidence,
        latencyMs: Date.now() - startTime
      });

      return res.status(200).json(prediction);

    } catch (error) {
      logger.error('[Inference API] Ensemble prediction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Ensemble prediction failed'
      });
    }
  });

  /**
   * POST /api/predict/batch
   *
   * Batch predictions
   *
   * Body:
   * {
   *   requests: [{ features, context, ... }, ...],
   *   parallel?: boolean,
   *   maxConcurrency?: number
   * }
   */
  router.post('/predict/batch', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const batchRequest: BatchPredictionRequest = req.body;

      if (!batchRequest.requests || batchRequest.requests.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Requests array is required'
        });
      }

      // Generate batch predictions
      const batchResponse = await inferenceGateway.predictBatch(batchRequest);

      logger.info('[Inference API] Batch prediction', {
        total: batchResponse.summary.total,
        successful: batchResponse.summary.successful,
        failed: batchResponse.summary.failed,
        latencyMs: Date.now() - startTime
      });

      return res.status(200).json(batchResponse);

    } catch (error) {
      logger.error('[Inference API] Batch prediction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Batch prediction failed'
      });
    }
  });

  /**
   * GET /api/inference/health
   *
   * Health check for inference gateway
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const gatewayHealth = await inferenceGateway.healthCheck();
      const coordinatorHealth = await ensembleCoordinator.healthCheck();
      const evaluatorHealth = await continuousEvaluator.healthCheck();

      const overallStatus =
        gatewayHealth.status === 'unhealthy' ||
        coordinatorHealth.status === 'unhealthy' ||
        evaluatorHealth.status === 'unhealthy'
          ? 'unhealthy'
          : gatewayHealth.status === 'degraded' ||
            coordinatorHealth.status === 'degraded' ||
            evaluatorHealth.status === 'degraded'
          ? 'degraded'
          : 'healthy';

      return res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        components: {
          inferenceGateway: gatewayHealth,
          ensembleCoordinator: coordinatorHealth,
          continuousEvaluator: evaluatorHealth
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[Inference API] Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  });

  /**
   * GET /api/inference/metrics
   *
   * Get performance metrics
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = inferenceGateway.getMetrics();
      const sloCompliance = inferenceGateway.checkSLOCompliance();

      return res.status(200).json({
        metrics,
        sloCompliance,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[Inference API] Metrics retrieval failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve metrics'
      });
    }
  });

  /**
   * GET /api/inference/models
   *
   * Get deployed models
   */
  router.get('/models', async (req: Request, res: Response) => {
    try {
      const deployedModels = await modelRegistry.getAllDeployedModels();

      return res.status(200).json({
        models: deployedModels,
        count: deployedModels.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[Inference API] Models retrieval failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve models'
      });
    }
  });

  /**
   * POST /api/inference/evaluate
   *
   * Record prediction outcome for continuous evaluation
   *
   * Body:
   * {
   *   modelId: string,
   *   prediction: number,
   *   actual: number,
   *   features: { ... },
   *   latencyMs: number
   * }
   */
  router.post('/evaluate', async (req: Request, res: Response) => {
    try {
      const { modelId, prediction, actual, features, latencyMs } = req.body;

      if (!modelId || prediction === undefined || actual === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'modelId, prediction, and actual are required'
        });
      }

      await continuousEvaluator.recordPredictionOutcome(
        modelId,
        prediction,
        actual,
        features || {},
        latencyMs || 0
      );

      return res.status(200).json({
        success: true,
        message: 'Outcome recorded'
      });

    } catch (error) {
      logger.error('[Inference API] Evaluation recording failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to record outcome'
      });
    }
  });

  return router;
}

export default createInferenceRoutes;
