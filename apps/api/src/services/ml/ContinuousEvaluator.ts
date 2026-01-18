/**
 * Continuous Evaluator - Phase 13 Model Serving & Ensemble Layer
 *
 * Monitors model performance in production with:
 * - Accuracy, F1, precision, recall tracking
 * - Data drift detection (feature distribution changes)
 * - Model drift detection (prediction distribution changes)
 * - Calibration monitoring (Brier score, log loss)
 * - Performance degradation alerts
 * - Automatic retraining triggers
 *
 * @module services/ml/ContinuousEvaluator
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v3.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { ModelRegistrySync, ModelRegistryEntry } from './ModelRegistrySync';

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  modelId: string;
  modelVersion: string;
  period: 'hourly' | 'daily' | 'weekly';
  windowStart: Date;
  windowEnd: Date;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

/**
 * Drift detection result
 */
export interface DriftDetection {
  modelId: string;
  driftType: 'feature' | 'prediction' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  driftScore: number;
  threshold: number;
  detected: boolean;
  affectedFeatures?: string[];
  recommendedAction: 'monitor' | 'retrain' | 'replace' | 'investigate';
  details: {
    baseline: Record<string, number>;
    current: Record<string, number>;
    divergence: Record<string, number>;
  };
  detectedAt: Date;
}

/**
 * Calibration assessment
 */
export interface CalibrationAssessment {
  modelId: string;
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  reliabilityDiagram: Array<{
    binStart: number;
    binEnd: number;
    predictedProb: number;
    actualFreq: number;
    count: number;
  }>;
  isCalibrated: boolean;
  needsRecalibration: boolean;
}

/**
 * Evaluation alert
 */
export interface EvaluationAlert {
  id: string;
  modelId: string;
  alertType: 'performance_degradation' | 'drift_detected' | 'calibration_issue' | 'latency_slo_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  createdAt: Date;
  acknowledged: boolean;
}

/**
 * Continuous Evaluator Configuration
 */
export interface ContinuousEvaluatorConfig {
  evaluationInterval: number; // ms between evaluations
  performanceWindow: number; // Number of predictions to consider
  driftDetectionThreshold: number; // 0-1, threshold for drift detection
  calibrationThreshold: number; // Maximum acceptable calibration error
  latencySLO: {
    p95: number; // P95 latency target in ms
    p99: number; // P99 latency target in ms
  };
  accuracyDegradationThreshold: number; // % drop from baseline
  enableAutoRetrain: boolean;
  minSamplesForEvaluation: number;
}

/**
 * Continuous Evaluator - Production model monitoring
 *
 * Tracks:
 * - Accuracy, precision, recall, F1 score
 * - Feature drift (distribution changes in input data)
 * - Prediction drift (distribution changes in predictions)
 * - Performance drift (accuracy degradation over time)
 * - Calibration (Brier score, log loss, calibration error)
 * - Latency SLO compliance
 *
 * Generates alerts for:
 * - Performance degradation
 * - Drift detection
 * - Calibration issues
 * - SLO violations
 */
export class ContinuousEvaluator {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly modelRegistry: ModelRegistrySync;
  private readonly config: ContinuousEvaluatorConfig;
  private readonly predictionBuffer: Map<string, Array<{
    prediction: number;
    actual: number;
    features: Record<string, number>;
    latencyMs: number;
    timestamp: Date;
  }>> = new Map();
  private readonly baselineDistributions: Map<string, {
    features: Record<string, { mean: number; std: number }>;
    predictions: { mean: number; std: number };
  }> = new Map();
  private evaluationIntervalId: NodeJS.Timeout | null = null;

