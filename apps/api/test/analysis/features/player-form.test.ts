/**
 * Unit tests for Player Form Feature Extractor (UNI-18)
 */
import {
  extractPlayerFormFeatures,
  type GameLog,
  type PlayerFormFeatures,
} from '@/analysis/features/player-form';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGameLogs(
  data: Array<{ minutes: number; stat: number; usage?: number; started?: boolean }>
): GameLog[] {
  return data.map((d, i) => ({
    game_date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    minutes: d.minutes,
    stat_value: d.stat,
    usage_rate: d.usage,
    started: d.started ?? true,
  }));
}

function expectOk(result: ReturnType<typeof extractPlayerFormFeatures>): PlayerFormFeatures {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected ok');
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractPlayerFormFeatures', () => {
  describe('fail-closed behavior', () => {
    it('returns error when fewer than min_games', () => {
      const result = extractPlayerFormFeatures(
        makeGameLogs([
          { minutes: 30, stat: 20 },
          { minutes: 28, stat: 18 },
        ]),
        { min_games: 3 }
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toContain('Insufficient games');
    });

    it('returns error for empty array', () => {
      const result = extractPlayerFormFeatures([]);
      expect(result.ok).toBe(false);
    });
  });

  describe('opportunity features', () => {
    it('computes correct minutes average', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 32, stat: 22 },
        { minutes: 28, stat: 18 },
        { minutes: 34, stat: 24 },
        { minutes: 26, stat: 16 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.minutes_avg).toBe(30);
    });

    it('computes minutes uncertainty as variance', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 22 },
        { minutes: 30, stat: 18 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.minutes_uncertainty).toBe(0);
    });

    it('detects positive minutes trend', () => {
      const logs = makeGameLogs([
        { minutes: 20, stat: 10 },
        { minutes: 25, stat: 12 },
        { minutes: 30, stat: 15 },
        { minutes: 35, stat: 18 },
        { minutes: 40, stat: 20 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.minutes_trend).toBeGreaterThan(0);
    });

    it('detects negative minutes trend', () => {
      const logs = makeGameLogs([
        { minutes: 40, stat: 20 },
        { minutes: 35, stat: 18 },
        { minutes: 30, stat: 15 },
        { minutes: 25, stat: 12 },
        { minutes: 20, stat: 10 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.minutes_trend).toBeLessThan(0);
    });

    it('minutes_projection is non-negative', () => {
      const logs = makeGameLogs([
        { minutes: 5, stat: 2 },
        { minutes: 3, stat: 1 },
        { minutes: 1, stat: 0 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.minutes_projection).toBeGreaterThanOrEqual(0);
    });
  });

  describe('efficiency features', () => {
    it('computes stat_per_minute correctly', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 15 },
        { minutes: 30, stat: 15 },
        { minutes: 30, stat: 15 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.stat_per_minute).toBe(0.5);
    });

    it('uses usage_rate for stat_per_opportunity when available', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 15, usage: 0.25 },
        { minutes: 30, stat: 15, usage: 0.25 },
        { minutes: 30, stat: 15, usage: 0.25 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.stat_per_opportunity).toBe(2);
    });

    it('falls back to stat_per_minute when usage_rate missing', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 15 },
        { minutes: 30, stat: 15 },
        { minutes: 30, stat: 15 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.stat_per_opportunity).toBe(data.stat_per_minute);
    });

    it('computes positive stat_trend for increasing stats', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 10 },
        { minutes: 30, stat: 15 },
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 25 },
        { minutes: 30, stat: 30 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.stat_trend).toBeGreaterThan(0);
    });
  });

  describe('variance features', () => {
    it('returns zero volatility for constant stats', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 20 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.player_base_volatility).toBe(0);
    });

    it('returns higher volatility for variable stats', () => {
      const consistentLogs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 21 },
        { minutes: 30, stat: 19 },
      ]);
      const volatileLogs = makeGameLogs([
        { minutes: 30, stat: 10 },
        { minutes: 30, stat: 30 },
        { minutes: 30, stat: 20 },
      ]);
      const consistent = expectOk(extractPlayerFormFeatures(consistentLogs));
      const volatile_ = expectOk(extractPlayerFormFeatures(volatileLogs));
      expect(volatile_.player_base_volatility).toBeGreaterThan(consistent.player_base_volatility);
    });

    it('consistency_score is 1.0 for perfectly consistent player', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 20 },
        { minutes: 30, stat: 20 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.consistency_score).toBe(1);
    });

    it('consistency_score is bounded [0, 1]', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 1 },
        { minutes: 30, stat: 100 },
        { minutes: 30, stat: 50 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      expect(data.consistency_score).toBeGreaterThanOrEqual(0);
      expect(data.consistency_score).toBeLessThanOrEqual(1);
    });
  });

  describe('metadata', () => {
    it('reports correct games_sampled with window', () => {
      const logs = makeGameLogs(Array(20).fill({ minutes: 30, stat: 20 }));
      const data = expectOk(extractPlayerFormFeatures(logs, { window_size: 5 }));
      expect(data.games_sampled).toBe(5);
      expect(data.window_size).toBe(5);
    });
  });

  describe('no market inputs', () => {
    it('output contains only player/stat features', () => {
      const logs = makeGameLogs([
        { minutes: 30, stat: 20 },
        { minutes: 32, stat: 22 },
        { minutes: 28, stat: 18 },
      ]);
      const data = expectOk(extractPlayerFormFeatures(logs));
      const keys = Object.keys(data);
      const forbidden = ['odds', 'line', 'implied_probability', 'betting_line', 'market'];
      for (const mk of forbidden) {
        expect(keys.some(k => k.includes(mk))).toBe(false);
      }
    });
  });
});
