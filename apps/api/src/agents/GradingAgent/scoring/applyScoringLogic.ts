import { calculateConfidenceScore } from './confidenceScore';
import { determineTier } from './determineTier';
import { calculateExpectedValue } from './expectedValue';
import { calculateLineValueScore } from './lineValueScore';
import { calculateMatchupScore } from './matchupScore';
import { calculateRoleStabilityScore } from './roleStabilityScore';
import { calculateTrendScore } from './trendScore';

export interface ScoringResult {
  trend_score: number;
  matchup_score: number;
  ev_percent: number;
  confidence_score: number;
  line_value_score: number;
  role_stability: number;
  composite_score: number;
  tier: string;
  [key: string]: any;
}

export function applyScoringLogic(prop: any) {
  const trend_score = calculateTrendScore(prop);
  const matchup_score = calculateMatchupScore(prop);
  const ev_percent = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({
    trend_score,
    matchup_score,
    ev_percent
  });
  const line_value_score = calculateLineValueScore(prop);
  const role_stability = calculateRoleStabilityScore(prop);

  const professional_score = 
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0);

  const tier = determineTier(professional_score);

  return {
    ...prop,
    trend_score,
    matchup_score,
    ev_percent,
    confidence_score,
    line_value_score,
    role_stability,
    professional_score,
    tier,
  };
}
