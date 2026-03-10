/**
 * CLV Analyzer Tests
 * Sprint: SPRINT-PHASE2-CLV-EDGE-VALIDATION
 */

import { describe, it, expect } from 'vitest';

import { analyzeCLV, MIN_CLV_SAMPLE } from '../clvAnalyzer';

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

// =============================================================================
// TESTS
// =============================================================================

describe('analyzeCLV', () => {
  describe('fail-closed gates', () => {
    it('returns ok:false for empty input', () => {
      const result = analyzeCLV([]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('EMPTY_INPUT');
        expect(result.n).toBe(0);
      }
    });

    it('returns ok:false when fewer than MIN_CLV_SAMPLE valid records', () => {
      const records = makeOutcomes(MIN_CLV_SAMPLE - 1);
      const result = analyzeCLV(records);
      expect(result.ok).toBe(false);
    });

    it('filters out records with p_final = 0', () => {
      // Exactly MIN_CLV_SAMPLE records but all with invalid p_final=0
      const invalid = makeOutcomes(MIN_CLV_SAMPLE, { p_final: 0 });
      const result = analyzeCLV(invalid);
      expect(result.ok).toBe(false);
    });

    it('filters out records with p_market_devig = 1', () => {
      const invalid = makeOutcomes(MIN_CLV_SAMPLE, { p_market_devig: 1 });
      const result = analyzeCLV(invalid);
      expect(result.ok).toBe(false);
    });

    it('filters out records with non-finite probabilities', () => {
      const invalid = makeOutcomes(MIN_CLV_SAMPLE, { p_final: NaN });
      const result = analyzeCLV(invalid);
      expect(result.ok).toBe(false);
    });
  });

  describe('successful computation', () => {
    it('returns ok:true with sufficient valid records', () => {
      const records = makeOutcomes(MIN_CLV_SAMPLE);
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
    });

    it('computes correct mean CLV', () => {
      // p_final=0.6, p_market_devig=0.55 → CLV = 0.05 for all
      const records = makeOutcomes(20, { p_final: 0.6, p_market_devig: 0.55 });
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.meanCLV).toBeCloseTo(0.05, 5);
      }
    });

    it('computes correct CLV record count', () => {
      const records = makeOutcomes(25);
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.n).toBe(25);
        expect(result.records).toHaveLength(25);
      }
    });

    it('clv = p_final - p_market_devig per record', () => {
      const records = makeOutcomes(15, { p_final: 0.65, p_market_devig: 0.58 });
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const r of result.records) {
          expect(r.clv).toBeCloseTo(0.07, 5);
        }
      }
    });

    it('positiveCLVPct = 100 when all CLV > 0', () => {
      const records = makeOutcomes(20, { p_final: 0.7, p_market_devig: 0.5 });
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.positiveCLVPct).toBe(100);
      }
    });

    it('positiveCLVPct = 0 when all CLV < 0', () => {
      const records = makeOutcomes(20, { p_final: 0.4, p_market_devig: 0.6 });
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.positiveCLVPct).toBe(0);
      }
    });

    it('positiveCLVPct = 50 when half CLV > 0, half CLV < 0', () => {
      const positive = makeOutcomes(10, { p_final: 0.7, p_market_devig: 0.5 });
      const negative = makeOutcomes(10, {
        p_final: 0.4,
        p_market_devig: 0.6,
        market_key: 'neg_market',
      });
      const result = analyzeCLV([...positive, ...negative]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.positiveCLVPct).toBe(50);
      }
    });

    it('stdDev = 0 when all CLV values are identical', () => {
      const records = makeOutcomes(20, { p_final: 0.6, p_market_devig: 0.55 });
      const result = analyzeCLV(records);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.stdDev).toBe(0);
      }
    });

    it('byMarketType groups records by market_type_id', () => {
      const type1 = makeOutcomes(10, { market_type_id: 1, p_final: 0.6, p_market_devig: 0.5 });
      const type2 = makeOutcomes(10, {
        market_type_id: 2,
        p_final: 0.55,
        p_market_devig: 0.5,
        market_key: 'alt_market',
      });
      const result = analyzeCLV([...type1, ...type2]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.byMarketType['mt_1']).toBeDefined();
        expect(result.summary.byMarketType['mt_2']).toBeDefined();
        expect(result.summary.byMarketType['mt_1'].n).toBe(10);
        expect(result.summary.byMarketType['mt_2'].n).toBe(10);
      }
    });

    it('byMarketType mean CLV correct per group', () => {
      const type1 = makeOutcomes(10, { market_type_id: 1, p_final: 0.7, p_market_devig: 0.5 });
      const type2 = makeOutcomes(10, {
        market_type_id: 2,
        p_final: 0.52,
        p_market_devig: 0.5,
        market_key: 'alt_market',
      });
      const result = analyzeCLV([...type1, ...type2]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary.byMarketType['mt_1'].meanCLV).toBeCloseTo(0.2, 5);
        expect(result.summary.byMarketType['mt_2'].meanCLV).toBeCloseTo(0.02, 5);
      }
    });
  });
});
