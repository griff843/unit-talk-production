/**
 * Unit tests for Performance Report (SPRINT-029)
 * Sprint: SPRINT-034 — Outcome Tracking Foundation
 */
import type { ScoredOutcome } from '@/analysis/outcomes/types';

import { generatePerformanceReport } from '@/analysis/outcomes/performance-report';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScored(overrides: Partial<ScoredOutcome> = {}): ScoredOutcome {
  return {
    market_key: 'test-market-1',
    event_id: 'event-1',
    market_type_id: 1,
    participant_id: 'player-1',
    p_final: 0.6,
    p_market_devig: 0.52,
    edge_final: 0.08,
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

function makeFixtures(): ScoredOutcome[] {
  return [
    // Wins — high confidence, high edge
    makeScored({
      p_final: 0.65,
      edge_final: 0.1,
      outcome: 'WIN',
      actual_value: 25,
      market_type_key: 'player_points_ou',
    }),
    makeScored({
      p_final: 0.7,
      edge_final: 0.15,
      outcome: 'WIN',
      actual_value: 30,
      market_type_key: 'player_points_ou',
      market_key: 'mk2',
    }),
    makeScored({
      p_final: 0.55,
      edge_final: 0.03,
      outcome: 'WIN',
      actual_value: 10,
      market_type_key: 'player_rebounds_ou',
      market_key: 'mk3',
    }),
    // Losses — varied confidence
    makeScored({
      p_final: 0.6,
      edge_final: 0.08,
      outcome: 'LOSS',
      actual_value: 20,
      market_type_key: 'player_points_ou',
      market_key: 'mk4',
    }),
    makeScored({
      p_final: 0.45,
      edge_final: -0.02,
      outcome: 'LOSS',
      actual_value: 5,
      market_type_key: 'player_assists_ou',
      market_key: 'mk5',
    }),
    makeScored({
      p_final: 0.52,
      edge_final: 0.01,
      outcome: 'LOSS',
      actual_value: 19,
      market_type_key: 'player_rebounds_ou',
      market_key: 'mk6',
    }),
    // Push
    makeScored({
      p_final: 0.58,
      edge_final: 0.06,
      outcome: 'PUSH',
      actual_value: 22.5,
      market_type_key: 'player_points_ou',
      market_key: 'mk7',
    }),
  ];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generatePerformanceReport', () => {
  describe('overall', () => {
    it('counts wins, losses, and pushes correctly', () => {
      const report = generatePerformanceReport(makeFixtures());
      expect(report.overall.total).toBe(7);
      expect(report.overall.wins).toBe(3);
      expect(report.overall.losses).toBe(3);
      expect(report.overall.pushes).toBe(1);
    });

    it('computes hit_rate_pct excluding pushes', () => {
      const report = generatePerformanceReport(makeFixtures());
      // 3 wins / (3 wins + 3 losses) = 50%
      expect(report.overall.hit_rate_pct).toBe(50);
    });

    it('computes directional_accuracy_pct', () => {
      const report = generatePerformanceReport(makeFixtures());
      // directional accuracy: p >= 0.5 predicted over
      // WINs: 0.65, 0.70, 0.55 all predicted over, outcome WIN -> 3 correct
      // LOSSes: 0.60 predicted over, outcome LOSS -> incorrect
      //         0.45 predicted under, outcome LOSS -> correct
      //         0.52 predicted over, outcome LOSS -> incorrect
      // PUSH: excluded
      // 4 correct / 6 total = 66.67%
      expect(report.overall.directional_accuracy_pct).toBeCloseTo(66.67, 1);
    });

    it('computes flat_bet_roi_pct', () => {
      const report = generatePerformanceReport(makeFixtures());
      // 3W 3L (pushes excluded from flat bet): profit = 300 - 330 = -30
      // wagered = 6 * 110 = 660
      // roi = -30/660 * 100 = -4.545%
      expect(report.overall.flat_bet_roi_pct).toBeCloseTo(-4.545, 1);
    });
  });

  describe('by_market_type', () => {
    it('creates buckets for each market type', () => {
      const report = generatePerformanceReport(makeFixtures());
      const labels = report.by_market_type.map(b => b.label);
      expect(labels).toContain('player_points_ou');
      expect(labels).toContain('player_rebounds_ou');
      expect(labels).toContain('player_assists_ou');
    });

    it('counts correctly per market type', () => {
      const report = generatePerformanceReport(makeFixtures());
      const points = report.by_market_type.find(b => b.label === 'player_points_ou');
      expect(points).toBeDefined();
      // 2 WIN + 1 LOSS + 1 PUSH = 4 total for player_points_ou
      expect(points!.count).toBe(4);
      expect(points!.wins).toBe(2);
      expect(points!.losses).toBe(1);
      expect(points!.pushes).toBe(1);
    });
  });

  describe('by_p_final_bin', () => {
    it('creates probability bins', () => {
      const report = generatePerformanceReport(makeFixtures());
      expect(report.by_p_final_bin.length).toBeGreaterThan(0);
      const labels = report.by_p_final_bin.map(b => b.label);
      // p=0.45 -> <0.50, p=0.52/0.55/0.58/0.60 -> various bins, p=0.65/0.70 -> 0.65+
      expect(labels).toContain('0.65+');
    });
  });

  describe('by_edge_quartile', () => {
    it('creates 4 quartile buckets', () => {
      const report = generatePerformanceReport(makeFixtures());
      expect(report.by_edge_quartile.length).toBe(4);
    });

    it('each record appears in exactly one quartile', () => {
      const report = generatePerformanceReport(makeFixtures());
      const totalInQuartiles = report.by_edge_quartile.reduce((s, b) => s + b.count, 0);
      expect(totalInQuartiles).toBe(7);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const report = generatePerformanceReport([]);
      expect(report.overall.total).toBe(0);
      expect(report.overall.wins).toBe(0);
      expect(report.overall.hit_rate_pct).toBe(0);
      expect(report.overall.flat_bet_roi_pct).toBe(0);
    });

    it('handles single record', () => {
      const report = generatePerformanceReport([makeScored()]);
      expect(report.overall.total).toBe(1);
      expect(report.overall.wins).toBe(1);
      expect(report.by_market_type.length).toBe(1);
    });

    it('handles all pushes', () => {
      const records = [
        makeScored({ outcome: 'PUSH', market_key: 'mk1' }),
        makeScored({ outcome: 'PUSH', market_key: 'mk2' }),
      ];
      const report = generatePerformanceReport(records);
      expect(report.overall.pushes).toBe(2);
      expect(report.overall.hit_rate_pct).toBe(0);
    });
  });
});
