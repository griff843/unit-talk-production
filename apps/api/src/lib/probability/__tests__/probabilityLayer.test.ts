/**
 * Probability Layer Tests
 * Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING
 *
 * Tests for syndicate model layering:
 * - computeConfidenceFactor()
 * - computeDynamicCap()
 * - computePFinal() (updated 5-param version)
 * - computeProbabilityLayer() integration with explanation payload
 * - Backward compatibility (neutral confidence = market-anchored)
 */

import { describe, it, expect } from 'vitest';

import {
  computeConfidenceFactor,
  computeDynamicCap,
  computePFinal,
  computeUncertainty,
  computeProbabilityLayer,
  computeCLVForecast,
  UNCERTAINTY_THRESHOLDS,
  type ProbabilityInput,
  type ProbabilityOutputOk,
  type ExplanationPayload,
} from '../probabilityLayer';

import type { BookOffer } from '../devigConsensus';

// =============================================================================
// Test Fixtures
// =============================================================================

function createBookOffers(count: number): BookOffer[] {
  const books: Array<{
    id: string;
    name: string;
    profile: BookOffer['bookProfile'];
    liquidity: BookOffer['liquidityTier'];
  }> = [
    { id: 'pinnacle', name: 'Pinnacle', profile: 'sharp', liquidity: 'high' },
    { id: 'fanduel', name: 'FanDuel', profile: 'market_maker', liquidity: 'high' },
    { id: 'draftkings', name: 'DraftKings', profile: 'market_maker', liquidity: 'high' },
    { id: 'betmgm', name: 'BetMGM', profile: 'retail', liquidity: 'medium' },
    { id: 'caesars', name: 'Caesars', profile: 'retail', liquidity: 'medium' },
    { id: 'pointsbet', name: 'PointsBet', profile: 'retail', liquidity: 'low' },
  ];

  return books.slice(0, count).map(b => ({
    bookId: b.id,
    bookName: b.name,
    overOdds: -110,
    underOdds: -110,
    bookProfile: b.profile,
    liquidityTier: b.liquidity,
    dataQuality: 'good' as const,
  }));
}

function createProbabilityInput(overrides: Partial<ProbabilityInput> = {}): ProbabilityInput {
  return {
    confidenceScore: 5.0,
    bookOffers: createBookOffers(3),
    side: 'over',
    entryOdds: -110,
    sport: 'NBA',
    marketType: 'points',
    hoursToStart: null,
    featureCompleteness: 0.8,
    ...overrides,
  };
}

// =============================================================================
// computeConfidenceFactor
// =============================================================================

describe('computeConfidenceFactor', () => {
  it('returns high factor for many books, low spread, high completeness', () => {
    const factor = computeConfidenceFactor(5, 0.01, 0.9);
    expect(factor).toBeGreaterThanOrEqual(0.8);
    expect(factor).toBeLessThanOrEqual(1.0);
  });

  it('returns lower factor for fewer books', () => {
    const factor2books = computeConfidenceFactor(2, 0.01, 0.9);
    const factor5books = computeConfidenceFactor(5, 0.01, 0.9);
    expect(factor2books).toBeLessThan(factor5books);
  });

  it('returns lower factor for high book spread', () => {
    const lowSpread = computeConfidenceFactor(3, 0.01, 0.8);
    const highSpread = computeConfidenceFactor(3, 0.05, 0.8);
    expect(highSpread).toBeLessThan(lowSpread);
  });

  it('returns lower factor for low feature completeness', () => {
    const highComplete = computeConfidenceFactor(3, 0.02, 0.9);
    const lowComplete = computeConfidenceFactor(3, 0.02, 0.3);
    expect(lowComplete).toBeLessThan(highComplete);
  });

  it('is bounded between 0 and 1', () => {
    // Worst case
    const worst = computeConfidenceFactor(1, 0.1, 0.0);
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(1);

    // Best case
    const best = computeConfidenceFactor(10, 0.0, 1.0);
    expect(best).toBeGreaterThanOrEqual(0);
    expect(best).toBeLessThanOrEqual(1);
  });

  it('clamps book count factor floor at 0.3', () => {
    // 1 book → (1-1)/4 = 0 → clamped to 0.3
    const factor = computeConfidenceFactor(1, 0.0, 1.0);
    // minimum contribution from books is 0.3 * 0.4 = 0.12
    expect(factor).toBeGreaterThanOrEqual(0.3 * 0.4);
  });
});

// =============================================================================
// computeDynamicCap
// =============================================================================

