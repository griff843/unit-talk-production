/* eslint-disable security/detect-object-injection, max-lines-per-function, complexity */
/**
 * MLB Baseline Projection Calculator
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Deterministic baseline calculator for MLB player props.
 * Supports pitcher strikeouts and batter props.
 *
 * Formula (Pitcher Ks example):
 *   projected_ks = (k_per_9 / 9) * expected_batters_faced * opponent_k_rate_factor * park_factor
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

export const MLB_MODEL_VERSION = 'v1.0.0-mlb-baseline';

/** Supported stat types for MLB */
export const MLB_STAT_TYPES = [
  'strikeouts', // Pitcher Ks
  'hits', // Batter hits
  'total_bases', // Batter total bases
  'runs', // Batter runs
  'rbis', // Batter RBIs
  'home_runs', // Batter HRs
  'walks', // Batter walks
  'stolen_bases', // Batter SBs
  'hits_runs_rbis', // Batter combo
  'outs_recorded', // Pitcher outs
  'earned_runs', // Pitcher ERs
];

/** Weights for recent games (most recent = highest weight) */
const RECENT_GAME_WEIGHTS = [0.3, 0.25, 0.2, 0.15, 0.1];

/** Default league averages by stat type */
const LEAGUE_AVERAGES: Record<string, number> = {
  strikeouts: 5.5, // SP K avg
  hits: 1.0, // Batter hits avg
  total_bases: 1.5, // Batter TB avg
  runs: 0.5, // Batter runs avg
  rbis: 0.6, // Batter RBI avg
  home_runs: 0.15, // Batter HR avg
  walks: 0.35, // Batter BB avg
  stolen_bases: 0.1, // Batter SB avg
  hits_runs_rbis: 2.1, // H+R+RBI avg
  outs_recorded: 18.0, // 6 IP avg
  earned_runs: 3.0, // Pitcher ER avg
};

/** Base confidence when all inputs present */
const BASE_CONFIDENCE = 0.75;

