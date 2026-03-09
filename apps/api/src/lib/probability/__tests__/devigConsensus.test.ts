/**
 * Devig Consensus Tests
 * Sprint: SPRINT-MULTI-BOOK-CONSENSUS-SCORING
 *
 * Tests for the core consensus engine:
 * - americanToImplied() conversion precision
 * - proportionalDevig() / powerDevig() correctness
 * - calculateBookWeight() isolation (sharp > market_maker > retail)
 * - computeConsensus() integration:
 *   - 2-book minimum (INSUFFICIENT_BOOKS gate)
 *   - 3-book sharp-weighted consensus
 *   - INVALID_ODDS filtering → INSUFFICIENT_BOOKS after filter
 *   - ZERO_WEIGHT gate
 *   - Determinism (same input → same output)
 *   - overConsensus + underConsensus ≈ 1.0
 *   - consensusWeights audit trail
 * - calculateEdge() / calculateCLVProb()
 */

import { describe, it, expect } from 'vitest';

import {
  americanToImplied,
  calculateOverround,
  proportionalDevig,
  powerDevig,
  applyDevig,
  calculateBookWeight,
  computeConsensus,
  calculateEdge,
  calculateCLVProb,
  MIN_BOOKS_FOR_CONSENSUS,
  PROBABILITY_MODEL_VERSION,
  LIQUIDITY_WEIGHTS,
  SHARP_WEIGHTS,
  DATA_QUALITY_WEIGHTS,
  roundTo,
  type BookOffer,
  type ConsensusResultOk,
  type ConsensusResultFail,
} from '../devigConsensus';

// =============================================================================
// Fixtures
// =============================================================================

function makeBook(
  id: string,
  overOdds: number,
  underOdds: number,
  profile: BookOffer['bookProfile'] = 'sharp',
  liquidity: BookOffer['liquidityTier'] = 'high',
  quality: BookOffer['dataQuality'] = 'good'
): BookOffer {
  return {
    bookId: id,
    bookName: id,
    overOdds,
    underOdds,
    bookProfile: profile,
    liquidityTier: liquidity,
    dataQuality: quality,
  };
}

// Two standard books at -110/-110 (symmetric, fair = 0.5 each)
const TWO_BOOKS_EVEN: BookOffer[] = [
  makeBook('pinnacle', -110, -110, 'sharp', 'high', 'good'),
  makeBook('fanduel', -110, -110, 'market_maker', 'high', 'good'),
];

// Three books with slight disagreement
const THREE_BOOKS_MIXED: BookOffer[] = [
  makeBook('pinnacle', -120, +100, 'sharp', 'high', 'good'),
  makeBook('fanduel', -115, +105, 'market_maker', 'high', 'good'),
  makeBook('betmgm', -110, -110, 'retail', 'medium', 'good'),
];

// =============================================================================
// americanToImplied
// =============================================================================

describe('americanToImplied', () => {
  it('converts negative American odds correctly', () => {
    // -110 → 110/210
    const result = americanToImplied(-110);
    expect(result).toBeCloseTo(110 / 210, 4);
  });

  it('converts positive American odds correctly', () => {
    // +110 → 100/210
    const result = americanToImplied(110);
    expect(result).toBeCloseTo(100 / 210, 4);
  });

  it('-200 favorite', () => {
    expect(americanToImplied(-200)).toBeCloseTo(2 / 3, 4);
  });

  it('+200 underdog', () => {
    expect(americanToImplied(200)).toBeCloseTo(1 / 3, 4);
  });

  it('-100 returns 0.5', () => {
    expect(americanToImplied(-100)).toBeCloseTo(0.5, 4);
  });

  it('+100 returns 0.5', () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 4);
  });

  it('0 returns 0.5 (special case)', () => {
    expect(americanToImplied(0)).toBe(0.5);
  });

  it('result is always in (0, 1)', () => {
    const odds = [-500, -200, -110, -100, 100, 110, 200, 500];
    for (const o of odds) {
      const v = americanToImplied(o);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rounds to 6 decimal places', () => {
    const result = americanToImplied(-110);
    const decimals = (result.toString().split('.')[1] ?? '').length;
    expect(decimals).toBeLessThanOrEqual(6);
  });

  it('negative and positive mirror: sum ≈ 1 for matching odds', () => {
    // -110 and +110 don't sum to 1 (that would be overround=0), but -100/+100 do
    expect(americanToImplied(-100) + americanToImplied(100)).toBeCloseTo(1.0, 6);
  });
});

