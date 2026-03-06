/**
 * Unit tests for Alpha Evaluation Engine (UNI-23)
 */
import type { BlendOutput } from '@/analysis/models/stat-market-blend';

import {
  computeAlphaEvaluation,
  computeBrierScore,
  computeLogLoss,
  type EvaluationRecord,
  type AlphaEvaluationReport,
} from '@/analysis/evaluation/alpha-evaluation';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(
  p_final: number,
  p_stat: number,
  p_market: number,
  outcome: 0 | 1,
  sport = 'nba',
  market_type = 'points'
): EvaluationRecord {
  const stat_alpha = p_stat - p_market;
  return {
    blend: {
      p_final,
      p_stat,
      p_market,
      stat_weight: 0.3,
      market_weight: 0.7,
      stat_alpha,
      divergence: Math.abs(stat_alpha),
      divergence_direction: stat_alpha > 0 ? 1 : stat_alpha < 0 ? -1 : 0,
      edge_vs_market: p_final - p_market,
      blend_version: 'test',
    },
    outcome,
    sport,
    market_type,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeBrierScore', () => {
  it('returns 0 for perfect predictions', () => {
    const records = [makeRecord(1, 1, 0.5, 1), makeRecord(0, 0, 0.5, 0)];
    // Brier = mean((1-1)^2 + (0-0)^2) = 0
    expect(computeBrierScore(records)).toBe(0);
  });

  it('returns 1 for worst predictions', () => {
    const records = [makeRecord(0, 0, 0.5, 1), makeRecord(1, 1, 0.5, 0)];
    expect(computeBrierScore(records)).toBe(1);
  });

  it('returns 0.25 for 50/50 predictions', () => {
    const records = [makeRecord(0.5, 0.5, 0.5, 1), makeRecord(0.5, 0.5, 0.5, 0)];
    expect(computeBrierScore(records)).toBe(0.25);
  });

  it('returns 0 for empty', () => {
    expect(computeBrierScore([])).toBe(0);
  });
});

describe('computeLogLoss', () => {
  it('returns low value for confident correct predictions', () => {
    const records = [makeRecord(0.9, 0.9, 0.5, 1), makeRecord(0.1, 0.1, 0.5, 0)];
    expect(computeLogLoss(records)).toBeLessThan(0.2);
  });

  it('returns high value for confident wrong predictions', () => {
    const records = [makeRecord(0.9, 0.9, 0.5, 0), makeRecord(0.1, 0.1, 0.5, 1)];
    expect(computeLogLoss(records)).toBeGreaterThan(2);
  });

  it('returns 0 for empty', () => {
    expect(computeLogLoss([])).toBe(0);
  });
});

describe('computeAlphaEvaluation', () => {
  it('returns empty report for no records', () => {
    const report = computeAlphaEvaluation([]);
    expect(report.sample_size).toBe(0);
  });

  describe('full report', () => {
    const records = [
      // Bullish alpha (stat > market), outcome=over hit
      makeRecord(0.65, 0.7, 0.6, 1, 'nba', 'points'),
      // Bearish alpha (stat < market), outcome=under hit
      makeRecord(0.45, 0.4, 0.55, 0, 'nba', 'rebounds'),
      // Agreement zone, outcome=over hit
      makeRecord(0.55, 0.56, 0.54, 1, 'nfl', 'yards'),
      // Slight bullish, outcome=under hit
      makeRecord(0.57, 0.58, 0.55, 0, 'nba', 'points'),
      // Strong bullish, outcome=over hit
      makeRecord(0.68, 0.75, 0.6, 1, 'nba', 'assists'),
    ];

    let report: AlphaEvaluationReport;

    beforeAll(() => {
      report = computeAlphaEvaluation(records);
    });

    it('reports correct sample size', () => {
      expect(report.sample_size).toBe(5);
    });

    it('computes brier score', () => {
      expect(report.brier_score).toBeGreaterThan(0);
      expect(report.brier_score).toBeLessThan(1);
    });

    it('computes log loss', () => {
      expect(report.log_loss).toBeGreaterThan(0);
    });

    it('computes ECE', () => {
      expect(report.ece).toBeGreaterThanOrEqual(0);
      expect(report.ece).toBeLessThanOrEqual(1);
    });

    it('produces confidence buckets', () => {
      expect(report.confidence_buckets.length).toBe(5);
      const totalInBuckets = report.confidence_buckets.reduce((s, b) => s + b.count, 0);
      expect(totalInBuckets).toBe(5);
    });

    it('produces alpha buckets', () => {
      expect(report.alpha_buckets.length).toBe(5);
      const totalInBuckets = report.alpha_buckets.reduce((s, b) => s + b.count, 0);
      expect(totalInBuckets).toBe(5);
    });

    it('alpha buckets have ROI per bin', () => {
      for (const bucket of report.alpha_buckets) {
        expect(bucket).toHaveProperty('roi_pct');
        expect(typeof bucket.roi_pct).toBe('number');
      }
    });

    it('groups by sport', () => {
      expect(report.by_sport).toHaveProperty('nba');
      expect(report.by_sport).toHaveProperty('nfl');
      expect(report.by_sport['nba'].sample_size).toBe(4);
      expect(report.by_sport['nfl'].sample_size).toBe(1);
    });

    it('groups by market type', () => {
      expect(report.by_market_type).toHaveProperty('points');
      expect(report.by_market_type['points'].sample_size).toBe(2);
    });
  });

  describe('alpha bucket classification', () => {
    it('classifies strong bullish correctly', () => {
      const records = [makeRecord(0.65, 0.7, 0.55, 1)]; // alpha=0.15
      const report = computeAlphaEvaluation(records);
      const bullish = report.alpha_buckets.find(b => b.label.includes('bullish (>'));
      expect(bullish?.count).toBe(1);
    });

    it('classifies agreement zone correctly', () => {
      const records = [makeRecord(0.55, 0.55, 0.54, 1)]; // alpha=0.01
      const report = computeAlphaEvaluation(records);
      const agreement = report.alpha_buckets.find(b => b.label.includes('agreement'));
      expect(agreement?.count).toBe(1);
    });

    it('classifies bearish correctly', () => {
      const records = [makeRecord(0.35, 0.3, 0.45, 0)]; // alpha=-0.15
      const report = computeAlphaEvaluation(records);
      const bearish = report.alpha_buckets.find(b => b.label.includes('bearish (<'));
      expect(bearish?.count).toBe(1);
    });
  });
});
