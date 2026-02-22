/**
 * Projection Agent Types
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

/** Player stats input for projection calculation */
export interface PlayerStatsInput {
  playerName: string;
  sport: 'NBA' | 'MLB' | 'NFL' | 'NHL';
  statType: string;
  gameDate: string;
  opponent?: string;
  venue?: 'home' | 'away';

  // Recent game logs (most recent first)
  recentGames?: GameLog[];

  // Season averages (if available)
  seasonAvg?: number;
  seasonGames?: number;

  // Contextual factors
  minutesProjection?: number; // NBA: expected minutes
  usageRate?: number; // NBA: usage rate
  paceAdjustment?: number; // NBA: pace factor vs opponent
  opponentDefRating?: number; // NBA: opponent defensive rating

  // MLB-specific
  pitcherKPer9?: number; // MLB: K/9 rate
  opponentKRate?: number; // MLB: opponent K%
  parkFactor?: number; // MLB: park factor
  expectedBattersFaced?: number; // MLB: expected batters faced
}

/** Game log entry */
export interface GameLog {
  date: string;
  opponent: string;
  statValue: number;
  minutes?: number;
  venue?: 'home' | 'away';
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Projection calculation result */
export interface ProjectionCalculation {
  playerName: string;
  sport: string;
  statType: string;
  gameDate: string;
  projectedValue: number;
  confidence: number;
  modelVersion: string;
  sourceData: ProjectionSourceData;
  flags: string[];
}

/** Source data captured for projection */
export interface ProjectionSourceData {
  recentAvg?: number;
  recentGamesUsed?: number;
  seasonAvg?: number;
  minutesFactor?: number;
  paceFactor?: number;
  defFactor?: number;
  usageFactor?: number;
  kPer9?: number;
  opponentKRate?: number;
  parkFactor?: number;
  method: string;
  inputsAvailable: string[];
  inputsMissing: string[];
}

// ============================================================================
// CALCULATOR TYPES
// ============================================================================

/** Calculator interface for sport-specific projection logic */
export interface ProjectionCalculator {
  sport: string;
  supportedStatTypes: string[];
  calculate(input: PlayerStatsInput): ProjectionCalculation;
}

// ============================================================================
// COVERAGE TYPES
// ============================================================================

/** Coverage report entry */
export interface CoverageEntry {
  sport: string;
  statType: string;
  totalPlayers: number;
  withProjection: number;
  coveragePct: number;
  avgConfidence: number;
}

/** Projection compute job result */
export interface ComputeJobResult {
  sport: string;
  gameDate: string;
  playersProcessed: number;
  projectionsCreated: number;
  projectionsSkipped: number;
  errors: number;
  duration: number;
  coverage: CoverageEntry[];
}
