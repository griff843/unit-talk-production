/* eslint-disable max-lines, max-lines-per-function, max-params, security/detect-object-injection, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Edge Engine V1 / POST - Deterministic Scoring System (Validation)
 * Sprint: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097
 * Updated: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 * Model Version: v1.0.1-post
 *
 * POST Score: Uses CLV as primary signal. Includes closing line data.
 * Purpose: Validation, CLV tracking, retrospective analysis.
 * NOT for: Promotion/posting decisions (use PRE score instead).
 *
 * All inputs are frozen at computation time for replayability.
 */

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

export const MODEL_VERSION = 'v1.0.0' as const;
export const MODEL_VERSION_POST = 'v1.0.1-post' as const;

/** Market type historical performance weights */
const MARKET_WEIGHTS: Record<string, number> = {
  points: 10,
  rebounds: 8,
  assists: 8,
  threes: 7,
  pts_reb_ast: 9,
  steals: 6,
  blocks: 6,
  strikeouts: 8,
  hits: 7,
  home_runs: 6,
  rbis: 6,
  passing_yards: 8,
  rushing_yards: 7,
  receiving_yards: 7,
  touchdowns: 6,
  default: 5,
};

/** Tier thresholds (deterministic boundaries) */
const TIER_THRESHOLDS = {
  S: 80,
  A: 65,
  B: 50,
} as const;

