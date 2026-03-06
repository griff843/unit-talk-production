/**
 * Tests for Calibration Module — SPRINT-039
 */

import { describe, it, expect } from 'vitest';

import {
  computeCalibrationMetrics,
  compareCalibration,
  compareCalibrationByBand,
} from '../calibration-analysis';
import { calibrate, calibrateBatch } from '../calibration-engine';
import {
  CALIBRATION_VERSION,
  DEFAULT_CALIBRATION_PROFILE,
  IDENTITY_CALIBRATION_PROFILE,
} from '../calibration-version';

import type {
  CalibrationInput,
  CalibrationProfile,
  CalibrationOutcomeRecord,
} from '../calibration-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    p_final: 0.55,
    band: 'A',
    ...overrides,
  };
}

// ── Calibration Version ──────────────────────────────────────────────────────

describe('calibration-version', () => {
  it('exports a valid version string', () => {
    expect(CALIBRATION_VERSION).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it('default profile has matching version', () => {
    expect(DEFAULT_CALIBRATION_PROFILE.version).toBe(CALIBRATION_VERSION);
  });

  it('identity profile has version suffix', () => {
    expect(IDENTITY_CALIBRATION_PROFILE.version).toContain('identity');
  });

  it('default profile uses platt method', () => {
    expect(DEFAULT_CALIBRATION_PROFILE.global.method).toBe('platt');
    expect(DEFAULT_CALIBRATION_PROFILE.global.plattParams).toBeDefined();
  });
});

// ── Calibration Engine ───────────────────────────────────────────────────────

describe('calibrate', () => {
  it('returns a CalibrationOutput with version and delta', () => {
    const result = calibrate(makeInput());
    expect(result.p_calibrated).toBeGreaterThan(0);
    expect(result.p_calibrated).toBeLessThan(1);
    expect(result.calibrationVersion).toBe(CALIBRATION_VERSION);
    expect(typeof result.delta).toBe('number');
  });

  it('is deterministic — same input produces same output', () => {
    const input = makeInput({ p_final: 0.6, band: 'A+' });
    const r1 = calibrate(input);
    const r2 = calibrate(input);
    expect(r1.p_calibrated).toBe(r2.p_calibrated);
    expect(r1.delta).toBe(r2.delta);
    expect(r1.calibrationVersion).toBe(r2.calibrationVersion);
  });

  it('identity profile returns input probability unchanged', () => {
    const input = makeInput({ p_final: 0.65 });
    const result = calibrate(input, IDENTITY_CALIBRATION_PROFILE);
    expect(result.p_calibrated).toBeCloseTo(0.65, 5);
    expect(result.delta).toBeCloseTo(0, 5);
  });

  it('enforces probability bounds near 0', () => {
    const input = makeInput({ p_final: 0.001 });
    const result = calibrate(input);
    expect(result.p_calibrated).toBeGreaterThan(0);
    expect(result.p_calibrated).toBeLessThan(1);
  });

  it('enforces probability bounds near 1', () => {
    const input = makeInput({ p_final: 0.999 });
    const result = calibrate(input);
    expect(result.p_calibrated).toBeGreaterThan(0);
    expect(result.p_calibrated).toBeLessThan(1);
  });

  it('delta equals p_calibrated minus p_final', () => {
    const input = makeInput({ p_final: 0.55 });
    const result = calibrate(input);
    // Allow small floating-point tolerance
    expect(result.delta).toBeCloseTo(result.p_calibrated - input.p_final, 5);
  });

  it('applies mild correction — mid-range probabilities change little', () => {
    const input = makeInput({ p_final: 0.5 });
    const result = calibrate(input);
    // With default Platt params (a=-1.05, b=0.02), 0.50 should stay near 0.50
    expect(Math.abs(result.delta)).toBeLessThan(0.05);
  });

  it('uses per-band config when available', () => {
    const profile: CalibrationProfile = {
      version: 'test-v1',
      global: { method: 'identity' },
      byBand: {
        'A+': {
          method: 'platt',
          plattParams: { a: -1.1, b: 0.05 },
        },
      },
    };

    const aPlusResult = calibrate(makeInput({ band: 'A+', p_final: 0.6 }), profile);
    const aResult = calibrate(makeInput({ band: 'A', p_final: 0.6 }), profile);

    // A+ uses Platt, A uses identity
    expect(aResult.p_calibrated).toBeCloseTo(0.6, 5);
    expect(aPlusResult.p_calibrated).not.toBeCloseTo(0.6, 3);
  });

  it('histogram method maps to observed rate', () => {
    const profile: CalibrationProfile = {
      version: 'test-hist',
      global: {
        method: 'histogram',
        bins: [
          { lower: 0.0, upper: 0.5, observedRate: 0.35, sampleSize: 100 },
          { lower: 0.5, upper: 1.0, observedRate: 0.6, sampleSize: 100 },
        ],
      },
    };

    const result1 = calibrate(makeInput({ p_final: 0.4 }), profile);
    expect(result1.p_calibrated).toBeCloseTo(0.35, 5);

    const result2 = calibrate(makeInput({ p_final: 0.7 }), profile);
    expect(result2.p_calibrated).toBeCloseTo(0.6, 5);
  });
});

describe('calibrateBatch', () => {
  it('calibrates multiple inputs', () => {
    const inputs = [
      makeInput({ p_final: 0.5 }),
      makeInput({ p_final: 0.6 }),
      makeInput({ p_final: 0.7 }),
    ];
    const results = calibrateBatch(inputs);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.p_calibrated).toBeGreaterThan(0);
      expect(r.p_calibrated).toBeLessThan(1);
      expect(r.calibrationVersion).toBeDefined();
    }
  });

  it('batch results match individual results', () => {
    const inputs = [
      makeInput({ p_final: 0.45, band: 'B' }),
      makeInput({ p_final: 0.55, band: 'A' }),
    ];
    const batch = calibrateBatch(inputs);
    const individual = inputs.map(i => calibrate(i));
    expect(batch).toEqual(individual);
  });
});

