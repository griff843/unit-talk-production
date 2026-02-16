/**
 * NormalizedConfidence — Continuous 0-1 confidence model.
 *
 * Replaces the discrete integer confidence (0-5 from Math.round())
 * with a continuous [0.05, 0.95] signal for PromotionGatekeeper.
 *
 * Design: Tranche 3, Stage 3 (2026-01-30)
 * Implementation: Tranche 4, Stage 2 (2026-02-01)
 *
 * Properties:
 *   - Continuous: full decimal precision, no Math.round()
 *   - Monotonic: higher quality → higher confidence
 *   - Deterministic: same inputs → same output
 *   - Bounded: [0.05, 0.95] — never absolute certainty
 *   - Compatible: 0-1 scale matches PromotionGatekeeper expectations
 */

// ─── Signal Weights ─────────────────────────────────────────────────────────
const WEIGHTS = {
  ev_percent: 0.3,
  professional_score: 0.25,
  trend_score: 0.1,
  matchup_score: 0.1,
  line_value_score: 0.1,
  role_stability: 0.05,
  volatility_penalty: -0.1,
  data_quality_bonus: 0.05,
} as const;

const BOUNDS = { min: 0.05, max: 0.95 } as const;

// ─── Data quality fields ────────────────────────────────────────────────────
const DATA_QUALITY_FIELDS = [
  'player_name',
  'sport',
  'stat_type',
  'line',
  'odds',
  'over_odds',
  'under_odds',
  'recent_avg',
  'season_avg',
  'team',
  'projected_win_prob',
] as const;

// ─── Normalization Functions ────────────────────────────────────────────────

/** Sigmoid normalization for EV: centered at 0, saturating at ±20 */
function normalizeEV(evPercent: number): number {
  return 1 / (1 + Math.exp(-(evPercent ?? 0) / 5));
}

/** Linear normalization: score/max clamped to [0, 1] */
function normalizeLinear(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, (score ?? 0) / max));
}

/** Binary volatility penalty: 1 if contradictory flags, 0 otherwise */
function volatilityPenalty(prop: any): number {
  if (prop.is_volatile === true && prop.is_stable === true) return 1;
  if (prop.steam_for === true && prop.steam_against === true) return 1;
  return 0;
}

/** Fraction of data quality fields that are populated */
function dataQualityBonus(prop: any): number {
  let populated = 0;
  for (const field of DATA_QUALITY_FIELDS) {
    // eslint-disable-next-line security/detect-object-injection
    const val = prop[field];
    if (val !== undefined && val !== null && val !== '') {
      populated++;
    }
  }
  return populated / DATA_QUALITY_FIELDS.length;
}

// ─── Main Function ──────────────────────────────────────────────────────────

export interface NormalizedConfidenceInput {
  ev_percent: number;
  professional_score_raw: number; // 0-25 (raw sub-score sum)
  trend_score: number;
  matchup_score: number;
  line_value_score: number;
  role_stability: number;
  prop: any; // original prop for volatility/data quality checks
}

/**
 * Calculate normalized confidence on continuous [0.05, 0.95] scale.
 *
 * Pure function — deterministic, no side effects.
 */
export function calculateNormalizedConfidence(input: NormalizedConfidenceInput): number {
  const {
    ev_percent,
    professional_score_raw,
    trend_score,
    matchup_score,
    line_value_score,
    role_stability,
    prop,
  } = input;

  const raw =
    WEIGHTS.ev_percent * normalizeEV(ev_percent) +
    WEIGHTS.professional_score * normalizeLinear(professional_score_raw, 25) +
    WEIGHTS.trend_score * normalizeLinear(trend_score, 5) +
    WEIGHTS.matchup_score * normalizeLinear(matchup_score, 5) +
    WEIGHTS.line_value_score * normalizeLinear(line_value_score, 5) +
    WEIGHTS.role_stability * normalizeLinear(role_stability, 5) +
    WEIGHTS.volatility_penalty * volatilityPenalty(prop) +
    WEIGHTS.data_quality_bonus * dataQualityBonus(prop);

  return Math.min(BOUNDS.max, Math.max(BOUNDS.min, raw));
}