// =============================================================================
// calculateOverround
// =============================================================================

describe('calculateOverround', () => {
  it('returns overround for symmetric -110/-110 juice', () => {
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const or = calculateOverround(over, under);
    expect(or).toBeGreaterThan(1.0);
    expect(or).toBeCloseTo(1.0476, 3);
  });

  it('returns 1.0 for zero-vig market', () => {
    expect(calculateOverround(0.5, 0.5)).toBeCloseTo(1.0, 6);
  });

  it('rounds to 6 decimals', () => {
    const result = calculateOverround(0.52381, 0.47619);
    const decimals = (result.toString().split('.')[1] ?? '').length;
    expect(decimals).toBeLessThanOrEqual(6);
  });
});

// =============================================================================
// proportionalDevig
// =============================================================================

describe('proportionalDevig', () => {
  it('fair probabilities sum to 1.0 for symmetric -110/-110', () => {
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const result = proportionalDevig(over, under);
    expect(result).not.toBeNull();
    expect(result!.overFair + result!.underFair).toBeCloseTo(1.0, 5);
  });

  it('symmetric odds yield overFair = underFair = 0.5', () => {
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const result = proportionalDevig(over, under);
    expect(result!.overFair).toBeCloseTo(0.5, 4);
    expect(result!.underFair).toBeCloseTo(0.5, 4);
  });

  it('favorite has higher fair probability than underdog', () => {
    const over = americanToImplied(-130); // favorite
    const under = americanToImplied(+110); // underdog
    const result = proportionalDevig(over, under);
    expect(result!.overFair).toBeGreaterThan(0.5);
    expect(result!.underFair).toBeLessThan(0.5);
  });

  it('returns null for zero overround', () => {
    const result = proportionalDevig(0, 0);
    expect(result).toBeNull();
  });

  it('overround field is populated', () => {
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const result = proportionalDevig(over, under);
    expect(result!.overround).toBeGreaterThan(1.0);
  });

  it('devig removes vig — fair probs are lower than implied for same side', () => {
    // With juice, implied > fair (vig extracted from both sides)
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const result = proportionalDevig(over, under);
    // overFair should be < overImplied (the excess was vig)
    expect(result!.overFair).toBeLessThan(over);
    expect(result!.underFair).toBeLessThan(under);
  });
});

// =============================================================================
// powerDevig
// =============================================================================

describe('powerDevig', () => {
  it('k=1 produces same result as proportional', () => {
    const over = americanToImplied(-110);
    const under = americanToImplied(-110);
    const prop = proportionalDevig(over, under);
    const power = powerDevig(over, under, 1.0);
    expect(power!.overFair).toBeCloseTo(prop!.overFair, 4);
    expect(power!.underFair).toBeCloseTo(prop!.underFair, 4);
  });

  it('k=2 over-weights the stronger side', () => {
    // -130 favorite. Power with k=2 should give higher fair to favorite
    const over = americanToImplied(-130);
    const under = americanToImplied(+110);
    const prop = proportionalDevig(over, under)!;
    const power = powerDevig(over, under, 2.0)!;
    // Power devig amplifies the favorite's probability relative to proportional
    expect(power.overFair).toBeGreaterThan(prop.overFair);
    expect(power.underFair).toBeLessThan(prop.underFair);
  });

  it('fair probs sum to 1.0', () => {
    const over = americanToImplied(-115);
    const under = americanToImplied(+100);
    const result = powerDevig(over, under, 1.5);
    expect(result!.overFair + result!.underFair).toBeCloseTo(1.0, 5);
  });

  it('returns null when sum of powers is zero', () => {
    const result = powerDevig(0, 0, 1.0);
    // 0^1 + 0^1 = 0 → null
    expect(result).toBeNull();
  });

  it('result is always in (0, 1) for valid inputs', () => {
    const over = americanToImplied(-200);
    const under = americanToImplied(+160);
    const result = powerDevig(over, under, 1.0)!;
    expect(result.overFair).toBeGreaterThan(0);
    expect(result.overFair).toBeLessThan(1);
    expect(result.underFair).toBeGreaterThan(0);
    expect(result.underFair).toBeLessThan(1);
  });
});

// =============================================================================
// applyDevig
// =============================================================================

