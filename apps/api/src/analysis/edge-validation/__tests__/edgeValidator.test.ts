/**
 * Edge Validator Tests
 * Sprint: SPRINT-PHASE2-CLV-EDGE-VALIDATION
 */

import { describe, it, expect } from 'vitest';

import { validateEdge, MIN_EDGE_SAMPLE_SIZE, DEFAULT_ALPHA } from '../edgeValidator';

import type { ScoredOutcome } from '../../outcomes/types';

// =============================================================================
// HELPERS
// =============================================================================

function makeOutcome(overrides: Partial<ScoredOutcome> = {}): ScoredOutcome {
  return {
    market_key: 'player_points_over_22.5',
    event_id: 'evt_001',
    market_type_id: 1,
    participant_id: 'player_001',
    p_final: 0.6,
    p_market_devig: 0.55,
    edge_final: 0.05,
    score: 75,
    tier: 'A',
    book_count: 2,
    line: 22.5,
    actual_value: 25,
    outcome: 'WIN',
    ...overrides,
  };
}

function makeOutcomes(n: number, overrides: Partial<ScoredOutcome> = {}): ScoredOutcome[] {
  return Array.from({ length: n }, (_, i) =>
    makeOutcome({ market_key: `market_${i}`, ...overrides })
  );
}

// Generate outcomes with known CLV spread for t-test verification
function makeVariedOutcomes(n: number, meanCLV: number, spread: number): ScoredOutcome[] {
  return Array.from({ length: n }, (_, i) => {
    const offset = ((i % 5) - 2) * spread;
    const p_final = Math.max(0.01, Math.min(0.99, 0.55 + meanCLV + offset));
    return makeOutcome({
      market_key: `market_${i}`,
      p_final,
      p_market_devig: 0.55,
    });
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('validateEdge', () => {
  describe('INSUFFICIENT_SAMPLE gate', () => {
    it('fails when records < MIN_EDGE_SAMPLE_SIZE', () => {
      const records = makeOutcomes(MIN_EDGE_SAMPLE_SIZE - 1);
      const result = validateEdge(records);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INSUFFICIENT_SAMPLE');
        expect(result.sampleSize).toBe(MIN_EDGE_SAMPLE_SIZE - 1);
      }
    });

    it('fails for empty input', () => {
      const result = validateEdge([]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INSUFFICIENT_SAMPLE');
      }
    });

    it('passes at exactly MIN_EDGE_SAMPLE_SIZE records', () => {
      const records = makeOutcomes(MIN_EDGE_SAMPLE_SIZE);
      const result = validateEdge(records);
      // May still fail if CLV analysis fails, but not for INSUFFICIENT_SAMPLE
      if (!result.ok) {
        expect(result.reason).not.toBe('INSUFFICIENT_SAMPLE');
      }
    });
  });

  describe('ZERO_VARIANCE gate', () => {
    it('fails when all CLV values are identical', () => {
      // Identical p_final and p_market_devig → CLV = 0.05 exactly for all
      const records = makeOutcomes(MIN_EDGE_SAMPLE_SIZE, {
        p_final: 0.6,
        p_market_devig: 0.55,
      });
      const result = validateEdge(records);
      // stdDev = 0 → ZERO_VARIANCE
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('ZERO_VARIANCE');
      }
    });
  });

  describe('successful validation — edge detection', () => {
    it('returns ok:true for valid varied records', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
    });

    it('returns meanCLV > 0 when picks beat the market', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.meanCLV).toBeGreaterThan(0);
      }
    });

    it('returns meanCLV < 0 when picks trail the market', () => {
      const records = makeVariedOutcomes(50, -0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.meanCLV).toBeLessThan(0);
      }
    });

    it('large consistent positive CLV → isReal = true', () => {
      // Large mean CLV → high t-stat → p < 0.05
      const records = makeVariedOutcomes(80, 0.15, 0.01);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.isReal).toBe(true);
        expect(result.tStat).toBeGreaterThan(1.96);
      }
    });

    it('tiny CLV with high variance → isReal = false', () => {
      // Very small mean CLV with large spread → low t-stat
      const records = makeVariedOutcomes(40, 0.001, 0.1);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.isReal).toBe(false);
        expect(Math.abs(result.tStat)).toBeLessThan(1.96);
      }
    });

    it('pValueApprox is between 0 and 1', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.03);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.pValueApprox).toBeGreaterThanOrEqual(0);
        expect(result.pValueApprox).toBeLessThanOrEqual(1);
      }
    });

    it('sampleSize matches records used', () => {
      const records = makeVariedOutcomes(45, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sampleSize).toBe(45);
      }
    });

    it('significanceLevel defaults to DEFAULT_ALPHA', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.significanceLevel).toBe(DEFAULT_ALPHA);
      }
    });

    it('custom alpha=0.01 raises the significance bar', () => {
      // Same records that pass at 0.05 may not pass at 0.01
      const records = makeVariedOutcomes(50, 0.04, 0.05);
      const resultDefault = validateEdge(records, 0.05);
      const resultStrict = validateEdge(records, 0.01);
      // Strict alpha cannot be more permissive than default alpha
      if (resultDefault.ok && resultStrict.ok) {
        if (!resultDefault.isReal) {
          expect(resultStrict.isReal).toBe(false);
        }
      }
    });

    it('positiveCLVPct is between 0 and 100', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.positiveCLVPct).toBeGreaterThanOrEqual(0);
        expect(result.positiveCLVPct).toBeLessThanOrEqual(100);
      }
    });

    it('stdDev is positive for varied records', () => {
      const records = makeVariedOutcomes(50, 0.05, 0.02);
      const result = validateEdge(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stdDev).toBeGreaterThan(0);
      }
    });
  });
});
