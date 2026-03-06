/**
 * Unit tests for Market Resistance Filter (SPRINT-035)
 */
import { makeInput, DEFAULT_CONFIG } from './fixtures';

import {
  computeLineMovePct,
  detectSharpFade,
  applyMarketResistanceFilter,
} from '@/pick-engine/market-resistance';

// ── computeLineMovePct ──────────────────────────────────────────────────────

describe('computeLineMovePct', () => {
  it('computes positive pct when close > open', () => {
    const result = computeLineMovePct(makeInput({ p_open_devig: 0.5, p_close_devig: 0.52 }));
    expect(result).toBeCloseTo(4.0, 1);
  });

  it('computes negative pct when close < open', () => {
    const result = computeLineMovePct(makeInput({ p_open_devig: 0.5, p_close_devig: 0.48 }));
    expect(result).toBeCloseTo(-4.0, 1);
  });

  it('returns zero when close equals open', () => {
    const result = computeLineMovePct(makeInput({ p_open_devig: 0.5, p_close_devig: 0.5 }));
    expect(result).toBeCloseTo(0, 4);
  });

  it('returns null when p_open_devig is 0', () => {
    const result = computeLineMovePct(makeInput({ p_open_devig: 0 }));
    expect(result).toBeNull();
  });

  it('returns null when p_open_devig is 1', () => {
    const result = computeLineMovePct(makeInput({ p_open_devig: 1 }));
    expect(result).toBeNull();
  });

  it('returns null when p_close_devig is 0', () => {
    const result = computeLineMovePct(makeInput({ p_close_devig: 0 }));
    expect(result).toBeNull();
  });

  it('returns null when p_close_devig is 1', () => {
    const result = computeLineMovePct(makeInput({ p_close_devig: 1 }));
    expect(result).toBeNull();
  });
});

// ── detectSharpFade ─────────────────────────────────────────────────────────

describe('detectSharpFade', () => {
  it('detects sharp fade (edge > 0 AND clv_prob < -0.01)', () => {
    const result = detectSharpFade(makeInput({ edge_final: 0.05, clv_prob: -0.02 }));
    expect(result).toBe(true);
  });

  it('no fade at noise threshold (clv_prob === -0.01)', () => {
    const result = detectSharpFade(makeInput({ edge_final: 0.05, clv_prob: -0.01 }));
    expect(result).toBe(false);
  });

  it('no fade when clv_prob is positive', () => {
    const result = detectSharpFade(makeInput({ edge_final: 0.05, clv_prob: 0.02 }));
    expect(result).toBe(false);
  });

  it('no fade when edge_final is zero', () => {
    const result = detectSharpFade(makeInput({ edge_final: 0, clv_prob: -0.05 }));
    expect(result).toBe(false);
  });

  it('no fade when edge_final is negative', () => {
    const result = detectSharpFade(makeInput({ edge_final: -0.02, clv_prob: -0.05 }));
    expect(result).toBe(false);
  });
});

// ── applyMarketResistanceFilter ─────────────────────────────────────────────

describe('applyMarketResistanceFilter', () => {
  it('passes clean market (no fade, acceptable move)', () => {
    const result = applyMarketResistanceFilter(makeInput(), DEFAULT_CONFIG);
    expect(result.filter_name).toBe('market_resistance');
    expect(result.passed).toBe(true);
    expect(result.reason).toContain('OK');
  });

  it('rejects on sharp fade alone', () => {
    const input = makeInput({ edge_final: 0.05, clv_prob: -0.05 });
    const result = applyMarketResistanceFilter(input, DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('sharp_fade');
  });

  it('rejects on adverse line move alone', () => {
    // line_move = (0.45 - 0.50) / 0.50 * 100 = -10% < -5%
    const input = makeInput({
      p_open_devig: 0.5,
      p_close_devig: 0.45,
      clv_prob: 0.01, // no sharp fade
      edge_final: 0.07,
    });
    const result = applyMarketResistanceFilter(input, DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('line_move');
  });
});
