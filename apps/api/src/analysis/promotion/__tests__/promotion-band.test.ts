/**
 * Promotion Band Calibration Tests — SPRINT-036
 *
 * Tests:
 *   1. Initial band assignment (edge + score thresholds)
 *   2. Uncertainty-based caps and downgrades
 *   3. CLV forecast downgrades and suppression
 *   4. Liquidity band caps
 *   5. Market resistance downgrades and suppression
 *   6. Risk decision suppression
 *   7. Full pipeline (assignPromotionBand)
 *   8. Deterministic repeated-run behavior
 *   9. Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';

import { initialBandAssignment } from '../band-assignment';
import { applyBandDowngrades } from '../band-downgrade-rules';
import {
  THRESHOLD_VERSION,
  EDGE_THRESHOLDS,
  UNCERTAINTY_CAPS,
  UNCERTAINTY_SUPPRESS_THRESHOLD,
  CLV_THRESHOLDS,
  MARKET_RESISTANCE_DOWNGRADE_THRESHOLD,
  MARKET_RESISTANCE_SUPPRESS_THRESHOLD,
  compareBands,
  downgradeOneStep,
} from '../band-thresholds';
import { assignPromotionBand } from '../index';

import type { BandInput, BandTier } from '../types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<BandInput> = {}): BandInput {
  return {
    edge: 0.1,
    uncertainty: 0.05,
    clvForecast: 0.1,
    liquidityTier: 'high',
    selectionDecision: 'select',
    selectionScore: 90,
    ...overrides,
  };
}

// ── 1. Initial Band Assignment ──────────────────────────────────────────────

describe('initialBandAssignment', () => {
  it('assigns A+ for elite edge + high score', () => {
    const input = makeInput({ edge: 0.1, selectionScore: 90 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('A+');
    expect(result.thresholdVersion).toBe(THRESHOLD_VERSION);
  });

  it('assigns A for strong edge + good score', () => {
    const input = makeInput({ edge: 0.06, selectionScore: 75 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('A');
  });

  it('assigns B for solid edge + moderate score', () => {
    const input = makeInput({ edge: 0.035, selectionScore: 55 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('B');
  });

  it('assigns C for marginal edge (no score floor)', () => {
    const input = makeInput({ edge: 0.02, selectionScore: 30 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('C');
  });

  it('suppresses when edge is below C threshold', () => {
    const input = makeInput({ edge: 0.01 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('SUPPRESS');
    expect(result.reasons[0]).toContain('no_tier_qualified');
  });

  it('suppresses non-selected picks', () => {
    const input = makeInput({ selectionDecision: 'hold' });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('SUPPRESS');
    expect(result.reasons[0]).toContain('selection_not_selected');
  });

  it('suppresses rejected picks', () => {
    const input = makeInput({ selectionDecision: 'reject' });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('SUPPRESS');
  });

  it('high edge but low score falls to tier without score requirement', () => {
    // A+ requires score >= 85, A requires >= 70, B requires >= 50
    // With score=40, only C qualifies (no score floor)
    const input = makeInput({ edge: 0.1, selectionScore: 40 });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('C');
  });

  it('handles null selectionScore — skips score-gated tiers', () => {
    // A+ requires score >= 85, A >= 70, B >= 50 — all fail with null score
    // C has no score floor, so edge alone decides
    const input = makeInput({ edge: 0.1, selectionScore: null });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('C');
  });

  it('exact threshold values qualify', () => {
    const input = makeInput({
      edge: EDGE_THRESHOLDS['A+'],
      selectionScore: 85,
    });
    const result = initialBandAssignment(input);
    expect(result.band).toBe('A+');
  });

  it('just below threshold does not qualify', () => {
    const input = makeInput({
      edge: EDGE_THRESHOLDS['A+'] - 0.0001,
      selectionScore: 90,
    });
    const result = initialBandAssignment(input);
    expect(result.band).not.toBe('A+');
  });
});

// ── 2. Uncertainty Caps/Downgrades ──────────────────────────────────────────

describe('uncertainty downgrades', () => {
  it('does not downgrade A+ with low uncertainty', () => {
    const input = makeInput({ uncertainty: 0.05 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('A+');
    expect(result.downgradeReasons).toHaveLength(0);
  });

  it('downgrades A+ to A when uncertainty exceeds A+ cap', () => {
    const input = makeInput({ uncertainty: UNCERTAINTY_CAPS['A+'] + 0.01 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('A');
    expect(result.downgradeReasons.some(r => r.includes('uncertainty_cap'))).toBe(true);
  });

  it('cascading downgrade: A+ → B when uncertainty exceeds A cap', () => {
    const input = makeInput({ uncertainty: UNCERTAINTY_CAPS.A + 0.01 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('B');
  });

  it('suppresses when uncertainty exceeds suppress threshold', () => {
    const input = makeInput({ uncertainty: UNCERTAINTY_SUPPRESS_THRESHOLD + 0.01 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.suppressionReasons.some(r => r.includes('uncertainty_extreme'))).toBe(true);
  });

  it('suppresses C band when uncertainty exceeds C cap', () => {
    const input = makeInput({ uncertainty: UNCERTAINTY_CAPS.C + 0.01 });
    const result = applyBandDowngrades(input, 'C');
    expect(result.finalBand).toBe('SUPPRESS');
  });
});

// ── 3. CLV Forecast Downgrades ──────────────────────────────────────────────

describe('CLV forecast downgrades', () => {
  it('does not downgrade with positive CLV', () => {
    const input = makeInput({ clvForecast: 0.1 });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });

  it('downgrades one step for moderately negative CLV', () => {
    const input = makeInput({ clvForecast: CLV_THRESHOLDS.downgradeBelow - 0.01 });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('B');
    expect(result.downgradeReasons.some(r => r.includes('clv_downgrade'))).toBe(true);
  });

  it('suppresses for strongly negative CLV', () => {
    const input = makeInput({ clvForecast: CLV_THRESHOLDS.suppressBelow - 0.01 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.suppressionReasons.some(r => r.includes('clv_suppress'))).toBe(true);
  });

  it('CLV exactly at downgrade threshold does not downgrade', () => {
    const input = makeInput({ clvForecast: CLV_THRESHOLDS.downgradeBelow });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });
});

// ── 4. Liquidity Band Caps ──────────────────────────────────────────────────

describe('liquidity band caps', () => {
  it('high liquidity does not cap', () => {
    const input = makeInput({ liquidityTier: 'high' });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('A+');
  });

  it('medium liquidity caps at A', () => {
    const input = makeInput({ liquidityTier: 'medium' });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('A');
    expect(result.downgradeReasons.some(r => r.includes('liquidity_cap'))).toBe(true);
  });

  it('low liquidity caps at B', () => {
    const input = makeInput({ liquidityTier: 'low' });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('B');
  });

  it('unknown liquidity caps at C', () => {
    const input = makeInput({ liquidityTier: 'unknown' });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('C');
  });

  it('liquidity cap does not upgrade a lower band', () => {
    const input = makeInput({ liquidityTier: 'high' });
    const result = applyBandDowngrades(input, 'C');
    expect(result.finalBand).toBe('C');
  });
});

// ── 5. Market Resistance ────────────────────────────────────────────────────

describe('market resistance', () => {
  it('no resistance field — no downgrade', () => {
    const input = makeInput({ marketResistance: null });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });

  it('low resistance — no downgrade', () => {
    const input = makeInput({ marketResistance: 0.3 });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });

  it('high resistance — one-step downgrade', () => {
    const input = makeInput({ marketResistance: MARKET_RESISTANCE_DOWNGRADE_THRESHOLD + 0.01 });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('B');
    expect(result.downgradeReasons.some(r => r.includes('market_resistance_downgrade'))).toBe(true);
  });

  it('extreme resistance — suppress', () => {
    const input = makeInput({ marketResistance: MARKET_RESISTANCE_SUPPRESS_THRESHOLD + 0.01 });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.suppressionReasons.some(r => r.includes('market_resistance_suppress'))).toBe(
      true
    );
  });
});

// ── 6. Risk Decision ────────────────────────────────────────────────────────

describe('risk decision', () => {
  it('allow — no change', () => {
    const input = makeInput({ riskDecision: 'allow' });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });

  it('reduce — one-step downgrade', () => {
    const input = makeInput({
      riskDecision: 'reduce',
      riskThrottleReasonCodes: ['exposure_high'],
    });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('B');
    expect(result.downgradeReasons.some(r => r.includes('risk_reduce'))).toBe(true);
  });

  it('reject — suppress', () => {
    const input = makeInput({
      riskDecision: 'reject',
      riskThrottleReasonCodes: ['critical_exposure'],
    });
    const result = applyBandDowngrades(input, 'A+');
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.suppressionReasons.some(r => r.includes('risk_reject'))).toBe(true);
  });

  it('null risk decision — no change', () => {
    const input = makeInput({ riskDecision: null });
    const result = applyBandDowngrades(input, 'A');
    expect(result.finalBand).toBe('A');
  });
});

// ── 7. Full Pipeline (assignPromotionBand) ──────────────────────────────────

describe('assignPromotionBand (full pipeline)', () => {
  it('elite pick → A+', () => {
    const result = assignPromotionBand(
      makeInput({
        edge: 0.1,
        uncertainty: 0.05,
        clvForecast: 0.15,
        liquidityTier: 'high',
        selectionScore: 95,
      })
    );
    expect(result.finalBand).toBe('A+');
    expect(result.initialBand).toBe('A+');
    expect(result.downgradeReasons).toHaveLength(0);
    expect(result.suppressionReasons).toHaveLength(0);
  });

  it('good pick with medium liquidity → capped at A', () => {
    const result = assignPromotionBand(
      makeInput({
        edge: 0.1,
        uncertainty: 0.05,
        clvForecast: 0.1,
        liquidityTier: 'medium',
        selectionScore: 90,
      })
    );
    expect(result.finalBand).toBe('A');
    expect(result.initialBand).toBe('A+');
  });

  it('multiple downgrades stack correctly', () => {
    // A+ initial, uncertainty caps to A, CLV downgrades to B
    const result = assignPromotionBand(
      makeInput({
        edge: 0.1,
        uncertainty: UNCERTAINTY_CAPS['A+'] + 0.01,
        clvForecast: CLV_THRESHOLDS.downgradeBelow - 0.01,
        liquidityTier: 'high',
        selectionScore: 90,
      })
    );
    expect(result.initialBand).toBe('A+');
    expect(result.finalBand).toBe('B');
    expect(result.downgradeReasons.length).toBeGreaterThanOrEqual(2);
  });

  it('suppression produces correct output shape', () => {
    const result = assignPromotionBand(
      makeInput({
        edge: 0.1,
        uncertainty: UNCERTAINTY_SUPPRESS_THRESHOLD + 0.1,
        selectionScore: 90,
      })
    );
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.suppressionReasons.length).toBeGreaterThan(0);
    expect(result.thresholdVersion).toBe(THRESHOLD_VERSION);
  });

  it('non-selected pick → SUPPRESS with initial SUPPRESS', () => {
    const result = assignPromotionBand(
      makeInput({
        selectionDecision: 'reject',
      })
    );
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.initialBand).toBe('SUPPRESS');
  });

  it('C band pick with risk reduce → SUPPRESS', () => {
    const result = assignPromotionBand(
      makeInput({
        edge: 0.02,
        selectionScore: 30,
        riskDecision: 'reduce',
      })
    );
    // C → downgraded one step → SUPPRESS
    expect(result.finalBand).toBe('SUPPRESS');
  });
});

// ── 8. Determinism ──────────────────────────────────────────────────────────

describe('deterministic behavior', () => {
  it('same input produces identical output across 100 runs', () => {
    const input = makeInput({
      edge: 0.06,
      uncertainty: 0.12,
      clvForecast: -0.03,
      liquidityTier: 'medium',
      marketResistance: 0.5,
      riskDecision: 'allow',
      selectionScore: 75,
    });

    const baseline = assignPromotionBand(input);
    for (let i = 0; i < 100; i++) {
      const result = assignPromotionBand(input);
      expect(result).toEqual(baseline);
    }
  });

  it('deep-equal inputs produce identical outputs', () => {
    const input1 = makeInput({ edge: 0.07, uncertainty: 0.08 });
    const input2 = makeInput({ edge: 0.07, uncertainty: 0.08 });
    expect(assignPromotionBand(input1)).toEqual(assignPromotionBand(input2));
  });
});

// ── 9. Edge Cases & Helpers ─────────────────────────────────────────────────

describe('threshold helpers', () => {
  it('compareBands: A+ < A < B < C < SUPPRESS', () => {
    expect(compareBands('A+', 'A')).toBeLessThan(0);
    expect(compareBands('A', 'B')).toBeLessThan(0);
    expect(compareBands('B', 'C')).toBeLessThan(0);
    expect(compareBands('C', 'SUPPRESS')).toBeLessThan(0);
    expect(compareBands('A', 'A')).toBe(0);
    expect(compareBands('SUPPRESS', 'A+')).toBeGreaterThan(0);
  });

  it('downgradeOneStep walks the chain correctly', () => {
    expect(downgradeOneStep('A+')).toBe('A');
    expect(downgradeOneStep('A')).toBe('B');
    expect(downgradeOneStep('B')).toBe('C');
    expect(downgradeOneStep('C')).toBe('SUPPRESS');
    expect(downgradeOneStep('SUPPRESS')).toBe('SUPPRESS');
  });
});

describe('boundary conditions', () => {
  it('zero edge → SUPPRESS', () => {
    const result = assignPromotionBand(makeInput({ edge: 0 }));
    expect(result.finalBand).toBe('SUPPRESS');
  });

  it('negative edge → SUPPRESS', () => {
    const result = assignPromotionBand(makeInput({ edge: -0.05 }));
    expect(result.finalBand).toBe('SUPPRESS');
  });

  it('zero uncertainty → no uncertainty downgrade', () => {
    const result = assignPromotionBand(makeInput({ uncertainty: 0 }));
    expect(result.downgradeReasons.filter(r => r.includes('uncertainty'))).toHaveLength(0);
  });

  it('CLV exactly at suppress threshold does not suppress', () => {
    const input = makeInput({ clvForecast: CLV_THRESHOLDS.suppressBelow });
    const result = applyBandDowngrades(input, 'A');
    // At threshold, not below — should downgrade, not suppress
    expect(result.finalBand).not.toBe('SUPPRESS');
  });

  it('output always has thresholdVersion', () => {
    const tiers: BandTier[] = ['A+', 'A', 'B', 'C', 'SUPPRESS'];
    for (const tier of tiers) {
      const result = applyBandDowngrades(makeInput(), tier);
      expect(result.thresholdVersion).toBe(THRESHOLD_VERSION);
    }
  });

  it('already-suppressed initial band passes through cleanly', () => {
    const result = applyBandDowngrades(makeInput(), 'SUPPRESS');
    expect(result.finalBand).toBe('SUPPRESS');
    expect(result.initialBand).toBe('SUPPRESS');
    expect(result.suppressionReasons).toContain('initial_assignment_suppressed');
  });
});
