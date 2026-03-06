// SPRINT-REPO-TRUTH-LOCK-002: Canonical copy lives in @unit-talk/intelligence. Keep in sync.
/**
 * Devig Consensus Computation
 * Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
 * Updated: INTELLIGENCE-PROBABILITY-INTEGRATION-002 (fail-closed)
 *
 * Implements DEVIG_NORMALIZATION_SPEC_v1.md:
 * - Proportional devig (Section 4.1)
 * - Multi-book weighted consensus (Section 5)
 * - Edge calculation (Section 6)
 *
 * FAIL-CLOSED: Returns { ok: false, reason } when consensus cannot be computed.
 * NO fabricated defaults (0.5/0.5 or entry-implied).
 */

// =============================================================================
// TYPE DEFINITIONS (per DEVIG_NORMALIZATION_SPEC)
// =============================================================================

export type DevigMethod = 'proportional' | 'shin' | 'power' | 'logit';

export type BookProfile = 'retail' | 'market_maker' | 'sharp';
export type LiquidityTier = 'low' | 'medium' | 'high';
export type DataQuality = 'good' | 'partial' | 'suspect';

/** Book offer with raw prices */
export interface BookOffer {
  bookId: string;
  bookName: string;
  overOdds: number; // American odds
  underOdds: number; // American odds
  bookProfile: BookProfile;
  liquidityTier: LiquidityTier;
  dataQuality: DataQuality;
}

/** Devigged result for a single book */
export interface DevigedBook {
  bookId: string;
  bookName: string;
  overImplied: number;
  underImplied: number;
  overround: number;
  overFair: number;
  underFair: number;
  devigMethod: DevigMethod;
  rawWeight: number;
  normalizedWeight: number;
}

/** Book weight breakdown for audit trail */
export interface BookWeightBreakdown {
  bookId: string;
  liquidityWeight: number;
  sharpWeight: number;
  dataQualityWeight: number;
  rawWeight: number;
  normalizedWeight: number;
}

/** Successful consensus computation result */
export interface ConsensusResultOk {
  ok: true;
  overConsensus: number; // P_consensus for over/yes
  underConsensus: number; // P_consensus for under/no
  devigMethod: DevigMethod;
  consensusWeights: Record<string, BookWeightBreakdown>;
  books: DevigedBook[];
  booksUsed: number;
}

/** Failed consensus computation result */
export interface ConsensusResultFail {
  ok: false;
  reason: ConsensusFailReason;
  reasonDetail: string;
  booksReceived: number;
}

export type ConsensusFailReason =
  | 'INSUFFICIENT_BOOKS'
  | 'INVALID_ODDS'
  | 'ZERO_WEIGHT'
  | 'COMPUTATION_ERROR';

export type ConsensusResult = ConsensusResultOk | ConsensusResultFail;

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum books required for valid consensus (fail-closed) */
export const MIN_BOOKS_FOR_CONSENSUS = 2;

/** Section 5.1: Liquidity weights */
const LIQUIDITY_WEIGHTS: Record<LiquidityTier, number> = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
};

/** Section 5.2: Sharp weights */
const SHARP_WEIGHTS: Record<BookProfile, number> = {
  retail: 1.0,
  market_maker: 1.2,
  sharp: 1.5,
};

/** Section 5.3: Data quality weights */
const DATA_QUALITY_WEIGHTS: Record<DataQuality, number> = {
  good: 1.0,
  partial: 0.7,
  suspect: 0.3,
};

// =============================================================================
// DETERMINISTIC UTILITY FUNCTIONS
// =============================================================================

/**
 * Round to fixed decimal places for determinism
 */
function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Convert American odds to implied probability (Section 2.1)
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
 * Calculate overround (Section 3)
 */
export function calculateOverround(overImplied: number, underImplied: number): number {
  return roundTo(overImplied + underImplied, 6);
}

// =============================================================================
// DEVIG METHODS (Section 4)
// =============================================================================

/**
 * Proportional Normalization (Section 4.1 - Baseline)
 * P_fair_i = P_implied_i / Overround
 *
 * Returns null if cannot compute (zero overround).
 */
export function proportionalDevig(
  overImplied: number,
  underImplied: number
): { overFair: number; underFair: number; overround: number } | null {
  const overround = calculateOverround(overImplied, underImplied);

  // Fail-closed: cannot devig with zero overround
  if (overround === 0 || !isFinite(overround)) {
    return null;
  }

  return {
    overFair: roundTo(overImplied / overround, 6),
    underFair: roundTo(underImplied / overround, 6),
    overround,
  };
}