describe('applyDevig', () => {
  const over = americanToImplied(-110);
  const under = americanToImplied(-110);

  it('proportional method matches proportionalDevig()', () => {
    const a = applyDevig(over, under, 'proportional');
    const b = proportionalDevig(over, under);
    expect(a!.overFair).toBe(b!.overFair);
  });

  it('shin method returns non-null result', () => {
    // Shin V1 falls back to proportional
    const result = applyDevig(over, under, 'shin');
    expect(result).not.toBeNull();
    expect(result!.overFair + result!.underFair).toBeCloseTo(1.0, 5);
  });

  it('logit method returns non-null result', () => {
    // Logit V1 falls back to proportional
    const result = applyDevig(over, under, 'logit');
    expect(result).not.toBeNull();
  });

  it('power method returns non-null result', () => {
    const result = applyDevig(over, under, 'power');
    expect(result).not.toBeNull();
  });
});

// =============================================================================
// calculateBookWeight
// =============================================================================

describe('calculateBookWeight', () => {
  it('sharp/high/good produces highest weight', () => {
    const w = calculateBookWeight('sharp', 'high', 'good');
    expect(w.rawWeight).toBeCloseTo(
      SHARP_WEIGHTS.sharp * LIQUIDITY_WEIGHTS.high * DATA_QUALITY_WEIGHTS.good,
      4
    );
    expect(w.rawWeight).toBe(2.25); // 1.5 × 1.5 × 1.0
  });

  it('retail/low/suspect produces lowest weight', () => {
    const w = calculateBookWeight('retail', 'low', 'suspect');
    expect(w.rawWeight).toBeCloseTo(1.0 * 0.5 * 0.3, 4);
    expect(w.rawWeight).toBe(0.15); // 1.0 × 0.5 × 0.3
  });

  it('market_maker/medium/partial', () => {
    const w = calculateBookWeight('market_maker', 'medium', 'partial');
    expect(w.rawWeight).toBeCloseTo(1.2 * 1.0 * 0.7, 4);
    expect(w.rawWeight).toBeCloseTo(0.84, 4);
  });

  it('sharp outweighs retail (same liquidity/quality)', () => {
    const sharp = calculateBookWeight('sharp', 'medium', 'good');
    const retail = calculateBookWeight('retail', 'medium', 'good');
    expect(sharp.rawWeight).toBeGreaterThan(retail.rawWeight);
  });

  it('high liquidity outweighs low (same profile/quality)', () => {
    const high = calculateBookWeight('market_maker', 'high', 'good');
    const low = calculateBookWeight('market_maker', 'low', 'good');
    expect(high.rawWeight).toBeGreaterThan(low.rawWeight);
  });

  it('good quality outweighs suspect (same profile/liquidity)', () => {
    const good = calculateBookWeight('retail', 'medium', 'good');
    const suspect = calculateBookWeight('retail', 'medium', 'suspect');
    expect(good.rawWeight).toBeGreaterThan(suspect.rawWeight);
  });

  it('breakdown fields match individual weights', () => {
    const w = calculateBookWeight('sharp', 'high', 'partial');
    expect(w.liquidityWeight).toBe(LIQUIDITY_WEIGHTS.high);
    expect(w.sharpWeight).toBe(SHARP_WEIGHTS.sharp);
    expect(w.dataQualityWeight).toBe(DATA_QUALITY_WEIGHTS.partial);
    expect(w.rawWeight).toBeCloseTo(w.liquidityWeight * w.sharpWeight * w.dataQualityWeight, 6);
  });
});

// =============================================================================
// computeConsensus — gate: INSUFFICIENT_BOOKS
// =============================================================================

