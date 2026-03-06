/**
 * Unit tests for Outcome Bridge (SPRINT-034)
 */
import type { ScoredOutcome } from '@/analysis/outcomes/types';

import {
  bridgeOutcomeToEvaluation,
  bridgeBatchToEvaluation,
} from '@/analysis/outcomes/outcome-bridge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScored(overrides: Partial<ScoredOutcome> = {}): ScoredOutcome {
  return {
    market_key: 'test-mk-1',
    event_id: 'event-1',
    market_type_id: 1,
    participant_id: 'player-1',
    p_final: 0.62,
    p_market_devig: 0.55,
    edge_final: 0.07,
    score: 85,
    tier: 'A',
    book_count: 5,
    line: 22.5,
    actual_value: 25,
    outcome: 'WIN',
    market_type_key: 'player_points_ou',
    ...overrides,
  };
}

// ── bridgeOutcomeToEvaluation ───────────────────────────────────────────────

describe('bridgeOutcomeToEvaluation', () => {
  describe('WIN outcomes', () => {
    it('maps WIN to outcome 1', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ outcome: 'WIN' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.outcome).toBe(1);
    });

    it('constructs BlendOutput from ScoredOutcome fields', () => {
      const result = bridgeOutcomeToEvaluation(
        makeScored({
          p_final: 0.62,
          p_market_devig: 0.55,
          edge_final: 0.07,
        })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const blend = result.data.blend;
      expect(blend.p_final).toBe(0.62);
      expect(blend.p_market).toBe(0.55);
      expect(blend.p_stat).toBe(0.62); // approximated as p_final
      expect(blend.stat_alpha).toBeCloseTo(0.07, 4);
      expect(blend.edge_vs_market).toBe(0.07);
      expect(blend.blend_version).toBe('outcome-bridge-v1.0');
    });
  });

  describe('LOSS outcomes', () => {
    it('maps LOSS to outcome 0', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ outcome: 'LOSS' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.outcome).toBe(0);
    });
  });

  describe('PUSH outcomes', () => {
    it('rejects PUSH outcomes', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ outcome: 'PUSH' }));
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toContain('PUSH');
    });
  });

  describe('validation', () => {
    it('rejects p_final <= 0', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ p_final: 0 }));
      expect(result.ok).toBe(false);
    });

    it('rejects p_final >= 1', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ p_final: 1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects p_market_devig <= 0', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ p_market_devig: 0 }));
      expect(result.ok).toBe(false);
    });

    it('rejects p_market_devig >= 1', () => {
      const result = bridgeOutcomeToEvaluation(makeScored({ p_market_devig: 1 }));
      expect(result.ok).toBe(false);
    });
  });

  describe('derived fields', () => {
    it('computes stat_alpha as p_final - p_market_devig', () => {
      const result = bridgeOutcomeToEvaluation(
        makeScored({
          p_final: 0.65,
          p_market_devig: 0.52,
        })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.blend.stat_alpha).toBeCloseTo(0.13, 4);
    });

    it('computes divergence as absolute difference', () => {
      const result = bridgeOutcomeToEvaluation(
        makeScored({
          p_final: 0.4,
          p_market_devig: 0.55,
        })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.blend.divergence).toBeCloseTo(0.15, 4);
      expect(result.data.blend.divergence_direction).toBe(-1);
    });

    it('sets stat_weight=0 and market_weight=1 (unknown from historical)', () => {
      const result = bridgeOutcomeToEvaluation(makeScored());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.blend.stat_weight).toBe(0);
      expect(result.data.blend.market_weight).toBe(1);
    });
  });

  describe('market_type passthrough', () => {
    it('uses market_type_key when available', () => {
      const result = bridgeOutcomeToEvaluation(
        makeScored({
          market_type_key: 'player_rebounds_ou',
        })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.market_type).toBe('player_rebounds_ou');
    });

    it('falls back to mt_{id} when market_type_key is undefined', () => {
      const result = bridgeOutcomeToEvaluation(
        makeScored({
          market_type_key: undefined,
          market_type_id: 42,
        })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.market_type).toBe('mt_42');
    });
  });

  describe('sport option', () => {
    it('passes sport from options', () => {
      const result = bridgeOutcomeToEvaluation(makeScored(), { sport: 'nba' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.sport).toBe('nba');
    });

    it('sport is undefined when not provided', () => {
      const result = bridgeOutcomeToEvaluation(makeScored());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.sport).toBeUndefined();
    });
  });
});

// ── bridgeBatchToEvaluation ─────────────────────────────────────────────────

describe('bridgeBatchToEvaluation', () => {
  it('bridges valid records and skips PUSHes', () => {
    const scored: ScoredOutcome[] = [
      makeScored({ outcome: 'WIN', market_key: 'mk1' }),
      makeScored({ outcome: 'LOSS', market_key: 'mk2' }),
      makeScored({ outcome: 'PUSH', market_key: 'mk3' }),
      makeScored({ outcome: 'WIN', market_key: 'mk4' }),
      makeScored({ outcome: 'PUSH', market_key: 'mk5' }),
    ];

    const result = bridgeBatchToEvaluation(scored, { sport: 'nba' });
    expect(result.records.length).toBe(3);
    expect(result.skipped).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  it('handles all PUSHes', () => {
    const scored: ScoredOutcome[] = [
      makeScored({ outcome: 'PUSH', market_key: 'mk1' }),
      makeScored({ outcome: 'PUSH', market_key: 'mk2' }),
    ];

    const result = bridgeBatchToEvaluation(scored);
    expect(result.records.length).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('handles empty input', () => {
    const result = bridgeBatchToEvaluation([]);
    expect(result.records.length).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('captures errors for invalid records (non-PUSH)', () => {
    const scored: ScoredOutcome[] = [
      makeScored({ outcome: 'WIN', p_final: 0 }), // invalid
      makeScored({ outcome: 'WIN', market_key: 'mk2' }), // valid
    ];

    const result = bridgeBatchToEvaluation(scored);
    expect(result.records.length).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('p_final');
  });

  it('preserves sport option across all bridged records', () => {
    const scored = [
      makeScored({ outcome: 'WIN', market_key: 'mk1' }),
      makeScored({ outcome: 'LOSS', market_key: 'mk2' }),
    ];

    const result = bridgeBatchToEvaluation(scored, { sport: 'nfl' });
    for (const r of result.records) {
      expect(r.sport).toBe('nfl');
    }
  });
});