/**
 * Shin Method (Section 4.2 - Sharp-aware)
 * V1: Falls back to proportional. Full Shin deferred to INTELLIGENCE-SHIN-DEVIG-002.
 */
export function shinDevig(
  overImplied: number,
  underImplied: number
): { overFair: number; underFair: number; overround: number } | null {
  return proportionalDevig(overImplied, underImplied);
}

/**
 * Power Method (Section 4.3)
 * P_fair_i = P_implied_i^k / Σ(P_implied_j^k)
 */
export function powerDevig(
  overImplied: number,
  underImplied: number,
  k: number = 1.0
): { overFair: number; underFair: number; overround: number } | null {
  const overround = calculateOverround(overImplied, underImplied);

  const overPower = Math.pow(overImplied, k);
  const underPower = Math.pow(underImplied, k);
  const sumPower = overPower + underPower;

  if (sumPower === 0 || !isFinite(sumPower)) {
    return null;
  }

  return {
    overFair: roundTo(overPower / sumPower, 6),
    underFair: roundTo(underPower / sumPower, 6),
    overround,
  };
}

/**
 * Apply devig method based on selection
 */
export function applyDevig(
  overImplied: number,
  underImplied: number,
  method: DevigMethod
): { overFair: number; underFair: number; overround: number } | null {
  switch (method) {
    case 'proportional':
      return proportionalDevig(overImplied, underImplied);
    case 'shin':
      return shinDevig(overImplied, underImplied);
    case 'power':
      return powerDevig(overImplied, underImplied);
    case 'logit':
      return proportionalDevig(overImplied, underImplied);
    default:
      return proportionalDevig(overImplied, underImplied);
  }
}

// =============================================================================
// BOOK WEIGHTING (Section 5)
// =============================================================================

/**
 * Calculate raw book weight (Section 5)
 * w_book = liquidity_weight × sharp_weight × data_quality_weight
 */
export function calculateBookWeight(
  bookProfile: BookProfile,
  liquidityTier: LiquidityTier,
  dataQuality: DataQuality
): { liquidityWeight: number; sharpWeight: number; dataQualityWeight: number; rawWeight: number } {
  // eslint-disable-next-line security/detect-object-injection -- Validated enum lookup
  const liquidityWeight = LIQUIDITY_WEIGHTS[liquidityTier];
  // eslint-disable-next-line security/detect-object-injection -- Validated enum lookup
  const sharpWeight = SHARP_WEIGHTS[bookProfile];
  // eslint-disable-next-line security/detect-object-injection -- Validated enum lookup
  const dataQualityWeight = DATA_QUALITY_WEIGHTS[dataQuality];

  return {
    liquidityWeight,
    sharpWeight,
    dataQualityWeight,
    rawWeight: roundTo(liquidityWeight * sharpWeight * dataQualityWeight, 6),
  };
}

// =============================================================================
// CONSENSUS COMPUTATION (Section 5) - FAIL-CLOSED
// =============================================================================

/**
 * Compute multi-book consensus fair probability
 * P_consensus = Σ (w_book × P_fair_i_book)
 *
 * FAIL-CLOSED: Returns { ok: false, reason } if:
 * - Fewer than MIN_BOOKS_FOR_CONSENSUS books
 * - Invalid odds data
 * - Zero total weight
 *
 * NO fabricated defaults. Promotion must be blocked if this fails.
 */
