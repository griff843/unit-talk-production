// SPRINT-REPO-TRUTH-LOCK-002: Canonical copy lives in @unit-talk/intelligence. Keep in sync.
/**
 * Calibration Computation
 * Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
 *
 * Computes calibration metrics (ECE, Brier, reliability buckets) for model evaluation.
 * Per MODEL_ARCHITECTURE_SPEC_v1.md Section on Calibration Monitoring.
 */

import { roundTo } from './devigConsensus';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Single prediction with outcome */
export interface PredictionOutcome {
  /** Model probability (P_final) */
  pFinal: number;
  /** Settlement result: 1 = win, 0 = loss */
  outcome: 0 | 1;
  /** Optional: pick ID for audit */
  pickId?: string;
}

/** Reliability bucket for calibration analysis */
export interface ReliabilityBucket {
  /** Lower bound of probability bucket */
  bucketLower: number;
  /** Upper bound of probability bucket */
  bucketUpper: number;
  /** Number of predictions in bucket */
  count: number;
  /** Average predicted probability in bucket */
  avgPredicted: number;
  /** Observed win rate in bucket */
  observedRate: number;
  /** Calibration error = |avgPredicted - observedRate| */
  calibrationError: number;
  /** Brier contribution for this bucket */
  brierContribution: number;
}

/** Calibration metrics result */
export interface CalibrationMetrics {
  /** Sample size */
  sampleSize: number;
  /** Win count */
  winCount: number;
  /** Loss count */
  lossCount: number;
  /** Brier score (lower is better, 0 = perfect) */
  brierScore: number;
  /** Expected Calibration Error (lower is better) */
  ece: number;
  /** Maximum Calibration Error */
  mce: number;
  /** Log loss (lower is better) */
  logLoss: number;
  /** Reliability buckets for visualization */
  buckets: ReliabilityBucket[];
  /** Model version */
  modelVersion: string;
  /** Probability model version */
  probabilityModelVersion: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default bucket width for calibration (5% = 20 buckets) */
const DEFAULT_BUCKET_WIDTH = 0.05;

/** Epsilon for log loss to avoid log(0) */
const LOG_LOSS_EPSILON = 1e-15;

// =============================================================================
// CALIBRATION COMPUTATION
// =============================================================================

/**
 * Compute Brier score
 * Brier = mean((outcome - predicted)^2)
 * Lower is better. Perfect = 0, random = 0.25
 */
export function computeBrierScore(predictions: PredictionOutcome[]): number {
  if (predictions.length === 0) return 0;

  const sumSquaredError = predictions.reduce((sum, p) => {
    const error = p.outcome - p.pFinal;
    return sum + error * error;
  }, 0);

  return roundTo(sumSquaredError / predictions.length, 6);
}

/**
 * Compute log loss (cross-entropy loss)
 * LogLoss = -mean(y*log(p) + (1-y)*log(1-p))
 * Lower is better.
 */
export function computeLogLoss(predictions: PredictionOutcome[]): number {
  if (predictions.length === 0) return 0;

  const sumLogLoss = predictions.reduce((sum, p) => {
    // Clamp probability to avoid log(0)
    const pClamped = Math.max(LOG_LOSS_EPSILON, Math.min(1 - LOG_LOSS_EPSILON, p.pFinal));
    if (p.outcome === 1) {
      return sum - Math.log(pClamped);
    } else {
      return sum - Math.log(1 - pClamped);
    }
  }, 0);

  return roundTo(sumLogLoss / predictions.length, 6);
}

/**
 * Compute reliability buckets
 * Groups predictions by probability and compares predicted vs observed rates.
 */
export function computeReliabilityBuckets(
  predictions: PredictionOutcome[],
  bucketWidth: number = DEFAULT_BUCKET_WIDTH
): ReliabilityBucket[] {
  if (predictions.length === 0) return [];

  // Initialize buckets
  const numBuckets = Math.ceil(1 / bucketWidth);
  const bucketData: Map<number, { predictions: PredictionOutcome[] }> = new Map();

  // Assign predictions to buckets
  for (const p of predictions) {
    const bucketIdx = Math.min(Math.floor(p.pFinal / bucketWidth), numBuckets - 1);
    if (!bucketData.has(bucketIdx)) {
      bucketData.set(bucketIdx, { predictions: [] });
    }
    bucketData.get(bucketIdx)!.predictions.push(p);
  }

  // Compute bucket statistics
  const buckets: ReliabilityBucket[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const data = bucketData.get(i);
    if (!data || data.predictions.length === 0) continue;

    const bucketLower = roundTo(i * bucketWidth, 4);
    const bucketUpper = roundTo((i + 1) * bucketWidth, 4);

    const count = data.predictions.length;
    const sumPredicted = data.predictions.reduce((s, p) => s + p.pFinal, 0);
    const sumOutcomes = data.predictions.reduce((s, p) => s + p.outcome, 0);

    const avgPredicted = roundTo(sumPredicted / count, 6);
    const observedRate = roundTo(sumOutcomes / count, 6);
    const calibrationError = roundTo(Math.abs(avgPredicted - observedRate), 6);

    // Brier contribution for this bucket
    const brierContribution = roundTo(
      data.predictions.reduce((sum, p) => sum + Math.pow(p.outcome - p.pFinal, 2), 0) / count,
      6
    );

    buckets.push({
      bucketLower,
      bucketUpper,
      count,
      avgPredicted,
      observedRate,
      calibrationError,
      brierContribution,
    });
  }

  return buckets;
}

/**
 * Compute Expected Calibration Error (ECE)
 * ECE = sum(|bucket| / n * |avgPredicted - observedRate|)
 * Weighted average of bucket calibration errors.
 */
export function computeECE(buckets: ReliabilityBucket[], totalSamples: number): number {
  if (buckets.length === 0 || totalSamples === 0) return 0;

  const ece = buckets.reduce((sum, b) => {
    return sum + (b.count / totalSamples) * b.calibrationError;
  }, 0);

  return roundTo(ece, 6);
}

/**
 * Compute Maximum Calibration Error (MCE)
 * MCE = max(|avgPredicted - observedRate|) across all buckets
 */
export function computeMCE(buckets: ReliabilityBucket[]): number {
  if (buckets.length === 0) return 0;
  return Math.max(...buckets.map(b => b.calibrationError));
}

/**
 * Compute full calibration metrics
 *
 * @param predictions Array of predictions with outcomes
 * @param modelVersion Model version string
 * @param probabilityModelVersion Probability model version string
 * @param bucketWidth Width of reliability buckets (default 0.05)
 */
export function computeCalibrationMetrics(
  predictions: PredictionOutcome[],
  modelVersion: string,
  probabilityModelVersion: string,
  bucketWidth: number = DEFAULT_BUCKET_WIDTH
): CalibrationMetrics {
  const sampleSize = predictions.length;
  const winCount = predictions.filter(p => p.outcome === 1).length;
  const lossCount = sampleSize - winCount;

  const brierScore = computeBrierScore(predictions);
  const logLoss = computeLogLoss(predictions);
  const buckets = computeReliabilityBuckets(predictions, bucketWidth);
  const ece = computeECE(buckets, sampleSize);
  const mce = computeMCE(buckets);

  return {
    sampleSize,
    winCount,
    lossCount,
    brierScore,
    ece,
    mce,
    logLoss,
    buckets,
    modelVersion,
    probabilityModelVersion,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { DEFAULT_BUCKET_WIDTH };
