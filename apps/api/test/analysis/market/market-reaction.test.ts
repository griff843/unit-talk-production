/**
 * Unit tests for Market Reaction Intelligence (Sprint 033)
 */
import type { BlendOutput } from '@/analysis/models/stat-market-blend';

import {
  computeAlphaEvaluation,
  type EvaluationRecord,
} from '@/analysis/evaluation/alpha-evaluation';
import {
  computeMarketReaction,
  summarizeMarketReactions,
  type MarketReactionOutput,
  type MarketReactionInput,
} from '@/analysis/market/market-reaction';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<MarketReactionInput> = {}): MarketReactionInput {
  return {
    player_id: 'player-abc',
    stat_type: 'points',
    open_line: 22.5,
    close_line: 23.5,
    model_projection: 25.0,
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof computeMarketReaction>): MarketReactionOutput {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeMarketReaction', () => {
  describe('fail-closed', () => {
    it('rejects negative open_line', () => {
      const result = computeMarketReaction(makeInput({ open_line: -1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects negative close_line', () => {
      const result = computeMarketReaction(makeInput({ close_line: -1 }));
      expect(result.ok).toBe(false);
    });

    it('rejects model_projection <= 0', () => {
      const result = computeMarketReaction(makeInput({ model_projection: 0 }));
      expect(result.ok).toBe(false);
    });

    it('rejects bet_line = 0', () => {
      const result = computeMarketReaction(makeInput({ bet_line: 0 }));
      expect(result.ok).toBe(false);
    });
  });

  describe('market moves toward model', () => {
    it('detects alignment when market moves up toward over projection', () => {
      // Model says 25 (over 22.5), market moves from 22.5 → 23.5 (up)
      const data = expectOk(computeMarketReaction(makeInput()));
      expect(data.model_direction).toBe(1);
      expect(data.market_direction).toBe(1);
      expect(data.reaction_alignment).toBe(true);
    });

    it('detects alignment when market moves down toward under projection', () => {
      // Model says 18 (under 22.5), market moves from 22.5 → 21.5 (down)
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            model_projection: 18,
            close_line: 21.5,
          })
        )
      );
      expect(data.model_direction).toBe(-1);
      expect(data.market_direction).toBe(-1);
      expect(data.reaction_alignment).toBe(true);
    });
  });

  describe('market moves against model', () => {
    it('detects non-alignment when market moves opposite to model', () => {
      // Model says 25 (over 22.5), but market moves from 22.5 → 21.5 (down)
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            model_projection: 25,
            close_line: 21.5,
          })
        )
      );
      expect(data.model_direction).toBe(1);
      expect(data.market_direction).toBe(-1);
      expect(data.reaction_alignment).toBe(false);
    });
  });

  describe('no movement', () => {
    it('market_direction is 0 when line unchanged', () => {
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            close_line: 22.5, // same as open
          })
        )
      );
      expect(data.market_direction).toBe(0);
      expect(data.reaction_alignment).toBe(false);
      expect(data.reaction_strength).toBe(0);
    });

    it('model_direction is 0 when projection equals line', () => {
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            model_projection: 22.5, // same as open_line
          })
        )
      );
      expect(data.model_direction).toBe(0);
      expect(data.reaction_alignment).toBe(false);
    });
  });

  describe('large movement', () => {
    it('captures high reaction_strength', () => {
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 27.5,
          })
        )
      );
      expect(data.reaction_strength).toBeCloseTo(5.0, 4);
    });
  });

  describe('CLV positive', () => {
    it('positive CLV when close moves in bet direction (over)', () => {
      // Bet at open 22.5, close moves to 24.0 → line went up (harder to hit over)
      // CLV = 24.0 - 22.5 = +1.5
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 24.0,
          })
        )
      );
      expect(data.clv_value).toBeCloseTo(1.5, 4);
      expect(data.clv_percent).toBeCloseTo(1.5 / 22.5, 4);
      expect(data.clv_value).toBeGreaterThan(0);
    });

    it('positive CLV with custom bet_line', () => {
      // Bet at 21.0, close at 24.0 → CLV = 3.0
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 24.0,
            bet_line: 21.0,
          })
        )
      );
      expect(data.clv_value).toBeCloseTo(3.0, 4);
      expect(data.clv_percent).toBeCloseTo(3.0 / 21.0, 4);
    });
  });

  describe('CLV negative', () => {
    it('negative CLV when close moves against bet direction', () => {
      // Bet at open 22.5, close drops to 21.0
      // CLV = 21.0 - 22.5 = -1.5
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 21.0,
          })
        )
      );
      expect(data.clv_value).toBeCloseTo(-1.5, 4);
      expect(data.clv_percent).toBeCloseTo(-1.5 / 22.5, 4);
      expect(data.clv_value).toBeLessThan(0);
    });
  });

  describe('CLV zero', () => {
    it('zero CLV when close equals bet line', () => {
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            close_line: 22.5, // same as open/bet
          })
        )
      );
      expect(data.clv_value).toBe(0);
      expect(data.clv_percent).toBe(0);
    });
  });

  describe('output contract', () => {
    it('includes all required fields', () => {
      const data = expectOk(computeMarketReaction(makeInput()));
      expect(data).toHaveProperty('player_id');
      expect(data).toHaveProperty('stat_type');
      expect(data).toHaveProperty('open_line');
      expect(data).toHaveProperty('close_line');
      expect(data).toHaveProperty('model_projection');
      expect(data).toHaveProperty('model_direction');
      expect(data).toHaveProperty('market_direction');
      expect(data).toHaveProperty('reaction_alignment');
      expect(data).toHaveProperty('clv_value');
      expect(data).toHaveProperty('clv_percent');
      expect(data).toHaveProperty('reaction_strength');
    });

    it('passes through player_id and stat_type', () => {
      const data = expectOk(
        computeMarketReaction(
          makeInput({
            player_id: 'test-123',
            stat_type: 'rebounds',
          })
        )
      );
      expect(data.player_id).toBe('test-123');
      expect(data.stat_type).toBe('rebounds');
    });
  });
});

