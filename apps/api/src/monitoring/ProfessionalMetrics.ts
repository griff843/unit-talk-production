/**
 * Professional Pipeline Metrics
 *
 * Prometheus metrics for monitoring professional betting features and pipeline performance.
 */

import { Histogram, Counter, register } from 'prom-client';

/**
 * Feature execution duration histogram
 * Tracks how long each feature takes to calculate
 */
export const professionalFeatureDuration = new Histogram({
  name: 'professional_feature_duration_seconds',
  help: 'Duration of professional feature calculations in seconds',
  labelNames: ['feature_id', 'feature_name'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0], // 1ms to 1s
  registers: [register],
});

/**
 * Feature error counter
 * Tracks errors by feature and error type
 */
export const professionalFeatureError = new Counter({
  name: 'professional_feature_error_total',
  help: 'Total number of professional feature calculation errors',
  labelNames: ['feature_id', 'error_type'],
  registers: [register],
});

/**
 * Feature score histogram
 * Tracks the distribution of feature scores
 */
export const professionalFeatureScore = new Histogram({
  name: 'professional_feature_score',
  help: 'Distribution of professional feature scores (0-1)',
  labelNames: ['feature_id', 'feature_name'],
  buckets: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

/**
 * Feature confidence histogram
 * Tracks the distribution of feature confidence levels
 */
export const professionalFeatureConfidence = new Histogram({
  name: 'professional_feature_confidence',
  help: 'Distribution of professional feature confidence levels (0-1)',
  labelNames: ['feature_id', 'feature_name'],
  buckets: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

/**
 * Feature skip counter
 * Tracks how often features are skipped due to missing data
 */
export const professionalFeatureSkipped = new Counter({
  name: 'professional_feature_skipped_total',
  help: 'Total number of times a feature was skipped due to missing data',
  labelNames: ['feature_id', 'reason'],
  registers: [register],
});

/**
 * Pipeline execution duration histogram
 * Tracks total pipeline execution time
 */
export const professionalPipelineDuration = new Histogram({
  name: 'professional_pipeline_duration_seconds',
  help: 'Duration of complete professional pipeline execution in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0], // 10ms to 5s
  registers: [register],
});

/**
 * Pipeline error counter
 * Tracks pipeline-level errors
 */
export const professionalPipelineError = new Counter({
  name: 'professional_pipeline_error_total',
  help: 'Total number of professional pipeline errors',
  labelNames: ['error_type'],
  registers: [register],
});

/**
 * Pipeline composite score histogram
 * Tracks the distribution of final composite scores
 */
export const professionalPipelineCompositeScore = new Histogram({
  name: 'professional_pipeline_composite_score',
  help: 'Distribution of professional pipeline composite scores (0-1)',
  buckets: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

/**
 * Pipeline features executed counter
 * Tracks how many features were successfully executed per pipeline run
 */
export const professionalPipelineFeaturesExecuted = new Histogram({
  name: 'professional_pipeline_features_executed',
  help: 'Number of features successfully executed per pipeline run',
  buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  registers: [register],
});

/**
 * CLV integration counter
 * Tracks how often CLV data is available in professional context
 */
export const professionalCLVAvailable = new Counter({
  name: 'professional_clv_available_total',
  help: 'Total number of professional pipeline executions with CLV data available',
  labelNames: ['has_clv'],
  registers: [register],
});

/**
 * Canonical entity integration counter
 * Tracks usage of canonical IDs in professional pipeline
 */
export const professionalCanonicalUsage = new Counter({
  name: 'professional_canonical_usage_total',
  help: 'Total number of professional pipeline executions with canonical IDs',
  labelNames: ['has_game_id', 'has_player_id'],
  registers: [register],
});

/**
 * Helper function to record feature execution metrics
 */
export function recordFeatureExecution(
  featureId: string,
  featureName: string,
  durationSeconds: number,
  score: number,
  confidence: number | undefined
): void {
  professionalFeatureDuration.labels(featureId, featureName).observe(durationSeconds);
  professionalFeatureScore.labels(featureId, featureName).observe(score);

  if (confidence !== undefined) {
    professionalFeatureConfidence.labels(featureId, featureName).observe(confidence);
  }
}

/**
 * Helper function to record feature error
 */
export function recordFeatureError(featureId: string, errorType: string): void {
  professionalFeatureError.labels(featureId, errorType).inc();
}

/**
 * Helper function to record feature skip
 */
export function recordFeatureSkipped(featureId: string, reason: string): void {
  professionalFeatureSkipped.labels(featureId, reason).inc();
}

/**
 * Helper function to record pipeline execution metrics
 */
export function recordPipelineExecution(
  durationSeconds: number,
  compositeScore: number,
  featuresExecuted: number,
  hasCLV: boolean,
  hasCanonicalGameId: boolean,
  hasCanonicalPlayerId: boolean
): void {
  professionalPipelineDuration.observe(durationSeconds);
  professionalPipelineCompositeScore.observe(compositeScore);
  professionalPipelineFeaturesExecuted.observe(featuresExecuted);

  professionalCLVAvailable.labels(hasCLV ? 'true' : 'false').inc();
  professionalCanonicalUsage
    .labels(
      hasCanonicalGameId ? 'true' : 'false',
      hasCanonicalPlayerId ? 'true' : 'false'
    )
    .inc();
}

/**
 * Helper function to record pipeline error
 */
export function recordPipelineError(errorType: string): void {
  professionalPipelineError.labels(errorType).inc();
}
