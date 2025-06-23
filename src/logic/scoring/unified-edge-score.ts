// src/logic/scoring/unified-edge-score.ts
import { PropObject } from '../../types/propTypes';
import { RawProp } from '../../types/rawProps';

// Import league-specific rules
import { nbaCoreStats, nbaSynergy } from './rules/nba';
import { mlbCoreStats, mlbSynergy } from './rules/mlb';
import { nhlCoreStats, nhlSynergy } from './rules/nhl';
import { nflCoreStats, nflSynergy } from './rules/nfl';

// Version tracking for scoring algorithm
export const EDGE_SCORING_VERSION = {
  CURRENT: 2,
  LEGACY: 1,
  MINIMUM_SUPPORTED: 1
};

// Type definitions
export type ScoreBreakdown = Record<string, number | string>;

export interface EdgeScoreResult {
  score: number;
  tier: string;
  tags: string[];
  breakdown: ScoreBreakdown;
  postable: boolean;
  solo_lock: boolean;
  version: number;
}

export interface EdgeScoreConfig {
  version?: number;
  market: Record<string, number>;
  odds: {
    threshold: number;
    high: number;
  };
  trend_score: {
    threshold: number;
    strong: number;
  };
  matchup_score: {
    threshold: number;
    strong: number;
  };
  role_score: {
    threshold: number;
    strong: number;
  };
  line_value_score: {
    threshold: number;
    strong: number;
  };
  source: Record<string, number>;
  tags: Record<string, number>;
  max: number;
  tier_thresholds: {
    S: number;
    A: number;
    B: number;
    C: number;
  };
}

// Default configuration
export const DEFAULT_EDGE_CONFIG: EdgeScoreConfig = {
  version: EDGE_SCORING_VERSION.CURRENT,
  market: {
    'points': 5,
    'rebounds': 4,
    'assists': 4,
    '3PM': 3,
    'PRA': 2,
    'default': 1
  },
  odds: {
    threshold: -125,
    high: 3
  },
  trend_score: {
    threshold: 0.7,
    strong: 4
  },
  matchup_score: {
    threshold: 0.6,
    strong: 3
  },
  role_score: {
    threshold: 0.5,
    strong: 2
  },
  line_value_score: {
    threshold: 0.6,
    strong: 3
  },
  source: {
    'premium': 2,
    'verified': 1,
    'standard': 0
  },
  tags: {
    'rocket': 3,
    'ladder': 2,
    'value': 1
  },
  max: 100,
  tier_thresholds: {
    S: 85,
    A: 75,
    B: 65,
    C: 55
  }
};

/**
 * Unified edge scoring function that combines all scoring logic
 * @param prop - The prop to score
 * @param config - Configuration for scoring algorithm
 * @param options - Additional options
 * @returns Complete edge score result
 */
