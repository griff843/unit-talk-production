import { calculateTrendScore } from './trendScore';
import { calculateMatchupScore } from './matchupScore';
import { calculateExpectedValue } from './expectedValue';
import { calculateConfidenceScore } from './confidenceScore';
import { calculateLineValueScore } from './lineValueScore';
import { calculateRoleStabilityScore } from './roleStabilityScore';
import { determineTier } from './determineTier';

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

  const composite_score = 
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0);

  const tier = determineTier(composite_score);

  return {
    ...prop,
    trend_score,
    matchup_score,
    ev_percent,
    confidence_score,
    line_value_score,
    role_stability,
    composite_score,
    tier,
  };
}
