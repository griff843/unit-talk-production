/**
 * Unit tests for Stat Resolver (SPRINT-029)
 * Sprint: SPRINT-034 — Outcome Tracking Foundation
 */
import {
  resolveActualValue,
  hasStatMapping,
  getSupportedMarketKeys,
} from '@/analysis/outcomes/stat-resolver';

// ── resolveActualValue ──────────────────────────────────────────────────────

describe('resolveActualValue', () => {
  describe('single stat markets', () => {
    it('resolves player_points_ou from points stat', () => {
      const result = resolveActualValue('player_points_ou', { points: 28 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(28);
      expect(result.stat_columns).toEqual(['points']);
      expect(result.missing_columns).toEqual([]);
    });

    it('resolves player_rebounds_ou', () => {
      const result = resolveActualValue('player_rebounds_ou', { rebounds: 12 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(12);
    });

    it('resolves player_assists_ou', () => {
      const result = resolveActualValue('player_assists_ou', { assists: 7 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(7);
    });

    it('resolves player_3pm_ou from threes stat', () => {
      const result = resolveActualValue('player_3pm_ou', { threes: 4 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(4);
    });
  });

  describe('combo stat markets', () => {
    it('resolves PRA by summing points + rebounds + assists', () => {
      const result = resolveActualValue('player_pra_ou', {
        points: 20,
        rebounds: 8,
        assists: 5,
      });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(33);
      expect(result.stat_columns).toEqual(['points', 'rebounds', 'assists']);
    });

    it('resolves pts+rebs by summing points + rebounds', () => {
      const result = resolveActualValue('player_pts_rebs_ou', {
        points: 25,
        rebounds: 10,
      });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(35);
    });

    it('resolves blocks+steals by summing', () => {
      const result = resolveActualValue('player_blocks_steals_ou', {
        blocks: 3,
        steals: 2,
      });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(5);
    });
  });

  describe('combo fallback', () => {
    it('falls back to direct combo stat name for PRA', () => {
      const result = resolveActualValue('player_pra_ou', { pra: 33 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(33);
      expect(result.stat_columns).toEqual(['pra']);
    });

    it('falls back to alternate combo name', () => {
      const result = resolveActualValue('player_pra_ou', { 'points+rebounds+assists': 30 });
      expect(result.resolved).toBe(true);
      expect(result.actual_value).toBe(30);
    });
  });

  describe('failure cases', () => {
    it('returns unresolved for unknown market key', () => {
      const result = resolveActualValue('unknown_market', { points: 20 });
      expect(result.resolved).toBe(false);
      expect(result.actual_value).toBeNull();
    });

    it('returns unresolved when required stat is missing', () => {
      const result = resolveActualValue('player_points_ou', { assists: 5 });
      expect(result.resolved).toBe(false);
      expect(result.actual_value).toBeNull();
      expect(result.missing_columns).toEqual(['points']);
    });

    it('returns unresolved for partial combo without fallback', () => {
      const result = resolveActualValue('player_pra_ou', { points: 20 });
      expect(result.resolved).toBe(false);
      expect(result.actual_value).toBeNull();
      expect(result.missing_columns).toContain('rebounds');
      expect(result.missing_columns).toContain('assists');
    });
  });
});

// ── hasStatMapping ──────────────────────────────────────────────────────────

describe('hasStatMapping', () => {
  it('returns true for known market keys', () => {
    expect(hasStatMapping('player_points_ou')).toBe(true);
    expect(hasStatMapping('player_pra_ou')).toBe(true);
  });

  it('returns false for unknown market keys', () => {
    expect(hasStatMapping('unknown_market')).toBe(false);
    expect(hasStatMapping('')).toBe(false);
  });
});

// ── getSupportedMarketKeys ──────────────────────────────────────────────────

describe('getSupportedMarketKeys', () => {
  it('returns all supported market keys', () => {
    const keys = getSupportedMarketKeys();
    expect(keys.length).toBeGreaterThanOrEqual(12);
    expect(keys).toContain('player_points_ou');
    expect(keys).toContain('player_pra_ou');
    expect(keys).toContain('player_fantasy_score_ou');
  });
});
