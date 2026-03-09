/**
 * Probability Layer
 * Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
 * Updated: INTELLIGENCE-PROBABILITY-INTEGRATION-002 (market-anchored, fail-closed)
 * Updated: SPRINT-024-SCORING-ENHANCEMENT-LAYERING (syndicate model)
 *
 * Implements MODEL_ARCHITECTURE_SPEC_v1.md:
 * - P_final: Calibrated model probability (0-1)
 * - uncertainty_final: Model uncertainty (0-1)
 * - edge_final: P_final - P_market_devig
 * - clv_forecast: Predicted CLV direction and magnitude
 *
 * CRITICAL CHANGES (v2.0.0 — syndicate layered):
 * - MARKET-ANCHORED: Confidence maps to delta AROUND p_market_devig, not absolute probability.
 * - BOUNDED ADJUSTMENT: Delta capped by dynamic cap derived from book_count + agreement.
 * - CONFIDENCE FACTOR: Multiplier (0..1) scales adjustment by data quality signals.
 * - EXPLANATION PAYLOAD: Every computation produces an operator-readable explain_v3 object.
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

/** Explanation payload for scoring transparency (SPRINT-024 Syndicate Model) */
export interface ExplanationPayload {
  model_version: string;
  p_market_devig: number;
  adjustment_raw: number;
  adjustment_capped: number;
  cap_value: number;
  cap_reason: string;
  uncertainty_final: number;
  confidence_factor: number;
  p_final: number;
  edge_final: number;
  clipped: boolean;
  reason_codes: string[];
  books_used: number;
  book_spread: number;
  feature_completeness: number;
}

