/**
 * Unit tests for Stat Distribution Engine (UNI-17)
 */
import type { EfficiencyFeatures } from '@/analysis/features/efficiency';
import type { OpportunityFeatures } from '@/analysis/features/opportunity';
import type { PlayerFormFeatures } from '@/analysis/features/player-form';

import {
  computeStatProjection,
  normalCDF,
  poissonCDF,
  FEATURE_SET_VERSION,
  type ProjectionInput,
  type StatProjectionOutput,
} from '@/analysis/models/stat-distribution';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const playerForm: PlayerFormFeatures = {
  minutes_avg: 32,
  minutes_trend: 0.05,
  minutes_projection: 33,
  minutes_uncertainty: 6,
  stat_per_minute: 0.65,
  stat_per_opportunity: 2.5,
  stat_trend: 0.02,
  player_base_volatility: 12,
  consistency_score: 0.7,
  games_sampled: 10,
  window_size: 10,
};

const opportunity: OpportunityFeatures = {
  minutes_projection: 33,
  starter_probability: 1.0,
  usage_rate_projection: 0.28,
  role_stability: 0.9,
  role_uncertainty: 0.6,
  role_change_detected: false,
  opportunity_projection: 9.24, // 33 × 0.28
  games_sampled: 10,
};

const efficiency: EfficiencyFeatures = {
  player_skill_rate: 2.5,
  opponent_defensive_adjustment: 1.05,
  pace_adjustment: 1.02,
  efficiency_projection: 2.6775, // 2.5 × 1.05 × 1.02
  matchup_volatility: 0.15,
  matchup_variance: 0.9,
  opponent_team_id: 'opp-team-1',
  stat_allowed_rank: 8,
};

function makeInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    player_id: 'player-abc',
    stat_type: 'points',
    line: 22.5,
    playerForm,
    opportunity,
    efficiency,
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof computeStatProjection>): StatProjectionOutput {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeStatProjection', () => {
  describe('fail-closed', () => {
    it('rejects zero opportunity projection', () => {
      const input = makeInput({
        opportunity: { ...opportunity, opportunity_projection: 0 },
      });
      const result = computeStatProjection(input);
      expect(result.ok).toBe(false);
    });

    it('rejects zero efficiency projection', () => {
      const input = makeInput({
        efficiency: { ...efficiency, efficiency_projection: 0 },
      });
      const result = computeStatProjection(input);
      expect(result.ok).toBe(false);
    });

    it('rejects negative line', () => {
      const result = computeStatProjection(makeInput({ line: -1 }));
      expect(result.ok).toBe(false);
    });
  });

  describe('expected_value = opportunity × efficiency', () => {
    it('computes correct expected value', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      // 9.24 × 2.6775 ≈ 24.74
      const expected = 9.24 * 2.6775;
      expect(data.expected_value).toBeCloseTo(expected, 1);
    });

    it('does NOT use historical averages directly', () => {
      // The expected_value should be opportunity × efficiency,
      // not playerForm.minutes_avg × playerForm.stat_per_minute
      const data = expectOk(computeStatProjection(makeInput()));
      const naiveAvg = playerForm.minutes_avg * playerForm.stat_per_minute; // 32 × 0.65 = 20.8
      expect(data.expected_value).not.toBeCloseTo(naiveAvg, 0);
    });
  });

  describe('non-constant variance', () => {
    it('includes all 4 variance components', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      // variance = 12 + 6 + 0.6 + 0.9 = 19.5
      expect(data.variance).toBeCloseTo(19.5, 2);
    });

    it('variance changes when matchup_variance changes', () => {
      const lowMatchup = makeInput({
        efficiency: { ...efficiency, matchup_variance: 0 },
      });
      const highMatchup = makeInput({
        efficiency: { ...efficiency, matchup_variance: 5 },
      });
      const low = expectOk(computeStatProjection(lowMatchup));
      const high = expectOk(computeStatProjection(highMatchup));
      expect(high.variance).toBeGreaterThan(low.variance);
    });

    it('variance changes when role_uncertainty changes', () => {
      const stableRole = makeInput({
        opportunity: { ...opportunity, role_uncertainty: 0 },
      });
      const unstableRole = makeInput({
        opportunity: { ...opportunity, role_uncertainty: 3 },
      });
      const stable = expectOk(computeStatProjection(stableRole));
      const unstable = expectOk(computeStatProjection(unstableRole));
      expect(unstable.variance).toBeGreaterThan(stable.variance);
    });
  });

  describe('distribution type selection', () => {
    it('selects normal for points', () => {
      const data = expectOk(computeStatProjection(makeInput({ stat_type: 'points' })));
      expect(data.distribution_type).toBe('normal');
    });

    it('selects poisson for blocks', () => {
      const data = expectOk(computeStatProjection(makeInput({ stat_type: 'blocks' })));
      expect(data.distribution_type).toBe('poisson');
    });

    it('selects poisson for three_pointers_made', () => {
      const data = expectOk(computeStatProjection(makeInput({ stat_type: 'three_pointers_made' })));
      expect(data.distribution_type).toBe('poisson');
    });

    it('allows distribution override', () => {
      const data = expectOk(
        computeStatProjection(
          makeInput({
            stat_type: 'points',
            distribution_type: 'poisson',
          })
        )
      );
      expect(data.distribution_type).toBe('poisson');
    });
  });

  describe('p_over / p_under', () => {
    it('p_over + p_under ≈ 1.0', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      expect(data.p_over + data.p_under).toBeCloseTo(1, 2);
    });

    it('p_over > 0.5 when expected > line', () => {
      // expected ≈ 24.7, line = 22.5 → should favor over
      const data = expectOk(computeStatProjection(makeInput()));
      expect(data.p_over).toBeGreaterThan(0.5);
    });

    it('p_under > 0.5 when expected < line', () => {
      const data = expectOk(computeStatProjection(makeInput({ line: 30 })));
      expect(data.p_under).toBeGreaterThan(0.5);
    });

    it('probabilities are bounded (0.001, 0.999)', () => {
      const data = expectOk(computeStatProjection(makeInput({ line: 0 })));
      expect(data.p_over).toBeLessThanOrEqual(0.999);
      expect(data.p_under).toBeGreaterThanOrEqual(0.001);
    });
  });

  describe('confidence', () => {
    it('is bounded [0, 1]', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      expect(data.confidence).toBeGreaterThanOrEqual(0);
      expect(data.confidence).toBeLessThanOrEqual(1);
    });

    it('higher for low-variance projections', () => {
      const lowVar = makeInput({
        playerForm: { ...playerForm, player_base_volatility: 1, minutes_uncertainty: 0 },
        opportunity: { ...opportunity, role_uncertainty: 0 },
        efficiency: { ...efficiency, matchup_variance: 0 },
      });
      const highVar = makeInput({
        playerForm: { ...playerForm, player_base_volatility: 50, minutes_uncertainty: 20 },
      });
      const low = expectOk(computeStatProjection(lowVar));
      const high = expectOk(computeStatProjection(highVar));
      expect(low.confidence).toBeGreaterThan(high.confidence);
    });
  });

  describe('reproducibility', () => {
    it('produces consistent feature_vector_hash', () => {
      const r1 = expectOk(computeStatProjection(makeInput()));
      const r2 = expectOk(computeStatProjection(makeInput()));
      expect(r1.feature_vector_hash).toBe(r2.feature_vector_hash);
    });

    it('produces different hash for different inputs', () => {
      const r1 = expectOk(computeStatProjection(makeInput()));
      const r2 = expectOk(computeStatProjection(makeInput({ line: 30 })));
      // Hash is based on features not line, so same features → same hash
      expect(r1.feature_vector_hash).toBe(r2.feature_vector_hash);

      // Different features → different hash
      const r3 = expectOk(
        computeStatProjection(
          makeInput({
            opportunity: { ...opportunity, opportunity_projection: 12 },
          })
        )
      );
      expect(r1.feature_vector_hash).not.toBe(r3.feature_vector_hash);
    });

    it('includes feature_set_version', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      expect(data.feature_set_version).toBe(FEATURE_SET_VERSION);
    });
  });

  describe('output contract fields', () => {
    it('includes all required fields', () => {
      const data = expectOk(computeStatProjection(makeInput()));
      expect(data).toHaveProperty('player_id');
      expect(data).toHaveProperty('stat_type');
      expect(data).toHaveProperty('opportunity_projection');
      expect(data).toHaveProperty('efficiency_projection');
      expect(data).toHaveProperty('expected_value');
      expect(data).toHaveProperty('variance');
      expect(data).toHaveProperty('distribution_type');
      expect(data).toHaveProperty('params_json');
      expect(data).toHaveProperty('p_over');
      expect(data).toHaveProperty('p_under');
      expect(data).toHaveProperty('confidence');
      expect(data).toHaveProperty('feature_vector_hash');
      expect(data).toHaveProperty('feature_set_version');
    });
  });
});

describe('normalCDF', () => {
  it('returns 0.5 at z=0', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it('returns ~0.8413 at z=1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ~0.9772 at z=2', () => {
    expect(normalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it('is symmetric', () => {
    expect(normalCDF(-1)).toBeCloseTo(1 - normalCDF(1), 4);
  });
});

describe('poissonCDF', () => {
  it('P(X<=0) = e^-lambda for Poi(lambda)', () => {
    expect(poissonCDF(0, 5)).toBeCloseTo(Math.exp(-5), 6);
  });

  it('P(X<=100) ≈ 1 for Poi(5)', () => {
    expect(poissonCDF(100, 5)).toBeCloseTo(1, 6);
  });

  it('returns 0 for k < 0', () => {
    expect(poissonCDF(-1, 5)).toBe(0);
  });
});
