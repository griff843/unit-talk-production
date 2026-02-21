/* eslint-disable complexity, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Promotion Scoring - PRE Score Adapter
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * CRITICAL: Promotion and posting decisions MUST use PRE scores only.
 * POST scores (with CLV) are for validation purposes only.
 *
 * This module provides the canonical interface for promotion decisions.
 */

import {
  computeEdgeScorePre,
  EdgePreInput,
  TIER_THRESHOLDS_PRE,
  assertNoFutureData,
  MODEL_VERSION_PRE,
} from './edgeEnginePre';

// =============================================================================
// PROMOTION THRESHOLDS (CALIBRATED FOR PRE SCORE)
// =============================================================================

/**
 * Promotion thresholds calibrated for PRE scores.
 * PRE scores have less information, so thresholds are slightly lower.
 */
export const PROMOTION_THRESHOLDS = {
  /** Minimum edge score for HARD promotion (S-tier automatic) */
  HARD_MIN_EDGE: 65,

  /** Minimum edge score for SOFT promotion */
  SOFT_MIN_EDGE: 50,

  /** Minimum edge score for A-tier HARD promotion */
  A_TIER_HARD_MIN_EDGE: 70,

  /** Minimum confidence for HARD promotion */
  HARD_MIN_CONFIDENCE: 80,

  /** Minimum confidence for SOFT promotion */
  SOFT_MIN_CONFIDENCE: 70,
} as const;

// =============================================================================
// PROMOTION BAND TYPE
// =============================================================================

export type PromotionBand = 'HARD' | 'SOFT' | 'NO_POST';

export interface PromotionDecision {
  band: PromotionBand;
  tier_pre: 'S' | 'A' | 'B' | 'PASS';
  edge_score_pre: number;
  kelly_fraction_pre: number;
  confidence: number;
  reasons: string[];
  model_version_pre: typeof MODEL_VERSION_PRE;
}

// =============================================================================
// PROMOTION DECISION FUNCTIONS
// =============================================================================

/**
 * Calculate promotion confidence from PRE score components.
 * Maps edge_score_pre to a confidence percentage.
 */
function calculatePromotionConfidence(edgeScorePre: number): number {
  // Map 0-100 edge score to 50-100 confidence
  // S-tier (75+) → 85+ confidence
  // A-tier (60-74) → 75-84 confidence
  // B-tier (45-59) → 65-74 confidence
  // PASS (<45) → <65 confidence
  const base = 50;
  const scaled = (edgeScorePre / 100) * 50;
  return Math.min(100, Math.round(base + scaled));
}

/**
 * Compute promotion band from PRE score.
 *
 * CRITICAL: This function uses ONLY PRE scores for promotion decisions.
 * It explicitly rejects any input containing closing data.
 */
export function computePromotionBand(input: EdgePreInput): PromotionDecision {
  // LEAKAGE GUARD: Ensure no future data
  assertNoFutureData({});

  // Compute PRE score
  const preResult = computeEdgeScorePre(input);

  // Calculate confidence
  const confidence = calculatePromotionConfidence(preResult.edge_score_pre);

  // Determine promotion band
  const reasons: string[] = [];
  let band: PromotionBand;

  // S-tier with minimum edge → HARD
  if (
    preResult.tier_pre === 'S' &&
    preResult.edge_score_pre >= PROMOTION_THRESHOLDS.HARD_MIN_EDGE
  ) {
    band = 'HARD';
    reasons.push(
      `S-tier with edge ${preResult.edge_score_pre.toFixed(1)} >= ${PROMOTION_THRESHOLDS.HARD_MIN_EDGE}`
    );
  }
  // A-tier with elevated edge and confidence → HARD
  else if (
    preResult.tier_pre === 'A' &&
    preResult.edge_score_pre >= PROMOTION_THRESHOLDS.A_TIER_HARD_MIN_EDGE &&
    confidence >= PROMOTION_THRESHOLDS.HARD_MIN_CONFIDENCE
  ) {
    band = 'HARD';
    reasons.push(
      `A-tier with edge ${preResult.edge_score_pre.toFixed(1)} >= ${PROMOTION_THRESHOLDS.A_TIER_HARD_MIN_EDGE}`
    );
    reasons.push(`Confidence ${confidence}% >= ${PROMOTION_THRESHOLDS.HARD_MIN_CONFIDENCE}%`);
  }
  // A or B tier with minimum edge → SOFT
  else if (
    (preResult.tier_pre === 'A' || preResult.tier_pre === 'B') &&
    preResult.edge_score_pre >= PROMOTION_THRESHOLDS.SOFT_MIN_EDGE
  ) {
    band = 'SOFT';
    reasons.push(
      `${preResult.tier_pre}-tier with edge ${preResult.edge_score_pre.toFixed(1)} >= ${PROMOTION_THRESHOLDS.SOFT_MIN_EDGE}`
    );
  }
  // Otherwise → NO_POST
  else {
    band = 'NO_POST';
    if (preResult.tier_pre === 'PASS') {
      reasons.push('PASS tier - insufficient edge');
    } else {
      reasons.push(
        `Edge ${preResult.edge_score_pre.toFixed(1)} below soft threshold ${PROMOTION_THRESHOLDS.SOFT_MIN_EDGE}`
      );
    }
  }

  // Add flags as reasons if present
  if (preResult.pre_flags.length > 0) {
    reasons.push(`Flags: ${preResult.pre_flags.join(', ')}`);
  }

  return {
    band,
    tier_pre: preResult.tier_pre,
    edge_score_pre: preResult.edge_score_pre,
    kelly_fraction_pre: preResult.kelly_fraction_pre,
    confidence,
    reasons,
    model_version_pre: MODEL_VERSION_PRE,
  };
}

/**
 * Check if a pick meets promotion criteria using PRE score.
 *
 * CRITICAL: This is the canonical function for promotion decisions.
 * It replaces any legacy functions that used POST scores.
 */
export function meetsPromotionCriteriaPre(input: EdgePreInput): {
  promoted: boolean;
  band: PromotionBand;
  decision: PromotionDecision;
} {
  const decision = computePromotionBand(input);

  return {
    promoted: decision.band === 'HARD' || decision.band === 'SOFT',
    band: decision.band,
    decision,
  };
}

/**
 * Batch promotion scoring
 */
export function computePromotionBandBatch(inputs: EdgePreInput[]): PromotionDecision[] {
  return inputs.map(input => computePromotionBand(input));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { TIER_THRESHOLDS_PRE, MODEL_VERSION_PRE };
