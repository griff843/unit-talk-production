// src/scoring/edgeScore.ts

import { PropObject } from '../../types/propTypes';
import { EDGE_CONFIG } from '../config/edgeConfig';
import { 
  zoneThreatRating, 
  calculateZoneThreatBoost, 
  logZoneThreatDecision,
  type PitcherStats,
  type MatchupData 
} from '../zoneThreat';

export type ScoreBreakdown = Record<string, number | string>;

/**
 * Extracts pitcher statistics from prop object
 * Returns null if insufficient data for Zone Threat analysis
 */
function extractPitcherStats(prop: PropObject): PitcherStats | null {
  // Check if prop has pitcher data (these fields would be populated by data pipeline)
  if (!prop['pitcher_id'] || !prop['pitcher_name']) {
    return null;
  }

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  return {
    pitcherId: typeof prop['pitcher_id'] === 'string' ? prop['pitcher_id'] : String(prop['pitcher_id'] || ''),
    name: typeof prop['pitcher_name'] === 'string' ? prop['pitcher_name'] : String(prop['pitcher_name'] || ''),
    hrPer9: toNumber(prop['pitcher_hr_per_9']),
    barrelPercent: toNumber(prop['pitcher_barrel_pct']),
    meatballPercent: toNumber(prop['pitcher_meatball_pct']),
    hittableCountPct: toNumber(prop['pitcher_hittable_count_pct']),
    recentHRs: toNumber(prop['pitcher_recent_hrs']),
    walkRate: toNumber(prop['pitcher_walk_rate'])
  };
}

/**
 * Extracts matchup data from prop object
 * Returns null if insufficient data for matchup analysis
 */
function extractMatchupData(prop: PropObject): MatchupData | null {
  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const toBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  };

  // Check if prop has batter and conditions data
  if (prop['batter_barrel_pct'] === undefined || prop['batter_launch_angle'] === undefined) {
    return null;
  }

  return {
    batterBarrel: toNumber(prop['batter_barrel_pct']),
    batterLaunch: toNumber(prop['batter_launch_angle']),
    parkFactor: toNumber(prop['park_factor']) || 1.0,
    windOut: toBoolean(prop['wind_out'])
  };
}

/**
 * Determines if prop is eligible for Zone Threat Rating analysis
 */