/** Confidence penalties for missing inputs */
const CONFIDENCE_PENALTIES: Record<string, number> = {
  recentGames: 0.25,
  pitcherKPer9: 0.15,
  opponentKRate: 0.1,
  expectedBattersFaced: 0.1,
  parkFactor: 0.05,
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
// MLB CALCULATOR - STRIKEOUTS
// ============================================================================

/**
 * Calculate pitcher strikeouts projection
 *
 * Formula: (K/9 / 9) * expected_batters_faced * opponent_k_rate_adjustment * park_factor
 */
function calculateStrikeoutsProjection(input: PlayerStatsInput): ProjectionCalculation {
  const {
    playerName,
    statType,
    gameDate,
    recentGames,
    seasonAvg,
    pitcherKPer9,
    opponentKRate,
    expectedBattersFaced,
    parkFactor,
  } = input;

  const flags: string[] = [];
  const inputsAvailable: string[] = [];
  const inputsMissing: string[] = [];
  let confidence = BASE_CONFIDENCE;

  // Track inputs
  if (recentGames && recentGames.length > 0) {
    inputsAvailable.push('recentGames');
  } else {
    inputsMissing.push('recentGames');
    confidence -= CONFIDENCE_PENALTIES.recentGames;
    flags.push('no_recent_games');
  }

  if (pitcherKPer9 !== undefined) {
    inputsAvailable.push('pitcherKPer9');
  } else {
    inputsMissing.push('pitcherKPer9');
    confidence -= CONFIDENCE_PENALTIES.pitcherKPer9;
  }

  if (opponentKRate !== undefined) {
    inputsAvailable.push('opponentKRate');
  } else {
    inputsMissing.push('opponentKRate');
    confidence -= CONFIDENCE_PENALTIES.opponentKRate;
  }

  if (expectedBattersFaced !== undefined) {
    inputsAvailable.push('expectedBattersFaced');
  } else {
    inputsMissing.push('expectedBattersFaced');
    confidence -= CONFIDENCE_PENALTIES.expectedBattersFaced;
  }

  if (parkFactor !== undefined) {
    inputsAvailable.push('parkFactor');
  } else {
    inputsMissing.push('parkFactor');
    confidence -= CONFIDENCE_PENALTIES.parkFactor;
  }

  // Calculate base value
  let projectedValue: number;
  let method: string;

  if (pitcherKPer9 !== undefined && expectedBattersFaced !== undefined) {
    // Best method: K/9 * batters faced
    const kPerBatter = pitcherKPer9 / 27.0; // K per batter faced
    projectedValue = kPerBatter * expectedBattersFaced;
    method = 'k_per_bf_model';
  } else if (recentGames && recentGames.length >= 3) {
    // Fall back to weighted recent average
    projectedValue = calculateWeightedRecentAvg(recentGames);
    method = 'weighted_recent_avg';
    flags.push('fallback_recent_avg');
  } else if (seasonAvg !== undefined && seasonAvg > 0) {
    // Fall back to season average
    projectedValue = seasonAvg;
    method = 'season_avg';
    flags.push('fallback_season_avg');
  } else {
    // Fall back to league average
    projectedValue = LEAGUE_AVERAGES.strikeouts ?? 5.5;
    method = 'league_avg';
    flags.push('fallback_league_avg');
    confidence = Math.max(confidence - 0.2, 0.1);
  }

  // Apply opponent K rate adjustment
  let opponentKFactor = 1.0;
  if (opponentKRate !== undefined) {
    // League average K rate is ~23%
    const leagueAvgKRate = 0.23;
    opponentKFactor = opponentKRate / leagueAvgKRate;
    opponentKFactor = clamp(opponentKFactor, 0.8, 1.25);
    projectedValue *= opponentKFactor;
  }

  // Apply park factor (strikeout-friendly parks)
  let parkFactorValue = 1.0;
  if (parkFactor !== undefined) {
    parkFactorValue = parkFactor;
    parkFactorValue = clamp(parkFactorValue, 0.9, 1.1);
    projectedValue *= parkFactorValue;
  }

  // Ensure reasonable value
  projectedValue = Math.max(projectedValue, 0);
  projectedValue = roundTo(projectedValue, 1);

  // Ensure confidence is within bounds
  confidence = clamp(confidence, 0.1, 0.9);
  confidence = roundTo(confidence, 3);

  const sourceData: ProjectionSourceData = {
    recentAvg:
      recentGames && recentGames.length > 0
        ? roundTo(calculateWeightedRecentAvg(recentGames), 2)
        : undefined,
    recentGamesUsed: recentGames?.length ?? 0,
    seasonAvg: seasonAvg !== undefined ? roundTo(seasonAvg, 2) : undefined,
    kPer9: pitcherKPer9 !== undefined ? roundTo(pitcherKPer9, 2) : undefined,
    opponentKRate: opponentKRate !== undefined ? roundTo(opponentKRate, 3) : undefined,
    parkFactor: parkFactor !== undefined ? roundTo(parkFactor, 3) : undefined,
    method,
    inputsAvailable,
    inputsMissing,
  };

  return {
    playerName,
    sport: 'MLB',
    statType: statType.toLowerCase(),
    gameDate,
    projectedValue,
    confidence,
    modelVersion: MLB_MODEL_VERSION,
    sourceData,
    flags,
  };
}

// ============================================================================
// MLB CALCULATOR - BATTER PROPS
// ============================================================================

/**
 * Calculate batter prop projection (hits, total bases, etc.)
 *
 * Uses weighted recent average with park and matchup adjustments.
 */
function calculateBatterPropProjection(input: PlayerStatsInput): ProjectionCalculation {
  const { playerName, statType, gameDate, recentGames, seasonAvg, parkFactor } = input;

  const flags: string[] = [];
  const inputsAvailable: string[] = [];
  const inputsMissing: string[] = [];
  let confidence = BASE_CONFIDENCE;

  // Track inputs
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

  if (parkFactor !== undefined) {
    inputsAvailable.push('parkFactor');
  } else {
    inputsMissing.push('parkFactor');
    confidence -= CONFIDENCE_PENALTIES.parkFactor;
  }

  // Calculate base value
  let projectedValue: number;
  let method: string;

  if (recentGames && recentGames.length >= 3) {
    // Weighted recent average (preferred)
    projectedValue = calculateWeightedRecentAvg(recentGames);
    method = 'weighted_recent_avg';
  } else if (seasonAvg !== undefined && seasonAvg > 0) {
    // Fall back to season average
    projectedValue = seasonAvg;
    method = 'season_avg';
    flags.push('fallback_season_avg');
  } else {
    // Fall back to league average
    const normalizedStatType = statType.toLowerCase().replace(/[^a-z_]/g, '');
    projectedValue = LEAGUE_AVERAGES[normalizedStatType] ?? 1.0;
    method = 'league_avg';
    flags.push('fallback_league_avg');
    confidence = Math.max(confidence - 0.2, 0.1);
  }

  // Apply park factor
  let parkFactorValue = 1.0;
  if (parkFactor !== undefined) {
    parkFactorValue = parkFactor;
    parkFactorValue = clamp(parkFactorValue, 0.85, 1.15);
    projectedValue *= parkFactorValue;
  }

  // Ensure reasonable value
  projectedValue = Math.max(projectedValue, 0);
  projectedValue = roundTo(projectedValue, 1);

  // Ensure confidence is within bounds
  confidence = clamp(confidence, 0.1, 0.85);
  confidence = roundTo(confidence, 3);

  const sourceData: ProjectionSourceData = {
    recentAvg:
      recentGames && recentGames.length > 0
        ? roundTo(calculateWeightedRecentAvg(recentGames), 2)
        : undefined,
    recentGamesUsed: recentGames?.length ?? 0,
    seasonAvg: seasonAvg !== undefined ? roundTo(seasonAvg, 2) : undefined,
    parkFactor: parkFactor !== undefined ? roundTo(parkFactor, 3) : undefined,
    method,
    inputsAvailable,
    inputsMissing,
  };

  return {
    playerName,
    sport: 'MLB',
    statType: statType.toLowerCase(),
    gameDate,
    projectedValue,
    confidence,
    modelVersion: MLB_MODEL_VERSION,
    sourceData,
    flags,
  };
}

// ============================================================================
// MLB CALCULATOR DISPATCHER
// ============================================================================

/**
 * Calculate MLB projection
 * Routes to appropriate calculator based on stat type.
 */
export function calculateMlbProjection(input: PlayerStatsInput): ProjectionCalculation {
  const statType = input.statType.toLowerCase();

  // Pitcher props
  if (statType === 'strikeouts' || statType === 'outs_recorded' || statType === 'earned_runs') {
    return calculateStrikeoutsProjection(input);
  }

  // Batter props
  return calculateBatterPropProjection(input);
}

// ============================================================================
// CALCULATOR INTERFACE
// ============================================================================

export const MlbCalculator: ProjectionCalculator = {
  sport: 'MLB',
  supportedStatTypes: MLB_STAT_TYPES,
  calculate: calculateMlbProjection,
};

export default MlbCalculator;
