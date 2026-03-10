/**
 * Edge Validator — Statistical significance test for identified edges
 * Sprint: SPRINT-PHASE2-CLV-EDGE-VALIDATION
 * Issue: UNI-16
 *
 * Answers: "Is the observed CLV edge statistically real, or is it noise?"
 *
 * Uses a one-sample t-test (H₀: mean CLV = 0) with normal approximation
 * for N ≥ MIN_EDGE_SAMPLE_SIZE. For large samples (N ≥ 30) the t-distribution
 * converges to normal, so we use the z-critical value (1.96 for α=0.05).
 *
 * FAIL-CLOSED: Returns { ok: false, reason } when test cannot be performed.
 * READ-ONLY: No writes to any table.
 */

import { analyzeCLV } from './clvAnalyzer';

import type { ScoredOutcome } from '../outcomes/types';

// =============================================================================
// TYPES
// =============================================================================

export type EdgeValidationFailReason =
  | 'INSUFFICIENT_SAMPLE'
  | 'INVALID_PROBABILITIES'
  | 'ZERO_VARIANCE'
  | 'CLV_ANALYSIS_FAILED';

export interface EdgeValidationOk {
  ok: true;
  isReal: boolean;
  meanCLV: number;
  stdDev: number;
  tStat: number;
  pValueApprox: number; // approximate two-tailed p-value (normal approx)
  sampleSize: number;
  positiveCLVPct: number;
  significanceLevel: number; // alpha used (default 0.05)
}

export interface EdgeValidationFail {
  ok: false;
  reason: EdgeValidationFailReason;
  reasonDetail: string;
  sampleSize: number;
}

export type EdgeValidationResult = EdgeValidationOk | EdgeValidationFail;

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum sample size required to perform edge validation (fail-closed) */
export const MIN_EDGE_SAMPLE_SIZE = 30;

/** Default significance level (α) for the two-tailed test */
export const DEFAULT_ALPHA = 0.05;

/**
 * Z-critical values for two-tailed normal approximation.
 * Used when N ≥ MIN_EDGE_SAMPLE_SIZE.
 */
const Z_CRITICAL: Record<number, number> = {
  0.1: 1.6449,
  0.05: 1.96,
  0.01: 2.5758,
};

// =============================================================================
// CORE FUNCTION
// =============================================================================

/**
 * Validate whether the observed edge (CLV) across a set of scored picks
 * is statistically distinguishable from zero.
 *
 * @param records   Settled scored picks with p_final and p_market_devig
 * @param alpha     Significance level — default 0.05
 */
export function validateEdge(
  records: ScoredOutcome[],
  alpha: number = DEFAULT_ALPHA
): EdgeValidationResult {
  if (records.length < MIN_EDGE_SAMPLE_SIZE) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_SAMPLE',
      reasonDetail: `Need ≥${MIN_EDGE_SAMPLE_SIZE} records; got ${records.length}`,
      sampleSize: records.length,
    };
  }

  // Delegate CLV computation
  const clvResult = analyzeCLV(records);
  if (clvResult.ok === false) {
    return {
      ok: false,
      reason: 'CLV_ANALYSIS_FAILED',
      reasonDetail: clvResult.reason,
      sampleSize: records.length,
    };
  }

  const { summary } = clvResult;
  const { n, meanCLV, stdDev } = summary;

  if (stdDev === 0) {
    return {
      ok: false,
      reason: 'ZERO_VARIANCE',
      reasonDetail: 'All CLV values are identical — t-test undefined',
      sampleSize: n,
    };
  }

  // One-sample t-statistic: t = (x̄ - 0) / (s / √n)
  const stdErr = stdDev / Math.sqrt(n);
  const tStat = meanCLV / stdErr;

  // Normal approximation for p-value (valid for n ≥ 30)
  const pValueApprox = approximatePValue(Math.abs(tStat));

  // Significance: |t| > z_critical for given alpha
  const zCrit = Z_CRITICAL[alpha] ?? Z_CRITICAL[DEFAULT_ALPHA];
  const isReal = Math.abs(tStat) > zCrit;

  return {
    ok: true,
    isReal,
    meanCLV: round(meanCLV, 6),
    stdDev: round(stdDev, 6),
    tStat: round(tStat, 4),
    pValueApprox: round(pValueApprox, 4),
    sampleSize: n,
    positiveCLVPct: summary.positiveCLVPct,
    significanceLevel: alpha,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Approximate two-tailed p-value from |t| using normal distribution CDF.
 * Accurate for N ≥ 30 where t ≈ Z.
 *
 * Uses Abramowitz & Stegun approximation for the normal CDF tail.
 */
function approximatePValue(absTStat: number): number {
  // P(Z > |t|) * 2 (two-tailed)
  const tailProb = normalTailProb(absTStat);
  return Math.min(1, tailProb * 2);
}

/**
 * Upper tail probability P(Z > z) for z ≥ 0.
 * Abramowitz & Stegun 26.2.17 approximation — max error < 7.5e-8.
 */
function normalTailProb(z: number): number {
  if (z < 0) return 1 - normalTailProb(-z);
  const t = 1 / (1 + 0.2316419 * z);
  const poly =
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
  return phi * poly;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