describe('summarizeMarketReactions', () => {
  it('returns zeroes for empty array', () => {
    const summary = summarizeMarketReactions([]);
    expect(summary.total).toBe(0);
    expect(summary.alignment_rate).toBe(0);
  });

  it('computes correct summary stats', () => {
    const reactions: MarketReactionOutput[] = [
      expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 23.5,
            model_projection: 25,
          })
        )
      ),
      expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 21.5,
            model_projection: 18,
          })
        )
      ),
      expectOk(
        computeMarketReaction(
          makeInput({
            open_line: 22.5,
            close_line: 21.0,
            model_projection: 25,
          })
        )
      ),
    ];

    const summary = summarizeMarketReactions(reactions);
    expect(summary.total).toBe(3);
    expect(summary.aligned_count).toBe(2); // first two aligned
    expect(summary.alignment_rate).toBeCloseTo(2 / 3, 3);
    expect(summary.positive_clv_count).toBe(1); // 23.5 - 22.5 = +1
    expect(summary.negative_clv_count).toBe(2); // 21.5 - 22.5 = -1, 21.0 - 22.5 = -1.5
    expect(summary.avg_reaction_strength).toBeGreaterThan(0);
  });
});

describe('AlphaEvaluation integration', () => {
  it('includes market_reaction metrics when records have reaction data', () => {
    const reaction = expectOk(computeMarketReaction(makeInput()));

    const records: EvaluationRecord[] = [
      {
        blend: makeBlend(),
        outcome: 1,
        sport: 'nba',
        market_type: 'points',
        market_reaction: reaction,
      },
      {
        blend: makeBlend({ p_final: 0.45, p_stat: 0.4, p_market: 0.55, stat_alpha: -0.15 }),
        outcome: 0,
        sport: 'nba',
        market_type: 'points',
        market_reaction: expectOk(
          computeMarketReaction(
            makeInput({
              open_line: 22.5,
              close_line: 21.5,
              model_projection: 18,
            })
          )
        ),
      },
    ];

    const report = computeAlphaEvaluation(records);
    expect(report.market_reaction).toBeDefined();
    expect(report.market_reaction!.reaction_sample_size).toBe(2);
    expect(report.market_reaction!.reaction_alignment_rate).toBeGreaterThan(0);
    expect(typeof report.market_reaction!.avg_clv_value).toBe('number');
    expect(typeof report.market_reaction!.avg_reaction_strength).toBe('number');
  });

  it('market_reaction is undefined when no records have reaction data', () => {
    const records: EvaluationRecord[] = [{ blend: makeBlend(), outcome: 1 }];
    const report = computeAlphaEvaluation(records);
    expect(report.market_reaction).toBeUndefined();
  });

  it('existing alpha evaluation fields still work', () => {
    const records: EvaluationRecord[] = [
      { blend: makeBlend(), outcome: 1, sport: 'nba', market_type: 'points' },
      { blend: makeBlend({ p_final: 0.45, stat_alpha: -0.1 }), outcome: 0, sport: 'nba' },
    ];
    const report = computeAlphaEvaluation(records);
    expect(report.sample_size).toBe(2);
    expect(report.brier_score).toBeGreaterThan(0);
    expect(report.confidence_buckets.length).toBe(5);
    expect(report.alpha_buckets.length).toBe(5);
    expect(report.by_sport).toHaveProperty('nba');
  });
});
