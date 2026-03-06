/**
 * Unit tests for Risk Sizing (SPRINT-035)
 */
import { makeInput, DEFAULT_CONFIG } from './fixtures';

import { applyProbabilitySanity, computeKellyFraction } from '@/pick-engine/risk-sizing';

// ── applyProbabilitySanity ──────────────────────────────────────────────────

describe('applyProbabilitySanity', () => {
  it('passes when p_final exceeds minimum', () => {
    const result = applyProbabilitySanity(makeInput({ p_final: 0.62 }), DEFAULT_CONFIG);
    expect(result.filter_name).toBe('probability_sanity');
    expect(result.passed).toBe(true);
    expect(result.value).toBe(0.62);
    expect(result.threshold).toBe(0.52);
  });

  it('rejects when p_final is below minimum', () => {
    const result = applyProbabilitySanity(makeInput({ p_final: 0.45 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('<');
  });

  it('passes at exact boundary (p_final === p_final_min)', () => {
    const result = applyProbabilitySanity(makeInput({ p_final: 0.52 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(true);
  });

  it('respects custom p_final_min from config', () => {
    const config = { ...DEFAULT_CONFIG, p_final_min: 0.6 };
    const result = applyProbabilitySanity(makeInput({ p_final: 0.55 }), config);
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(0.6);
  });
});

// ── computeKellyFraction ────────────────────────────────────────────────────

describe('computeKellyFraction', () => {
  it('returns correct Kelly fraction for valid inputs', () => {
    // b = 1/0.55 - 1 = 0.8182, f = (0.8182*0.62 - 0.38) / 0.8182 ≈ 0.1556
    const result = computeKellyFraction(makeInput({ p_final: 0.62, p_market_devig: 0.55 }));
    expect(result).not.toBeNull();
    expect(result!.fraction).toBeGreaterThan(0);
    expect(result!.fraction).toBeLessThan(0.25);
  });

  it('returns null when p_market_devig is 0', () => {
    const result = computeKellyFraction(makeInput({ p_market_devig: 0 }));
    expect(result).toBeNull();
  });

  it('returns null when p_market_devig is 1', () => {
    const result = computeKellyFraction(makeInput({ p_market_devig: 1 }));
    expect(result).toBeNull();
  });

  it('returns null when p_final is 0', () => {
    const result = computeKellyFraction(makeInput({ p_final: 0 }));
    expect(result).toBeNull();
  });

  it('returns null when p_final is 1', () => {
    const result = computeKellyFraction(makeInput({ p_final: 1 }));
    expect(result).toBeNull();
  });

  it('clamps negative Kelly fraction to 0', () => {
    // p_final < p_market_devig → negative edge → negative Kelly
    const result = computeKellyFraction(makeInput({ p_final: 0.4, p_market_devig: 0.55 }));
    expect(result).not.toBeNull();
    expect(result!.fraction).toBe(0);
    expect(result!.halfKelly).toBe(0);
    expect(result!.quarterKelly).toBe(0);
  });

  it('clamps fraction at maximum 0.25', () => {
    // Massive edge → raw Kelly >> 0.25
    const result = computeKellyFraction(makeInput({ p_final: 0.99, p_market_devig: 0.1 }));
    expect(result).not.toBeNull();
    expect(result!.fraction).toBe(0.25);
  });

  it('halfKelly is fraction divided by 2', () => {
    const result = computeKellyFraction(makeInput({ p_final: 0.62, p_market_devig: 0.55 }));
    expect(result).not.toBeNull();
    expect(result!.halfKelly).toBeCloseTo(result!.fraction / 2, 10);
  });

  it('quarterKelly is fraction divided by 4', () => {
    const result = computeKellyFraction(makeInput({ p_final: 0.62, p_market_devig: 0.55 }));
    expect(result).not.toBeNull();
    expect(result!.quarterKelly).toBeCloseTo(result!.fraction / 4, 10);
  });
});