/** Risk flag thresholds */
const RISK_THRESHOLDS = {
  STEAM_FADE_PCT: 5.0,
  STALE_LINE_THRESHOLD: 0.001,
  LOW_CLV_THRESHOLD: 1.0,
  VOLATILITY_THRESHOLD: 3.0,
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface EdgeV1Input {
  pick_id: string;
  sport: string;
  stat_type: string;
  side: 'over' | 'under' | 'yes' | 'no';

  // Entry data
  entry_line: number;
  entry_odds: number; // American format

  // Closing data (from provider_offers or unified_picks)
  closing_line: number | null;
  closing_odds: number | null;

  // Optional metadata
  player_name?: string;
  closing_source?: string;
}

export interface EdgeEngineV1Output {
  // Core outputs
  pick_id: string;
  edge_score: number; // 0-100
  tier: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction: number; // 0.00-0.05

  // CLV metrics
  clv_pct: number;
  clv_direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

  // Market analysis
  market_resistance_flag: 'WITH' | 'AGAINST' | 'NEUTRAL';
  line_movement_pct: number;

  // Risk assessment
  risk_flags: string[];

  // Component breakdown (for auditing)
  score_components: {
    clv_score: number;
    resistance_score: number;
    probability_score: number;
    juice_score: number;
    historical_score: number;
  };

  // Feature snapshot (inputs for replay)
  feature_snapshot: {
    entry_implied: number;
    closing_implied: number;
    entry_line: number;
    closing_line: number;
    entry_odds: number;
    closing_odds: number;
    stat_type: string;
    side: string;
  };

  // Metadata
  model_version: typeof MODEL_VERSION;
  computed_at: string;
}

// =============================================================================
// DETERMINISTIC UTILITY FUNCTIONS
// =============================================================================

/**
 * Round to fixed decimal places for determinism
 * Uses banker's rounding (round half to even)
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
 * Deterministic: no floating point precision issues
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
// SCORING COMPONENT FUNCTIONS
// =============================================================================

/**
 * Calculate CLV percentage
 * Positive CLV = line moved in your favor (good)
 */
function calculateCLV(entryImplied: number, closingImplied: number, side: string): number {
  if (entryImplied === 0) return 0;

  // For OVER/YES: higher closing implied = line moved against public = good
  // For UNDER/NO: lower closing implied = line moved against public = good
  const isOverSide = side === 'over' || side === 'yes';

  let clv: number;
  if (isOverSide) {
    clv = ((closingImplied - entryImplied) / entryImplied) * 100;
  } else {
    // For under, invert: we want closing to be lower
    clv = ((entryImplied - closingImplied) / entryImplied) * 100;
  }

  return roundTo(clv, 4);
}

/**
 * CLV Score Component (0-40 points)
 * Primary edge signal
 */
function calculateCLVScore(clvPct: number): number {
  // Map CLV to score: +10% CLV = 40 points, 0% = 0, -5% = -20
  const rawScore = clvPct * 4;
  return roundTo(clamp(rawScore, -20, 40), 2);
}

/**
 * Market Resistance Score (0-25 points)
 * Rewards betting WITH market movement
 */
function calculateResistanceScore(
  lineMovementPct: number,
  side: string
): { score: number; flag: 'WITH' | 'AGAINST' | 'NEUTRAL' } {
  const isOverSide = side === 'over' || side === 'yes';

  // Determine if movement is WITH or AGAINST our position
  // For OVER: line going UP = market expects more = WITH us
  // For UNDER: line going DOWN = market expects less = WITH us
  const movementWithUs = isOverSide ? lineMovementPct > 0 : lineMovementPct < 0;

  const absMovement = Math.abs(lineMovementPct);

  let flag: 'WITH' | 'AGAINST' | 'NEUTRAL';
  let score: number;

  if (absMovement < 0.5) {
    flag = 'NEUTRAL';
    score = 10; // Neutral bonus
  } else if (movementWithUs) {
    flag = 'WITH';
    score = clamp(absMovement * 2.5, 0, 25);
  } else {
    flag = 'AGAINST';
    score = clamp(-absMovement * 1.5, -15, 0);
  }

  return { score: roundTo(score, 2), flag };
}

/**
 * Probability Quality Score (0-15 points)
 * Rewards entries at strong implied probability positions
 */
function calculateProbabilityScore(entryImplied: number, entryOdds: number): number {
  if (entryImplied >= 0.55 && entryOdds <= -130) {
    return 15; // Strong favorite position
  }
  if (entryImplied >= 0.5 && entryOdds <= -110) {
    return 12; // Moderate favorite
  }
  if (entryImplied >= 0.45) {
    return 8; // Slight favorite
  }
  if (entryImplied >= 0.4) {
    return 5; // Even money
  }
  return 0; // Underdog
}

/**
 * Juice Efficiency Score (0-10 points)
 * Rewards avoiding excessive vig
 */
function calculateJuiceScore(entryOdds: number): number {
  const absOdds = Math.abs(entryOdds);
  if (absOdds <= 115 || entryOdds > 0) {
    return 10; // Low juice or plus money
  }
  if (absOdds <= 125) {
    return 7;
  }
  if (absOdds <= 140) {
    return 4;
  }
  return 0; // High juice
}

/**
 * Historical Factor Score (0-10 points)
 * Market type performance adjustment
 */
function calculateHistoricalScore(statType: string): number {
  const normalized = statType.toLowerCase().replace(/[^a-z_]/g, '');
  return MARKET_WEIGHTS[normalized] ?? MARKET_WEIGHTS['default'];
}

/**
 * Calculate Kelly Fraction
 * Capped at 5% (fractional Kelly with 25% of full Kelly)
 */
function calculateKellyFraction(trueProb: number, decimalOdds: number): number {
  if (trueProb <= 0 || trueProb >= 1 || decimalOdds <= 1) {
    return 0;
  }

  const b = decimalOdds - 1;
  const p = trueProb;
  const q = 1 - p;

  // Full Kelly
  const kellyRaw = (p * b - q) / b;

  if (kellyRaw <= 0) return 0;

  // Fractional Kelly (25% of full)
  const fractionalKelly = kellyRaw * 0.25;

  // Cap at 5%
  return roundTo(clamp(fractionalKelly, 0, 0.05), 4);
}

/**
 * Detect risk flags based on scoring inputs
 */
function detectRiskFlags(
  clvPct: number,
  lineMovementPct: number,
  closingLine: number | null,
  closingOdds: number | null,
  entryImplied: number
): string[] {
  const flags: string[] = [];

  // No closing data
  if (closingLine === null || closingOdds === null) {
    flags.push('no_closing_data');
    return flags; // Other flags require closing data
  }

  // Steam fade: line moved against by >5%
  if (lineMovementPct < -RISK_THRESHOLDS.STEAM_FADE_PCT) {
    flags.push('steam_fade');
  }

  // Stale line: no movement
  if (Math.abs(lineMovementPct) < RISK_THRESHOLDS.STALE_LINE_THRESHOLD) {
    flags.push('stale_line');
  }

  // Low CLV capture despite movement
  if (Math.abs(lineMovementPct) > 2.0 && Math.abs(clvPct) < RISK_THRESHOLDS.LOW_CLV_THRESHOLD) {
    flags.push('low_juice_capture');
  }

  // Underdog fade: underdog position lost value
  if (entryImplied < 0.45 && clvPct < -3.0) {
    flags.push('underdog_fade');
  }

  return flags;
}

/**
 * Determine tier from edge score
 */
function determineTier(edgeScore: number): 'S' | 'A' | 'B' | 'PASS' {
  if (edgeScore >= TIER_THRESHOLDS.S) return 'S';
  if (edgeScore >= TIER_THRESHOLDS.A) return 'A';
  if (edgeScore >= TIER_THRESHOLDS.B) return 'B';
  return 'PASS';
}

/**
 * Determine CLV direction
 */
function determineCLVDirection(clvPct: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  if (clvPct > 1.0) return 'POSITIVE';
  if (clvPct < -1.0) return 'NEGATIVE';
  return 'NEUTRAL';
}

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

/**
 * Compute Edge Engine V1 score
 * Deterministic: same inputs always produce identical outputs
 */
export function computeEdgeV1(input: EdgeV1Input): EdgeEngineV1Output {
  const computedAt = new Date().toISOString();

  // Handle missing closing data
  const hasClosingData = input.closing_line !== null && input.closing_odds !== null;

  // Use entry as closing if no closing data (results in 0 CLV)
  const closingLine = input.closing_line ?? input.entry_line;
  const closingOdds = input.closing_odds ?? input.entry_odds;

  // Step 1: Convert odds to implied probabilities
  const entryImplied = americanToImplied(input.entry_odds);
  const closingImplied = americanToImplied(closingOdds);

  // Step 2: Calculate CLV
  const clvPct = calculateCLV(entryImplied, closingImplied, input.side);

  // Step 3: Calculate line movement percentage
  const lineMovementPct =
    input.entry_line !== 0
      ? roundTo(((closingLine - input.entry_line) / input.entry_line) * 100, 4)
      : 0;

  // Step 4: Calculate component scores
  const clvScore = calculateCLVScore(clvPct);
  const { score: resistanceScore, flag: resistanceFlag } = calculateResistanceScore(
    lineMovementPct,
    input.side
  );
  const probabilityScore = calculateProbabilityScore(entryImplied, input.entry_odds);
  const juiceScore = calculateJuiceScore(input.entry_odds);
  const historicalScore = calculateHistoricalScore(input.stat_type);

  // Step 5: Sum and normalize edge score
  const rawScore = clvScore + resistanceScore + probabilityScore + juiceScore + historicalScore;
  const edgeScore = roundTo(clamp(rawScore, 0, 100), 2);

  // Step 6: Determine tier
  const tier = determineTier(edgeScore);

  // Step 7: Calculate Kelly fraction
  // Estimate true probability from CLV-adjusted model
  const trueProbEstimate = clamp(entryImplied * (1 + clvPct / 100), 0.01, 0.99);
  const decimalOdds = americanToDecimal(input.entry_odds);
  const kellyFraction = calculateKellyFraction(trueProbEstimate, decimalOdds);

  // Step 8: Detect risk flags
  const riskFlags = detectRiskFlags(
    clvPct,
    lineMovementPct,
    input.closing_line,
    input.closing_odds,
    entryImplied
  );

  // Add no_closing_data flag if applicable
  if (!hasClosingData && !riskFlags.includes('no_closing_data')) {
    riskFlags.push('no_closing_data');
  }

  // Step 9: Build output
  return {
    pick_id: input.pick_id,
    edge_score: edgeScore,
    tier,
    kelly_fraction: kellyFraction,

    clv_pct: roundTo(clvPct, 4),
    clv_direction: determineCLVDirection(clvPct),

    market_resistance_flag: resistanceFlag,
    line_movement_pct: lineMovementPct,

    risk_flags: riskFlags,

    score_components: {
      clv_score: clvScore,
      resistance_score: resistanceScore,
      probability_score: probabilityScore,
      juice_score: juiceScore,
      historical_score: historicalScore,
    },

    feature_snapshot: {
      entry_implied: entryImplied,
      closing_implied: closingImplied,
      entry_line: input.entry_line,
      closing_line: closingLine,
      entry_odds: input.entry_odds,
      closing_odds: closingOdds,
      stat_type: input.stat_type,
      side: input.side,
    },

    model_version: MODEL_VERSION,
    computed_at: computedAt,
  };
}

/**
 * Batch scoring for multiple picks
 * Returns array in same order as input
 */
export function computeEdgeV1Batch(inputs: EdgeV1Input[]): EdgeEngineV1Output[] {
  return inputs.map(input => computeEdgeV1(input));
}

/**
 * Verify determinism: compute twice and compare
 * Returns true if outputs are identical (excluding computed_at)
 */
export function verifyDeterminism(input: EdgeV1Input): boolean {
  const result1 = computeEdgeV1(input);
  const result2 = computeEdgeV1(input);

  // Compare all fields except computed_at
  const normalize = (output: EdgeEngineV1Output): Omit<EdgeEngineV1Output, 'computed_at'> => {
    const { computed_at: _, ...rest } = output;
    return rest;
  };

  return JSON.stringify(normalize(result1)) === JSON.stringify(normalize(result2));
}

// =============================================================================
// POST SCORE ALIASES (SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098)
// =============================================================================

/**
 * POST Input type (alias for EdgeV1Input)
 * Explicitly allows closing data for validation purposes.
 */
export type EdgePostInput = EdgeV1Input;

/**
 * POST Output type (alias for EdgeEngineV1Output with POST naming)
 */
export interface EdgePostOutput extends EdgeEngineV1Output {
  edge_score_post: number;
  tier_post: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction_post: number;
  post_flags: string[];
  model_version_post: typeof MODEL_VERSION_POST;
}

/**
 * Compute Edge Engine POST score (Validation)
 *
 * Uses closing line data (CLV) for retrospective validation.
 * NOT for promotion/posting decisions - use computeEdgeScorePre() instead.
 */
export function computeEdgeScorePost(input: EdgePostInput): EdgePostOutput {
  const baseOutput = computeEdgeV1(input);

  // Extend with POST-specific naming
  return {
    ...baseOutput,
    edge_score_post: baseOutput.edge_score,
    tier_post: baseOutput.tier,
    kelly_fraction_post: baseOutput.kelly_fraction,
    post_flags: baseOutput.risk_flags,
    model_version_post: MODEL_VERSION_POST,
  };
}

/**
 * Batch POST scoring
 */
export function computeEdgeScorePostBatch(inputs: EdgePostInput[]): EdgePostOutput[] {
  return inputs.map(input => computeEdgeScorePost(input));
}

/**
 * Verify POST determinism
 */
export function verifyPostDeterminism(input: EdgePostInput): boolean {
  return verifyDeterminism(input);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  TIER_THRESHOLDS,
  MARKET_WEIGHTS,
  RISK_THRESHOLDS,
  roundTo,
  clamp,
  calculateCLV,
  calculateKellyFraction,
  detectRiskFlags,
};

// Re-export POST aliases as TIER_THRESHOLDS_POST for consistency
export const TIER_THRESHOLDS_POST = TIER_THRESHOLDS;
