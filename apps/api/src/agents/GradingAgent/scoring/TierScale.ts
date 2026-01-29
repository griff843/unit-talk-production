/**
 * TierScale.ts — Canonical Tier Determination
 *
 * SINGLE SOURCE OF TRUTH for all tier classification in the scoring system.
 * All tier systems MUST delegate to this module.
 *
 * Created: 2026-01-29 (Tranche 2, Stage 1 — Scoring Rebuild)
 * Canonical system: SyndicateGradingEngine (System 3)
 *
 * Systems consolidated:
 *   System 1 — determineTier.ts (scale 0-25)
 *   System 2 — unified-edge-score.ts (scale 0-100)
 *   System 3 — gradingEngine.ts (scale 0-100, multi-dimensional) ← CANONICAL
 *   System 4 — edgeScore.ts (scale 0-5)
 *   System 5 — gradeProps.ts runner (scale 0-5)
 */

// ─── Type ────────────────────────────────────────────────────────────────────
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

// ─── Canonical Thresholds ────────────────────────────────────────────────────
// From SyndicateGradingEngine.determineTierAndConfidence (gradingEngine.ts:975-979)
export const CANONICAL_THRESHOLDS = {
  S: { minScore: 70, minEdge: 20, maxRisk: 4 },
  A: { minScore: 50, minEdge: 0, maxRisk: 5 },
  B: { minScore: 40, minEdge: -Infinity, maxRisk: 6 },
  C: { minScore: 30, minEdge: -Infinity, maxRisk: 7 },
  // D: everything below C
} as const;

// Score-only thresholds (derived from canonical, for callers without edge/risk)
export const SCORE_ONLY_THRESHOLDS = {
  S: 70,
  A: 50,
  B: 40,
  C: 30,
} as const;

// ─── Canonical Tier Function (Multi-Dimensional) ─────────────────────────────

export interface CanonicalTierInput {
  score: number; // 0-100 composite score
  edge: number; // edge score (higher = more edge detected)
  risk: number; // risk score (lower = less risk = better)
}

/**
 * Canonical tier determination — full System 3 fidelity.
 * Requires score, edge, AND risk for multi-dimensional classification.
 *
 * This is the ONLY function that should determine tiers for production grading.
 */
// eslint-disable-next-line complexity
export function canonicalTier(input: CanonicalTierInput): Tier {
  const { score, edge, risk } = input;

  if (
    score >= CANONICAL_THRESHOLDS.S.minScore &&
    edge >= CANONICAL_THRESHOLDS.S.minEdge &&
    risk <= CANONICAL_THRESHOLDS.S.maxRisk
  ) {
    return 'S';
  }
  if (
    score >= CANONICAL_THRESHOLDS.A.minScore &&
    edge >= CANONICAL_THRESHOLDS.A.minEdge &&
    risk <= CANONICAL_THRESHOLDS.A.maxRisk
  ) {
    return 'A';
  }
  if (score >= CANONICAL_THRESHOLDS.B.minScore && risk <= CANONICAL_THRESHOLDS.B.maxRisk) {
    return 'B';
  }
  if (score >= CANONICAL_THRESHOLDS.C.minScore && risk <= CANONICAL_THRESHOLDS.C.maxRisk) {
    return 'C';
  }
  return 'D';
}

// ─── Score-Only Tier Function ────────────────────────────────────────────────

/**
 * Score-only tier determination for callers without edge/risk data.
 * Uses canonical score thresholds. Equivalent to canonicalTier with
 * permissive edge (Infinity) and risk (0) so score alone decides.
 *
 * @param score100 - Score on the canonical 0-100 scale.
 */
export function scoreOnlyTier(score100: number): Tier {
  if (score100 >= SCORE_ONLY_THRESHOLDS.S) return 'S';
  if (score100 >= SCORE_ONLY_THRESHOLDS.A) return 'A';
  if (score100 >= SCORE_ONLY_THRESHOLDS.B) return 'B';
  if (score100 >= SCORE_ONLY_THRESHOLDS.C) return 'C';
  return 'D';
}

// ─── Scale Normalization ─────────────────────────────────────────────────────

/**
 * Normalize a score from a legacy scale to the canonical 0-100 scale.
 * @param score - Raw score on the legacy scale
 * @param maxScale - Maximum value of the legacy scale (e.g. 25 for System 1, 5 for System 4)
 */
export function normalizeScore(score: number, maxScale: number): number {
  if (maxScale <= 0) return 0;
  return Math.min(100, Math.max(0, (score / maxScale) * 100));
}
