/**
 * driftLogger.ts — Structured Drift Logging for V2 Canary
 *
 * Emits structured JSON log lines when shadow or V2 mode is active.
 * No DB writes — stdout only (compatible with any log aggregator).
 *
 * Created: 2026-01-29 (Tranche 6 — Canary Routing)
 */

import type { CanaryMode } from './canaryRouter';
import type { ComputeScoreV2Result } from './computeScoreV2';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DriftLogEntry {
  /** Log type discriminator */
  type: 'scoring_drift';
  /** ISO timestamp */
  timestamp: string;
  /** Trace/correlation ID */
  trace_id: string;
  /** Pick identifier */
  pick_id: string;
  /** Sport */
  sport: string;
  /** Canary mode that was used */
  mode: CanaryMode;
  /** V1 scoring result */
  v1: {
    score: number;
    tier: string;
    ev: number;
  };
  /** V2 scoring result (null if V1-only mode) */
  v2: {
    score: number;
    tier: string;
    ev: number;
    weights_source: string;
    top_contributors: Array<{ feature: string; contribution: number }>;
  } | null;
  /** Score/tier/ev deltas (null if no V2 computed) */
  deltas: {
    score: number;
    tier_changed: boolean;
    ev: number;
  } | null;
  /** Whether the tier change would affect promotion eligibility */
  promotion_impacting: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract top N contributors from V2 breakdown by absolute contribution.
 */
export function topContributors(
  breakdown: ComputeScoreV2Result['breakdown'],
  n: number = 3
): Array<{ feature: string; contribution: number }> {
  return Object.entries(breakdown)
    .map(([feature, b]) => ({ feature, contribution: b.contribution }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, n);
}

/**
 * Determine if a tier change is promotion-impacting.
 * Promotion tiers: S, A (postable). Non-promotion: B, C, D.
 * A change is promotion-impacting if one tier is postable and the other is not.
 */
export function isPromotionImpacting(v1Tier: string, v2Tier: string): boolean {
  const postable = new Set(['S', 'A']);
  const v1Post = postable.has(v1Tier);
  const v2Post = postable.has(v2Tier);
  return v1Post !== v2Post;
}

// ─── Logger ─────────────────────────────────────────────────────────────────

/**
 * Emit a structured drift log entry to stdout.
 */
export function emitDriftLog(entry: DriftLogEntry): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

/**
 * Build and emit a drift log entry from V1/V2 results.
 */
export function logDrift(params: {
  pickId: string;
  sport: string;
  mode: CanaryMode;
  v1Score: number;
  v1Tier: string;
  v1Ev: number;
  v2Result: ComputeScoreV2Result | null;
  traceId?: string;
}): DriftLogEntry {
  const { pickId, sport, mode, v1Score, v1Tier, v1Ev, v2Result, traceId } = params;

  const entry: DriftLogEntry = {
    type: 'scoring_drift',
    timestamp: new Date().toISOString(),
    trace_id: traceId || pickId,
    pick_id: pickId,
    sport: sport.toUpperCase(),
    mode,
    v1: { score: v1Score, tier: v1Tier, ev: v1Ev },
    v2: v2Result
      ? {
          score: v2Result.score,
          tier: v2Result.tier,
          ev: v2Result.ev,
          weights_source: sport.toUpperCase(),
          top_contributors: topContributors(v2Result.breakdown, 3),
        }
      : null,
    deltas: v2Result
      ? {
          score: Math.round((v2Result.score - v1Score) * 100) / 100,
          tier_changed: v2Result.tier !== v1Tier,
          ev: Math.round((v2Result.ev - v1Ev) * 100) / 100,
        }
      : null,
    promotion_impacting: v2Result ? isPromotionImpacting(v1Tier, v2Result.tier) : false,
  };

  emitDriftLog(entry);
  return entry;
}