export function unifiedEdgeScore(
  prop: PropObject | RawProp,
  config: EdgeScoreConfig = DEFAULT_EDGE_CONFIG,
  options: {
    adminOverrideTier?: string | null;
    useLeagueRules?: boolean;
    useLegacyScoring?: boolean;
  } = {}
): EdgeScoreResult {
  // Use requested version or default to current
  const version = options.useLegacyScoring ? EDGE_SCORING_VERSION.LEGACY : (config.version || EDGE_SCORING_VERSION.CURRENT);
  
  let score = 0;
  const breakdown: ScoreBreakdown = {};
  const tags: string[] = [];

  // Apply league-specific rules if requested
  if (options.useLeagueRules) {
    const leagueScore = calculateLeagueSpecificScore(prop);
    score += leagueScore.score;
    breakdown.league_rules = leagueScore.score;
    Object.assign(breakdown, leagueScore.breakdown);
  }

  // Apply market type bonus
  const marketType = (prop as PropObject).market_type || (prop as RawProp).stat_type || 'default';
  const marketMod = config.market[marketType.toLowerCase()] ?? config.market.default;
  score += marketMod;
  breakdown.market_type = marketMod;

  // Odds logic
  const odds = (prop as PropObject).odds || (prop as RawProp).odds;
  if (odds !== undefined) {
    if (odds < config.odds.threshold) {
      score += config.odds.high;
      breakdown.odds = config.odds.high;
    }
  }

  // Trend score
  const trendScore = (prop as PropObject).trend_score;
  if (trendScore !== undefined && trendScore > config.trend_score.threshold) {
    score += config.trend_score.strong;
    breakdown.trend_score = config.trend_score.strong;
  }

  // Matchup score
  const matchupScore = (prop as PropObject).matchup_score || (prop as RawProp).dvp_score;
  if (matchupScore !== undefined && matchupScore > config.matchup_score.threshold) {
    score += config.matchup_score.strong;
    breakdown.matchup_score = config.matchup_score.strong;
  }

  // Role score
  const roleScore = (prop as PropObject).role_score;
  if (roleScore !== undefined && roleScore > config.role_score.threshold) {
    score += config.role_score.strong;
    breakdown.role_score = config.role_score.strong;
  }

  // Source bonus
  const source = (prop as PropObject).source || (prop as RawProp).provider;
  if (source && config.source[source]) {
    score += config.source[source];
    breakdown.source = config.source[source];
  }

  // Line value
  const lineValueScore = (prop as PropObject).line_value_score;
  if (lineValueScore !== undefined && lineValueScore > config.line_value_score.threshold) {
    score += config.line_value_score.strong;
    breakdown.line_value_score = config.line_value_score.strong;
  }

  // Tags + boosts
  if ((prop as PropObject).is_rocket) {
    score += config.tags.rocket;
    tags.push('rocket');
    breakdown.is_rocket = config.tags.rocket;
  }
  if ((prop as PropObject).is_ladder) {
    score += config.tags.ladder;
    tags.push('ladder');
    breakdown.is_ladder = config.tags.ladder;
  }

  // Context flag (lower score if present)
  const contextFlag = (prop as RawProp).context_flag;
  if (contextFlag === false) {
    score += 1;
    breakdown.no_context_flag = 1;
  }

  // Clamp score
  score = Math.min(config.max, Math.max(0, score));
  breakdown.total = score;

  // Determine tier
  let tier = '';
  if (options.adminOverrideTier && typeof options.adminOverrideTier === 'string') {
    tier = options.adminOverrideTier;
    breakdown.override = `Forced to ${tier}`;
  } else {
    tier = determineTier(score, config);
  }

  // Postable + Solo Lock Logic
  const postable = ['S', 'A'].includes(tier);
  const solo_lock = tier === 'S';

  return {
    score,
    tier,
    tags,
    breakdown,
    postable,
    solo_lock,
    version
  };
}

/**
 * Calculate league-specific score based on rules from edgeScoreEngine.ts
 */
