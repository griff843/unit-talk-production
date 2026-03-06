/**
 * Band Thresholds — SPRINT-036
 *
 * Centralized, versioned threshold definitions for promotion band calibration.
 * All band assignment and downgrade logic references these thresholds.
 *
 * Design:
 *   - Every threshold is explicit and named
 *   - Version string tracks threshold changes for auditability
 *   - No magic numbers outside this file
 */

import type { BandTier, LiquidityTier } from './types';

// ── Threshold Version ───────────────────────────────────────────────────────

/** Bump this when any threshold value changes. */
export const THRESHOLD_VERSION = '1.0.0';

// ── Band Assignment Thresholds ──────────────────────────────────────────────

/**
 * Minimum edge required for each initial band tier.
 * A pick must meet the edge threshold to qualify for the tier.
 */
export const EDGE_THRESHOLDS: Record<Exclude<BandTier, 'SUPPRESS'>, number> = {
  'A+': 0.08, // 8% edge — elite
  A: 0.05, // 5% edge — strong
  B: 0.03, // 3% edge — solid
  C: 0.015, // 1.5% edge — marginal
};

/**
 * Minimum selection score (0-100) for each initial band tier.
 * Null means no score requirement for that tier.
 */
export const SELECTION_SCORE_THRESHOLDS: Record<Exclude<BandTier, 'SUPPRESS'>, number | null> = {
  'A+': 85,
  A: 70,
  B: 50,
  C: null, // No score floor for C — edge alone can qualify
};

// ── Downgrade Thresholds ────────────────────────────────────────────────────

/**
 * Uncertainty caps: if uncertainty exceeds the cap for a band,
 * the pick is downgraded to the next lower band.
 */
export const UNCERTAINTY_CAPS: Record<Exclude<BandTier, 'SUPPRESS'>, number> = {
  'A+': 0.1, // Very low uncertainty required for A+
  A: 0.15, // Low uncertainty for A
  B: 0.25, // Moderate uncertainty allowed for B
  C: 0.35, // Higher uncertainty tolerated for C
};

/** Uncertainty above this value forces suppression regardless of band. */
export const UNCERTAINTY_SUPPRESS_THRESHOLD = 0.45;

/**
 * CLV forecast thresholds.
 * Negative CLV forecast indicates the market is expected to move against the pick.
 */
export const CLV_THRESHOLDS = {
  /** CLV forecast below this triggers suppression. */
  suppressBelow: -0.15,
  /** CLV forecast below this triggers a one-band downgrade. */
  downgradeBelow: -0.05,
} as const;

/**
 * Liquidity-based band caps.
 * Picks with the given liquidity tier cannot exceed the specified band.
 */
export const LIQUIDITY_BAND_CAPS: Record<LiquidityTier, BandTier> = {
  high: 'A+', // No cap
  medium: 'A', // Cap at A
  low: 'B', // Cap at B
  unknown: 'C', // Cap at C
};

/**
 * Market resistance threshold.
 * Resistance above this triggers a one-band downgrade.
 */
export const MARKET_RESISTANCE_DOWNGRADE_THRESHOLD = 0.7;

/** Market resistance above this forces suppression. */
export const MARKET_RESISTANCE_SUPPRESS_THRESHOLD = 0.9;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compare two bands. Returns negative if a is higher, positive if b is higher, 0 if equal.
 */
export function compareBands(a: BandTier, b: BandTier): number {
  const order: BandTier[] = ['A+', 'A', 'B', 'C', 'SUPPRESS'];
  return order.indexOf(a) - order.indexOf(b);
}

/**
 * Return the lower of two bands (further from A+).
 */
export function lowerBand(a: BandTier, b: BandTier): BandTier {
  return compareBands(a, b) >= 0 ? a : b;
}

/**
 * Downgrade a band by one step. SUPPRESS stays SUPPRESS.
 */
export function downgradeOneStep(band: BandTier): BandTier {
  const order: BandTier[] = ['A+', 'A', 'B', 'C', 'SUPPRESS'];
  const idx = order.indexOf(band);
  return idx < order.length - 1 ? order[idx + 1] : 'SUPPRESS';
}