describe('computeConsensus — INSUFFICIENT_BOOKS gate', () => {
  it('returns INSUFFICIENT_BOOKS for 0 offers', () => {
    const result = computeConsensus([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INSUFFICIENT_BOOKS');
      expect(result.booksReceived).toBe(0);
    }
  });

  it('returns INSUFFICIENT_BOOKS for 1 offer', () => {
    const result = computeConsensus([makeBook('single', -110, -110)]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INSUFFICIENT_BOOKS');
      expect(result.booksReceived).toBe(1);
    }
  });

  it('fails if all offers have invalid odds (Infinity)', () => {
    const result = computeConsensus([makeBook('a', Infinity, -110), makeBook('b', -110, Infinity)]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INSUFFICIENT_BOOKS');
    }
  });

  it('succeeds with 2 valid + 1 invalid (filters invalid, keeps 2)', () => {
    const result = computeConsensus([
      makeBook('a', -110, -110),
      makeBook('b', -110, -110),
      makeBook('bad', Infinity, -110), // invalid
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booksUsed).toBe(2);
    }
  });

  it('MIN_BOOKS_FOR_CONSENSUS is 2', () => {
    expect(MIN_BOOKS_FOR_CONSENSUS).toBe(2);
  });
});

// =============================================================================
// computeConsensus — successful computation
// =============================================================================

describe('computeConsensus — successful computation', () => {
  it('2 books at -110/-110 yields overConsensus ≈ underConsensus ≈ 0.5', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN);
    expect(result.ok).toBe(true);
    const ok = result as ConsensusResultOk;
    expect(ok.overConsensus).toBeCloseTo(0.5, 4);
    expect(ok.underConsensus).toBeCloseTo(0.5, 4);
  });

  it('overConsensus + underConsensus = 1.0 for 2-book case', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(result.overConsensus + result.underConsensus).toBeCloseTo(1.0, 5);
  });

  it('overConsensus + underConsensus = 1.0 for 3-book mixed case', () => {
    const result = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    expect(result.ok).toBe(true);
    expect(result.overConsensus + result.underConsensus).toBeCloseTo(1.0, 5);
  });

  it('booksUsed matches number of valid books provided', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(result.booksUsed).toBe(2);

    const result3 = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    expect(result3.booksUsed).toBe(3);
  });

  it('devigMethod is set to proportional by default', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(result.devigMethod).toBe('proportional');
  });

  it('consensusWeights audit trail is populated for each book', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(Object.keys(result.consensusWeights)).toHaveLength(2);
    expect(result.consensusWeights['pinnacle']).toBeDefined();
    expect(result.consensusWeights['fanduel']).toBeDefined();
  });

  it('normalized weights sum to 1.0', () => {
    const result = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    const totalNorm = Object.values(result.consensusWeights).reduce(
      (sum, w) => sum + w.normalizedWeight,
      0
    );
    expect(totalNorm).toBeCloseTo(1.0, 5);
  });

  it('sharp book receives higher weight than retail book', () => {
    const result = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    const pinnacleWeight = result.consensusWeights['pinnacle'];
    const betmgmWeight = result.consensusWeights['betmgm'];
    expect(pinnacleWeight).toBeDefined();
    expect(betmgmWeight).toBeDefined();
    expect(pinnacleWeight!.normalizedWeight).toBeGreaterThan(betmgmWeight!.normalizedWeight);
  });

  it('books array is populated with devig results', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(result.books).toHaveLength(2);
    for (const book of result.books) {
      expect(book.overFair).toBeGreaterThan(0);
      expect(book.overFair).toBeLessThan(1);
      expect(book.underFair).toBeGreaterThan(0);
      expect(book.underFair).toBeLessThan(1);
      expect(book.overFair + book.underFair).toBeCloseTo(1.0, 5);
    }
  });

  it('consensus is finite', () => {
    const result = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    expect(isFinite(result.overConsensus)).toBe(true);
    expect(isFinite(result.underConsensus)).toBe(true);
  });

  it('consensus values are in (0, 1)', () => {
    const result = computeConsensus(THREE_BOOKS_MIXED) as ConsensusResultOk;
    expect(result.overConsensus).toBeGreaterThan(0);
    expect(result.overConsensus).toBeLessThan(1);
    expect(result.underConsensus).toBeGreaterThan(0);
    expect(result.underConsensus).toBeLessThan(1);
  });
});

// =============================================================================
// computeConsensus — determinism
// =============================================================================

describe('computeConsensus — determinism', () => {
  it('same input produces identical output on repeated calls', () => {
    const books = THREE_BOOKS_MIXED;
    const r1 = computeConsensus(books) as ConsensusResultOk;
    const r2 = computeConsensus(books) as ConsensusResultOk;
    expect(r1.overConsensus).toBe(r2.overConsensus);
    expect(r1.underConsensus).toBe(r2.underConsensus);
    expect(r1.booksUsed).toBe(r2.booksUsed);
  });

  it('produces same result regardless of book order (stable)', () => {
    const booksAB = [
      makeBook('pinnacle', -115, +105, 'sharp', 'high', 'good'),
      makeBook('fanduel', -110, -110, 'market_maker', 'high', 'good'),
    ];
    const booksBA = [
      makeBook('fanduel', -110, -110, 'market_maker', 'high', 'good'),
      makeBook('pinnacle', -115, +105, 'sharp', 'high', 'good'),
    ];
    const r1 = computeConsensus(booksAB) as ConsensusResultOk;
    const r2 = computeConsensus(booksBA) as ConsensusResultOk;
    // Different order, same books → same consensus (weight-based, order-independent)
    expect(r1.overConsensus).toBeCloseTo(r2.overConsensus, 6);
    expect(r1.underConsensus).toBeCloseTo(r2.underConsensus, 6);
  });
});

