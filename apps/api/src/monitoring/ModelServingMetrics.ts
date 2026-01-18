/**
 * Model Serving Prometheus Metrics
 * 
 * Charter v3.0 → v4.0 Model Serving Infrastructure
 * Date: 2025-11-01
 * 
 * SLO Targets:
 * - p95 inference latency < 150ms
 * - Drift score < 0.05
 * - Accuracy ≥ baseline - 2%
 */

import { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';
import * as http from 'http';

export class ModelServingMetrics {
  private registry: Registry;
  private metricsServer: http.Server | null = null;

  // ===============================================================================
  // COUNTERS - Cumulative metrics
  // ===============================================================================

  /** Total model inference requests */
  public readonly inferenceRequestsTotal: Counter;

  /** Total inference errors */
  public readonly inferenceErrorsTotal: Counter;

  /** Total predictions made */
  public readonly predictionsTotal: Counter;

  /** Total SLO violations */
  public readonly sloViolationsTotal: Counter;

  /** Total drift detections */
  public readonly driftDetectionsTotal: Counter;

  // ===============================================================================
  // HISTOGRAMS - Distribution metrics with SLO tracking
  // ===============================================================================

  /** Inference latency in seconds (SLO: p95 < 150ms) */
  public readonly inferenceLatencySeconds: Histogram;

  /** Feature extraction latency */
  public readonly featureExtractionLatencyMs: Histogram;

  /** Model execution latency */
  public readonly modelExecutionLatencyMs: Histogram;

  /** Ensemble confidence score distribution */
  public readonly ensembleConfidenceScore: Histogram;

  /** Model agreement score distribution */
  public readonly modelAgreementScore: Histogram;

  /** Prediction error distribution */
  public readonly predictionError: Histogram;

  // ===============================================================================
  // GAUGES - Current state metrics
  // ===============================================================================

  /** Current drift score (SLO: < 0.05) */
  public readonly currentDriftScore: Gauge;

  /** Current model accuracy */
  public readonly currentAccuracy: Gauge;

  /** Accuracy delta from baseline (SLO: ≥ -2%) */
  public readonly accuracyDeltaFromBaseline: Gauge;

  /** Active canary deployments */
  public readonly activeCanaryDeployments: Gauge;

  /** Models in production */
  public readonly modelsInProduction: Gauge;

  /** Current p95 latency (rolling window) */
  public readonly currentP95LatencyMs: Gauge;

  // ===============================================================================
  // SUMMARIES - Statistical aggregations
  // ===============================================================================

  /** Inference latency summary with quantiles */
  public readonly inferenceLatencySummary: Summary;

  /** Drift score summary */
  public readonly driftScoreSummary: Summary;

  constructor(port: number = 9464) {
    this.registry = new Registry();

    // -------------------------------------------------------------------------
    // Initialize Counters
    // -------------------------------------------------------------------------

    this.inferenceRequestsTotal = new Counter({
      name: 'model_serving_inference_requests_total',
      help: 'Total number of model inference requests',
      labelNames: ['model_id', 'model_version', 'deployment_mode', 'environment', 'status'],
      registers: [this.registry],
    });

    this.inferenceErrorsTotal = new Counter({
      name: 'model_serving_inference_errors_total',
      help: 'Total number of inference errors',
      labelNames: ['model_id', 'model_version', 'error_type', 'environment'],
      registers: [this.registry],
    });

    this.predictionsTotal = new Counter({
      name: 'model_serving_predictions_total',
      help: 'Total number of predictions made',
      labelNames: ['model_id', 'model_version', 'ensemble_method', 'environment'],
      registers: [this.registry],
    });

    this.sloViolationsTotal = new Counter({
      name: 'model_serving_slo_violations_total',
      help: 'Total number of SLO violations',
      labelNames: ['slo_type', 'model_id', 'severity'],
      registers: [this.registry],
    });

    this.driftDetectionsTotal = new Counter({
      name: 'model_serving_drift_detections_total',
      help: 'Total number of drift detections (drift_score > 0.05)',
      labelNames: ['model_id', 'model_version', 'severity'],
      registers: [this.registry],
    });

    // -------------------------------------------------------------------------
    // Initialize Histograms
    // -------------------------------------------------------------------------

    this.inferenceLatencySeconds = new Histogram({
      name: 'model_serving_inference_latency_seconds',
      help: 'Model inference latency in seconds (SLO: p95 < 150ms)',
      labelNames: ['model_id', 'model_version', 'deployment_mode', 'environment'],
      buckets: [0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0], // 10ms to 1s
      registers: [this.registry],
    });

    this.featureExtractionLatencyMs = new Histogram({
      name: 'model_serving_feature_extraction_latency_ms',
      help: 'Feature extraction latency in milliseconds',
      labelNames: ['model_id', 'feature_count'],
      buckets: [5, 10, 25, 50, 75, 100, 150, 200],
      registers: [this.registry],
    });

    this.modelExecutionLatencyMs = new Histogram({
      name: 'model_serving_model_execution_latency_ms',
      help: 'Model execution latency in milliseconds',
      labelNames: ['model_id', 'model_version', 'ensemble_method'],
      buckets: [10, 25, 50, 75, 100, 150, 200, 300],
      registers: [this.registry],
    });

    this.ensembleConfidenceScore = new Histogram({
      name: 'model_serving_ensemble_confidence_score',
      help: 'Ensemble confidence score distribution (0-1)',
      labelNames: ['model_id', 'ensemble_method'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      registers: [this.registry],
    });

    this.modelAgreementScore = new Histogram({
      name: 'model_serving_model_agreement_score',
      help: 'Model agreement score distribution (0-1)',
      labelNames: ['model_id', 'ensemble_method'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      registers: [this.registry],
    });

    this.predictionError = new Histogram({
      name: 'model_serving_prediction_error',
      help: 'Prediction error distribution (absolute difference)',
      labelNames: ['model_id', 'model_version'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
      registers: [this.registry],
    });

    // -------------------------------------------------------------------------
    // Initialize Gauges
    // -------------------------------------------------------------------------

    this.currentDriftScore = new Gauge({
      name: 'model_serving_current_drift_score',
      help: 'Current drift score (SLO: < 0.05)',
      labelNames: ['model_id', 'model_version'],
      registers: [this.registry],
    });

    this.currentAccuracy = new Gauge({
      name: 'model_serving_current_accuracy',
      help: 'Current model accuracy (0-1)',
      labelNames: ['model_id', 'model_version', 'period'],
      registers: [this.registry],
    });

    this.accuracyDeltaFromBaseline = new Gauge({
      name: 'model_serving_accuracy_delta_from_baseline',
      help: 'Accuracy delta from baseline (SLO: ≥ -0.02)',
      labelNames: ['model_id', 'model_version'],
      registers: [this.registry],
    });

    this.activeCanaryDeployments = new Gauge({
      name: 'model_serving_active_canary_deployments',
      help: 'Number of active canary deployments',
      labelNames: ['canary_stage'],
      registers: [this.registry],
    });

    this.modelsInProduction = new Gauge({
      name: 'model_serving_models_in_production',
      help: 'Number of models currently in production',
      labelNames: ['model_type'],
      registers: [this.registry],
    });

    this.currentP95LatencyMs = new Gauge({
      name: 'model_serving_current_p95_latency_ms',
      help: 'Current p95 latency in milliseconds (rolling 5min window)',
      labelNames: ['model_id', 'model_version'],
      registers: [this.registry],
    });

    // -------------------------------------------------------------------------
    // Initialize Summaries
    // -------------------------------------------------------------------------

    this.inferenceLatencySummary = new Summary({
      name: 'model_serving_inference_latency_summary',
      help: 'Inference latency summary with quantiles',
      labelNames: ['model_id', 'model_version'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.driftScoreSummary = new Summary({
      name: 'model_serving_drift_score_summary',
      help: 'Drift score summary with quantiles',
      labelNames: ['model_id', 'model_version'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    // Start metrics server
    this.startMetricsServer(port);
  }

  /**
   * Start HTTP server for Prometheus scraping
   */
  private startMetricsServer(port: number): void {
    this.metricsServer = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.metricsServer.listen(port, () => {
      console.log(`📊 Model Serving Metrics server listening on port ${port}`);
      console.log(`   Metrics: http://localhost:${port}/metrics`);
      console.log(`   Health:  http://localhost:${port}/health`);
    });
  }

  /**
   * Shutdown metrics server
   */
  async shutdown(): Promise<void> {
    if (this.metricsServer) {
      return new Promise((resolve) => {
        this.metricsServer!.close(() => {
          console.log('📊 Model Serving Metrics server shut down');
          resolve();
        });
      });
    }
  }

  /**
   * Get registry for custom metric registration
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

// Singleton instance
let metricsInstance: ModelServingMetrics | null = null;

/**
 * Get or create ModelServingMetrics singleton
 */
export function getModelServingMetrics(port: number = 9464): ModelServingMetrics {
  if (!metricsInstance) {
    metricsInstance = new ModelServingMetrics(port);
  }
  return metricsInstance;
}

/**
 * Shutdown metrics singleton
 */
export async function shutdownModelServingMetrics(): Promise<void> {
  if (metricsInstance) {
    await metricsInstance.shutdown();
    metricsInstance = null;
  }
}