  constructor(
    logger: Logger,
    supabase: SupabaseClient,
    modelRegistry: ModelRegistrySync,
    config?: Partial<ContinuousEvaluatorConfig>
  ) {
    this.logger = logger;
    this.supabase = supabase;
    this.modelRegistry = modelRegistry;

    // Default configuration with Charter SLO targets
    this.config = {
      evaluationInterval: 3600000, // 1 hour
      performanceWindow: 1000,
      driftDetectionThreshold: 0.05, // Phase 21 SLO requirement (was 0.15)
      calibrationThreshold: 0.1,
      latencySLO: {
        p95: 150, // Charter requirement
        p99: 300
      },
      accuracyDegradationThreshold: 0.05, // 5% drop
      enableAutoRetrain: true,
      minSamplesForEvaluation: 100,
      ...config
    };
  }

  /**
   * Initialize continuous evaluator
   */
  async initialize(): Promise<void> {
    this.logger.info('[ContinuousEvaluator] Initializing continuous evaluator...');

    // Load baseline distributions
    await this.loadBaselineDistributions();

    // Start periodic evaluation
    this.startPeriodicEvaluation();

    this.logger.info('[ContinuousEvaluator] Continuous evaluator initialized', {
      evaluationInterval: this.config.evaluationInterval,
      performanceWindow: this.config.performanceWindow
    });
  }

  /**
   * Record prediction outcome for evaluation
   *
   * @param modelId - Model ID
   * @param prediction - Model prediction
   * @param actual - Actual outcome
   * @param features - Input features
   * @param latencyMs - Prediction latency
   */
  async recordPredictionOutcome(
    modelId: string,
    prediction: number,
    actual: number,
    features: Record<string, number>,
    latencyMs: number
  ): Promise<void> {
    const buffer = this.predictionBuffer.get(modelId) || [];

    buffer.push({
      prediction,
      actual,
      features,
      latencyMs,
      timestamp: new Date()
    });

    // Keep buffer within window size
    if (buffer.length > this.config.performanceWindow) {
      buffer.shift();
    }

    this.predictionBuffer.set(modelId, buffer);

    // Save to database for persistence
    await this.savePredictionOutcome(modelId, prediction, actual, features, latencyMs);

    // Check if we should trigger evaluation
    if (buffer.length >= this.config.minSamplesForEvaluation &&
        buffer.length % 100 === 0) {
      await this.evaluateModel(modelId);
    }
  }

