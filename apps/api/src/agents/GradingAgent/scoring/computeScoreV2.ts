/**
 * computeScoreV2.ts — Unified Scoring Pipeline V2
 *
 * Single canonical scoring function that replaces the scattered score-composition
 * logic across 5 legacy systems. Uses the declarative Feature Registry for
 * auditable, deterministic scoring.
 *
 * Returns: { score, tier, ev, breakdown, feature_audit }
 *
 * Created: 2026-01-29 (Tranche 3, Stage 3 — Scoring Rebuild)
 */

import { getSportWeights } from '../../../scoring/config/weights';

import {
  FEATURE_REGISTRY,
  extractFeatureVector,
  type FeatureRegistryEntry,
  type FeatureVectorEntry as _FeatureVectorEntry,
} from './featureRegistry';
import { type Tier, canonicalTier } from './TierScale';

import type { CoreScoringWeights } from '../../../scoring/config/weights/types';
import type { GradingFeatureSet } from '../../../types/GradingFeatureSet';

// ─── Result Types ───────────────────────────────────────────────────────────

export interface FeatureBreakdown {
  raw: number;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface FeatureAuditEntry {
  present: boolean;
  fallbackUsed: boolean;
  fallbackPolicy: string;
  rawValue: number | undefined;
}

export interface ComputeScoreV2Result {
  /** Composite score on 0-100 scale */
  score: number;
  /** Canonical tier: S | A | B | C | D */
  tier: Tier;
  /** Expected value in percent (5 = +5%) */
  ev: number;
  /** Per-feature scoring breakdown */
  breakdown: Record<string, FeatureBreakdown>;
  /** Per-feature data availability audit */
  feature_audit: Record<string, FeatureAuditEntry>;
  // DATA-MOAT-V3-INTEGRATION-001: Feature snapshot linkage for reproducibility
  /** UUID of feature_snapshot record (required for promotion) */
  featureSnapshotId?: string;
  /** SHA-256 hash of feature vector (required for reproducibility) */
  featureVectorHash?: string;
}

// ─── Edge & Risk Derivation ─────────────────────────────────────────────────

/**
 * Derive edge score for canonicalTier from feature values.
 * Edge represents mathematical advantage of the pick.
 *
 * Components:
 * - EV (primary): expected value in percent
 * - CLV: closing line value
 * - Sharp money signal: deviation from neutral (50)
 *
 * Range: roughly -50 to +50. S-tier requires ≥ 20.
 */
function deriveEdge(features: GradingFeatureSet): number {
  const ev = features.expectedValue ?? 0;
  const clv = features.closingLineValue ?? 0;
  const sharpSignal = ((features.sharpMoney ?? 50) - 50) / 5;
  return ev + clv + sharpSignal;
}

/**
 * Derive risk score for canonicalTier from feature values.
 * Risk represents downside exposure of the pick.
 *
 * Components:
 * - correlationRisk (0-1): scaled × 4
 * - volatility (0-10): scaled × 0.3
 * - portfolioImpact (0-1): scaled × 3
 *
 * Range: 0-10. S-tier requires ≤ 4.
 */
function deriveRisk(features: GradingFeatureSet): number {
  const corr = features.correlationRisk ?? 0.2;
  const vol = features.volatility ?? 5;
  const port = features.portfolioImpact ?? 0.1;
  return Math.min(10, corr * 4 + vol * 0.3 + port * 3);
}

// ─── Main Scoring Function ──────────────────────────────────────────────────

/**
 * Compute a composite score using the declarative Feature Registry.
 *
 * Algorithm:
 * 1. Look up sport-specific weights from getSportWeights()
 * 2. Extract + normalize all features via the registry
 * 3. Compute participating weight sum (excluding 'excluded' features)
 * 4. Normalize weights so participating features sum to 1.0
 * 5. Weighted sum of normalized features → score (0-100)
 * 6. Derive edge and risk from raw feature values
 * 7. Determine tier via canonicalTier({ score, edge, risk })
 * 8. Build full breakdown and feature_audit
 *
 * Deterministic: no randomness, no time-based jitter. Same input → same output.
 */
// eslint-disable-next-line max-lines-per-function
export function computeScoreV2(features: GradingFeatureSet): ComputeScoreV2Result {
  const sport = features.sport || features.league || 'NBA';
  const weights = getSportWeights(sport);

  // Step 1: Extract + normalize all features via registry
  const vector = extractFeatureVector(features, FEATURE_REGISTRY);

  // Step 2: Compute participating weight sum (excluding 'excluded' features)
  let totalWeight = 0;
  for (const v of vector) {
    if (v.excluded) continue;
    const w = getWeight(weights, v.entry);
    totalWeight += w;
  }

  // Step 3: Weighted sum with normalized weights → score 0-100
  let score = 0;
  const breakdown: Record<string, FeatureBreakdown> = {};
  const feature_audit: Record<string, FeatureAuditEntry> = {};

  for (const v of vector) {
    const rawWeight = getWeight(weights, v.entry);

    if (v.excluded) {
      feature_audit[v.entry.name] = {
        present: false,
        fallbackUsed: false,
        fallbackPolicy: 'excluded',
        rawValue: undefined,
      };
      continue;
    }

    // Normalize weight so participating features sum to 1.0
    const normalizedWeight = totalWeight > 0 ? rawWeight / totalWeight : 0;
    const contribution = v.normalized * normalizedWeight;
    score += contribution;

    breakdown[v.entry.name] = {
      raw: v.raw,
      normalized: v.normalized,
      weight: normalizedWeight,
      contribution,
    };

    feature_audit[v.entry.name] = {
      present: v.present,
      fallbackUsed: v.fallbackUsed,
      fallbackPolicy: v.entry.fallbackPolicy,
      rawValue: v.present ? v.raw : undefined,
    };
  }

  // Step 4: EV from features (already computed upstream)
  const ev = features.expectedValue ?? 0;

  // Step 5: Derive edge and risk for canonical tier
  const edge = deriveEdge(features);
  const risk = deriveRisk(features);

  // Step 6: Determine tier
  const tier = canonicalTier({ score, edge, risk });

  return {
    score: Math.round(score * 100) / 100,
    tier,
    ev,
    breakdown,
    feature_audit,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Look up the weight for a feature from sport-specific weights. */
function getWeight(
  weights: ReturnType<typeof getSportWeights>,
  entry: FeatureRegistryEntry
): number {
  const key = entry.weightKey as keyof CoreScoringWeights;
  // eslint-disable-next-line security/detect-object-injection -- Type-safe keyof access
  const w = weights[key];
  return typeof w === 'number' ? w : 0;
}