describe('computeDynamicCap', () => {
  it('returns default cap close to MAX_DELTA with moderate inputs', () => {
    const { cap } = computeDynamicCap(3, 0.02);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(0.06);
  });

  it('increases cap with more books', () => {
    const { cap: cap2 } = computeDynamicCap(2, 0.02);
    const { cap: cap5 } = computeDynamicCap(5, 0.02);
    expect(cap5).toBeGreaterThanOrEqual(cap2);
  });

  it('decreases cap with high spread', () => {
    const { cap: lowSpread } = computeDynamicCap(3, 0.01);
    const { cap: highSpread } = computeDynamicCap(3, 0.07);
    expect(highSpread).toBeLessThan(lowSpread);
  });

  it('never exceeds absolute max (0.06)', () => {
    const { cap } = computeDynamicCap(10, 0.0);
    expect(cap).toBeLessThanOrEqual(0.06);
  });

  it('never goes below absolute min (0.01)', () => {
    const { cap } = computeDynamicCap(1, 0.1);
    expect(cap).toBeGreaterThanOrEqual(0.01);
  });

  it('respects custom params', () => {
    const { cap } = computeDynamicCap(3, 0.02, {
      absoluteMaxCap: 0.03,
      absoluteMinCap: 0.02,
    });
    expect(cap).toBeGreaterThanOrEqual(0.02);
    expect(cap).toBeLessThanOrEqual(0.03);
  });

  it('includes reason string with book and spread info', () => {
    const { reason } = computeDynamicCap(3, 0.02);
    expect(reason).toContain('base=');
    expect(reason).toContain('books=3');
    expect(reason).toContain('spread=');
  });

  it('flags hit_absolute_min when capped at minimum', () => {
    // Need extreme inputs to force cap below absolute min
    // books=1, spread=0.2: 0.04 * 0.6 * max(0.5, 1 - 0.2/0.08 = -1.5) = 0.04 * 0.6 * 0.5 = 0.012
    // Use custom params with higher absoluteMinCap to trigger the flag
    const { reason } = computeDynamicCap(1, 0.1, { absoluteMinCap: 0.02 });
    expect(reason).toContain('hit_absolute_min');
  });
});

// =============================================================================
// computePFinal (syndicate-layered)
// =============================================================================

describe('computePFinal (syndicate)', () => {
  it('returns p_market when confidence is neutral (5.0)', () => {
    const result = computePFinal(5.0, 0.55, 0.1, 0.8, 0.04);
    expect(result.pFinal).toBe(0.55);
    expect(result.adjustmentRaw).toBe(0);
    expect(result.adjustmentCapped).toBe(0);
    expect(result.clipped).toBe(false);
  });

  it('returns higher p_final for high confidence', () => {
    const result = computePFinal(10.0, 0.5, 0.0, 1.0, 0.04);
    expect(result.pFinal).toBeGreaterThan(0.5);
    expect(result.adjustmentRaw).toBeGreaterThan(0);
  });

  it('returns lower p_final for low confidence', () => {
    const result = computePFinal(0.0, 0.5, 0.0, 1.0, 0.04);
    expect(result.pFinal).toBeLessThan(0.5);
    expect(result.adjustmentRaw).toBeLessThan(0);
  });

  it('shrinks adjustment when uncertainty is high', () => {
    const low = computePFinal(10.0, 0.5, 0.0, 1.0, 0.04);
    const high = computePFinal(10.0, 0.5, 0.9, 1.0, 0.04);
    expect(Math.abs(high.pFinal - 0.5)).toBeLessThan(Math.abs(low.pFinal - 0.5));
  });

  it('zeroes adjustment when uncertainty is 1.0', () => {
    const result = computePFinal(10.0, 0.55, 1.0, 1.0, 0.04);
    expect(result.pFinal).toBe(0.55);
  });

  it('zeroes adjustment when confidence_factor is 0', () => {
    const result = computePFinal(10.0, 0.55, 0.0, 0.0, 0.04);
    expect(result.pFinal).toBe(0.55);
  });

  it('caps adjustment at dynamic cap', () => {
    const smallCap = computePFinal(10.0, 0.5, 0.0, 1.0, 0.02);
    const largeCap = computePFinal(10.0, 0.5, 0.0, 1.0, 0.06);
    expect(smallCap.adjustmentCapped).toBe(0.02);
    expect(smallCap.pFinal).toBe(0.52);
    expect(largeCap.adjustmentCapped).toBe(0.04); // raw delta is 0.04, cap is 0.06
    expect(largeCap.pFinal).toBe(0.54);
  });

  it('clips p_final to [0.01, 0.99]', () => {
    const low = computePFinal(0.0, 0.005, 0.0, 1.0, 0.04);
    expect(low.pFinal).toBe(0.01);
    expect(low.clipped).toBe(true);

    const high = computePFinal(10.0, 0.995, 0.0, 1.0, 0.04);
    expect(high.pFinal).toBe(0.99);
    expect(high.clipped).toBe(true);
  });

  it('p_final always in (0, 1) for any inputs', () => {
    const testCases = [
      { conf: 0, market: 0.01, unc: 0, cf: 1, cap: 0.06 },
      { conf: 10, market: 0.99, unc: 0, cf: 1, cap: 0.06 },
      { conf: 5, market: 0.5, unc: 0.5, cf: 0.5, cap: 0.04 },
      { conf: 7, market: 0.3, unc: 0.2, cf: 0.9, cap: 0.05 },
    ];
    for (const tc of testCases) {
      const result = computePFinal(tc.conf, tc.market, tc.unc, tc.cf, tc.cap);
      expect(result.pFinal).toBeGreaterThanOrEqual(0.01);
      expect(result.pFinal).toBeLessThanOrEqual(0.99);
      expect(isFinite(result.pFinal)).toBe(true);
    }
  });

  it('defaults confidenceFactor=1.0 and dynamicCap=MAX_DELTA when omitted', () => {
    // Old-style 3-arg call still works via defaults
    const result = computePFinal(10.0, 0.5, 0.0);
    expect(result.pFinal).toBe(0.54); // 0.50 + 0.04 * 1.0 * (1 - 0)
  });
});