  /**
   * Evaluate model performance
   *
   * @param modelId - Model ID to evaluate
   */
  async evaluateModel(modelId: string): Promise<PerformanceMetrics | null> {
    this.logger.info('[ContinuousEvaluator] Evaluating model performance', { modelId });

    const buffer = this.predictionBuffer.get(modelId);
    if (!buffer || buffer.length < this.config.minSamplesForEvaluation) {
      this.logger.debug('[ContinuousEvaluator] Insufficient samples for evaluation', {
        modelId,
        samples: buffer?.length || 0
      });
      return null;
    }

    try {
      // Get model info
      const model = await this.modelRegistry.getModelById(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(modelId, buffer);

      // Detect drift
      const drift = await this.detectDrift(modelId, buffer);

      // Check calibration
      const calibration = this.assessCalibration(modelId, buffer);

      // Check for performance degradation
      await this.checkPerformanceDegradation(model, metrics);

      // Check SLO compliance
      await this.checkSLOCompliance(modelId, metrics);

      // Generate alerts if needed
      if (drift.detected) {
        await this.createAlert(modelId, 'drift_detected', drift.severity,
          `Drift detected: ${drift.driftType}`, drift);
      }

      if (!calibration.isCalibrated) {
        await this.createAlert(modelId, 'calibration_issue', 'medium',
          `Calibration error: ${calibration.calibrationError.toFixed(3)}`, calibration);
      }

      // Save metrics to database
      await this.savePerformanceMetrics(metrics);

      this.logger.info('[ContinuousEvaluator] Model evaluation complete', {
        modelId,
        accuracy: metrics.accuracy,
        f1Score: metrics.f1Score,
        driftDetected: drift.detected,
        calibrated: calibration.isCalibrated
      });

      return metrics;

    } catch (error) {
      this.logger.error('[ContinuousEvaluator] Model evaluation failed', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Detect data or prediction drift
   *
   * @param modelId - Model ID
   * @param buffer - Prediction buffer
   */
  private async detectDrift(
    modelId: string,
    buffer: Array<any>
  ): Promise<DriftDetection> {
    // Get baseline distribution
    const baseline = this.baselineDistributions.get(modelId);

    if (!baseline) {
      return {
        modelId,
        driftType: 'feature',
        severity: 'low',
        driftScore: 0,
        threshold: this.config.driftDetectionThreshold,
        detected: false,
        recommendedAction: 'monitor',
        details: {
          baseline: {},
          current: {},
          divergence: {}
        },
        detectedAt: new Date()
      };
    }

    // Calculate current distributions
    const currentFeatureDist = this.calculateFeatureDistributions(buffer);
    const currentPredDist = this.calculatePredictionDistribution(buffer);

    // Calculate KL divergence for features
    const featureDivergence: Record<string, number> = {};
    const affectedFeatures: string[] = [];

    for (const feature of Object.keys(baseline.features)) {
      if (currentFeatureDist[feature]) {
        const divergence = this.calculateKLDivergence(
          baseline.features[feature],
          currentFeatureDist[feature]
        );
        featureDivergence[feature] = divergence;

        if (divergence > this.config.driftDetectionThreshold) {
          affectedFeatures.push(feature);
        }
      }
    }

    // Calculate prediction drift
    const predictionDrift = this.calculateKLDivergence(
      baseline.predictions,
      currentPredDist
    );

    // Determine drift type and severity
    const maxFeatureDrift = Math.max(...Object.values(featureDivergence), 0);
    const driftScore = Math.max(maxFeatureDrift, predictionDrift);
    const detected = driftScore > this.config.driftDetectionThreshold;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (driftScore > 0.5) severity = 'critical';
    else if (driftScore > 0.3) severity = 'high';
    else if (driftScore > 0.15) severity = 'medium';

    let recommendedAction: 'monitor' | 'retrain' | 'replace' | 'investigate' = 'monitor';
    if (severity === 'critical') recommendedAction = 'replace';
    else if (severity === 'high') recommendedAction = 'retrain';
    else if (severity === 'medium') recommendedAction = 'investigate';

    return {
      modelId,
      driftType: maxFeatureDrift > predictionDrift ? 'feature' : 'prediction',
      severity,
      driftScore,
      threshold: this.config.driftDetectionThreshold,
      detected,
      affectedFeatures: affectedFeatures.length > 0 ? affectedFeatures : undefined,
      recommendedAction,
      details: {
        baseline: {
          ...Object.fromEntries(
            Object.entries(baseline.features).map(([k, v]) => [k, v.mean])
          ),
          prediction_mean: baseline.predictions.mean
        },
        current: {
          ...Object.fromEntries(
            Object.entries(currentFeatureDist).map(([k, v]) => [k, v.mean])
          ),
          prediction_mean: currentPredDist.mean
        },
        divergence: {
          ...featureDivergence,
          prediction_divergence: predictionDrift
        }
      },
      detectedAt: new Date()
    };
  }

  /**
   * Assess model calibration
   */
  private assessCalibration(
    modelId: string,
    buffer: Array<any>
  ): CalibrationAssessment {
    // Calculate Brier score
    const brierScore = this.calculateBrierScore(buffer);

    // Calculate log loss
    const logLoss = this.calculateLogLoss(buffer);

    // Calculate calibration error (ECE - Expected Calibration Error)
    const { calibrationError, reliabilityDiagram } = this.calculateCalibrationError(buffer);

    const isCalibrated = calibrationError < this.config.calibrationThreshold;
    const needsRecalibration = calibrationError > this.config.calibrationThreshold * 1.5;

    return {
      modelId,
      brierScore,
      logLoss,
      calibrationError,
      reliabilityDiagram,
      isCalibrated,
      needsRecalibration
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    modelId: string,
    buffer: Array<any>
  ): PerformanceMetrics {
    const total = buffer.length;
    let correct = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let totalLatency = 0;

    const latencies: number[] = [];

    for (const item of buffer) {
      const predicted = item.prediction > 0.5 ? 1 : 0;
      const actual = item.actual > 0.5 ? 1 : 0;

      if (predicted === actual) correct++;

      if (predicted === 1 && actual === 1) truePositives++;
      if (predicted === 1 && actual === 0) falsePositives++;
      if (predicted === 0 && actual === 1) falseNegatives++;

      totalLatency += item.latencyMs;
      latencies.push(item.latencyMs);
    }

    const accuracy = correct / total;
    const precision = truePositives / Math.max(1, truePositives + falsePositives);
    const recall = truePositives / Math.max(1, truePositives + falseNegatives);
    const f1Score = 2 * (precision * recall) / Math.max(0.0001, precision + recall);

    const brierScore = this.calculateBrierScore(buffer);
    const logLoss = this.calculateLogLoss(buffer);
    const { calibrationError } = this.calculateCalibrationError(buffer);

    // Calculate latency percentiles
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      modelId,
      modelVersion: 'current', // Would get from model
      period: 'daily',
      windowStart: buffer[0].timestamp,
      windowEnd: buffer[buffer.length - 1].timestamp,
      totalPredictions: total,
      correctPredictions: correct,
      accuracy,
      precision,
      recall,
      f1Score,
      brierScore,
      logLoss,
      calibrationError,
      avgLatencyMs: totalLatency / total,
      p95LatencyMs: latencies[p95Index] || 0,
      p99LatencyMs: latencies[p99Index] || 0
    };
  }

  /**
   * Check for performance degradation
   */
  private async checkPerformanceDegradation(
    model: ModelRegistryEntry,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const baselineAccuracy = model.accuracy || 0.7;
    const currentAccuracy = metrics.accuracy;
    const degradation = (baselineAccuracy - currentAccuracy) / baselineAccuracy;

    if (degradation > this.config.accuracyDegradationThreshold) {
      await this.createAlert(
        model.id,
        'performance_degradation',
        degradation > 0.15 ? 'high' : 'medium',
        `Performance degraded ${(degradation * 100).toFixed(1)}%: ${baselineAccuracy.toFixed(3)} → ${currentAccuracy.toFixed(3)}`,
        { baselineAccuracy, currentAccuracy, degradation }
      );

      // Trigger retraining if enabled
      if (this.config.enableAutoRetrain && degradation > 0.1) {
        this.logger.info('[ContinuousEvaluator] Triggering automatic retraining', {
          modelId: model.id,
          degradation
        });
        // Would trigger retraining workflow here
      }
    }
  }

  /**
   * Check SLO compliance
   */
  private async checkSLOCompliance(
    modelId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const violations: string[] = [];

    if (metrics.p95LatencyMs > this.config.latencySLO.p95) {
      violations.push(
        `P95 latency ${metrics.p95LatencyMs}ms exceeds SLO ${this.config.latencySLO.p95}ms`
      );
    }

    if (metrics.p99LatencyMs > this.config.latencySLO.p99) {
      violations.push(
        `P99 latency ${metrics.p99LatencyMs}ms exceeds SLO ${this.config.latencySLO.p99}ms`
      );
    }

    if (violations.length > 0) {
      await this.createAlert(
        modelId,
        'latency_slo_violation',
        'high',
        violations.join('; '),
        { metrics, slo: this.config.latencySLO }
      );
    }
  }

  // Statistical calculation methods

  private calculateBrierScore(buffer: Array<any>): number {
    const sum = buffer.reduce((acc, item) => {
      return acc + Math.pow(item.prediction - item.actual, 2);
    }, 0);
    return sum / buffer.length;
  }

  private calculateLogLoss(buffer: Array<any>): number {
    const epsilon = 1e-15; // Avoid log(0)
    const sum = buffer.reduce((acc, item) => {
      const p = Math.max(epsilon, Math.min(1 - epsilon, item.prediction));
      return acc - (item.actual * Math.log(p) + (1 - item.actual) * Math.log(1 - p));
    }, 0);
    return sum / buffer.length;
  }

  private calculateCalibrationError(buffer: Array<any>): {
    calibrationError: number;
    reliabilityDiagram: Array<any>;
  } {
    const numBins = 10;
    const bins: Array<{
      binStart: number;
      binEnd: number;
      predictions: number[];
      actuals: number[];
    }> = [];

    // Initialize bins
    for (let i = 0; i < numBins; i++) {
      bins.push({
        binStart: i / numBins,
        binEnd: (i + 1) / numBins,
        predictions: [],
        actuals: []
      });
    }

    // Assign predictions to bins
    for (const item of buffer) {
      const binIndex = Math.min(
        Math.floor(item.prediction * numBins),
        numBins - 1
      );
      bins[binIndex].predictions.push(item.prediction);
      bins[binIndex].actuals.push(item.actual);
    }

    // Calculate calibration error
    let calibrationError = 0;
    const reliabilityDiagram: Array<any> = [];

    for (const bin of bins) {
      if (bin.predictions.length === 0) continue;

      const predictedProb = bin.predictions.reduce((sum, p) => sum + p, 0) / bin.predictions.length;
      const actualFreq = bin.actuals.reduce((sum, a) => sum + a, 0) / bin.actuals.length;
      const weight = bin.predictions.length / buffer.length;

      calibrationError += weight * Math.abs(predictedProb - actualFreq);

      reliabilityDiagram.push({
        binStart: bin.binStart,
        binEnd: bin.binEnd,
        predictedProb,
        actualFreq,
        count: bin.predictions.length
      });
    }

    return { calibrationError, reliabilityDiagram };
  }

  private calculateFeatureDistributions(
    buffer: Array<any>
  ): Record<string, { mean: number; std: number }> {
    const distributions: Record<string, { mean: number; std: number }> = {};

    if (buffer.length === 0) return distributions;

    const features = Object.keys(buffer[0].features);

    for (const feature of features) {
      const values = buffer.map(item => item.features[feature]);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      distributions[feature] = { mean, std };
    }

    return distributions;
  }

  private calculatePredictionDistribution(
    buffer: Array<any>
  ): { mean: number; std: number } {
    const predictions = buffer.map(item => item.prediction);
    const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
    const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
    const std = Math.sqrt(variance);

    return { mean, std };
  }

  private calculateKLDivergence(
    p: { mean: number; std: number },
    q: { mean: number; std: number }
  ): number {
    // Simplified KL divergence for normal distributions
    // KL(P||Q) = log(σ_q/σ_p) + (σ_p² + (μ_p - μ_q)²) / (2σ_q²) - 1/2

    const sigma_p = p.std + 1e-10; // Avoid division by zero
    const sigma_q = q.std + 1e-10;
    const mu_p = p.mean;
    const mu_q = q.mean;

    const kl = Math.log(sigma_q / sigma_p) +
      (sigma_p * sigma_p + Math.pow(mu_p - mu_q, 2)) / (2 * sigma_q * sigma_q) -
      0.5;

    return Math.max(0, kl); // KL divergence is non-negative
  }

  private async createAlert(
    modelId: string,
    alertType: EvaluationAlert['alertType'],
    severity: EvaluationAlert['severity'],
    message: string,
    details: any
  ): Promise<void> {
    const alert: EvaluationAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      modelId,
      alertType,
      severity,
      message,
      details,
      createdAt: new Date(),
      acknowledged: false
    };

    this.logger.warn('[ContinuousEvaluator] Alert created', alert);

    // Save alert to database
    await this.supabase
      .from('model_evaluation_alerts')
      .insert({
        id: alert.id,
        model_id: alert.modelId,
        alert_type: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
        created_at: alert.createdAt.toISOString(),
        acknowledged: false
      });
  }

  private async savePredictionOutcome(
    modelId: string,
    prediction: number,
    actual: number,
    features: Record<string, number>,
    latencyMs: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('prediction_outcomes')
        .insert({
          model_id: modelId,
          prediction,
          actual,
          features,
          latency_ms: latencyMs,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.debug('[ContinuousEvaluator] Failed to save prediction outcome', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await this.supabase
        .from('model_performance_history')
        .insert({
          model_id: metrics.modelId,
          model_version: metrics.modelVersion,
          period: metrics.period,
          window_start: metrics.windowStart.toISOString(),
          window_end: metrics.windowEnd.toISOString(),
          total_predictions: metrics.totalPredictions,
          correct_predictions: metrics.correctPredictions,
          accuracy: metrics.accuracy,
          precision: metrics.precision,
          recall: metrics.recall,
          f1_score: metrics.f1Score,
          brier_score: metrics.brierScore,
          log_loss: metrics.logLoss,
          calibration_error: metrics.calibrationError,
          avg_latency_ms: metrics.avgLatencyMs,
          p95_latency_ms: metrics.p95LatencyMs,
          p99_latency_ms: metrics.p99LatencyMs,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error('[ContinuousEvaluator] Failed to save performance metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async loadBaselineDistributions(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('model_baseline_distributions')
        .select('*');

      if (error || !data) {
        this.logger.debug('[ContinuousEvaluator] No baseline distributions found');
        return;
      }

      for (const row of data) {
        this.baselineDistributions.set(row.model_id, {
          features: row.feature_distributions,
          predictions: row.prediction_distribution
        });
      }

      this.logger.info('[ContinuousEvaluator] Baseline distributions loaded', {
        models: this.baselineDistributions.size
      });

    } catch (error) {
      this.logger.warn('[ContinuousEvaluator] Failed to load baseline distributions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private startPeriodicEvaluation(): void {
    this.evaluationIntervalId = setInterval(async () => {
      this.logger.debug('[ContinuousEvaluator] Running periodic evaluation');

      const deployedModels = await this.modelRegistry.getAllDeployedModels();

      for (const model of deployedModels) {
        await this.evaluateModel(model.id);
      }

    }, this.config.evaluationInterval);
  }

  /**
   * Stop periodic evaluation
   */
  async shutdown(): Promise<void> {
    if (this.evaluationIntervalId) {
      clearInterval(this.evaluationIntervalId);
      this.evaluationIntervalId = null;
    }

    this.logger.info('[ContinuousEvaluator] Continuous evaluator stopped');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const details = {
      activeModels: this.predictionBuffer.size,
      baselineModels: this.baselineDistributions.size,
      evaluationInterval: this.config.evaluationInterval,
      periodicEvaluationActive: this.evaluationIntervalId !== null
    };

    const status: 'healthy' | 'degraded' | 'unhealthy' =
      this.evaluationIntervalId !== null ? 'healthy' : 'degraded';

    return { status, details };
  }
}

/**
 * Create and initialize Continuous Evaluator
 */
export async function createContinuousEvaluator(
  logger: Logger,
  supabase: SupabaseClient,
  modelRegistry: ModelRegistrySync,
  config?: Partial<ContinuousEvaluatorConfig>
): Promise<ContinuousEvaluator> {
  const evaluator = new ContinuousEvaluator(
    logger,
    supabase,
    modelRegistry,
    config
  );
  await evaluator.initialize();
  return evaluator;
}

export default ContinuousEvaluator;
