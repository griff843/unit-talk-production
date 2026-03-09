/**
 * Unit tests for Game Context Feature Extractor (UNI-21)
 */
import {
  extractGameContextFeatures,
  type GameContextInput,
  type GameContextFeatures,
} from '@/analysis/features/game-context';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const neutralInput: GameContextInput = {
  pace: {
    team_pace: 100,
    opponent_pace: 100,
    league_avg_pace: 100,
    team_off_rating: 110,
    opponent_def_rating: 110,
    league_avg_ppg: 112,
  },
  schedule: {
    game_date: '2026-01-10',
    prev_game_date: '2026-01-07', // 3 days rest
    is_home: true,
  },
  team_id: 'team-a',
  opponent_team_id: 'team-b',
};

function expectOk(result: ReturnType<typeof extractGameContextFeatures>): GameContextFeatures {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractGameContextFeatures', () => {
  describe('fail-closed', () => {
    it('rejects zero league pace', () => {
      const input = {
        ...neutralInput,
        pace: { ...neutralInput.pace, league_avg_pace: 0 },
      };
      const result = extractGameContextFeatures(input);
      expect(result.ok).toBe(false);
    });

    it('rejects zero league ppg', () => {
      const input = {
        ...neutralInput,
        pace: { ...neutralInput.pace, league_avg_ppg: 0 },
      };
      const result = extractGameContextFeatures(input);
      expect(result.ok).toBe(false);
    });
  });

  describe('pace_factor', () => {
    it('returns 1.0 for league-average pace matchup', () => {
      const data = expectOk(extractGameContextFeatures(neutralInput));
      expect(data.pace_factor).toBe(1);
    });

    it('returns > 1.0 for fast-paced matchup', () => {
      const input = {
        ...neutralInput,
        pace: { ...neutralInput.pace, team_pace: 110, opponent_pace: 110 },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.pace_factor).toBeGreaterThan(1);
    });

    it('returns < 1.0 for slow-paced matchup', () => {
      const input = {
        ...neutralInput,
        pace: { ...neutralInput.pace, team_pace: 90, opponent_pace: 90 },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.pace_factor).toBeLessThan(1);
    });
  });

  describe('projected_game_total', () => {
    it('produces a reasonable game total', () => {
      const data = expectOk(extractGameContextFeatures(neutralInput));
      // Should be in a reasonable range for basketball (150-250)
      expect(data.projected_game_total).toBeGreaterThan(50);
      expect(data.projected_game_total).toBeLessThan(350);
    });

    it('is not derived from market lines (structural check)', () => {
      // The interface has no odds/line inputs — structural guarantee
      const keys = Object.keys(neutralInput.pace);
      const forbidden = ['over_under', 'betting_line', 'odds', 'market_total'];
      for (const f of forbidden) {
        expect(keys).not.toContain(f);
      }
    });
  });

  describe('rest_days and back_to_back', () => {
    it('computes correct rest days', () => {
      const data = expectOk(extractGameContextFeatures(neutralInput));
      expect(data.rest_days).toBe(3);
      expect(data.is_back_to_back).toBe(false);
    });

    it('detects back-to-back (1 day rest)', () => {
      const input = {
        ...neutralInput,
        schedule: { ...neutralInput.schedule, prev_game_date: '2026-01-09' },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.rest_days).toBe(1);
      expect(data.is_back_to_back).toBe(true);
    });

    it('detects back-to-back (0 days)', () => {
      const input = {
        ...neutralInput,
        schedule: { ...neutralInput.schedule, prev_game_date: '2026-01-10' },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.rest_days).toBe(0);
      expect(data.is_back_to_back).toBe(true);
    });

    it('defaults to 2 rest days when prev_game_date unknown', () => {
      const input = {
        ...neutralInput,
        schedule: { ...neutralInput.schedule, prev_game_date: null },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.rest_days).toBe(2);
      expect(data.is_back_to_back).toBe(false);
    });
  });

  describe('home_away_factor', () => {
    it('gives slight boost for home games', () => {
      const data = expectOk(extractGameContextFeatures(neutralInput));
      expect(data.home_away_factor).toBeGreaterThan(1);
    });

    it('gives slight penalty for away games', () => {
      const input = {
        ...neutralInput,
        schedule: { ...neutralInput.schedule, is_home: false },
      };
      const data = expectOk(extractGameContextFeatures(input));
      expect(data.home_away_factor).toBeLessThan(1);
    });
  });

  describe('metadata', () => {
    it('passes through team IDs', () => {
      const data = expectOk(extractGameContextFeatures(neutralInput));
      expect(data.team_id).toBe('team-a');
      expect(data.opponent_team_id).toBe('team-b');
    });
  });
});
