/**
 * Unit tests for Signal Quality Layer (UNI-25)
 * SPRINT-032A: Z-score and Kelly corrections applied
 */
import type { BlendOutput } from '@/analysis/models/stat-market-blend';

import {
  computeSignalQuality,
  type SignalOutput,
  type StatContext,
} from '@/analysis/signals/signal-quality';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBlend(overrides: Partial<BlendOutput> = {}): BlendOutput {
  return {
    p_final: 0.62,
    p_stat: 0.65,
    p_market: 0.55,
    stat_weight: 0.3,
    market_weight: 0.7,
    stat_alpha: 0.1,
    divergence: 0.1,
    divergence_direction: 1,
    edge_vs_market: 0.07,
    blend_version: 'test',
    ...overrides,
  };
}

function makeStat(overrides: Partial<StatContext> = {}): StatContext {
  return {
    expected_value: 24.7,
    variance: 19.5,
    line: 22.5,
    confidence: 0.7,
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof computeSignalQuality>): SignalOutput {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeSignalQuality', () => {
  describe('fail-closed', () => {
    it('rejects variance <= 0', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ variance: 0 }));
      expect(result.ok).toBe(false);
    });

    it('rejects negative variance', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ variance: -1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects confidence < 0', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ confidence: -0.1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects confidence > 1', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ confidence: 1.1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects p_final = 0', () => {
      const result = computeSignalQuality(makeBlend({ p_final: 0 }), makeStat());
      expect(result.ok).toBe(false);
    });

    it('rejects p_final = 1', () => {
      const result = computeSignalQuality(makeBlend({ p_final: 1 }), makeStat());
      expect(result.ok).toBe(false);
    });

    it('rejects expected_value <= 0', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ expected_value: 0 }));
      expect(result.ok).toBe(false);
    });

    it('rejects negative line', () => {
      const result = computeSignalQuality(makeBlend(), makeStat({ line: -1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects kelly_fraction <= 0', () => {
      const result = computeSignalQuality(makeBlend(), makeStat(), { kelly_fraction: 0 });
      expect(result.ok).toBe(false);
    });

    it('rejects kelly_fraction > 1', () => {
      const result = computeSignalQuality(makeBlend(), makeStat(), { kelly_fraction: 1.5 });
      expect(result.ok).toBe(false);
    });
  });

  describe('edge computation', () => {
    it('edge = p_final - p_market', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.edge).toBeCloseTo(0.62 - 0.55, 3);
    });

    it('edge_direction is over when edge >= 0', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.edge_direction).toBe('over');
    });

    it('edge_direction is under when edge < 0', () => {
      const blend = makeBlend({ p_final: 0.5, p_market: 0.55 });
      const data = expectOk(computeSignalQuality(blend, makeStat()));
      expect(data.edge_direction).toBe('under');
    });
  });

  describe('Z-score (stat-space)', () => {
    it('z_score = (expected_value - line) / sqrt(variance)', () => {
      // expected=24.7, line=22.5, variance=19.5
      // z = 2.2 / sqrt(19.5) ≈ 2.2 / 4.416 ≈ 0.498
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      const expected = (24.7 - 22.5) / Math.sqrt(19.5);
      expect(data.z_score).toBeCloseTo(expected, 3);
    });

    it('z_score is positive when expected > line', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.z_score).toBeGreaterThan(0);
    });

    it('z_score is negative when expected < line', () => {
      const stat = makeStat({ expected_value: 20, line: 25 });
      const data = expectOk(computeSignalQuality(makeBlend(), stat));
      expect(data.z_score).toBeLessThan(0);
    });

    it('z_score is zero when expected = line', () => {
      const stat = makeStat({ expected_value: 22.5, line: 22.5 });
      const data = expectOk(computeSignalQuality(makeBlend(), stat));
      expect(data.z_score).toBe(0);
    });

    it('larger variance → smaller |z_score|', () => {
      const low = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 5 })));
      const high = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 50 })));
      expect(Math.abs(low.z_score)).toBeGreaterThan(Math.abs(high.z_score));
    });

    it('is dimensionally consistent (stat units / stat units)', () => {
      // Verify with known values:
      // expected=30, line=20, variance=25 → z = 10/5 = 2.0
      const stat = makeStat({ expected_value: 30, line: 20, variance: 25 });
      const data = expectOk(computeSignalQuality(makeBlend(), stat));
      expect(data.z_score).toBeCloseTo(2.0, 4);
    });
  });

  describe('model uncertainty (coefficient of variation)', () => {
    it('uncertainty = sqrt(variance) / expected_value', () => {
      // sqrt(19.5) / 24.7 ≈ 4.416 / 24.7 ≈ 0.1788
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.model_uncertainty).toBeCloseTo(Math.sqrt(19.5) / 24.7, 3);
    });

    it('higher variance → higher uncertainty', () => {
      const low = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 5 })));
      const high = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 50 })));
      expect(high.model_uncertainty).toBeGreaterThan(low.model_uncertainty);
    });

    it('higher expected_value → lower uncertainty (same variance)', () => {
      const low = expectOk(computeSignalQuality(makeBlend(), makeStat({ expected_value: 10 })));
      const high = expectOk(computeSignalQuality(makeBlend(), makeStat({ expected_value: 40 })));
      expect(high.model_uncertainty).toBeLessThan(low.model_uncertainty);
    });

    it('is dimensionless', () => {
      // CV = sigma/mu, both in stat units → ratio is dimensionless
      // For expected=25, variance=25: CV = 5/25 = 0.2
      const stat = makeStat({ expected_value: 25, variance: 25 });
      const data = expectOk(computeSignalQuality(makeBlend(), stat));
      expect(data.model_uncertainty).toBeCloseTo(0.2, 4);
    });
  });

  describe('signal strength', () => {
    it('higher edge → stronger signal', () => {
      const small = expectOk(
        computeSignalQuality(makeBlend({ p_final: 0.56, p_stat: 0.57, p_market: 0.55 }), makeStat())
      );
      const large = expectOk(
        computeSignalQuality(makeBlend({ p_final: 0.7, p_stat: 0.75, p_market: 0.55 }), makeStat())
      );
      expect(large.signal_strength).toBeGreaterThan(small.signal_strength);
    });

    it('higher confidence → stronger signal', () => {
      const low = expectOk(computeSignalQuality(makeBlend(), makeStat({ confidence: 0.3 })));
      const high = expectOk(computeSignalQuality(makeBlend(), makeStat({ confidence: 0.9 })));
      expect(high.signal_strength).toBeGreaterThan(low.signal_strength);
    });

    it('signal_strength >= 0', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.signal_strength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('signal quality score', () => {
    it('quality score in [0, 1]', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.signal_quality_score).toBeGreaterThanOrEqual(0);
      expect(data.signal_quality_score).toBeLessThanOrEqual(1);
    });

    it('higher edge → higher quality', () => {
      const small = expectOk(
        computeSignalQuality(makeBlend({ p_final: 0.56, p_stat: 0.57, p_market: 0.55 }), makeStat())
      );
      const large = expectOk(
        computeSignalQuality(makeBlend({ p_final: 0.7, p_stat: 0.75, p_market: 0.55 }), makeStat())
      );
      expect(large.signal_quality_score).toBeGreaterThan(small.signal_quality_score);
    });

    it('lower variance → higher quality (less uncertainty penalty)', () => {
      const low = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 5 })));
      const high = expectOk(computeSignalQuality(makeBlend(), makeStat({ variance: 100 })));
      expect(low.signal_quality_score).toBeGreaterThan(high.signal_quality_score);
    });
  });

  describe('bet sizing (fractional Kelly)', () => {
    it('no bet when edge < min_edge', () => {
      const blend = makeBlend({ p_final: 0.56, p_market: 0.55 }); // edge=0.01
      const data = expectOk(computeSignalQuality(blend, makeStat()));
      expect(data.recommended_bet_size).toBe(0);
    });

    it('positive bet when edge >= min_edge', () => {
      // edge = 0.07, well above default 0.02
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.recommended_bet_size).toBeGreaterThan(0);
    });

    it('bet = full_kelly × kelly_fraction (quarter-Kelly default)', () => {
      // edge=0.07, p_market=0.55
      // full_kelly = 0.07 / (1 - 0.55) = 0.07 / 0.45 ≈ 0.1556
      // quarter_kelly = 0.1556 * 0.25 ≈ 0.0389
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      const expectedFull = 0.07 / 0.45;
      const expectedQuarter = expectedFull * 0.25;
      expect(data.recommended_bet_size).toBeCloseTo(expectedQuarter, 3);
    });

    it('bet size capped at max_bet_size', () => {
      const blend = makeBlend({ p_final: 0.95, p_market: 0.5 });
      const data = expectOk(computeSignalQuality(blend, makeStat()));
      expect(data.recommended_bet_size).toBeLessThanOrEqual(0.05);
    });

    it('higher kelly_fraction → larger bet', () => {
      const quarter = expectOk(
        computeSignalQuality(makeBlend(), makeStat(), { kelly_fraction: 0.25 })
      );
      const half = expectOk(computeSignalQuality(makeBlend(), makeStat(), { kelly_fraction: 0.5 }));
      expect(half.recommended_bet_size).toBeGreaterThan(quarter.recommended_bet_size);
    });

    it('full Kelly when kelly_fraction = 1.0', () => {
      // edge=0.07, p_market=0.55 → full_kelly = 0.07/0.45 ≈ 0.1556
      // Capped at max_bet_size=0.05
      const data = expectOk(
        computeSignalQuality(makeBlend(), makeStat(), {
          kelly_fraction: 1.0,
          max_bet_size: 0.2,
        })
      );
      const expectedFull = 0.07 / 0.45;
      expect(data.recommended_bet_size).toBeCloseTo(expectedFull, 3);
    });

    it('respects custom max_bet_size', () => {
      const blend = makeBlend({ p_final: 0.95, p_market: 0.5 });
      const data = expectOk(computeSignalQuality(blend, makeStat(), { max_bet_size: 0.02 }));
      expect(data.recommended_bet_size).toBeLessThanOrEqual(0.02);
    });
  });

  describe('output contract', () => {
    it('includes all required fields', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data).toHaveProperty('edge');
      expect(data).toHaveProperty('edge_direction');
      expect(data).toHaveProperty('signal_strength');
      expect(data).toHaveProperty('z_score');
      expect(data).toHaveProperty('signal_quality_score');
      expect(data).toHaveProperty('confidence');
      expect(data).toHaveProperty('recommended_bet_size');
      expect(data).toHaveProperty('model_uncertainty');
      expect(data).toHaveProperty('blend');
      expect(data).toHaveProperty('signal_version');
    });

    it('passes through blend output', () => {
      const blend = makeBlend();
      const data = expectOk(computeSignalQuality(blend, makeStat()));
      expect(data.blend).toEqual(blend);
    });

    it('includes updated signal_version', () => {
      const data = expectOk(computeSignalQuality(makeBlend(), makeStat()));
      expect(data.signal_version).toBe('signal-quality-v1.1');
    });
  });
});
