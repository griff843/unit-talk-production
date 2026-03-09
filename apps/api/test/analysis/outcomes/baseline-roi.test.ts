/**
 * Unit tests for Baseline ROI Report (SPRINT-034)
 * Issue: UNI-10 — Outcome tracking and baseline ROI
 */
import type { LossAttributionOutput } from '@/analysis/outcomes/loss-attribution';
import type { ScoredOutcome } from '@/analysis/outcomes/types';

import { generateBaselineROIReport } from '@/analysis/outcomes/baseline-roi';

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

function makeFixtures(): { outcomes: ScoredOutcome[]; attributions: LossAttributionOutput[] } {
  const outcomes: ScoredOutcome[] = [
    // 5 WINs
    makeScored({ outcome: 'WIN', market_key: 'mk1', p_final: 0.65, edge_final: 0.1 }),
    makeScored({ outcome: 'WIN', market_key: 'mk2', p_final: 0.6, edge_final: 0.05 }),
    makeScored({ outcome: 'WIN', market_key: 'mk3', p_final: 0.58, edge_final: 0.03 }),
    makeScored({
      outcome: 'WIN',
      market_key: 'mk4',
      p_final: 0.55,
      edge_final: 0.02,
      market_type_key: 'player_rebounds_ou',
    }),
    makeScored({ outcome: 'WIN', market_key: 'mk5', p_final: 0.7, edge_final: 0.15 }),
    // 4 LOSSes
    makeScored({
      outcome: 'LOSS',
      market_key: 'mk6',
      p_final: 0.55,
      edge_final: 0.03,
      actual_value: 20,
    }),
    makeScored({
      outcome: 'LOSS',
      market_key: 'mk7',
      p_final: 0.52,
      edge_final: 0.01,
      actual_value: 18,
    }),
    makeScored({
      outcome: 'LOSS',
      market_key: 'mk8',
      p_final: 0.6,
      edge_final: 0.08,
      actual_value: 19,
    }),
    makeScored({
      outcome: 'LOSS',
      market_key: 'mk9',
      p_final: 0.48,
      edge_final: -0.02,
      actual_value: 21,
      market_type_key: 'player_assists_ou',
    }),
    // 1 PUSH
    makeScored({ outcome: 'PUSH', market_key: 'mk10', actual_value: 22.5 }),
  ];

  const attributions: LossAttributionOutput[] = [
    { classification: 'PROJECTION_MISS', notes: ['ev=8.00%'] },
    { classification: 'PROJECTION_MISS', notes: ['ev=5.00%'] },
    { classification: 'VARIANCE', notes: ['ev=1.50%'] },
    { classification: 'PRICE_MISS', notes: ['clv=-4.50%'] },
  ];

  return { outcomes, attributions };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateBaselineROIReport', () => {
  describe('fail-closed', () => {
    it('rejects empty outcomes', () => {
      const result = generateBaselineROIReport([], []);
      expect(result.ok).toBe(false);
    });
  });

  describe('report structure', () => {
    it('returns all required sections', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions, { sport: 'nba' });
      expect(result.ok).toBe(true);
      if (result.ok !== true) return;

      const report = result.data;
      expect(report.report_version).toBe('baseline-roi-v1.0');
      expect(report.sample_size).toBe(10);
      expect(report.performance).toBeDefined();
      expect(report.alpha_evaluation).toBeDefined();
      expect(report.loss_attribution).toBeDefined();
      expect(report.diagnostics).toBeDefined();
    });
  });

  describe('performance section', () => {
    it('matches standalone performance report', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      const perf = result.data.performance;
      expect(perf.overall.total).toBe(10);
      expect(perf.overall.wins).toBe(5);
      expect(perf.overall.losses).toBe(4);
      expect(perf.overall.pushes).toBe(1);
    });

    it('computes hit rate from wins / (wins + losses)', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      // 5 wins / (5 wins + 4 losses) = 55.56%
      expect(result.data.performance.overall.hit_rate_pct).toBeCloseTo(55.56, 1);
    });
  });

  describe('alpha evaluation section', () => {
    it('has correct sample_size (PUSHes excluded)', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions, { sport: 'nba' });
      if (result.ok !== true) return;

      // 9 records (10 - 1 PUSH)
      expect(result.data.alpha_evaluation.sample_size).toBe(9);
    });

    it('computes Brier score', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.alpha_evaluation.brier_score).toBeGreaterThan(0);
      expect(result.data.alpha_evaluation.brier_score).toBeLessThan(1);
    });

    it('groups by sport when provided', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions, { sport: 'nba' });
      if (result.ok !== true) return;

      expect(result.data.alpha_evaluation.by_sport).toHaveProperty('nba');
    });
  });

  describe('loss attribution section', () => {
    it('matches standalone loss attribution summary', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      const la = result.data.loss_attribution;
      expect(la.total_losses).toBe(4);
      expect(la.top_category).toBe('PROJECTION_MISS');
    });

    it('includes actionable insights', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.loss_attribution.actionable_insights.length).toBeGreaterThan(0);
    });
  });

  describe('diagnostics', () => {
    it('reports profitable when ROI > 0', () => {
      // More wins than losses at -110 juice: 5W 4L
      // profit = 500 - 440 = 60, wagered = 9 * 110 = 990
      // roi = 60/990 * 100 ≈ 6.06%
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.diagnostics.is_profitable).toBe(true);
      expect(result.data.diagnostics.flat_bet_roi_pct).toBeGreaterThan(0);
    });

    it('reports unprofitable when losses exceed wins', () => {
      const outcomes: ScoredOutcome[] = [
        makeScored({ outcome: 'WIN', market_key: 'mk1' }),
        makeScored({ outcome: 'LOSS', market_key: 'mk2', actual_value: 20 }),
        makeScored({ outcome: 'LOSS', market_key: 'mk3', actual_value: 20 }),
        makeScored({ outcome: 'LOSS', market_key: 'mk4', actual_value: 20 }),
      ];
      const attributions: LossAttributionOutput[] = [
        { classification: 'VARIANCE', notes: [] },
        { classification: 'VARIANCE', notes: [] },
        { classification: 'VARIANCE', notes: [] },
      ];

      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.diagnostics.is_profitable).toBe(false);
      expect(result.data.diagnostics.flat_bet_roi_pct).toBeLessThan(0);
    });

    it('includes top loss category in diagnostics', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.diagnostics.top_loss_category).toBe('PROJECTION_MISS');
    });

    it('generates recommendation mentioning top category', () => {
      const { outcomes, attributions } = makeFixtures();
      const result = generateBaselineROIReport(outcomes, attributions);
      if (result.ok !== true) return;

      expect(result.data.diagnostics.recommendation).toContain('PROJECTION_MISS');
    });
  });

  describe('edge cases', () => {
    it('handles outcomes with no loss attributions', () => {
      const outcomes = [
        makeScored({ outcome: 'WIN', market_key: 'mk1' }),
        makeScored({ outcome: 'WIN', market_key: 'mk2' }),
      ];

      const result = generateBaselineROIReport(outcomes, []);
      if (result.ok !== true) return;

      expect(result.data.loss_attribution.total_losses).toBe(0);
      expect(result.data.diagnostics.top_loss_category).toBe('N/A');
    });

    it('handles all PUSHes (alpha eval has 0 records)', () => {
      const outcomes = [
        makeScored({ outcome: 'PUSH', market_key: 'mk1' }),
        makeScored({ outcome: 'PUSH', market_key: 'mk2' }),
      ];

      const result = generateBaselineROIReport(outcomes, []);
      if (result.ok !== true) return;

      expect(result.data.alpha_evaluation.sample_size).toBe(0);
      expect(result.data.performance.overall.pushes).toBe(2);
    });
  });
});
