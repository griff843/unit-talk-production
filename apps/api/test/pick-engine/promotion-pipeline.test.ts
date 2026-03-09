/**
 * Integration tests for Promotion Pipeline (SPRINT-035)
 */
import { makeInput, DEFAULT_CONFIG } from './fixtures';

import { runPromotionPipeline } from '@/pick-engine/promotion-pipeline';

describe('runPromotionPipeline', () => {
  describe('basic scenarios', () => {
    it('returns empty results for empty input', () => {
      const result = runPromotionPipeline([], DEFAULT_CONFIG);
      expect(result.promoted).toHaveLength(0);
      expect(result.rejected).toHaveLength(0);
      expect(result.total_input).toBe(0);
      expect(result.pass_rate_pct).toBe(0);
    });

    it('promotes a fully-passing input', () => {
      const result = runPromotionPipeline([makeInput()], DEFAULT_CONFIG);
      expect(result.promoted).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
      expect(result.promoted[0].accepted).toBe(true);
    });

    it('rejects an input failing the first filter (probability_sanity)', () => {
      const input = makeInput({ p_final: 0.4 });
      const result = runPromotionPipeline([input], DEFAULT_CONFIG);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].first_reject_filter).toBe('probability_sanity');
    });

    it('correctly splits mixed inputs', () => {
      const inputs = [
        makeInput({ market_key: 'mk1' }), // passes all
        makeInput({ market_key: 'mk2' }), // passes all
        makeInput({ market_key: 'mk3', p_final: 0.4 }), // fails probability
      ];
      const result = runPromotionPipeline(inputs, DEFAULT_CONFIG);
      expect(result.promoted).toHaveLength(2);
      expect(result.rejected).toHaveLength(1);
      expect(result.total_input).toBe(3);
    });
  });

  describe('filter cascade statistics', () => {
    it('cascade tracks input_count correctly per filter', () => {
      const inputs = [
        makeInput({ market_key: 'mk1' }), // passes all
        makeInput({ market_key: 'mk2', book_count: 2 }), // fails liquidity
      ];
      const result = runPromotionPipeline(inputs, DEFAULT_CONFIG);
      const cascade = result.filter_cascade;

      // Both reach probability_sanity
      expect(cascade['probability_sanity'].input_count).toBe(2);
      expect(cascade['probability_sanity'].pass_count).toBe(2);

      // Both reach liquidity (both passed probability_sanity)
      expect(cascade['liquidity'].input_count).toBe(2);
      expect(cascade['liquidity'].pass_count).toBe(1);
      expect(cascade['liquidity'].reject_count).toBe(1);

      // Only 1 reaches edge (second failed at liquidity)
      expect(cascade['edge'].input_count).toBe(1);
    });

    it('cascade tracks pass_count and reject_count', () => {
      const inputs = [
        makeInput({ market_key: 'mk1' }),
        makeInput({ market_key: 'mk2', p_final: 0.4 }),
      ];
      const result = runPromotionPipeline(inputs, DEFAULT_CONFIG);
      const prob = result.filter_cascade['probability_sanity'];
      expect(prob.pass_count + prob.reject_count).toBe(prob.input_count);
    });

    it('cascade computes pass_rate_pct correctly', () => {
      const inputs = [makeInput({ market_key: 'mk1' }), makeInput({ market_key: 'mk2' })];
      const result = runPromotionPipeline(inputs, DEFAULT_CONFIG);
      expect(result.filter_cascade['probability_sanity'].pass_rate_pct).toBe(100);
    });

    it('skipped filters excluded from cascade keys', () => {
      const config = { ...DEFAULT_CONFIG, skip_confidence: true };
      const result = runPromotionPipeline([makeInput()], config);
      expect(result.filter_cascade).not.toHaveProperty('confidence');
      // market_policy also excluded when no policies
      expect(result.filter_cascade).not.toHaveProperty('market_policy');
    });
  });

  describe('first_reject_filter tracking', () => {
    it('first_reject_filter is null when all filters pass', () => {
      const result = runPromotionPipeline([makeInput()], DEFAULT_CONFIG);
      expect(result.promoted[0].first_reject_filter).toBeNull();
      expect(result.promoted[0].accepted).toBe(true);
    });

    it('first_reject_filter identifies the failing filter', () => {
      const input = makeInput({ book_count: 1 });
      const result = runPromotionPipeline([input], DEFAULT_CONFIG);
      expect(result.rejected[0].first_reject_filter).toBe('liquidity');
    });

    it('first_reject_filter is the FIRST failing filter', () => {
      // Both probability_sanity and liquidity fail, but prob is checked first
      const input = makeInput({ p_final: 0.4, book_count: 1 });
      const result = runPromotionPipeline([input], DEFAULT_CONFIG);
      expect(result.rejected[0].first_reject_filter).toBe('probability_sanity');
    });
  });

  describe('config overrides', () => {
    it('skip_confidence omits confidence filter', () => {
      const config = { ...DEFAULT_CONFIG, skip_confidence: true };
      // score=50 would fail confidence (threshold 70) but confidence is skipped
      const input = makeInput({ score: 50 });
      const result = runPromotionPipeline([input], config);
      expect(result.promoted).toHaveLength(1);
    });

    it('custom thresholds change outcomes', () => {
      const config = { ...DEFAULT_CONFIG, edge_threshold: 0.1 };
      // edge_final=0.07 now fails (< 0.10)
      const input = makeInput({ edge_final: 0.07 });
      const result = runPromotionPipeline([input], config);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].first_reject_filter).toBe('edge');
    });
  });

  describe('log entry completeness', () => {
    it('kelly_fraction is computed for each entry', () => {
      const result = runPromotionPipeline([makeInput()], DEFAULT_CONFIG);
      expect(result.promoted[0].kelly_fraction).not.toBeNull();
      expect(result.promoted[0].kelly_fraction).toBeGreaterThan(0);
    });

    it('line_move_pct is computed for each entry', () => {
      const result = runPromotionPipeline([makeInput()], DEFAULT_CONFIG);
      // (0.52 - 0.50) / 0.50 * 100 = 4.0%
      expect(result.promoted[0].line_move_pct).toBeCloseTo(4.0, 1);
    });
  });
});