function isZoneThreatEligible(prop: PropObject): boolean {
  if (!EDGE_CONFIG.zoneThreat.enabled) {
    return false;
  }

  // Check if market type is eligible for Zone Threat boost
  const eligibleMarkets = EDGE_CONFIG.zoneThreat.hrMarkets;
  const marketEligible = eligibleMarkets.includes(prop['market_type']) || prop['is_rocket'] === true;

  if (!marketEligible) {
    return false;
  }

  // Check if required pitcher data is present
  const hasPitcherData = prop['pitcher_id'] && prop['pitcher_name'] &&
    typeof prop['pitcher_hr_per_9'] === 'number' &&
    typeof prop['pitcher_barrel_pct'] === 'number';

  if (!hasPitcherData) {
    return false;
  }

  // Check if required matchup data is present
  const hasMatchupData = typeof prop['batter_barrel_pct'] === 'number' &&
    typeof prop['batter_launch_angle'] === 'number';

  if (!hasMatchupData) {
    return false;
  }

  return true;
}

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
  const marketMod = config.market[prop['market_type']] ?? config.market['default'];
  score += marketMod!;
  breakdown['market_type'] = marketMod!;

  // Odds logic
  if (prop['odds'] !== undefined) {
    if (prop['odds'] < config.odds.threshold) {
      score += config.odds.high;
      breakdown['odds'] = config.odds.high;
    }
  }

  // Trend score
  if (prop['trend_score'] !== undefined && prop['trend_score'] > config.trend_score.threshold) {
    score += config.trend_score.strong;
    breakdown['trend_score'] = config.trend_score.strong;
  }

  // Matchup score
  if (prop['matchup_score'] !== undefined && prop['matchup_score'] > config.matchup_score.threshold) {
    score += config.matchup_score.strong;
    breakdown['matchup_score'] = config.matchup_score.strong;
  }

  // Role score
  if (prop['role_score'] !== undefined && prop['role_score'] > config.role_score.threshold) {
    score += config.role_score.strong;
    breakdown['role_score'] = config.role_score.strong;
  }

  // Source bonus
  if (prop['source'] && config.source[prop['source']]) {
    score += config.source[prop['source']]!;
    breakdown['source'] = config.source[prop['source']]!;
  }

  // Line value
  if (prop['line_value_score'] !== undefined && prop['line_value_score'] > config.line_value_score.threshold) {
    score += config.line_value_score.strong;
    breakdown['line_value_score'] = config.line_value_score.strong;
  }

  // Tags + boosts
  if (prop['is_rocket']) {
    score += config.tags.rocket;
    tags.push('rocket');
    breakdown['is_rocket'] = config.tags.rocket;
  }
  if (prop['is_ladder']) {
    score += config.tags.ladder;
    tags.push('ladder');
    breakdown['is_ladder'] = config.tags.ladder;
  }

  // ZONE THREAT RATING ANALYSIS (INTERNAL ONLY)
  // This boost is NOT exposed in public messages or Discord
  if (isZoneThreatEligible(prop)) {
    const pitcherStats = extractPitcherStats(prop);
    const matchupData = extractMatchupData(prop);

    if (pitcherStats && matchupData) {
      const zoneThreatBoost = calculateZoneThreatBoost(pitcherStats, matchupData);

      if (zoneThreatBoost > 0) {
        score += zoneThreatBoost;
        breakdown['zone_threat_boost'] = zoneThreatBoost;
        tags.push('zone-threat-extreme'); // Internal tag only

        // Internal logging for analysis (not exposed publicly)
        if (config.zoneThreat.logDecisions) {
          logZoneThreatDecision(pitcherStats, matchupData, prop['id']);
        }
      }

      // Add zone threat level to breakdown for internal analysis
      const threatLevel = zoneThreatRating(pitcherStats);
      breakdown['zone_threat_level'] = threatLevel;
    }
  }

  // Clamp score
  score = Math.min(config.max, Math.max(0, score));
  breakdown['total'] = score;

  // Determine tier
  let tier = '';
  if (adminOverrideTier && typeof adminOverrideTier === 'string') {
    tier = adminOverrideTier;
    breakdown['override'] = `Forced to ${tier}`;
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
  
  // Filter out internal-only tags before returning
  const publicTags = result.tags.filter(tag => !tag.startsWith('zone-threat'));
  
  // Create public breakdown (remove internal Zone Threat details)
  const publicBreakdown = { ...result.breakdown };
  delete publicBreakdown['zone_threat_boost'];
  delete publicBreakdown['zone_threat_level'];

  return {
    edge_score: result.score,
    tier: result.tier,
    context_tags: publicTags,
    edge_breakdown: publicBreakdown
  };
}

/**
 * INTERNAL ONLY: Get full scoring details including Zone Threat analysis
 * This function exposes Zone Threat data for internal review and logging
 * DO NOT use this for public-facing features
 */
export function getInternalScoringDetails(prop: PropObject): {
  score: number;
  tier: string;
  tags: string[];
  breakdown: ScoreBreakdown;
  postable: boolean;
  solo_lock: boolean;
  zoneThreatAnalysis?: {
    eligible: boolean;
    threatLevel?: string;
    boostApplied?: number;
    pitcherName?: string;
  };
} {
  const result = finalEdgeScore(prop, EDGE_CONFIG);

  // Add Zone Threat analysis details for internal use
  let zoneThreatAnalysis;
  if (isZoneThreatEligible(prop)) {
    const pitcherStats = extractPitcherStats(prop);
    zoneThreatAnalysis = {
      eligible: true,
      ...(result.breakdown['zone_threat_level'] && { threatLevel: result.breakdown['zone_threat_level'] as string }),
      ...(result.breakdown['zone_threat_boost'] !== undefined && { boostApplied: result.breakdown['zone_threat_boost'] as number || 0 }),
      ...(pitcherStats?.name && { pitcherName: pitcherStats.name })
    };
  } else {
    zoneThreatAnalysis = { eligible: false };
  }
  
  return {
    ...result,
    zoneThreatAnalysis
  };
}