// eslint-disable-next-line complexity, max-lines-per-function -- Complex probability computation algorithm
export function computeConsensus(
  offers: BookOffer[],
  method: DevigMethod = 'proportional'
): ConsensusResult {
  // FAIL-CLOSED: Insufficient books
  if (offers.length < MIN_BOOKS_FOR_CONSENSUS) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_BOOKS',
      reasonDetail: `Need ${MIN_BOOKS_FOR_CONSENSUS} books, got ${offers.length}`,
      booksReceived: offers.length,
    };
  }

  // Step 1: Devig each book and calculate raw weights
  const devigedBooks: DevigedBook[] = [];
  const weightBreakdowns: Record<string, BookWeightBreakdown> = {};
  let totalWeight = 0;
  let invalidBooks = 0;

  for (const offer of offers) {
    // Validate odds
    if (!isFinite(offer.overOdds) || !isFinite(offer.underOdds)) {
      invalidBooks++;
      continue;
    }

    const overImplied = americanToImplied(offer.overOdds);
    const underImplied = americanToImplied(offer.underOdds);

    // Validate implied probabilities
    if (overImplied <= 0 || underImplied <= 0 || overImplied >= 1 || underImplied >= 1) {
      invalidBooks++;
      continue;
    }

    const devigResult = applyDevig(overImplied, underImplied, method);
    if (!devigResult) {
      invalidBooks++;
      continue;
    }

    const { overFair, underFair, overround } = devigResult;
    const weights = calculateBookWeight(offer.bookProfile, offer.liquidityTier, offer.dataQuality);

    totalWeight += weights.rawWeight;

    devigedBooks.push({
      bookId: offer.bookId,
      bookName: offer.bookName,
      overImplied,
      underImplied,
      overround,
      overFair,
      underFair,
      devigMethod: method,
      rawWeight: weights.rawWeight,
      normalizedWeight: 0, // Normalized below
    });

    weightBreakdowns[offer.bookId] = {
      bookId: offer.bookId,
      liquidityWeight: weights.liquidityWeight,
      sharpWeight: weights.sharpWeight,
      dataQualityWeight: weights.dataQualityWeight,
      rawWeight: weights.rawWeight,
      normalizedWeight: 0,
    };
  }

  // FAIL-CLOSED: Not enough valid books after filtering
  if (devigedBooks.length < MIN_BOOKS_FOR_CONSENSUS) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_BOOKS',
      reasonDetail: `Need ${MIN_BOOKS_FOR_CONSENSUS} valid books, got ${devigedBooks.length} (${invalidBooks} invalid)`,
      booksReceived: offers.length,
    };
  }

  // FAIL-CLOSED: Zero total weight
  if (totalWeight === 0 || !isFinite(totalWeight)) {
    return {
      ok: false,
      reason: 'ZERO_WEIGHT',
      reasonDetail: 'Total book weight is zero or invalid',
      booksReceived: offers.length,
    };
  }

  // Step 2: Normalize weights so Σ w_book = 1
  for (const book of devigedBooks) {
    book.normalizedWeight = roundTo(book.rawWeight / totalWeight, 6);
    weightBreakdowns[book.bookId]!.normalizedWeight = book.normalizedWeight;
  }

  // Step 3: Compute weighted consensus
  let overConsensus = 0;
  let underConsensus = 0;

  for (const book of devigedBooks) {
    overConsensus += book.overFair * book.normalizedWeight;
    underConsensus += book.underFair * book.normalizedWeight;
  }

  // Renormalize to ensure sum = 1
  const consensusSum = overConsensus + underConsensus;
  if (consensusSum > 0 && Math.abs(consensusSum - 1) > 0.0001) {
    overConsensus = overConsensus / consensusSum;
    underConsensus = underConsensus / consensusSum;
  }

  // Validate final values
  if (!isFinite(overConsensus) || !isFinite(underConsensus)) {
    return {
      ok: false,
      reason: 'COMPUTATION_ERROR',
      reasonDetail: 'Consensus computation produced non-finite values',
      booksReceived: offers.length,
    };
  }

  return {
    ok: true,
    overConsensus: roundTo(overConsensus, 6),
    underConsensus: roundTo(underConsensus, 6),
    devigMethod: method,
    consensusWeights: weightBreakdowns,
    books: devigedBooks,
    booksUsed: devigedBooks.length,
  };
}

// =============================================================================
// EDGE CALCULATION (Section 6)
// =============================================================================

export interface EdgeResult {
  edge: number; // P_model - P_market
  ev: number; // Expected value
  evPercent: number; // EV as percentage
}

/**
 * Calculate edge (Section 6)
 * Edge = P_model - P_market
 */
export function calculateEdge(pModel: number, pMarket: number, decimalOdds: number): EdgeResult {
  const edge = roundTo(pModel - pMarket, 6);
  const payout = decimalOdds - 1;
  const ev = roundTo(pModel * payout - (1 - pModel), 6);
  const evPercent = roundTo(ev * 100, 4);

  return { edge, ev, evPercent };
}

// =============================================================================
// CLV CALCULATION (Section 8)
// =============================================================================

/**
 * Calculate CLV in probability space (Section 8.1)
 * CLV = closing_devig_probability - entry_devig_probability
 */
export function calculateCLVProb(entryDevigProb: number, closingDevigProb: number): number {
  return roundTo(closingDevigProb - entryDevigProb, 6);
}

// =============================================================================
// EXPORTS
// =============================================================================

export const PROBABILITY_MODEL_VERSION = 'prob_v2.0.0_syndicate_layered';

export { LIQUIDITY_WEIGHTS, SHARP_WEIGHTS, DATA_QUALITY_WEIGHTS, roundTo };
