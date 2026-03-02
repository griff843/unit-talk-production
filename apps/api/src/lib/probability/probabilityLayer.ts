/**
 * Probability Layer
 * Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
 * Updated: INTELLIGENCE-PROBABILITY-INTEGRATION-002 (market-anchored, fail-closed)
 *
 * Implements MODEL_ARCHITECTURE_SPEC_v1.md:
 * - P_final: Calibrated model probability (0-1)
 * - uncertainty_final: Model uncertainty (0-1)
 * - edge_final: P_final - P_market_devig
 * - clv_forecast: Predicted CLV direction and magnitude
 *
 * CRITICAL CHANGES (v1.1.0):
 * - MARKET-ANCHORED: Confidence maps to delta AROUND p_market_devig, not absolute probability.
 * - FAIL-CLOSED: Returns { ok: false, reason } when primitives cannot be computed.
 * - NO fabricated defaults (0.5, entry-implied, etc.).
 */

import {
  calculateEdge,
  computeConsensus,
  roundTo,
  type BookOffer,
  type ConsensusResultOk,
  type ConsensusResultFail,
  type DevigMethod,
  PROBABILITY_MODEL_VERSION,
  MIN_BOOKS_FOR_CONSENSUS,
} from './devigConsensus';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Factors that contribute to uncertainty */
export interface UncertaintyFactors {
  booksAvailable: number;
  bookSpread: number;
  dataQualityScore: number;
  hoursToStart: number | null;
  historicalAccuracy: number | null;
  featureCompleteness: number;
}

/** Input for probability layer computation */
export interface ProbabilityInput {
  /** Confidence score from existing scoring pipeline (0-10 scale) */
  confidenceScore: number;
  /** Book offers for consensus computation */
  bookOffers: BookOffer[];
  /** Side of the bet (over/under/yes/no) */
  side: 'over' | 'under' | 'yes' | 'no';
  /** American odds at entry */
  entryOdds: number;
  /** Sport for market-specific adjustments */
  sport: string;
  /** Market type (e.g., points, rebounds, etc.) */
  marketType: string;
  /** Hours until event starts (null if unknown) */
  hoursToStart: number | null;
  /** Feature completeness score from feature snapshot (0-1) */
  featureCompleteness: number;
}

/** Successful probability computation result */
export interface ProbabilityOutputOk {
  ok: true;
  /** Calibrated model probability (0-1) */
  pFinal: number;
  /** Model uncertainty (0-1, higher = more uncertain) */
  uncertaintyFinal: number;
  /** True edge = P_final - P_market_devig */
  edgeFinal: number;
  /** Predicted CLV (-1 to 1, positive = expect favorable line movement) */
  clvForecast: number;
  /** Devigged market consensus probability */
  pMarketDevig: number;
  /** Devig method used */
  devigMethod: DevigMethod;
  /** Consensus computation weights (for audit trail) */
  consensusWeightsJson: Record<string, unknown>;
  /** Probability model version */
  probabilityModelVersion: string;
  /** Books used in consensus */
  booksUsed: number;
}

/** Failed probability computation result */
export interface ProbabilityOutputFail {
  ok: false;
  reason: ProbabilityFailReason;
  reasonDetail: string;
}

export type ProbabilityFailReason =
  | 'CONSENSUS_FAILED'
  | 'INSUFFICIENT_BOOKS'
  | 'INVALID_INPUT'
  | 'COMPUTATION_ERROR';

export type ProbabilityOutput = ProbabilityOutputOk | ProbabilityOutputFail;

// =============================================================================
// CONSTANTS
// =============================================================================

/** Uncertainty thresholds for gating */
export const UNCERTAINTY_THRESHOLDS = {
  /** Maximum uncertainty for HARD promotion */
  HARD_MAX: 0.25,
  /** Maximum uncertainty for SOFT promotion */
  SOFT_MAX: 0.4,
  /** Minimum books for low uncertainty */
  MIN_BOOKS_LOW_UNCERTAINTY: 3,
  /** Maximum book spread for low uncertainty */
  MAX_BOOK_SPREAD_LOW_UNCERTAINTY: 0.03,
} as const;

/**
 * Market-anchored confidence transformation parameters
 *
 * CRITICAL: Confidence maps to a DELTA around p_market_devig, NOT an absolute probability.
 *
 * confidence 5.0 → delta = 0 (agree with market)
 * confidence 10.0 → delta = +MAX_DELTA (max positive edge claim)
 * confidence 0.0 → delta = -MAX_DELTA (max negative edge claim, would never promote)
 */
const MARKET_DELTA_PARAMS = {
  /** Confidence at which delta = 0 (neutral) */
  NEUTRAL_CONFIDENCE: 5.0,
  /** Max confidence score */
  MAX_CONFIDENCE: 10.0,
  /** Min confidence score */
  MIN_CONFIDENCE: 0.0,
  /**
   * Maximum probability delta from market (±4% = 0.04)
   * A confidence of 10 claims +4% edge over market.
   * A confidence of 0 claims -4% edge vs market (never promoted).
   */
  MAX_DELTA: 0.04,
} as const;