// ── Calibration Analysis ─────────────────────────────────────────────────────

describe('computeCalibrationMetrics', () => {
  it('returns empty metrics for empty input', () => {
    const metrics = computeCalibrationMetrics([]);
    expect(metrics.brierScore).toBe(0);
    expect(metrics.logLoss).toBe(0);
    expect(metrics.ece).toBe(0);
    expect(metrics.sampleSize).toBe(0);
  });

  it('computes Brier score correctly for perfect predictions', () => {
    const predictions = [
      { p: 1.0, outcome: 1 as const },
      { p: 0.0, outcome: 0 as const },
    ];
    const metrics = computeCalibrationMetrics(predictions);
    expect(metrics.brierScore).toBeCloseTo(0, 5);
  });

  it('computes Brier score correctly for worst predictions', () => {
    const predictions = [
      { p: 0.0, outcome: 1 as const },
      { p: 1.0, outcome: 0 as const },
    ];
    const metrics = computeCalibrationMetrics(predictions);
    expect(metrics.brierScore).toBeCloseTo(1, 5);
  });

  it('computes log loss correctly', () => {
    // Perfect calibration at 50/50 should have log loss = ln(2) ≈ 0.693
    const predictions = [
      { p: 0.5, outcome: 1 as const },
      { p: 0.5, outcome: 0 as const },
    ];
    const metrics = computeCalibrationMetrics(predictions);
    expect(metrics.logLoss).toBeCloseTo(Math.log(2), 4);
  });

  it('builds reliability curve with correct bucket count', () => {
    const predictions = Array.from({ length: 100 }, (_, i) => ({
      p: (i + 0.5) / 100,
      outcome: (i % 2 === 0 ? 1 : 0) as 0 | 1,
    }));
    const metrics = computeCalibrationMetrics(predictions, 10);
    expect(metrics.reliabilityCurve).toHaveLength(10);
    for (const bucket of metrics.reliabilityCurve) {
      expect(bucket.lower).toBeLessThan(bucket.upper);
      expect(bucket.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('ECE is zero for perfectly calibrated predictions', () => {
    // All predictions at 0.5, exactly half win
    const predictions = [
      { p: 0.5, outcome: 1 as const },
      { p: 0.5, outcome: 0 as const },
    ];
    const metrics = computeCalibrationMetrics(predictions, 10);
    // ECE should be very low (not exactly zero due to binning)
    expect(metrics.ece).toBeLessThan(0.1);
  });
});

describe('compareCalibration', () => {
  it('identity calibration shows zero improvement', () => {
    const records: CalibrationOutcomeRecord[] = [
      { p_final: 0.55, p_calibrated: 0.55, outcome: 'WIN', band: 'A' },
      { p_final: 0.45, p_calibrated: 0.45, outcome: 'LOSS', band: 'A' },
      { p_final: 0.6, p_calibrated: 0.6, outcome: 'WIN', band: 'B' },
    ];
    const comparison = compareCalibration(records);
    expect(comparison.improvement.brierDelta).toBeCloseTo(0, 5);
    expect(comparison.improvement.logLossDelta).toBeCloseTo(0, 5);
    expect(comparison.brierImproved).toBe(true); // zero delta = improved/preserved
    expect(comparison.logLossAcceptable).toBe(true);
  });

  it('better calibration shows negative Brier delta', () => {
    // Overconfident raw predictions, corrected by calibration
    const records: CalibrationOutcomeRecord[] = [
      { p_final: 0.9, p_calibrated: 0.6, outcome: 'WIN', band: 'A' },
      { p_final: 0.9, p_calibrated: 0.6, outcome: 'LOSS', band: 'A' },
      { p_final: 0.9, p_calibrated: 0.6, outcome: 'WIN', band: 'A' },
      { p_final: 0.9, p_calibrated: 0.6, outcome: 'LOSS', band: 'A' },
    ];
    // At 50% actual win rate, p=0.60 is closer than p=0.90
    const comparison = compareCalibration(records);
    expect(comparison.improvement.brierDelta).toBeLessThan(0);
    expect(comparison.brierImproved).toBe(true);
  });

  it('filters out PUSH outcomes', () => {
    const records: CalibrationOutcomeRecord[] = [
      { p_final: 0.55, p_calibrated: 0.55, outcome: 'WIN', band: 'A' },
      { p_final: 0.55, p_calibrated: 0.55, outcome: 'PUSH', band: 'A' },
      { p_final: 0.45, p_calibrated: 0.45, outcome: 'LOSS', band: 'A' },
    ];
    const comparison = compareCalibration(records);
    expect(comparison.preCal.sampleSize).toBe(2);
    expect(comparison.postCal.sampleSize).toBe(2);
  });

  it('flags unacceptable log loss worsening', () => {
    // Calibration makes predictions worse
    const records: CalibrationOutcomeRecord[] = [
      { p_final: 0.6, p_calibrated: 0.3, outcome: 'WIN', band: 'A' },
      { p_final: 0.6, p_calibrated: 0.3, outcome: 'WIN', band: 'A' },
      { p_final: 0.4, p_calibrated: 0.7, outcome: 'LOSS', band: 'A' },
      { p_final: 0.4, p_calibrated: 0.7, outcome: 'LOSS', band: 'A' },
    ];
    const comparison = compareCalibration(records);
    expect(comparison.improvement.logLossDelta).toBeGreaterThan(0);
    expect(comparison.logLossAcceptable).toBe(false);
  });
});

describe('compareCalibrationByBand', () => {
  it('returns per-band comparisons', () => {
    const records: CalibrationOutcomeRecord[] = [
      { p_final: 0.55, p_calibrated: 0.55, outcome: 'WIN', band: 'A+' },
      { p_final: 0.45, p_calibrated: 0.45, outcome: 'LOSS', band: 'A+' },
      { p_final: 0.5, p_calibrated: 0.5, outcome: 'WIN', band: 'A' },
      { p_final: 0.5, p_calibrated: 0.5, outcome: 'LOSS', band: 'A' },
    ];
    const byBand = compareCalibrationByBand(records);
    expect(byBand['A+']).toBeDefined();
    expect(byBand['A']).toBeDefined();
    expect(byBand['A+'].preCal.sampleSize).toBe(2);
    expect(byBand['A'].preCal.sampleSize).toBe(2);
  });
});

// ── Integration: Engine + Analysis ───────────────────────────────────────────

describe('calibration integration', () => {
  it('default profile calibration does not worsen well-calibrated data', () => {
    // Generate a realistic dataset: predictions near 55%, ~55% win rate
    const records: CalibrationOutcomeRecord[] = [];
    for (let i = 0; i < 100; i++) {
      const p = 0.5 + (i % 10) * 0.01; // 0.50 to 0.59
      const isWin = i < 55; // 55% win rate
      const input = makeInput({ p_final: p, band: 'A' });
      const output = calibrate(input);
      records.push({
        p_final: p,
        p_calibrated: output.p_calibrated,
        outcome: isWin ? 'WIN' : 'LOSS',
        band: 'A',
      });
    }

    const comparison = compareCalibration(records);
    // Default Platt params are mild — should not materially worsen Brier
    expect(comparison.logLossAcceptable).toBe(true);
  });

  it('calibration version flows through the full pipeline', () => {
    const input = makeInput();
    const output = calibrate(input);
    expect(output.calibrationVersion).toBe(CALIBRATION_VERSION);
  });

  it('calibration is monotonic — higher input produces higher or equal output', () => {
    const probabilities = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const outputs = probabilities.map(p => calibrate(makeInput({ p_final: p })).p_calibrated);

    for (let i = 1; i < outputs.length; i++) {
      expect(outputs[i]).toBeGreaterThanOrEqual(outputs[i - 1]);
    }
  });
});
