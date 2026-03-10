/**
 * KellySizer Unit Tests
 * Sprint: SPRINT-RISK-BANKROLL-KELLY
 *
 * Tests bankroll-aware Kelly criterion sizing:
 * - Pure Kelly math correctness
 * - Bankroll-aware unit sizing
 * - Fail-closed on invalid inputs
 * - Cap enforcement (max bet, min bet)
 * - Deterministic output
 * - Edge cases (no edge, boundary probabilities)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  computeKellySize,
  computeKellyFraction,
  americanToDecimal,
  DEFAULT_BANKROLL_CONFIG,
} from '../KellySizer';

import type { BankrollConfig } from '../KellySizer';

// ============================================================================
// americanToDecimal
// ============================================================================

describe('americanToDecimal', () => {
  it('converts positive American odds correctly', () => {
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(100)).toBe(2.0);
    expect(americanToDecimal(200)).toBe(3.0);
  });

  it('converts negative American odds correctly', () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2);
    expect(americanToDecimal(-200)).toBe(1.5);
    expect(americanToDecimal(-100)).toBe(2.0);
  });

  it('handles even odds (0) gracefully', () => {
    expect(americanToDecimal(0)).toBe(1);
  });
});

// ============================================================================
// computeKellyFraction — pure fraction without bankroll
// ============================================================================

describe('computeKellyFraction', () => {
  it('computes correct fractional Kelly for standard inputs', () => {
    // 55% win prob, +100 odds (decimal 2.0), 25% Kelly
    // Raw Kelly: (1*0.55 - 0.45) / 1 = 0.10
    // Fractional: 0.10 * 0.25 = 0.025
    const result = computeKellyFraction(0.55, 2.0, 0.25, 0.05);
    expect(result).toBeCloseTo(0.025, 4);
  });

  it('returns 0 for no-edge scenarios', () => {
    // 45% win prob, +100 odds → negative Kelly
    expect(computeKellyFraction(0.45, 2.0)).toBe(0);
  });

  it('returns 0 for exactly even edge', () => {
    // 50% win prob, +100 odds → Kelly = 0
    expect(computeKellyFraction(0.5, 2.0)).toBe(0);
  });

  it('caps at max fraction', () => {
    // 90% win prob, +100 odds → very high Kelly
    // Raw: (1*0.90 - 0.10) / 1 = 0.80
    // Fractional: 0.80 * 0.25 = 0.20
    // But max_fraction = 0.05 → capped at 0.05
    const result = computeKellyFraction(0.9, 2.0, 0.25, 0.05);
    expect(result).toBe(0.05);
  });

  it('returns 0 for invalid probability (0)', () => {
    expect(computeKellyFraction(0, 2.0)).toBe(0);
  });

  it('returns 0 for invalid probability (1)', () => {
    expect(computeKellyFraction(1, 2.0)).toBe(0);
  });

  it('returns 0 for invalid probability (negative)', () => {
    expect(computeKellyFraction(-0.5, 2.0)).toBe(0);
  });

  it('returns 0 for invalid probability (> 1)', () => {
    expect(computeKellyFraction(1.5, 2.0)).toBe(0);
  });

  it('returns 0 for invalid odds (1 or less)', () => {
    expect(computeKellyFraction(0.55, 1.0)).toBe(0);
    expect(computeKellyFraction(0.55, 0.5)).toBe(0);
  });

  it('returns 0 for NaN inputs', () => {
    expect(computeKellyFraction(NaN, 2.0)).toBe(0);
    expect(computeKellyFraction(0.55, NaN)).toBe(0);
  });

  it('returns 0 for Infinity inputs', () => {
    expect(computeKellyFraction(Infinity, 2.0)).toBe(0);
    expect(computeKellyFraction(0.55, Infinity)).toBe(0);
  });

  it('returns 0 for invalid kelly multiplier', () => {
    expect(computeKellyFraction(0.55, 2.0, 0, 0.05)).toBe(0);
    expect(computeKellyFraction(0.55, 2.0, -1, 0.05)).toBe(0);
    expect(computeKellyFraction(0.55, 2.0, 1.5, 0.05)).toBe(0);
  });

  it('is deterministic across repeated calls', () => {
    const a = computeKellyFraction(0.58, 1.91, 0.25, 0.05);
    const b = computeKellyFraction(0.58, 1.91, 0.25, 0.05);
    const c = computeKellyFraction(0.58, 1.91, 0.25, 0.05);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('handles longshot odds correctly', () => {
    // 10% win prob at +900 (decimal 10.0)
    // Raw: (9*0.10 - 0.90) / 9 = 0/9 = 0
    expect(computeKellyFraction(0.1, 10.0)).toBe(0);

    // 15% win prob at +900 → slight edge
    // Raw: (9*0.15 - 0.85) / 9 = (1.35 - 0.85) / 9 = 0.0556
    // Fractional: 0.0556 * 0.25 = 0.01389
    const result = computeKellyFraction(0.15, 10.0, 0.25, 0.05);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(0.05);
  });

  it('handles heavy favorite correctly', () => {
    // 75% win prob at -300 (decimal 1.333)
    // b = 0.333
    // Raw: (0.333*0.75 - 0.25) / 0.333 = (0.25 - 0.25) / 0.333 = 0
    expect(computeKellyFraction(0.75, 1.333)).toBe(0);
  });
});

// ============================================================================
// computeKellySize — full bankroll-aware sizing
// ============================================================================

describe('computeKellySize', () => {
  const standardBankroll: BankrollConfig = {
    total_bankroll: 1000,
    kelly_multiplier: 0.25,
    max_bet_fraction: 0.05,
    min_bet_units: 1.0,
    daily_loss_limit: 0.1,
  };

  it('computes correct sizing for standard scenario', () => {
    // 55% win prob, +100 odds, $1000 bankroll, quarter Kelly
    const result = computeKellySize(0.55, 2.0, standardBankroll);

    expect(result.has_edge).toBe(true);
    expect(result.raw_kelly).toBeCloseTo(0.1, 4);
    expect(result.fractional_kelly).toBeCloseTo(0.025, 4);
    expect(result.recommended_units).toBeCloseTo(25, 0);
    expect(result.recommended_fraction).toBeCloseTo(0.025, 4);
    expect(result.capped).toBe(false);
  });

  it('caps at max bet fraction', () => {
    // 80% win prob at +100 → raw Kelly = 0.60 → frac = 0.15
    // Max bet = 5% → capped at $50
    const result = computeKellySize(0.8, 2.0, standardBankroll);

    expect(result.capped).toBe(true);
    expect(result.cap_reason).toBe('max_bet_fraction');
    expect(result.recommended_fraction).toBe(0.05);
    expect(result.recommended_units).toBe(50);
  });

  it('applies minimum bet floor', () => {
    // Tiny edge → tiny fraction → below min bet
    const tinyBankroll: BankrollConfig = {
      ...standardBankroll,
      total_bankroll: 10,
      min_bet_units: 1.0,
    };
    // 51% win prob at +100 → raw Kelly = 0.02 → frac = 0.005
    // Units = 0.005 * 10 = $0.05 → below min $1
    const result = computeKellySize(0.51, 2.0, tinyBankroll);

    if (result.has_edge) {
      expect(result.recommended_units).toBeGreaterThanOrEqual(1.0);
      expect(result.capped).toBe(true);
      expect(result.cap_reason).toBe('min_bet_floor');
    }
  });

  it('returns zero sizing for no edge', () => {
    const result = computeKellySize(0.45, 2.0, standardBankroll);

    expect(result.has_edge).toBe(false);
    expect(result.raw_kelly).toBeLessThan(0);
    expect(result.fractional_kelly).toBe(0);
    expect(result.recommended_units).toBe(0);
    expect(result.recommended_fraction).toBe(0);
  });

  it('fail-closed on invalid bankroll (zero)', () => {
    const zeroBankroll: BankrollConfig = { ...standardBankroll, total_bankroll: 0 };
    const result = computeKellySize(0.55, 2.0, zeroBankroll);

    expect(result.has_edge).toBe(false);
    expect(result.recommended_units).toBe(0);
    expect(result.cap_reason).toBe('invalid_bankroll');
  });

  it('fail-closed on invalid bankroll (negative)', () => {
    const negBankroll: BankrollConfig = { ...standardBankroll, total_bankroll: -500 };
    const result = computeKellySize(0.55, 2.0, negBankroll);

    expect(result.has_edge).toBe(false);
    expect(result.recommended_units).toBe(0);
    expect(result.cap_reason).toBe('invalid_bankroll');
  });

  it('fail-closed on invalid probability', () => {
    const result = computeKellySize(1.5, 2.0, standardBankroll);
    expect(result.has_edge).toBe(false);
    expect(result.cap_reason).toBe('invalid_inputs');
  });

  it('fail-closed on invalid odds', () => {
    const result = computeKellySize(0.55, 0.5, standardBankroll);
    expect(result.has_edge).toBe(false);
    expect(result.cap_reason).toBe('invalid_inputs');
  });

  it('fail-closed on NaN probability', () => {
    const result = computeKellySize(NaN, 2.0, standardBankroll);
    expect(result.has_edge).toBe(false);
    expect(result.cap_reason).toBe('invalid_inputs');
  });

  it('scales linearly with bankroll', () => {
    const small = computeKellySize(0.55, 2.0, { ...standardBankroll, total_bankroll: 100 });
    const large = computeKellySize(0.55, 2.0, { ...standardBankroll, total_bankroll: 1000 });

    // Same fraction, different units
    expect(small.recommended_fraction).toBeCloseTo(large.recommended_fraction, 4);
    expect(large.recommended_units).toBeCloseTo(small.recommended_units * 10, 0);
  });

  it('respects kelly multiplier', () => {
    const quarter = computeKellySize(0.55, 2.0, { ...standardBankroll, kelly_multiplier: 0.25 });
    const half = computeKellySize(0.55, 2.0, { ...standardBankroll, kelly_multiplier: 0.5 });

    expect(half.fractional_kelly).toBeCloseTo(quarter.fractional_kelly * 2, 4);
  });

  it('is deterministic', () => {
    const a = computeKellySize(0.58, 1.91, standardBankroll);
    const b = computeKellySize(0.58, 1.91, standardBankroll);
    expect(a).toEqual(b);
  });

  it('handles default bankroll config', () => {
    const result = computeKellySize(0.55, 2.0, DEFAULT_BANKROLL_CONFIG);
    expect(result.has_edge).toBe(true);
    expect(result.recommended_units).toBeGreaterThan(0);
  });
});

// ============================================================================
// RiskEngine sizing integration (via evaluateForPromotion)
// ============================================================================

describe('RiskEngine sizing in evaluateForPromotion', () => {
  // Dynamic import to avoid circular dependency issues
  let RiskEngine: (typeof import('../RiskEngine'))['RiskEngine'];

  function createSizingMockSupabase() {
    const configRows = [
      { config_key: 'total_kelly_high', config_value: '0.60' },
      { config_key: 'total_kelly_critical', config_value: '1.00' },
      { config_key: 'event_kelly_limit', config_value: '0.25' },
      { config_key: 'drift_brier_block', config_value: '0.35' },
      { config_key: 'drift_min_settled', config_value: '30' },
      { config_key: 'engine_enabled', config_value: '1' },
      { config_key: 'bankroll_total', config_value: '1000' },
      { config_key: 'bankroll_kelly_multiplier', config_value: '0.25' },
      { config_key: 'bankroll_max_bet_fraction', config_value: '0.05' },
    ];

    return {
      from: vi.fn((table: string) => {
        if (table === 'risk_engine_config') {
          return {
            select: vi.fn().mockResolvedValue({ data: configRows, error: null }),
          };
        }
        if (table === 'risk_events') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'drift_snapshots') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'scored_legs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    } as any;
  }

  beforeEach(async () => {
    const mod = await import('../RiskEngine');
    RiskEngine = mod.RiskEngine;
    RiskEngine.resetConfigCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns sizing when sizingInputs are provided', async () => {
    const supabase = createSizingMockSupabase();
    const engine = RiskEngine.getInstance();

    const decision = await engine.evaluateForPromotion(
      supabase,
      'pick-sizing-1',
      0.025,
      undefined,
      { winProbability: 0.55, decimalOdds: 2.0 }
    );

    expect(decision.allowed).toBe(true);
    expect(decision.sizing).not.toBeNull();
    expect(decision.sizing!.has_edge).toBe(true);
    expect(decision.sizing!.raw_kelly).toBeCloseTo(0.1, 2);
    expect(decision.sizing!.recommended_units).toBeGreaterThan(0);
  });

  it('returns null sizing when sizingInputs are not provided', async () => {
    const supabase = createSizingMockSupabase();
    const engine = RiskEngine.getInstance();

    const decision = await engine.evaluateForPromotion(supabase, 'pick-no-sizing', 0.025);

    expect(decision.allowed).toBe(true);
    expect(decision.sizing).toBeNull();
  });

  it('returns sizing even when promotion is blocked', async () => {
    // Create mock with high exposure to trigger block
    const supabase = createSizingMockSupabase();
    const engine = RiskEngine.getInstance();

    // Override scored_legs to return high exposure
    let callCount = 0;
    supabase.from = vi.fn((table: string) => {
      if (table === 'risk_engine_config') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { config_key: 'total_kelly_critical', config_value: '0.01' },
              { config_key: 'engine_enabled', config_value: '1' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'scored_legs') {
        callCount++;
        // First call = exposure, return high Kelly
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({
                    data: [
                      {
                        kelly_fraction: 0.5,
                        ticket_legs: { event_id: 'e1', leg_status: 'pending' },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // Second call = drift
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'risk_events' || table === 'drift_snapshots') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const decision = await engine.evaluateForPromotion(
      supabase,
      'pick-blocked-with-sizing',
      0.025,
      undefined,
      { winProbability: 0.55, decimalOdds: 2.0 }
    );

    expect(decision.allowed).toBe(false);
    expect(decision.sizing).not.toBeNull();
    expect(decision.sizing!.has_edge).toBe(true);
  });

  it('returns zero sizing for no-edge inputs', async () => {
    const supabase = createSizingMockSupabase();
    const engine = RiskEngine.getInstance();

    const decision = await engine.evaluateForPromotion(supabase, 'pick-no-edge', 0, undefined, {
      winProbability: 0.4,
      decimalOdds: 2.0,
    });

    expect(decision.sizing).not.toBeNull();
    expect(decision.sizing!.has_edge).toBe(false);
    expect(decision.sizing!.recommended_units).toBe(0);
  });

  it('uses bankroll config from DB', async () => {
    const supabase = createSizingMockSupabase();
    const engine = RiskEngine.getInstance();

    const decision = await engine.evaluateForPromotion(
      supabase,
      'pick-bankroll-db',
      0.025,
      undefined,
      { winProbability: 0.55, decimalOdds: 2.0 }
    );

    // Bankroll is 1000, quarter Kelly on 55%/+100 → ~$25
    expect(decision.sizing!.recommended_units).toBeCloseTo(25, 0);
  });
});