/** Parameters for syndicate layer cap tuning */
export interface SyndicateLayerParams {
  maxDeltaOverride?: number;
  minBooksForCapBoost?: number;
  absoluteMaxCap?: number;
  absoluteMinCap?: number;
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
  /** Optional syndicate layer parameters for cap tuning */
  syndicateParams?: SyndicateLayerParams;
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
  /** Scoring explanation payload (SPRINT-024 Syndicate Model) */
  explain: ExplanationPayload;
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
// CONFIDENCE FACTOR (SPRINT-024 Syndicate Model)
// =============================================================================

/**
 * Compute confidence factor (0..1) for scaling the adjustment.
 * Higher = more trust in our edge claim.
 *
 * DISTINCT from uncertainty:
 * - uncertainty = how unsure we are about market truth
 * - confidence_factor = how much we trust our adjustment to be meaningful
 *
 * Derived from: book_count, book agreement (spread), data completeness.
 */
export function computeConfidenceFactor(
  booksUsed: number,
  bookSpread: number,
  featureCompleteness: number
): number {
  // More books → higher trust (2 books = 0.3, 5+ books = 1.0)
  const bookCountFactor = clamp((booksUsed - 1) / 4, 0.3, 1.0);
  // Lower spread → higher trust (spread 0 = 1.0, spread 0.06+ = 0.4)
  const agreementFactor = clamp(1 - bookSpread / 0.06, 0.4, 1.0);
  // Higher feature completeness → higher trust
  const completenessFactor = clamp(featureCompleteness, 0.3, 1.0);

  // Weighted blend: 40% books + 40% agreement + 20% completeness
  const factor = bookCountFactor * 0.4 + agreementFactor * 0.4 + completenessFactor * 0.2;

  return roundTo(clamp(factor, 0, 1), 6);
}

// =============================================================================
// DYNAMIC CAP (SPRINT-024 Syndicate Model)
// =============================================================================

/**
 * Compute dynamic cap for adjustment magnitude.
 * Default cap = MAX_DELTA (0.04), adjusted by book_count and agreement.
 * Bounded by absolute min/max to prevent extreme adjustments.
 *
 * More agreeing books → larger allowed cap (up to 0.06).
 * High book spread → smaller cap (down to 0.01).
 */
export function computeDynamicCap(
  booksUsed: number,
  bookSpread: number,
  params?: SyndicateLayerParams
): { cap: number; reason: string } {
  const baseCap = params?.maxDeltaOverride ?? MARKET_DELTA_PARAMS.MAX_DELTA;
  const minBooksBoost = params?.minBooksForCapBoost ?? 5;
  const absoluteMax = params?.absoluteMaxCap ?? 0.06;
  const absoluteMin = params?.absoluteMinCap ?? 0.01;

  // Scale cap by book count (more books = can trust larger adjustments)
  const bookFactor = clamp(booksUsed / minBooksBoost, 0.6, 1.2);
  // Scale cap by agreement (high spread = constrain adjustments)
  const agreementFactor = clamp(1 - bookSpread / 0.08, 0.5, 1.0);
  const dynamicCap = baseCap * bookFactor * agreementFactor;
  const finalCap = roundTo(clamp(dynamicCap, absoluteMin, absoluteMax), 6);

  const reasons: string[] = [];
  reasons.push(`base=${baseCap}`);
  reasons.push(`books=${booksUsed},bookFactor=${roundTo(bookFactor, 2)}`);
  reasons.push(`spread=${roundTo(bookSpread, 4)},agreeFactor=${roundTo(agreementFactor, 2)}`);
  if (finalCap === absoluteMax) reasons.push('hit_absolute_max');
  if (finalCap === absoluteMin) reasons.push('hit_absolute_min');

  return { cap: finalCap, reason: reasons.join(';') };
}

// =============================================================================
// P_FINAL COMPUTATION (SYNDICATE-LAYERED)
// =============================================================================

/** Result of P_final computation with audit details */
export interface PFinalResult {
  pFinal: number;
  adjustmentRaw: number;
  adjustmentCapped: number;
  clipped: boolean;
}

/**
 * Compute P_final using syndicate-layered delta mapping (SPRINT-024).
 *
 * Formula:
 *   delta = confidenceToDelta(confidence)                        // raw adjustment
 *   capped_delta = clamp(delta, -dynamicCap, +dynamicCap)        // bounded
 *   effective = capped_delta * confidenceFactor * (1 - uncertainty) // scaled
 *   p_final = p_market_devig + effective                         // anchored
 *
 * Invariants:
 * - p_final always in [0.01, 0.99]
 * - |capped_delta| <= dynamicCap <= 0.06 (absolute max)
 * - When confidence = 5.0 (neutral), delta = 0, so p_final = p_market_devig
 */
export function computePFinal(
  confidenceScore: number,
  pMarketDevig: number,
  uncertainty: number,
  confidenceFactor: number = 1.0,
  dynamicCap: number = MARKET_DELTA_PARAMS.MAX_DELTA
): PFinalResult {
  // Step 1: Get raw delta from confidence
  const adjustmentRaw = confidenceToDelta(confidenceScore);

  // Step 2: Apply dynamic cap (bounded adjustment)
  const adjustmentCapped = clamp(adjustmentRaw, -dynamicCap, dynamicCap);

  // Step 3: Scale by confidence factor and shrink by uncertainty
  const effectiveAdjustment = adjustmentCapped * confidenceFactor * (1 - uncertainty);

  // Step 4: Compute P_final = P_market + effective adjustment
  const pFinalRaw = pMarketDevig + effectiveAdjustment;
  const pFinal = roundTo(clamp(pFinalRaw, 0.01, 0.99), 6);
  const clipped = Math.abs(pFinalRaw - pFinal) > 1e-9;

  return {
    pFinal,
    adjustmentRaw: roundTo(adjustmentRaw, 6),
    adjustmentCapped: roundTo(adjustmentCapped, 6),
    clipped,
  };
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

  // Step 4b: Compute confidence factor (SPRINT-024 Syndicate Model)
  const confidenceFactor = computeConfidenceFactor(
    consensusOk.booksUsed,
    bookSpread,
    input.featureCompleteness
  );

  // Step 4c: Compute dynamic cap (SPRINT-024 Syndicate Model)
  const { cap: dynamicCap, reason: capReason } = computeDynamicCap(
    consensusOk.booksUsed,
    bookSpread,
    input.syndicateParams
  );

  // Step 5: Compute P_final (syndicate-layered)
  const pFinalResult = computePFinal(
    input.confidenceScore,
    pMarketDevig,
    uncertaintyFinal,
    confidenceFactor,
    dynamicCap
  );
  const pFinal = pFinalResult.pFinal;

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

  // Step 8: Build reason codes (SPRINT-024)
  const reasonCodes: string[] = [];
  if (pFinalResult.clipped) reasonCodes.push('P_FINAL_CLIPPED');
  if (dynamicCap < MARKET_DELTA_PARAMS.MAX_DELTA) reasonCodes.push('CAP_REDUCED');
  if (dynamicCap > MARKET_DELTA_PARAMS.MAX_DELTA) reasonCodes.push('CAP_BOOSTED');
  if (confidenceFactor < 0.5) reasonCodes.push('LOW_CONFIDENCE_FACTOR');
  if (uncertaintyFinal > UNCERTAINTY_THRESHOLDS.SOFT_MAX) reasonCodes.push('HIGH_UNCERTAINTY');
  if (bookSpread > 0.05) reasonCodes.push('HIGH_BOOK_SPREAD');
  if (Math.abs(edge) > 0.05) reasonCodes.push('LARGE_EDGE');
  if (Math.abs(edge) > 0.08) reasonCodes.push('EDGE_TOO_GOOD_TO_BE_TRUE');

  // Step 9: Build explanation payload (SPRINT-024)
  const explain: ExplanationPayload = {
    model_version: PROBABILITY_MODEL_VERSION,
    p_market_devig: pMarketDevig,
    adjustment_raw: pFinalResult.adjustmentRaw,
    adjustment_capped: pFinalResult.adjustmentCapped,
    cap_value: dynamicCap,
    cap_reason: capReason,
    uncertainty_final: uncertaintyFinal,
    confidence_factor: confidenceFactor,
    p_final: pFinal,
    edge_final: edge,
    clipped: pFinalResult.clipped,
    reason_codes: reasonCodes,
    books_used: consensusOk.booksUsed,
    book_spread: roundTo(bookSpread, 6),
    feature_completeness: input.featureCompleteness,
  };

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
    explain,
  };
}
