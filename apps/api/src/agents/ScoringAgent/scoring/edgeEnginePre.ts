/* eslint-disable max-lines, max-lines-per-function, max-params, security/detect-object-injection, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Edge Engine PRE - Selection/Decision Score
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 * Model Version: v1.0.1-pre
 *
 * CRITICAL: This score uses ONLY entry-time data.
 * NO closing lines, NO outcomes, NO post-start data.
 *
 * Purpose: Promotion, posting, and tiering decisions.
 */

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

export const MODEL_VERSION_PRE = 'v1.0.1-pre' as const;

/** PRE tier thresholds (slightly lower than POST due to less information) */
const TIER_THRESHOLDS_PRE = {
  S: 75,
  A: 60,
  B: 45,
} as const;

/** Market type historical performance weights (scaled for PRE) */
const MARKET_WEIGHTS_PRE: Record<string, number> = {
  points: 15,
  rebounds: 12,
  assists: 12,
  threes: 10,
  pts_reb_ast: 13,
  steals: 9,
  blocks: 9,
  strikeouts: 12,
  hits: 10,
  home_runs: 9,
  rbis: 9,
  passing_yards: 12,
  rushing_yards: 10,
  receiving_yards: 10,
  touchdowns: 9,
  default: 8,
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface EdgePreInput {
  pick_id: string;
  sport: string;
  stat_type: string;
  side: 'over' | 'under' | 'yes' | 'no';

  // Entry data (available at decision time)
  entry_line: number;
  entry_odds: number; // American format

  // Projection data (available at decision time)
  projection?: number | null;

  // Opening/early line data (NOT closing)
  opening_line?: number | null;
  opening_odds?: number | null;

  // Optional metadata
  player_name?: string;
  decision_timestamp?: string;
}

export interface EdgePreOutput {
  // Core outputs
  pick_id: string;
  edge_score_pre: number; // 0-100
  tier_pre: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction_pre: number; // 0.00-0.05

  // Component breakdown
  pre_components: {
    projection_delta_score: number;
    probability_quality_score: number;
    juice_efficiency_score: number;
    historical_factor_score: number;
    early_movement_score: number;
  };

  // Risk flags
  pre_flags: string[];

  // Feature snapshot (for replay)
  pre_feature_snapshot: {
    entry_line: number;
    entry_odds: number;
    entry_implied: number;
    projection: number | null;
    opening_line: number | null;
    opening_odds: number | null;
    stat_type: string;
    side: string;
  };

  // Metadata
  model_version_pre: typeof MODEL_VERSION_PRE;
  computed_at: string;
}

// =============================================================================
// LEAKAGE GUARD (MANDATORY)
// =============================================================================

/**
 * Runtime assertion: PRE score MUST NOT receive closing data.
 * This is the no-future-data guard.
 */
export function assertNoFutureData(data: {
  is_closing?: boolean;
  closing_line?: number | null;
  closing_odds?: number | null;
  result?: string | null;
}): void {
  if (data.is_closing === true) {
    throw new Error('LEAKAGE_VIOLATION: PRE score received is_closing=true data');
  }
  if (data.closing_line !== undefined && data.closing_line !== null) {
    throw new Error('LEAKAGE_VIOLATION: PRE score received closing_line data');
  }
  if (data.closing_odds !== undefined && data.closing_odds !== null) {
    throw new Error('LEAKAGE_VIOLATION: PRE score received closing_odds data');
  }
  if (data.result !== undefined && data.result !== null) {
    throw new Error('LEAKAGE_VIOLATION: PRE score received result data');
  }
}

/**
 * Validate that input contains no future data
 */
export function validatePreInput(input: EdgePreInput & Record<string, unknown>): void {
  // Check for forbidden fields
  const forbiddenFields = ['closing_line', 'closing_odds', 'result', 'settlement_status'];
  for (const field of forbiddenFields) {
    if (input[field] !== undefined && input[field] !== null) {
      throw new Error(`LEAKAGE_VIOLATION: PRE score input contains forbidden field: ${field}`);
    }
  }
}

// =============================================================================
// DETERMINISTIC UTILITY FUNCTIONS
// =============================================================================

/**
 * Round to fixed decimal places for determinism
 */
function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  const shifted = value * multiplier;
  const rounded = Math.round(shifted);
  return rounded / multiplier;
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert American odds to implied probability
 */
export function americanToImplied(odds: number): number {
  if (odds === 0) return 0.5;

  let implied: number;
  if (odds < 0) {
    implied = Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    implied = 100 / (odds + 100);
  }

  return roundTo(implied, 6);
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds === 0) return 2.0;

  let decimal: number;
  if (odds > 0) {
    decimal = odds / 100 + 1;
  } else {
    decimal = 100 / Math.abs(odds) + 1;
  }

  return roundTo(decimal, 4);
}

// =============================================================================
// PRE SCORING COMPONENT FUNCTIONS
// =============================================================================