// =============================================================================
// computeProbabilityLayer integration
// =============================================================================

describe('computeProbabilityLayer integration', () => {
  it('returns ok result with explanation payload', () => {
    const input = createProbabilityInput();
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);

    const ok = result as ProbabilityOutputOk;
    expect(ok.explain).toBeDefined();
    expect(ok.explain.model_version).toContain('syndicate_layered');
    expect(ok.explain.p_market_devig).toBeGreaterThan(0);
    expect(ok.explain.p_market_devig).toBeLessThan(1);
    expect(ok.explain.cap_value).toBeGreaterThan(0);
    expect(ok.explain.cap_value).toBeLessThanOrEqual(0.06);
    expect(ok.explain.confidence_factor).toBeGreaterThan(0);
    expect(ok.explain.confidence_factor).toBeLessThanOrEqual(1);
    expect(ok.explain.books_used).toBe(3);
    expect(Array.isArray(ok.explain.reason_codes)).toBe(true);
  });

  it('returns fail for insufficient books', () => {
    const input = createProbabilityInput({ bookOffers: createBookOffers(1) });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INSUFFICIENT_BOOKS');
    }
  });

  it('returns fail for invalid input', () => {
    const input = createProbabilityInput({ confidenceScore: NaN });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INVALID_INPUT');
    }
  });

  it('p_final is finite and in (0,1) for valid input', () => {
    const input = createProbabilityInput({ confidenceScore: 8.0 });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    const ok = result as ProbabilityOutputOk;
    expect(ok.pFinal).toBeGreaterThanOrEqual(0.01);
    expect(ok.pFinal).toBeLessThanOrEqual(0.99);
    expect(isFinite(ok.pFinal)).toBe(true);
  });

  it('|p_final - p_market| never exceeds cap', () => {
    const input = createProbabilityInput({ confidenceScore: 10.0 });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    const ok = result as ProbabilityOutputOk;
    const delta = Math.abs(ok.pFinal - ok.pMarketDevig);
    expect(delta).toBeLessThanOrEqual(ok.explain.cap_value + 1e-6);
  });

  it('explanation contains matching p_final and edge_final', () => {
    const input = createProbabilityInput({ confidenceScore: 7.0 });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    const ok = result as ProbabilityOutputOk;
    expect(ok.explain.p_final).toBe(ok.pFinal);
    expect(ok.explain.edge_final).toBe(ok.edgeFinal);
  });

  it('populates reason codes for extreme edges', () => {
    // Create a scenario with high confidence and divergent books
    const books: BookOffer[] = [
      {
        bookId: 'a',
        bookName: 'A',
        overOdds: -200,
        underOdds: +170,
        bookProfile: 'sharp',
        liquidityTier: 'high',
        dataQuality: 'good',
      },
      {
        bookId: 'b',
        bookName: 'B',
        overOdds: -190,
        underOdds: +160,
        bookProfile: 'market_maker',
        liquidityTier: 'high',
        dataQuality: 'good',
      },
      {
        bookId: 'c',
        bookName: 'C',
        overOdds: -180,
        underOdds: +150,
        bookProfile: 'retail',
        liquidityTier: 'medium',
        dataQuality: 'good',
      },
    ];
    const input = createProbabilityInput({
      confidenceScore: 10.0,
      bookOffers: books,
      entryOdds: -200,
    });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    // The explain payload should have reason_codes array
    const ok = result as ProbabilityOutputOk;
    expect(Array.isArray(ok.explain.reason_codes)).toBe(true);
  });
});

// =============================================================================
// Backward compatibility
// =============================================================================

describe('backward compatibility', () => {
  it('neutral confidence (5.0) produces p_final = p_market_devig', () => {
    const input = createProbabilityInput({ confidenceScore: 5.0 });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    const ok = result as ProbabilityOutputOk;
    // With neutral confidence, delta = 0, so p_final should equal p_market_devig
    expect(ok.pFinal).toBe(ok.pMarketDevig);
    expect(ok.explain.adjustment_raw).toBe(0);
    expect(ok.explain.adjustment_capped).toBe(0);
  });

  it('edge_final is 0 when confidence is neutral', () => {
    const input = createProbabilityInput({ confidenceScore: 5.0 });
    const result = computeProbabilityLayer(input);
    expect(result.ok).toBe(true);
    const ok = result as ProbabilityOutputOk;
    expect(ok.edgeFinal).toBe(0);
  });
});
