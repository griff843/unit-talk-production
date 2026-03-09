/* eslint-disable security/detect-object-injection, max-lines-per-function, complexity, no-unused-vars, @typescript-eslint/no-unused-vars */
/**
 * NBA Baseline Projection Calculator
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Deterministic baseline calculator for NBA player props.
 * Uses weighted recent average with contextual adjustments.
 *
 * Formula (Points example):
 *   projected_points = weighted_recent_avg * minutes_factor * pace_factor * def_factor * usage_factor
 *
 * Confidence is reduced when inputs are missing.
 */

import {
  PlayerStatsInput,
  ProjectionCalculation,
  ProjectionSourceData,
  ProjectionCalculator,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const NBA_MODEL_VERSION = 'v1.0.0-nba-baseline';

/** Supported stat types for NBA */
export const NBA_STAT_TYPES = [
  'points',
  'rebounds',
  'assists',
  'threes',
  'pts_reb_ast',
  'steals',
  'blocks',
  'pts_reb',
  'pts_ast',
  'reb_ast',
];

/** Weights for recent games (most recent = highest weight) */
const RECENT_GAME_WEIGHTS = [0.25, 0.2, 0.18, 0.15, 0.12, 0.1];

/** Default league averages by stat type */
const LEAGUE_AVERAGES: Record<string, number> = {
  points: 15.0,
  rebounds: 5.5,
  assists: 3.5,
  threes: 1.8,
  pts_reb_ast: 24.0,
  steals: 0.9,
  blocks: 0.6,
  pts_reb: 20.5,
  pts_ast: 18.5,
  reb_ast: 9.0,
};

/** Base confidence when all inputs present */
const BASE_CONFIDENCE = 0.8;

/** Confidence penalties for missing inputs */
const CONFIDENCE_PENALTIES: Record<string, number> = {
  recentGames: 0.25, // No recent games = major penalty
  minutesProjection: 0.1,
  usageRate: 0.05,
  paceAdjustment: 0.05,
  opponentDefRating: 0.05,
  seasonAvg: 0.1,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Round to fixed decimal places */
function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Calculate weighted average of recent games */
function calculateWeightedRecentAvg(games: Array<{ statValue: number }>): number {
  if (!games || games.length === 0) {
    return 0;
  }

  let weightSum = 0;
  let valueSum = 0;

  for (let i = 0; i < games.length && i < RECENT_GAME_WEIGHTS.length; i++) {
    const weight = RECENT_GAME_WEIGHTS[i] ?? 0.05;
    weightSum += weight;
    valueSum += (games[i]?.statValue ?? 0) * weight;
  }

  return weightSum > 0 ? valueSum / weightSum : 0;
}

// ============================================================================
// NBA CALCULATOR
// ============================================================================

/**
 * Calculate NBA baseline projection
 *
 * @param input - Player stats input
 * @returns Projection calculation result
 */
export function calculateNbaProjection(input: PlayerStatsInput): ProjectionCalculation {
  const {
    playerName,
    statType,
    gameDate,
    opponent,
    recentGames,
    seasonAvg,
    minutesProjection,
    usageRate,
    paceAdjustment,
    opponentDefRating,
  } = input;

  const flags: string[] = [];
  const inputsAvailable: string[] = [];
  const inputsMissing: string[] = [];
  let confidence = BASE_CONFIDENCE;

  // Track available inputs
  if (recentGames && recentGames.length > 0) {
    inputsAvailable.push('recentGames');
  } else {
    inputsMissing.push('recentGames');
    confidence -= CONFIDENCE_PENALTIES.recentGames;
    flags.push('no_recent_games');
  }

  if (seasonAvg !== undefined && seasonAvg > 0) {
    inputsAvailable.push('seasonAvg');
  } else {
    inputsMissing.push('seasonAvg');
    confidence -= CONFIDENCE_PENALTIES.seasonAvg;
  }

  if (minutesProjection !== undefined) {
    inputsAvailable.push('minutesProjection');
  } else {
    inputsMissing.push('minutesProjection');
    confidence -= CONFIDENCE_PENALTIES.minutesProjection;
  }

  if (usageRate !== undefined) {
    inputsAvailable.push('usageRate');
  } else {
    inputsMissing.push('usageRate');
    confidence -= CONFIDENCE_PENALTIES.usageRate;
  }

  if (paceAdjustment !== undefined) {
    inputsAvailable.push('paceAdjustment');
  } else {
    inputsMissing.push('paceAdjustment');
    confidence -= CONFIDENCE_PENALTIES.paceAdjustment;
  }

  if (opponentDefRating !== undefined) {
    inputsAvailable.push('opponentDefRating');
  } else {
    inputsMissing.push('opponentDefRating');
    confidence -= CONFIDENCE_PENALTIES.opponentDefRating;
  }

  // Calculate base value
  let baseValue: number;
  let method: string;

  if (recentGames && recentGames.length >= 3) {
    // Weighted recent average (preferred)
    baseValue = calculateWeightedRecentAvg(recentGames);
    method = 'weighted_recent_avg';
  } else if (seasonAvg !== undefined && seasonAvg > 0) {
    // Fall back to season average
    baseValue = seasonAvg;
    method = 'season_avg';
    flags.push('fallback_season_avg');
  } else {
    // Fall back to league average (lowest confidence)
    const normalizedStatType = statType.toLowerCase().replace(/[^a-z_]/g, '');
    baseValue = LEAGUE_AVERAGES[normalizedStatType] ?? LEAGUE_AVERAGES['points'] ?? 15.0;
    method = 'league_avg';
    flags.push('fallback_league_avg');
    confidence = Math.max(confidence - 0.2, 0.1);
  }

  // Apply contextual factors
  let projectedValue = baseValue;
  let minutesFactor = 1.0;
  let paceFactor = 1.0;
  let defFactor = 1.0;
  let usageFactor = 1.0;

  // Minutes factor (if projection available)
  if (minutesProjection !== undefined && recentGames && recentGames.length > 0) {
    // Calculate average minutes from recent games
    const avgMinutes =
      recentGames.reduce((sum, g) => sum + (g.minutes ?? 30), 0) / recentGames.length;
    if (avgMinutes > 0) {
      minutesFactor = minutesProjection / avgMinutes;
      minutesFactor = clamp(minutesFactor, 0.7, 1.3); // Cap adjustment
      projectedValue *= minutesFactor;
    }
  }

  // Pace factor (team pace vs opponent pace)
  if (paceAdjustment !== undefined) {
    // paceAdjustment > 1 means faster game expected
    paceFactor = paceAdjustment;
    paceFactor = clamp(paceFactor, 0.9, 1.15); // Cap adjustment
    projectedValue *= paceFactor;
  }

  // Opponent defensive factor
  if (opponentDefRating !== undefined) {
    // defRating > 110 = bad defense (good for offense)
    // defRating < 105 = good defense (bad for offense)
    const leagueAvgDef = 112.0;
    defFactor = opponentDefRating / leagueAvgDef;
    defFactor = clamp(defFactor, 0.85, 1.15); // Cap adjustment
    projectedValue *= defFactor;
  }

  // Usage rate factor (for points, assists)
  if (usageRate !== undefined && (statType === 'points' || statType === 'assists')) {
    // Average NBA usage rate is ~20%
    const avgUsage = 0.2;
    usageFactor = usageRate / avgUsage;
    usageFactor = clamp(usageFactor, 0.85, 1.25); // Cap adjustment
    projectedValue *= usageFactor;
  }

  // Ensure positive and reasonable value
  projectedValue = Math.max(projectedValue, 0.5);
  projectedValue = roundTo(projectedValue, 1);

  // Ensure confidence is within bounds
  confidence = clamp(confidence, 0.1, 0.95);
  confidence = roundTo(confidence, 3);

  const sourceData: ProjectionSourceData = {
    recentAvg:
      recentGames && recentGames.length > 0
        ? roundTo(calculateWeightedRecentAvg(recentGames), 2)
        : undefined,
    recentGamesUsed: recentGames?.length ?? 0,
    seasonAvg: seasonAvg !== undefined ? roundTo(seasonAvg, 2) : undefined,
    minutesFactor: minutesFactor !== 1.0 ? roundTo(minutesFactor, 3) : undefined,
    paceFactor: paceFactor !== 1.0 ? roundTo(paceFactor, 3) : undefined,
    defFactor: defFactor !== 1.0 ? roundTo(defFactor, 3) : undefined,
    usageFactor: usageFactor !== 1.0 ? roundTo(usageFactor, 3) : undefined,
    method,
    inputsAvailable,
    inputsMissing,
  };

  return {
    playerName,
    sport: 'NBA',
    statType: statType.toLowerCase(),
    gameDate,
    projectedValue,
    confidence,
    modelVersion: NBA_MODEL_VERSION,
    sourceData,
    flags,
  };
}

// ============================================================================
// CALCULATOR INTERFACE
// ============================================================================

export const NbaCalculator: ProjectionCalculator = {
  sport: 'NBA',
  supportedStatTypes: NBA_STAT_TYPES,
  calculate: calculateNbaProjection,
};

export default NbaCalculator;