/**
 * Projection Delta Score (0-40 points)
 * Measures edge between model projection and entry line
 */
function calculateProjectionDeltaScore(
  projection: number | null,
  entryLine: number,
  side: string
): number {
  if (projection === null || projection === undefined || entryLine === 0) {
    return 0; // No projection available
  }

  // Calculate delta percentage
  const deltaRaw = ((projection - entryLine) / entryLine) * 100;

  // For OVER/YES: positive delta is favorable (projection > line)
  // For UNDER/NO: negative delta is favorable (projection < line)
  const isOverSide = side === 'over' || side === 'yes';
  const delta = isOverSide ? deltaRaw : -deltaRaw;

  // Map delta to score: +10% = 40 points, 0% = 0, -5% = -20 (floored at 0)
  const rawScore = delta * 4;
  return roundTo(clamp(rawScore, 0, 40), 2);
}

/**
 * Probability Quality Score (0-20 points)
 * Rewards entries at strong implied probability positions
 */
function calculateProbabilityQualityScore(entryImplied: number, entryOdds: number): number {
  if (entryImplied >= 0.55 && entryOdds <= -130) {
    return 20; // Strong favorite position
  }
  if (entryImplied >= 0.5 && entryOdds <= -110) {
    return 16; // Moderate favorite
  }
  if (entryImplied >= 0.45) {
    return 10; // Slight favorite
  }
  if (entryImplied >= 0.4) {
    return 6; // Even money
  }
  return 0; // Underdog
}

/**
 * Juice Efficiency Score (0-15 points)
 * Rewards avoiding excessive vig
 */
function calculateJuiceEfficiencyScore(entryOdds: number): number {
  if (entryOdds > 0) {
    return 15; // Plus money
  }
  const absOdds = Math.abs(entryOdds);
  if (absOdds <= 115) {
    return 15; // Low juice
  }
  if (absOdds <= 125) {
    return 11;
  }
  if (absOdds <= 140) {
    return 6;
  }
  return 0; // High juice
}

/**
 * Historical Factor Score (0-15 points)
 * Market type performance adjustment
 */
function calculateHistoricalFactorScore(statType: string): number {
  const normalized = statType.toLowerCase().replace(/[^a-z_]/g, '');
  return MARKET_WEIGHTS_PRE[normalized] ?? MARKET_WEIGHTS_PRE['default'];
}

/**
 * Early Movement Score (0-10 points)
 * Movement from open to entry (NOT to close)
 */
function calculateEarlyMovementScore(
  openingLine: number | null,
  entryLine: number,
  side: string
): { score: number; movement_pct: number } {
  if (openingLine === null || openingLine === 0 || entryLine === 0) {
    return { score: 5, movement_pct: 0 }; // Neutral if no opening data
  }

  const movementPct = ((entryLine - openingLine) / openingLine) * 100;

  // For OVER: line going UP = market expects more = WITH us (favorable)
  // For UNDER: line going DOWN = market expects less = WITH us (favorable)
  const isOverSide = side === 'over' || side === 'yes';
  const movementWithUs = isOverSide ? movementPct > 0 : movementPct < 0;

  const absMovement = Math.abs(movementPct);

  let score: number;
  if (absMovement < 0.5) {
    score = 5; // Neutral
  } else if (movementWithUs) {
    score = clamp(absMovement * 2, 0, 10); // Favorable movement
  } else {
    score = clamp(-absMovement * 1, -5, 0); // Adverse movement
  }

  return { score: roundTo(score, 2), movement_pct: roundTo(movementPct, 4) };
}

/**
 * Detect PRE risk flags
 */
function detectPreFlags(
  projection: number | null,
  openingLine: number | null,
  entryOdds: number,
  historicalScore: number,
  earlyMovementPct: number,
  side: string
): string[] {
  const flags: string[] = [];

  if (projection === null || projection === undefined) {
    flags.push('no_projection');
  }

  if (openingLine === null || openingLine === undefined) {
    flags.push('stale_opening');
  }

  if (entryOdds < -140) {
    flags.push('high_juice');
  }

  if (historicalScore < 10) {
    flags.push('low_volume_market');
  }

  // Adverse early movement check
  const isOverSide = side === 'over' || side === 'yes';
  const adverseMovement = isOverSide ? earlyMovementPct < -3 : earlyMovementPct > 3;
  if (adverseMovement) {
    flags.push('adverse_early_movement');
  }

  return flags;
}

/**
 * Determine PRE tier from score
 */
function determineTierPre(edgeScorePre: number): 'S' | 'A' | 'B' | 'PASS' {
  if (edgeScorePre >= TIER_THRESHOLDS_PRE.S) return 'S';
  if (edgeScorePre >= TIER_THRESHOLDS_PRE.A) return 'A';
  if (edgeScorePre >= TIER_THRESHOLDS_PRE.B) return 'B';
  return 'PASS';
}

/**
 * Calculate Kelly Fraction for PRE score
 */
