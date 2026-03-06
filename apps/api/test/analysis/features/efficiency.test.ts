/**
 * Unit tests for Efficiency Feature Extractor (UNI-20)
 */
import type { PlayerFormFeatures } from '@/analysis/features/player-form';

import {
  extractEfficiencyFeatures,
  type OpponentDefenseInput,
  type EfficiencyFeatures,
} from '@/analysis/features/efficiency';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const basePlayerForm: PlayerFormFeatures = {
  minutes_avg: 30,
  minutes_trend: 0,
  minutes_projection: 30,
  minutes_uncertainty: 4,
  stat_per_minute: 0.5,
  stat_per_opportunity: 2.0,
  stat_trend: 0,
  player_base_volatility: 10,
  consistency_score: 0.7,
  games_sampled: 10,
  window_size: 10,
};

const neutralDefense: OpponentDefenseInput = {
  opponent: { stat_allowed_per_game: 25, games_sampled: 20 },
  league: { stat_per_game: 25, stat_allowed_std: 3 },
  opponent_team_id: 'team-opp-1',
  stat_allowed_rank: 15,
};

function expectOk(result: ReturnType<typeof extractEfficiencyFeatures>): EfficiencyFeatures {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractEfficiencyFeatures', () => {
  describe('fail-closed', () => {
    it('rejects insufficient opponent data', () => {
      const defense = {
        ...neutralDefense,
        opponent: { stat_allowed_per_game: 25, games_sampled: 2 },
      };
      const result = extractEfficiencyFeatures(basePlayerForm, defense);
      expect(result.ok).toBe(false);
    });

    it('rejects zero league average', () => {
      const defense = {
        ...neutralDefense,
        league: { stat_per_game: 0, stat_allowed_std: 3 },
      };
      const result = extractEfficiencyFeatures(basePlayerForm, defense);
      expect(result.ok).toBe(false);
    });
  });

  describe('opponent_defensive_adjustment', () => {
    it('returns 1.0 for league-average defense', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense));
      expect(data.opponent_defensive_adjustment).toBe(1);
    });

    it('returns > 1.0 for weak defense (allows more)', () => {
      const weakDefense = {
        ...neutralDefense,
        opponent: { stat_allowed_per_game: 30, games_sampled: 20 },
      };
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, weakDefense));
      expect(data.opponent_defensive_adjustment).toBeGreaterThan(1);
    });

    it('returns < 1.0 for strong defense (allows less)', () => {
      const strongDefense = {
        ...neutralDefense,
        opponent: { stat_allowed_per_game: 20, games_sampled: 20 },
      };
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, strongDefense));
      expect(data.opponent_defensive_adjustment).toBeLessThan(1);
    });
  });

  describe('efficiency_projection', () => {
    it('equals player_skill × defense_adj × pace_adj', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense, 1.0));
      // 2.0 × 1.0 × 1.0 = 2.0
      expect(data.efficiency_projection).toBe(2);
    });

    it('scales with pace adjustment', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense, 1.1));
      expect(data.efficiency_projection).toBeCloseTo(2.2, 3);
    });

    it('clamps extreme pace values', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense, 3.0));
      // pace clamped to 1.5
      expect(data.pace_adjustment).toBe(1.5);
    });
  });

  describe('matchup variance', () => {
    it('is zero for league-average opponent', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense));
      expect(data.matchup_volatility).toBe(0);
      expect(data.matchup_variance).toBe(0);
    });

    it('increases for extreme opponents', () => {
      const extremeDefense = {
        ...neutralDefense,
        opponent: { stat_allowed_per_game: 35, games_sampled: 20 },
      };
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, extremeDefense));
      expect(data.matchup_volatility).toBeGreaterThan(0);
      expect(data.matchup_variance).toBeGreaterThan(0);
    });
  });

  describe('metadata passthrough', () => {
    it('includes opponent_team_id and rank', () => {
      const data = expectOk(extractEfficiencyFeatures(basePlayerForm, neutralDefense));
      expect(data.opponent_team_id).toBe('team-opp-1');
      expect(data.stat_allowed_rank).toBe(15);
    });
  });
});
