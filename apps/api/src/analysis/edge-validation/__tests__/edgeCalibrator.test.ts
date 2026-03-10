/**
 * Edge Calibrator Tests
 * Sprint: SPRINT-PHASE2-CLV-EDGE-VALIDATION
 */

import { describe, it, expect } from 'vitest';

import { computeConfidenceInterval, MIN_CI_SAMPLE } from '../edgeCalibrator';

// =============================================================================
// HELPERS
// =============================================================================

function makeValues(n: number, value = 0.05): number[] {
  return Array.from({ length: n }, (_, i) => value + ((i % 5) - 2) * 0.01);
}

function uniformValues(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value);
}

// =============================================================================
// TESTS
// =============================================================================

describe('computeConfidenceInterval', () => {
  describe('fail-closed gates', () => {
    it('returns ok:false for empty input', () => {
      const result = computeConfidenceInterval([]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('EMPTY_INPUT');
        expect(result.n).toBe(0);
      }
    });

    it('returns ok:false when n < MIN_CI_SAMPLE', () => {
      const values = makeValues(MIN_CI_SAMPLE - 1);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INSUFFICIENT_SAMPLE');
        expect(result.n).toBe(MIN_CI_SAMPLE - 1);
      }
    });

    it('returns ok:false for zero variance (all identical)', () => {
      const values = uniformValues(MIN_CI_SAMPLE, 0.05);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('ZERO_VARIANCE');
      }
    });

    it('passes at exactly MIN_CI_SAMPLE non-uniform values', () => {
      const values = makeValues(MIN_CI_SAMPLE);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
    });
  });

  describe('CI properties', () => {
    it('lower < mean < upper', () => {
      const values = makeValues(50);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.lower).toBeLessThan(result.ci.mean);
        expect(result.ci.mean).toBeLessThan(result.ci.upper);
      }
    });

    it('CI is symmetric around the mean', () => {
      const values = makeValues(50);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const margin = result.ci.upper - result.ci.mean;
        const lowerMargin = result.ci.mean - result.ci.lower;
        expect(margin).toBeCloseTo(lowerMargin, 5);
      }
    });

    it('mean matches arithmetic mean of input', () => {
      const values = makeValues(50, 0.07);
      const expected = values.reduce((a, b) => a + b, 0) / values.length;
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.mean).toBeCloseTo(expected, 5);
      }
    });

    it('n matches input length', () => {
      const values = makeValues(60);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.n).toBe(60);
      }
    });

    it('stdErr = stdDev / sqrt(n)', () => {
      const values = makeValues(50);
      const n = values.length;
      const m = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (n - 1);
      const stdDev = Math.sqrt(variance);
      const expectedStdErr = stdDev / Math.sqrt(n);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.stdErr).toBeCloseTo(expectedStdErr, 5);
      }
    });

    it('confidenceLevel matches requested level', () => {
      const values = makeValues(50);
      const result = computeConfidenceInterval(values, 0.99);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.confidenceLevel).toBe(0.99);
      }
    });

    it('method is normal_approximation', () => {
      const values = makeValues(50);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.method).toBe('normal_approximation');
      }
    });
  });

  describe('CI width scales with confidence level', () => {
    it('99% CI is wider than 95% CI', () => {
      const values = makeValues(60);
      const r95 = computeConfidenceInterval(values, 0.95);
      const r99 = computeConfidenceInterval(values, 0.99);
      expect(r95.ok).toBe(true);
      expect(r99.ok).toBe(true);
      if (r95.ok && r99.ok) {
        const width95 = r95.ci.upper - r95.ci.lower;
        const width99 = r99.ci.upper - r99.ci.lower;
        expect(width99).toBeGreaterThan(width95);
      }
    });

    it('95% CI is wider than 90% CI', () => {
      const values = makeValues(60);
      const r90 = computeConfidenceInterval(values, 0.9);
      const r95 = computeConfidenceInterval(values, 0.95);
      expect(r90.ok).toBe(true);
      expect(r95.ok).toBe(true);
      if (r90.ok && r95.ok) {
        const width90 = r90.ci.upper - r90.ci.lower;
        const width95 = r95.ci.upper - r95.ci.lower;
        expect(width95).toBeGreaterThan(width90);
      }
    });

    it('larger n → narrower CI (for same data distribution)', () => {
      const small = makeValues(30);
      const large = makeValues(120);
      const rSmall = computeConfidenceInterval(small);
      const rLarge = computeConfidenceInterval(large);
      expect(rSmall.ok).toBe(true);
      expect(rLarge.ok).toBe(true);
      if (rSmall.ok && rLarge.ok) {
        const widthSmall = rSmall.ci.upper - rSmall.ci.lower;
        const widthLarge = rLarge.ci.upper - rLarge.ci.lower;
        expect(widthLarge).toBeLessThan(widthSmall);
      }
    });
  });

  describe('CI bounds correctness', () => {
    it('95% CI: bounds are mean ± 1.96 * stdErr', () => {
      const values = makeValues(50);
      const n = values.length;
      const m = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (n - 1);
      const stdErr = Math.sqrt(variance) / Math.sqrt(n);
      const result = computeConfidenceInterval(values, 0.95);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ci.upper).toBeCloseTo(m + 1.96 * stdErr, 3);
        expect(result.ci.lower).toBeCloseTo(m - 1.96 * stdErr, 3);
      }
    });

    it('all output values are finite numbers', () => {
      const values = makeValues(50);
      const result = computeConfidenceInterval(values);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Number.isFinite(result.ci.lower)).toBe(true);
        expect(Number.isFinite(result.ci.upper)).toBe(true);
        expect(Number.isFinite(result.ci.mean)).toBe(true);
        expect(Number.isFinite(result.ci.stdErr)).toBe(true);
      }
    });
  });
});
