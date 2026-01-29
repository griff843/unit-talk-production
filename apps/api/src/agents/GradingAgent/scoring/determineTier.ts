/**
 * determineTier.ts — Legacy tier function (System 1).
 *
 * SCORING_ENGINE_V2=true  → delegates to canonical TierScale.
 * SCORING_ENGINE_V2=false → original thresholds (S≥20, A≥15, B≥10, else C).
 *
 * Tranche 2, Stage 1+3 (2026-01-29): Consolidated to TierScale behind feature flag.
 */
import { type Tier, scoreOnlyTier, normalizeScore } from './TierScale';

const USE_V2 = process.env.SCORING_ENGINE_V2 === 'true';

/**
 * @deprecated Prefer canonicalTier() from TierScale.ts for new code.
 */
export function determineTier(composite_score: number): Tier {
  if (USE_V2) {
    const normalized = normalizeScore(composite_score, 25);
    return scoreOnlyTier(normalized);
  }
  // Legacy path (System 1 original thresholds)
  if (composite_score >= 20) return 'S';
  if (composite_score >= 15) return 'A';
  if (composite_score >= 10) return 'B';
  return 'C';
}