/** CLV forecast parameters */
const CLV_FORECAST_PARAMS = {
  HIGH_CLV_MARKETS: ['points', 'rebounds', 'assists', 'pts_reb_ast'] as readonly string[],
  TIME_DECAY_HOURS: 24,
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert confidence score to probability DELTA around market.
 *
 * MARKET-ANCHORED: confidence 5 = agree with market (delta = 0)
 * confidence 10 = +MAX_DELTA above market
 * confidence 0 = -MAX_DELTA below market
 *
 * This is NOT an absolute probability - it's an edge claim relative to devig consensus.
 */
function confidenceToDelta(confidence: number): number {
  // Clamp confidence to valid range
  const clamped = clamp(
    confidence,
    MARKET_DELTA_PARAMS.MIN_CONFIDENCE,
    MARKET_DELTA_PARAMS.MAX_CONFIDENCE
  );

  // Map [0, 10] to [-MAX_DELTA, +MAX_DELTA]
  // confidence 5 → 0
  // confidence 10 → +MAX_DELTA
  // confidence 0 → -MAX_DELTA
  const normalized =
    (clamped - MARKET_DELTA_PARAMS.NEUTRAL_CONFIDENCE) /
    (MARKET_DELTA_PARAMS.MAX_CONFIDENCE - MARKET_DELTA_PARAMS.NEUTRAL_CONFIDENCE);

  return roundTo(normalized * MARKET_DELTA_PARAMS.MAX_DELTA, 6);
}

// =============================================================================
// UNCERTAINTY COMPUTATION
// =============================================================================

/**
 * Compute model uncertainty from multiple factors
 * Lower is better (less uncertain)
 */
export function computeUncertainty(factors: UncertaintyFactors): number {
  let uncertainty = 0;

  // Factor 1: Books available (0-0.3)
  const booksWeight = 0.3;
  const booksFactor = factors.booksAvailable >= 3 ? 0 : (3 - factors.booksAvailable) / 3;
  uncertainty += booksFactor * booksWeight;

  // Factor 2: Book spread (0-0.25)
  const spreadWeight = 0.25;
  const spreadFactor = clamp(factors.bookSpread / 0.1, 0, 1);
  uncertainty += spreadFactor * spreadWeight;

  // Factor 3: Data quality (0-0.2)
  const qualityWeight = 0.2;
  const qualityFactor = 1 - clamp(factors.dataQualityScore, 0.3, 1);
  uncertainty += qualityFactor * qualityWeight;

  // Factor 4: Time to start (0-0.15)
  const timeWeight = 0.15;
  if (factors.hoursToStart !== null) {
    const timeFactor = clamp(factors.hoursToStart / 24, 0, 1);
    uncertainty += timeFactor * timeWeight;
  } else {
    uncertainty += 0.1; // Unknown time = moderate uncertainty
  }

  // Factor 5: Feature completeness (0-0.1)
  const featureWeight = 0.1;
  const featureFactor = 1 - clamp(factors.featureCompleteness, 0, 1);
  uncertainty += featureFactor * featureWeight;

  return roundTo(clamp(uncertainty, 0, 1), 6);
}

// =============================================================================
// P_FINAL COMPUTATION (MARKET-ANCHORED)
// =============================================================================

/**
 * Compute P_final using market-anchored delta mapping.
 *
 * P_final = p_market_devig + delta
 *
 * Where delta is derived from confidence score:
 * - Higher confidence → positive delta → P_final > P_market
 * - Lower confidence → negative delta → P_final < P_market
 *
 * Uncertainty shrinks P_final TOWARD market (reduces delta magnitude).
 */
export function computePFinal(
  confidenceScore: number,
  pMarketDevig: number,
  uncertainty: number
): number {
  // Step 1: Get raw delta from confidence
  const rawDelta = confidenceToDelta(confidenceScore);

  // Step 2: Shrink delta based on uncertainty
  // Higher uncertainty → delta approaches 0 (agree with market)
  // uncertainty 0 → full delta
  // uncertainty 1 → delta = 0
  const shrinkFactor = 1 - uncertainty;
  const adjustedDelta = rawDelta * shrinkFactor;

  // Step 3: Compute P_final = P_market + adjusted delta
  const pFinal = pMarketDevig + adjustedDelta;

  return roundTo(clamp(pFinal, 0.01, 0.99), 6);
}

// =============================================================================
// CLV FORECAST COMPUTATION
// =============================================================================

/**
 * Compute CLV forecast (-1 to 1)
 * Positive = expect favorable line movement
 * Negative = expect unfavorable line movement
 */
export function computeCLVForecast(
  edge: number,
  marketType: string,
  hoursToStart: number | null
): number {
  // Base forecast from edge (50% of edge expectation)
  let forecast = edge * 0.5;

  // Market type adjustment
  const normalizedMarket = marketType.toLowerCase().replace(/[^a-z_]/g, '');
  if (CLV_FORECAST_PARAMS.HIGH_CLV_MARKETS.includes(normalizedMarket)) {
    forecast *= 1.2;
  }

  // Time decay: more time = more opportunity for movement
  if (hoursToStart !== null) {
    const timeFactor = clamp(hoursToStart / CLV_FORECAST_PARAMS.TIME_DECAY_HOURS, 0.2, 1);
    forecast *= timeFactor;
  }

  return roundTo(clamp(forecast, -1, 1), 6);
}

// =============================================================================
// MAIN PROBABILITY LAYER FUNCTION - FAIL-CLOSED
// =============================================================================

/**
 * Compute full probability layer.
 *
 * FAIL-CLOSED: Returns { ok: false, reason } if:
 * - Consensus cannot be computed (insufficient books, invalid odds)
 * - Any required computation fails
 *
 * NO fabricated defaults. Promotion must be blocked if this fails.
 */
// eslint-disable-next-line complexity, max-lines-per-function -- Complex probability computation algorithm
export function computeProbabilityLayer(input: ProbabilityInput): ProbabilityOutput {
  // Validate input
  if (!isFinite(input.confidenceScore) || !isFinite(input.entryOdds)) {
    return {
      ok: false,
      reason: 'INVALID_INPUT',
      reasonDetail: 'confidenceScore or entryOdds is not a finite number',
    };
  }

  // FAIL-CLOSED: Require sufficient books for consensus
  if (input.bookOffers.length < MIN_BOOKS_FOR_CONSENSUS) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_BOOKS',
      reasonDetail: `Need ${MIN_BOOKS_FOR_CONSENSUS} books for consensus, got ${input.bookOffers.length}. Promotion blocked.`,
    };
  }

  // Step 1: Compute market consensus (FAIL-CLOSED)
  const consensus = computeConsensus(input.bookOffers, 'proportional');

  if (!consensus.ok) {
    // TypeScript narrow: consensus is ConsensusResultFail
    const consensusFail = consensus as ConsensusResultFail;
    return {
      ok: false,
      reason: 'CONSENSUS_FAILED',
      reasonDetail: `${consensusFail.reason}: ${consensusFail.reasonDetail}`,
    } as const;
  }

  // TypeScript narrow: consensus is ConsensusResultOk after the check above
  const consensusOk = consensus as ConsensusResultOk;

  // Get probability for our side
  const pMarketDevig =
    input.side === 'over' || input.side === 'yes'
      ? consensusOk.overConsensus
      : consensusOk.underConsensus;

  // Step 2: Compute book spread for uncertainty
  let bookSpread = 0;
  if (consensusOk.books.length >= 2) {
    const fairProbs = consensusOk.books.map(b =>
      input.side === 'over' || input.side === 'yes' ? b.overFair : b.underFair
    );
    bookSpread = Math.max(...fairProbs) - Math.min(...fairProbs);
  }

  // Step 3: Compute data quality score from books
  const dataQualityScore =
    Object.values(consensusOk.consensusWeights).reduce((sum, w) => sum + w.dataQualityWeight, 0) /
    consensusOk.booksUsed;

  // Step 4: Compute uncertainty
  const uncertaintyFactors: UncertaintyFactors = {
    booksAvailable: consensusOk.booksUsed,
    bookSpread,
    dataQualityScore,
    hoursToStart: input.hoursToStart,
    historicalAccuracy: null,
    featureCompleteness: input.featureCompleteness,
  };
  const uncertaintyFinal = computeUncertainty(uncertaintyFactors);

  // Step 5: Compute P_final (market-anchored)
  const pFinal = computePFinal(input.confidenceScore, pMarketDevig, uncertaintyFinal);

  // Step 6: Compute edge
  const decimalOdds =
    input.entryOdds > 0 ? input.entryOdds / 100 + 1 : 100 / Math.abs(input.entryOdds) + 1;
  const { edge } = calculateEdge(pFinal, pMarketDevig, decimalOdds);

  // Step 7: Compute CLV forecast
  const clvForecast = computeCLVForecast(edge, input.marketType, input.hoursToStart);

  // Validate outputs
  if (!isFinite(pFinal) || !isFinite(uncertaintyFinal) || !isFinite(edge)) {
    return {
      ok: false,
      reason: 'COMPUTATION_ERROR',
      reasonDetail: 'Probability computation produced non-finite values',
    };
  }

  return {
    ok: true,
    pFinal,
    uncertaintyFinal,
    edgeFinal: edge,
    clvForecast,
    pMarketDevig,
    devigMethod: consensusOk.devigMethod,
    consensusWeightsJson: consensusOk.consensusWeights,
    probabilityModelVersion: PROBABILITY_MODEL_VERSION,
    booksUsed: consensusOk.booksUsed,
  };
}