// =============================================================================
// computeConsensus — sharp weighting dominates consensus
// =============================================================================

describe('computeConsensus — sharp book influence', () => {
  it('sharp book moves consensus toward its opinion vs retail disagreement', () => {
    // Sharp: -130/+110 (62.5% over fair approx)
    // Retail: -100/+100 (50% fair)
    // Consensus should be closer to sharp's view
    const sharpHeavy: BookOffer[] = [
      makeBook('sharp1', -130, 110, 'sharp', 'high', 'good'),
      makeBook('retail1', -100, 100, 'retail', 'low', 'good'),
    ];
    const result = computeConsensus(sharpHeavy) as ConsensusResultOk;
    expect(result.ok).toBe(true);
    // Sharp weight: 2.25 (1.5×1.5×1.0), Retail weight: 0.5 (1.0×0.5×1.0)
    // Sharp ~82% weight. Sharp fair ≈ 0.543, retail fair = 0.5 → consensus ≈ 0.535
    expect(result.overConsensus).toBeGreaterThan(0.52);
    // And specifically above what retail alone would give
    expect(result.overConsensus).toBeGreaterThan(0.5);
  });

  it('two sharp books vs one retail: sharp consensus dominates', () => {
    const books: BookOffer[] = [
      makeBook('sharp1', -125, 105, 'sharp', 'high', 'good'),
      makeBook('sharp2', -120, 100, 'sharp', 'high', 'good'),
      makeBook('retail1', -100, 100, 'retail', 'low', 'good'),
    ];
    const result = computeConsensus(books) as ConsensusResultOk;
    expect(result.ok).toBe(true);
    // With two sharp books, consensus should be well above 0.5
    expect(result.overConsensus).toBeGreaterThan(0.52);
  });
});

// =============================================================================
// computeConsensus — missing book / partial data scenarios
// =============================================================================

