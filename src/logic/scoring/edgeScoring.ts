// src/scoring/edgeScore.ts

import { PropObject } from '../../types/propTypes';
import { EDGE_CONFIG } from '../config/edgeConfig';

export type ScoreBreakdown = Record<string, number | string>;

export function finalEdgeScore(
  prop: PropObject,
  config: typeof EDGE_CONFIG,
  adminOverrideTier?: string | null
): {
  score: number;
  tier: string;
  tags: string[];
  breakdown: ScoreBreakdown;
  postable: boolean;
  solo_lock: boolean;
} {
  let score = 0,
    breakdown: ScoreBreakdown = {},
    tags: string[] = [];

  // Market type bonus
  const marketMod = config.market[prop.market_type] ?? config.market.default;
  score += marketMod;
  breakdown.market_type = marketMod;

  // Odds logic
  if (prop.odds !== undefined) {
    if (prop.odds < config.odds.threshold) {
      score += config.odds.high;
      breakdown.odds = config.odds.high;
    }
  }

  // Trend score
  if (prop.trend_score !== undefined && prop.trend_score > config.trend_score.threshold) {
    score += config.trend_score.strong;
    breakdown.trend_score = config.trend_score.strong;
  }

  // Matchup score
  if (prop.matchup_score !== undefined && prop.matchup_score > config.matchup_score.threshold) {
    score += config.matchup_score.strong;
    breakdown.matchup_score = config.matchup_score.strong;
  }

  // Role score
  if (prop.role_score !== undefined && prop.role_score > config.role_score.threshold) {
    score += config.role_score.strong;
    breakdown.role_score = config.role_score.strong;
  }

  // Source bonus
  if (prop.source && config.source[prop.source]) {
    score += config.source[prop.source];
    breakdown.source = config.source[prop.source];
  }

  // Line value
  if (prop.line_value_score !== undefined && prop.line_value_score > config.line_value_score.threshold) {
    score += config.line_value_score.strong;
    breakdown.line_value_score = config.line_value_score.strong;
  }

  // Tags + boosts
  if (prop.is_rocket) {
    score += config.tags.rocket;
    tags.push('rocket');
    breakdown.is_rocket = config.tags.rocket;
  }
  if (prop.is_ladder) {
    score += config.tags.ladder;
    tags.push('ladder');
    breakdown.is_ladder = config.tags.ladder;
  }

  // Clamp score
  score = Math.min(config.max, Math.max(0, score));
  breakdown.total = score;

  // Determine tier
  let tier = '';
  if (adminOverrideTier && typeof adminOverrideTier === 'string') {
    tier = adminOverrideTier;
    breakdown.override = `Forced to ${tier}`;
  } else {
    tier = score >= 23 ? 'S'
      : score >= 20 ? 'A'
      : score >= 15 ? 'B'
      : score >= 10 ? 'C'
      : 'D';
  }

  // Postable + Solo Lock Logic
  const postable = ['S', 'A'].includes(tier);
  const solo_lock = tier === 'S';

  return { score, tier, tags, breakdown, postable, solo_lock };
}

// Export alias for ScoringAgent compatibility
export function scorePropEdge(prop: PropObject): {
  edge_score: number;
  tier: string;
  context_tags: string[];
  edge_breakdown: ScoreBreakdown;
} {
  const result = finalEdgeScore(prop, EDGE_CONFIG);
  return {
    edge_score: result.score,
    tier: result.tier,
    context_tags: result.tags,
    edge_breakdown: result.breakdown
  };
}