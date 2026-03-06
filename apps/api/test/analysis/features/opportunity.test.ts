/**
 * Unit tests for Opportunity Feature Extractor (UNI-19)
 */
import type { PlayerFormFeatures } from '@/analysis/features/player-form';

import {
  extractOpportunityFeatures,
  type RoleLog,
  type OpportunityFeatures,
} from '@/analysis/features/opportunity';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRoleLogs(
  data: Array<{ minutes: number; started: boolean; usage?: number }>
): RoleLog[] {
  return data.map((d, i) => ({
    game_date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    minutes: d.minutes,
    started: d.started,
    usage_rate: d.usage ?? null,
  }));
}

const basePlayerForm: PlayerFormFeatures = {
  minutes_avg: 30,
  minutes_trend: 0,
  minutes_projection: 30,
  minutes_uncertainty: 4,
  stat_per_minute: 0.5,
  stat_per_opportunity: 2,
  stat_trend: 0,
  player_base_volatility: 10,
  consistency_score: 0.7,
  games_sampled: 10,
  window_size: 10,
};

function expectOk(result: ReturnType<typeof extractOpportunityFeatures>): OpportunityFeatures {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error((result as { ok: false; reason: string }).reason);
  return result.data;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractOpportunityFeatures', () => {
  describe('fail-closed', () => {
    it('returns error on insufficient role logs', () => {
      const result = extractOpportunityFeatures(
        makeRoleLogs([{ minutes: 30, started: true }]),
        basePlayerForm,
        { min_games: 3 }
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('starter_probability', () => {
    it('returns 1.0 when always starts', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 32, started: true },
        { minutes: 28, started: true },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.starter_probability).toBe(1);
    });

    it('returns 0.0 when never starts', () => {
      const logs = makeRoleLogs([
        { minutes: 15, started: false },
        { minutes: 12, started: false },
        { minutes: 18, started: false },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.starter_probability).toBe(0);
    });

    it('returns fractional probability for mixed starts', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 15, started: false },
        { minutes: 30, started: true },
        { minutes: 15, started: false },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.starter_probability).toBe(0.5);
    });
  });

  describe('usage_rate_projection', () => {
    it('uses explicit usage_rate when available', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true, usage: 0.25 },
        { minutes: 30, started: true, usage: 0.3 },
        { minutes: 30, started: true, usage: 0.2 },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.usage_rate_projection).toBe(0.25);
    });

    it('falls back to snap share when usage_rate absent', () => {
      const logs = makeRoleLogs([
        { minutes: 24, started: true },
        { minutes: 24, started: true },
        { minutes: 24, started: true },
      ]);
      // snap_share = 24 / 240 = 0.1
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.usage_rate_projection).toBe(0.1);
    });
  });

  describe('role_stability', () => {
    it('is high for consistent starters with stable minutes', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 30, started: true },
        { minutes: 30, started: true },
        { minutes: 30, started: true },
        { minutes: 30, started: true },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.role_stability).toBeGreaterThan(0.8);
    });

    it('is lower for inconsistent role', () => {
      const stableLogs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 30, started: true },
        { minutes: 30, started: true },
      ]);
      const unstableLogs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 10, started: false },
        { minutes: 25, started: true },
        { minutes: 8, started: false },
      ]);
      const stable = expectOk(extractOpportunityFeatures(stableLogs, basePlayerForm));
      const unstable = expectOk(extractOpportunityFeatures(unstableLogs, basePlayerForm));
      expect(stable.role_stability).toBeGreaterThan(unstable.role_stability);
    });
  });

  describe('role_change_detected', () => {
    it('detects significant minutes change between halves', () => {
      const logs = makeRoleLogs([
        { minutes: 10, started: false },
        { minutes: 12, started: false },
        { minutes: 30, started: true },
        { minutes: 32, started: true },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.role_change_detected).toBe(true);
    });

    it('returns false for stable minutes', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 31, started: true },
        { minutes: 29, started: true },
        { minutes: 30, started: true },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      expect(data.role_change_detected).toBe(false);
    });
  });

  describe('opportunity_projection', () => {
    it('equals minutes_projection × usage_rate_projection', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true, usage: 0.25 },
        { minutes: 30, started: true, usage: 0.25 },
        { minutes: 30, started: true, usage: 0.25 },
      ]);
      const pf = { ...basePlayerForm, minutes_projection: 30 };
      const data = expectOk(extractOpportunityFeatures(logs, pf));
      // 30 × 0.25 = 7.5
      expect(data.opportunity_projection).toBe(7.5);
    });
  });

  describe('no market inputs', () => {
    it('output contains no market-related keys', () => {
      const logs = makeRoleLogs([
        { minutes: 30, started: true },
        { minutes: 30, started: true },
        { minutes: 30, started: true },
      ]);
      const data = expectOk(extractOpportunityFeatures(logs, basePlayerForm));
      const keys = Object.keys(data);
      const forbidden = ['odds', 'line', 'implied_probability', 'betting_line', 'market'];
      for (const mk of forbidden) {
        expect(keys.some(k => k.includes(mk))).toBe(false);
      }
    });
  });
});