describe('computeConsensus — partial data scenarios', () => {
  it('partial data quality reduces weight relative to good quality', () => {
    const goodBooks: BookOffer[] = [
      makeBook('a', -110, -110, 'sharp', 'high', 'good'),
      makeBook('b', -110, -110, 'sharp', 'high', 'good'),
    ];
    const partialBooks: BookOffer[] = [
      makeBook('a', -110, -110, 'sharp', 'high', 'partial'),
      makeBook('b', -110, -110, 'sharp', 'high', 'partial'),
    ];

    const goodResult = computeConsensus(goodBooks) as ConsensusResultOk;
    const partialResult = computeConsensus(partialBooks) as ConsensusResultOk;

    // Both agree on 0.5, so consensus values should be equal
    expect(goodResult.overConsensus).toBeCloseTo(partialResult.overConsensus, 4);

    // But raw weights should be lower for partial
    const goodWeight = Object.values(goodResult.consensusWeights)[0]!.rawWeight;
    const partialWeight = Object.values(partialResult.consensusWeights)[0]!.rawWeight;
    expect(partialWeight).toBeLessThan(goodWeight);
  });

  it('suspect data quality still counted but lower weight', () => {
    const result = computeConsensus([
      makeBook('a', -110, -110, 'sharp', 'high', 'suspect'),
      makeBook('b', -110, -110, 'sharp', 'high', 'suspect'),
    ]) as ConsensusResultOk;
    expect(result.ok).toBe(true);
    expect(result.booksUsed).toBe(2);
    // All suspect, but consensus is still computed
    const weights = Object.values(result.consensusWeights);
    expect(weights[0]!.dataQualityWeight).toBe(DATA_QUALITY_WEIGHTS.suspect);
  });

  it('single valid book among many invalid → INSUFFICIENT_BOOKS', () => {
    const result = computeConsensus([
      makeBook('good', -110, -110),
      makeBook('bad1', Infinity, -110),
      makeBook('bad2', -110, Infinity),
      makeBook('bad3', NaN, -110),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INSUFFICIENT_BOOKS');
    }
  });
});

// =============================================================================
// computeConsensus — devig method selection
// =============================================================================

describe('computeConsensus — devig method selection', () => {
  it('uses proportional by default', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN) as ConsensusResultOk;
    expect(result.devigMethod).toBe('proportional');
  });

  it('accepts power method', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN, 'power') as ConsensusResultOk;
    expect(result.ok).toBe(true);
    expect(result.devigMethod).toBe('power');
  });

  it('accepts shin method', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN, 'shin') as ConsensusResultOk;
    expect(result.ok).toBe(true);
  });

  it('accepts logit method', () => {
    const result = computeConsensus(TWO_BOOKS_EVEN, 'logit') as ConsensusResultOk;
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// calculateEdge
// =============================================================================

describe('calculateEdge', () => {
  it('positive edge when model > market', () => {
    // decimalOdds for -110: 100/110 + 1 = 1.909...
    const decimalOdds = 100 / 110 + 1;
    const result = calculateEdge(0.55, 0.52, decimalOdds);
    expect(result.edge).toBeGreaterThan(0);
    expect(isFinite(result.ev)).toBe(true);
  });

  it('zero edge when model = market', () => {
    const decimalOdds = 2.0; // +100
    const result = calculateEdge(0.5, 0.5, decimalOdds);
    expect(result.edge).toBe(0);
    expect(result.ev).toBeCloseTo(0, 6);
  });

  it('negative edge when model < market', () => {
    const decimalOdds = 2.0;
    const result = calculateEdge(0.45, 0.5, decimalOdds);
    expect(result.edge).toBeLessThan(0);
  });

  it('evPercent = ev * 100', () => {
    const decimalOdds = 2.0;
    const result = calculateEdge(0.55, 0.5, decimalOdds);
    expect(result.evPercent).toBeCloseTo(result.ev * 100, 4);
  });

  it('edge = pModel - pMarket', () => {
    const decimalOdds = 1.91;
    const result = calculateEdge(0.57, 0.52, decimalOdds);
    expect(result.edge).toBeCloseTo(0.57 - 0.52, 5);
  });
});

// =============================================================================
// calculateCLVProb
// =============================================================================

describe('calculateCLVProb', () => {
  it('positive CLV when closing line moves in our favor', () => {
    // Closing devig prob higher than entry = favorable
    const clv = calculateCLVProb(0.52, 0.56);
    expect(clv).toBeGreaterThan(0);
  });

  it('negative CLV when closing line moves against us', () => {
    const clv = calculateCLVProb(0.52, 0.48);
    expect(clv).toBeLessThan(0);
  });

  it('zero CLV when closing = entry', () => {
    const clv = calculateCLVProb(0.52, 0.52);
    expect(clv).toBe(0);
  });

  it('CLV = closing - entry exactly', () => {
    const clv = calculateCLVProb(0.5, 0.55);
    expect(clv).toBeCloseTo(0.05, 6);
  });
});

// =============================================================================
// Constants and exports
// =============================================================================

describe('constants and exports', () => {
  it('PROBABILITY_MODEL_VERSION contains syndicate_layered', () => {
    expect(PROBABILITY_MODEL_VERSION).toContain('syndicate_layered');
  });

  it('LIQUIDITY_WEIGHTS: high > medium > low', () => {
    expect(LIQUIDITY_WEIGHTS.high).toBeGreaterThan(LIQUIDITY_WEIGHTS.medium);
    expect(LIQUIDITY_WEIGHTS.medium).toBeGreaterThan(LIQUIDITY_WEIGHTS.low);
  });

  it('SHARP_WEIGHTS: sharp > market_maker > retail', () => {
    expect(SHARP_WEIGHTS.sharp).toBeGreaterThan(SHARP_WEIGHTS.market_maker);
    expect(SHARP_WEIGHTS.market_maker).toBeGreaterThan(SHARP_WEIGHTS.retail);
  });

  it('DATA_QUALITY_WEIGHTS: good > partial > suspect', () => {
    expect(DATA_QUALITY_WEIGHTS.good).toBeGreaterThan(DATA_QUALITY_WEIGHTS.partial);
    expect(DATA_QUALITY_WEIGHTS.partial).toBeGreaterThan(DATA_QUALITY_WEIGHTS.suspect);
  });

  it('roundTo precision utility', () => {
    expect(roundTo(1.23456789, 4)).toBe(1.2346);
    expect(roundTo(0.999995, 5)).toBe(1.0);
    expect(roundTo(0.1 + 0.2, 6)).toBe(0.3);
  });
});
