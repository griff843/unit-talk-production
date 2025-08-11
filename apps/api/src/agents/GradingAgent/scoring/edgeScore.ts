// src/scoring/edgeScore.ts

type RawProp = {
  league: 'NBA' | 'MLB' | 'NHL';
  odds: number;
  statType?: string;
  dvp_score?: number;
  position?: string;
  context_flag?: boolean;
};

export function gradePick(prop: RawProp): {
  score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  breakdown: Record<string, any>;
} {
  let professional_score = 0;
  // League-specific logic
  if (prop.league === 'NBA') {
    if (prop.odds >= -125 && prop.odds <= 115) {professional_score += 1;}
    if (['points', 'rebounds', 'assists', '3PM'].includes((prop.statType || '').toLowerCase())) {professional_score += 1;}
    if (typeof prop.dvp_score === 'number' && prop.dvp_score >= 1) {professional_score += 1;}
    if (['PG', 'SG', 'SF', 'PF', 'C'].includes(prop.position || '')) {professional_score += 1;}
    if (!prop.context_flag) {professional_score += 1;}
  } else if (prop.league === 'MLB') {
    if (prop.odds >= -130 && prop.odds <= 120) {professional_score += 1;}
    if (['hits', 'total_bases', 'rbis'].includes((prop.statType || '').toLowerCase())) {professional_score += 1;}
    if (typeof prop.dvp_score === 'number' && prop.dvp_score >= 1) {professional_score += 1;}
    if (['1B', '2B', 'SS', '3B', 'OF', 'C', 'P'].includes(prop.position || '')) {professional_score += 1;}
    if (!prop.context_flag) {professional_score += 1;}
  } else if (prop.league === 'NHL') {
    if (prop.odds >= -140 && prop.odds <= 130) {professional_score += 1;}
    if (['goals', 'shots_on_goal', 'assists'].includes((prop.statType || '').toLowerCase())) {professional_score += 1;}
    if (typeof prop.dvp_score === 'number' && prop.dvp_score >= 1) {professional_score += 1;}
    if (['LW', 'RW', 'C', 'D', 'G'].includes(prop.position || '')) {professional_score += 1;}
    if (!prop.context_flag) {professional_score += 1;}
  }
  let tier: 'S' | 'A' | 'B' | 'C' = 'C';
  if (professional_score >= 5) {tier = 'S';}
  else if (professional_score === 4) {tier = 'A';}
  else if (professional_score === 3) {tier = 'B';}
  return { score: professional_score, tier, breakdown: { league: prop.league, logic: 'modular edge scoring' } };
}
