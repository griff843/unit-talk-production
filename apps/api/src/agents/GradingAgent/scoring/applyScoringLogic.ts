import { computeScoreV2, type ComputeScoreV2Result } from './computeScoreV2';
import { calculateConfidenceScore } from './confidenceScore';
import { determineTier } from './determineTier';
import { calculateExpectedValue } from './expectedValue';
import { calculateLineValueScore } from './lineValueScore';
import { calculateMatchupScore } from './matchupScore';
import { calculateNormalizedConfidence } from './normalizedConfidence';
import { calculateRoleStabilityScore } from './roleStabilityScore';
import { normalizeScore } from './TierScale';
import { calculateTrendScore } from './trendScore';

import type { GradingFeatureSet } from '../../../types/GradingFeatureSet';

export interface ScoringResult {
  trend_score: number;
  matchup_score: number;
  ev_percent: number;
  confidence_score: number; // legacy integer sub-score (0-5)
  normalized_confidence: number; // continuous 0.05-0.95 for gatekeeper
  line_value_score: number;
  role_stability: number;
  professional_score: number; // 0-100 canonical scale
  professional_score_raw: number; // 0-25 raw sub-score sum (audit)
  composite_score: number;
  tier: string;
  v2_breakdown?: ComputeScoreV2Result['breakdown'];
  v2_feature_audit?: ComputeScoreV2Result['feature_audit'];
  scoring_engine?: 'v1' | 'v2';
  [key: string]: any;
}

/** Max raw professional_score: 5 sub-scores × 0-5 each = 25 */
const PROFESSIONAL_SCORE_RAW_MAX = 25;

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function useScoringV2(): boolean {
  return process.env.SCORING_ENGINE_V2 === 'true';
}

/**
 * Main scoring entry point.
 * - SCORING_ENGINE_V2=true  → 30-feature V2 pipeline (computeScoreV2)
 * - SCORING_ENGINE_V2=false → legacy 6-feature pipeline (default)
 */
export function applyScoringLogic(prop: any) {
  // Always compute legacy sub-scores (used by normalized_confidence + audit trail)
  const trend_score = calculateTrendScore(prop);
  const matchup_score = calculateMatchupScore(prop);
  const ev_percent_legacy = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({
    trend_score,
    matchup_score,
    ev_percent: ev_percent_legacy,
  });
  const line_value_score = calculateLineValueScore(prop);
  const role_stability = calculateRoleStabilityScore(prop);

  // Raw sum on 0-25 scale (5 sub-scores × 0-5)
  const professional_score_raw =
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0);

  if (useScoringV2()) {
    return applyScoringV2(prop, {
      trend_score,
      matchup_score,
      ev_percent_legacy,
      confidence_score,
      line_value_score,
      role_stability,
      professional_score_raw,
    });
  }

  // ── Legacy path (6 features) ──────────────────────────────────────────────

  // determineTier expects the raw 0-25 scale
  const tier = determineTier(professional_score_raw);

  // Canonical 0-100 scale for PromotionGatekeeper and downstream consumers
  const professional_score = normalizeScore(professional_score_raw, PROFESSIONAL_SCORE_RAW_MAX);

  // Continuous 0-1 confidence for PromotionGatekeeper
  const normalized_confidence = calculateNormalizedConfidence({
    ev_percent: ev_percent_legacy,
    professional_score_raw,
    trend_score,
    matchup_score,
    line_value_score,
    role_stability,
    prop,
  });

  return {
    ...prop,
    trend_score,
    matchup_score,
    ev_percent: ev_percent_legacy,
    confidence_score,
    normalized_confidence,
    line_value_score,
    role_stability,
    professional_score,
    professional_score_raw,
    tier,
    scoring_engine: 'v1' as const,
  };
}

// ── V2 Path (30 features) ─────────────────────────────────────────────────

interface LegacySubScores {
  trend_score: number;
  matchup_score: number;
  ev_percent_legacy: number;
  confidence_score: number;
  line_value_score: number;
  role_stability: number;
  professional_score_raw: number;
}

/**
 * Map raw prop fields to GradingFeatureSet for V2 scoring.
 * Fields not available on the raw prop are left undefined —
 * the Feature Registry handles them via neutral fallback values.
 */
function mapPropToFeatureSet(prop: any, evPercent: number): GradingFeatureSet {
  // Derive hours-to-game from game_time if available
  let hoursToGame: number | undefined;
  if (prop.game_time) {
    const gameTime = new Date(prop.game_time);
    if (!isNaN(gameTime.getTime())) {
      hoursToGame = Math.max(0, (gameTime.getTime() - Date.now()) / (1000 * 60 * 60));
    }
  }

  return {
    expectedValue: evPercent,
    sport: prop.sport,
    league: prop.league || prop.sport,
    player: prop.player_name,
    matchupRating: typeof prop.matchup_quality === 'number' ? prop.matchup_quality : undefined,
    playerForm: typeof prop.trend_confidence === 'number' ? prop.trend_confidence : undefined,
    hoursToGame,
  } as GradingFeatureSet;
}

function applyScoringV2(prop: any, legacy: LegacySubScores) {
  const features = mapPropToFeatureSet(prop, legacy.ev_percent_legacy);
  const v2 = computeScoreV2(features);

  // V2 score is already on 0-100 canonical scale
  const professional_score = v2.score;
  const tier = v2.tier;
  const ev_percent = v2.ev;

  // Normalized confidence: use V2 score mapped to legacy range for formula consistency
  // V2 score / 4 maps 0-100 → 0-25, preserving the same normalization ratio
  const normalized_confidence = calculateNormalizedConfidence({
    ev_percent,
    professional_score_raw: v2.score * 0.25,
    trend_score: legacy.trend_score,
    matchup_score: legacy.matchup_score,
    line_value_score: legacy.line_value_score,
    role_stability: legacy.role_stability,
    prop,
  });

  return {
    ...prop,
    trend_score: legacy.trend_score,
    matchup_score: legacy.matchup_score,
    ev_percent,
    confidence_score: legacy.confidence_score,
    normalized_confidence,
    line_value_score: legacy.line_value_score,
    role_stability: legacy.role_stability,
    professional_score,
    professional_score_raw: legacy.professional_score_raw,
    tier,
    v2_breakdown: v2.breakdown,
    v2_feature_audit: v2.feature_audit,
    scoring_engine: 'v2' as const,
  };
}