function calculateKellyFractionPre(
  edgeScorePre: number,
  entryImplied: number,
  decimalOdds: number
): number {
  if (entryImplied <= 0 || entryImplied >= 1 || decimalOdds <= 1) {
    return 0;
  }

  // Estimate edge from PRE score (maps 45+ to positive edge)
  const edgeEstimate = (edgeScorePre - 45) / 100;
  if (edgeEstimate <= 0) return 0;

  // Conservative probability adjustment
  const probAdjustment = edgeEstimate * 0.1;
  const trueProbPre = clamp(entryImplied + probAdjustment, 0.01, 0.99);

  const b = decimalOdds - 1;
  const p = trueProbPre;
  const q = 1 - p;

  // Full Kelly
  const kellyRaw = (p * b - q) / b;
  if (kellyRaw <= 0) return 0;

  // Fractional Kelly (25%) capped at 5%
  return roundTo(clamp(kellyRaw * 0.25, 0, 0.05), 4);
}

// =============================================================================
// MAIN PRE SCORING FUNCTION
// =============================================================================

/**
 * Compute Edge Engine PRE score (Selection/Decision)
 *
 * CRITICAL: Uses ONLY entry-time data. NO closing lines, NO outcomes.
 * Deterministic: same inputs always produce identical outputs.
 */
export function computeEdgeScorePre(input: EdgePreInput): EdgePreOutput {
  const computedAt = new Date().toISOString();

  // LEAKAGE GUARD: Validate no future data present
  validatePreInput(input as EdgePreInput & Record<string, unknown>);

  // Step 1: Convert odds to implied probability
  const entryImplied = americanToImplied(input.entry_odds);
  const decimalOdds = americanToDecimal(input.entry_odds);

  // Step 2: Calculate component scores
  const projectionDeltaScore = calculateProjectionDeltaScore(
    input.projection ?? null,
    input.entry_line,
    input.side
  );

  const probabilityQualityScore = calculateProbabilityQualityScore(entryImplied, input.entry_odds);

  const juiceEfficiencyScore = calculateJuiceEfficiencyScore(input.entry_odds);

  const historicalFactorScore = calculateHistoricalFactorScore(input.stat_type);

  const { score: earlyMovementScore, movement_pct: earlyMovementPct } = calculateEarlyMovementScore(
    input.opening_line ?? null,
    input.entry_line,
    input.side
  );

  // Step 3: Sum and normalize edge score
  const rawScore =
    projectionDeltaScore +
    probabilityQualityScore +
    juiceEfficiencyScore +
    historicalFactorScore +
    earlyMovementScore;

  const edgeScorePre = roundTo(clamp(rawScore, 0, 100), 2);

  // Step 4: Determine tier
  const tierPre = determineTierPre(edgeScorePre);

  // Step 5: Calculate Kelly fraction
  const kellyFractionPre = calculateKellyFractionPre(edgeScorePre, entryImplied, decimalOdds);

  // Step 6: Detect risk flags
  const preFlags = detectPreFlags(
    input.projection ?? null,
    input.opening_line ?? null,
    input.entry_odds,
    historicalFactorScore,
    earlyMovementPct,
    input.side
  );

  // Step 7: Build output
  return {
    pick_id: input.pick_id,
    edge_score_pre: edgeScorePre,
    tier_pre: tierPre,
    kelly_fraction_pre: kellyFractionPre,

    pre_components: {
      projection_delta_score: projectionDeltaScore,
      probability_quality_score: probabilityQualityScore,
      juice_efficiency_score: juiceEfficiencyScore,
      historical_factor_score: historicalFactorScore,
      early_movement_score: earlyMovementScore,
    },

    pre_flags: preFlags,

    pre_feature_snapshot: {
      entry_line: input.entry_line,
      entry_odds: input.entry_odds,
      entry_implied: entryImplied,
      projection: input.projection ?? null,
      opening_line: input.opening_line ?? null,
      opening_odds: input.opening_odds ?? null,
      stat_type: input.stat_type,
      side: input.side,
    },

    model_version_pre: MODEL_VERSION_PRE,
    computed_at: computedAt,
  };
}

/**
 * Batch PRE scoring for multiple picks
 */
export function computeEdgeScorePreBatch(inputs: EdgePreInput[]): EdgePreOutput[] {
  return inputs.map(input => computeEdgeScorePre(input));
}

/**
 * Verify PRE determinism: compute twice and compare
 */
export function verifyPreDeterminism(input: EdgePreInput): boolean {
  const result1 = computeEdgeScorePre(input);
  const result2 = computeEdgeScorePre(input);

  // Compare all fields except computed_at
  const normalize = (output: EdgePreOutput): Omit<EdgePreOutput, 'computed_at'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { computed_at, ...rest } = output;
    return rest;
  };

  return JSON.stringify(normalize(result1)) === JSON.stringify(normalize(result2));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { TIER_THRESHOLDS_PRE, MARKET_WEIGHTS_PRE, roundTo, clamp };