function calculateLeagueSpecificScore(prop: PropObject | RawProp): { score: number; breakdown: ScoreBreakdown } {
  const league = ((prop as PropObject).league || (prop as RawProp).league || '').toUpperCase();
  let score = 0;
  const breakdown: ScoreBreakdown = {};
  // League-specific scoring functions
  let coreStatsFunc: ((prop: PropObject) => ScoreBreakdown) | null = null;
  let synergyFunc: ((prop: PropObject) => ScoreBreakdown) | null = null;

  // Set league-specific rules
  if (league === 'NBA') {
    coreStatsFunc = nbaCoreStats;
    synergyFunc = nbaSynergy;
  } else if (league === 'MLB') {
    coreStatsFunc = mlbCoreStats;
    synergyFunc = mlbSynergy;
  } else if (league === 'NHL') {
    coreStatsFunc = nhlCoreStats;
    synergyFunc = nhlSynergy;
  } else if (league === 'NFL') {
    coreStatsFunc = nflCoreStats;
    synergyFunc = nflSynergy;
  }

  // 1. Odds sweet-spot
  const odds = (prop as PropObject).odds || (prop as RawProp).odds ||
               (prop as RawProp).over_odds || (prop as RawProp).under_odds || 0;
  if (odds >= -125 && odds <= 115) {
    score += 1;
    breakdown.odds_sweet_spot = 1;
  }

  // 2. Core stat type - use league-specific function
  if (coreStatsFunc) {
    const coreBreakdown = coreStatsFunc(prop as PropObject);
    const coreScore = Object.values(coreBreakdown).reduce((sum: number, val) =>
      sum + (typeof val === 'number' ? val : 0), 0);
    if (coreScore > 0) {
      score += Math.min(coreScore, 2); // Cap at 2 points
      breakdown.core_stats = coreScore;
    }
  }

  // 3. DVP or matchup score
  const dvpScore = (prop as PropObject).matchup_score || (prop as RawProp).dvp_score;
  if (typeof dvpScore === 'number' && dvpScore >= 1) {
    score += 1;
    breakdown.dvp_score = 1;
  }

  // 4. Synergy - use league-specific function
  if (synergyFunc) {
    const synergyBreakdown = synergyFunc(prop as PropObject);
    const synergyScore = Object.values(synergyBreakdown).reduce((sum: number, val) =>
      sum + (typeof val === 'number' ? val : 0), 0);
    if (synergyScore > 0) {
      score += Math.min(synergyScore, 2); // Cap at 2 points
      breakdown.synergy = synergyScore;
    }
  }

  // 5. No injury/context flag
  const contextFlag = (prop as RawProp).context_flag;
  if (contextFlag === false) {
    score += 1;
    breakdown.no_context_flag = 1;
  }

  return { score, breakdown };
}

/**
 * Determine tier based on score and config thresholds
 */
function determineTier(score: number, config: EdgeScoreConfig): string {
  if (score >= config.tier_thresholds.S) return 'S';
  if (score >= config.tier_thresholds.A) return 'A';
  if (score >= config.tier_thresholds.B) return 'B';
  if (score >= config.tier_thresholds.C) return 'C';
  return 'D';
}

/**
 * Legacy compatibility function for finalEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
export function finalEdgeScore(
  prop: PropObject,
  config: any,
  adminOverrideTier?: string | null
): {
  score: number;
  tier: string;
  tags: string[];
  breakdown: ScoreBreakdown;
  postable: boolean;
  solo_lock: boolean;
} {
  const result = unifiedEdgeScore(prop, config, { adminOverrideTier, useLegacyScoring: true });
  // Remove version to match legacy return type
  const { version, ...legacyResult } = result;
  return legacyResult;
}

/**
 * Legacy compatibility function for gradePick
 * @deprecated Use unifiedEdgeScore instead
 */
export function gradePick(prop: any): {
  score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  breakdown: Record<string, any>;
} {
  const result = unifiedEdgeScore(prop, DEFAULT_EDGE_CONFIG, { useLeagueRules: true });
  return {
    score: result.score,
    tier: result.tier as 'S' | 'A' | 'B' | 'C',
    breakdown: result.breakdown
  };
}

/**
 * Legacy compatibility function for calculateEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
export function calculateEdgeScore(prop: RawProp): number {
  const result = calculateLeagueSpecificScore(prop);
  return result.score;
}

/**
 * Legacy compatibility function for scorePropEdge
 * @deprecated Use unifiedEdgeScore instead
 */
export function scorePropEdge(prop: PropObject): {
  edge_score: number;
  tier: string;
  context_tags: string[];
  edge_breakdown: ScoreBreakdown;
} {
  const result = unifiedEdgeScore(prop, DEFAULT_EDGE_CONFIG);
  return {
    edge_score: result.score,
    tier: result.tier,
    context_tags: result.tags,
    edge_breakdown: result.breakdown
  };
}
