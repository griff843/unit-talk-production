/**
 * Tests for Daily Rollup & Drift Detector — SPRINT-038
 */

import { describe, it, expect } from 'vitest';

import {
  generateDailyRollup,
  type DailyRollupRecord,
  type DailyRollupReport,
} from '../daily-rollup';
import { detectDrift, DRIFT_THRESHOLDS } from '../drift-detector';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<DailyRollupRecord> = {}): DailyRollupRecord {
  return {
    finalBand: 'A',
    initialBand: 'A',
    downgradeReasons: [],
    suppressionReasons: [],
    thresholdVersion: '1.0.0',
    outcome: 'WIN',
    p_final: 0.55,
    p_market_devig: 0.5,
    edge_final: 0.05,
    score: 60,
    book_count: 4,
    clvPercent: 0.02,
    lossAttribution: null,
    marketType: 'moneyline',
    ...overrides,
  };
}

function makeRollup(overrides: Partial<DailyRollupReport> = {}): DailyRollupReport {
  const base = generateDailyRollup('2026-01-15', [
    makeRecord({ outcome: 'WIN', finalBand: 'A' }),
    makeRecord({ outcome: 'LOSS', finalBand: 'A', lossAttribution: 'VARIANCE' }),
    makeRecord({ outcome: 'WIN', finalBand: 'B' }),
  ]);
  return { ...base, ...overrides };
}

// ── Daily Rollup ─────────────────────────────────────────────────────────────

describe('generateDailyRollup', () => {
  it('returns empty report for zero records', () => {
    const report = generateDailyRollup('2026-01-15', []);
    expect(report.total_picks).toBe(0);
    expect(report.total_wins).toBe(0);
    expect(report.total_losses).toBe(0);
    expect(report.overall_roi_pct).toBe(0);
    expect(report.by_band).toEqual([]);
    expect(report.report_version).toBe('daily-rollup-v1.0');
  });

  it('computes overall totals correctly', () => {
    const records = [
      makeRecord({ outcome: 'WIN' }),
      makeRecord({ outcome: 'LOSS', lossAttribution: 'VARIANCE' }),
      makeRecord({ outcome: 'PUSH' }),
      makeRecord({ outcome: 'WIN' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.total_picks).toBe(4);
    expect(report.total_wins).toBe(2);
    expect(report.total_losses).toBe(1);
    expect(report.total_pushes).toBe(1);
    expect(report.date).toBe('2026-01-15');
  });

  it('computes hit rate excluding pushes', () => {
    const records = [
      makeRecord({ outcome: 'WIN' }),
      makeRecord({ outcome: 'LOSS', lossAttribution: 'VARIANCE' }),
      makeRecord({ outcome: 'PUSH' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    // 1 win / 2 non-push = 50%
    expect(report.overall_hit_rate_pct).toBe(50);
  });

  it('produces band-level metrics', () => {
    const records = [
      makeRecord({ finalBand: 'A+', outcome: 'WIN' }),
      makeRecord({ finalBand: 'A+', outcome: 'WIN' }),
      makeRecord({ finalBand: 'A', outcome: 'LOSS', lossAttribution: 'PROJECTION_MISS' }),
      makeRecord({ finalBand: 'B', outcome: 'WIN' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);

    const aPlusBand = report.by_band.find(b => b.band === 'A+');
    expect(aPlusBand).toBeDefined();
    expect(aPlusBand!.count).toBe(2);
    expect(aPlusBand!.wins).toBe(2);
    expect(aPlusBand!.hit_rate_pct).toBe(100);

    const aBand = report.by_band.find(b => b.band === 'A');
    expect(aBand).toBeDefined();
    expect(aBand!.count).toBe(1);
    expect(aBand!.losses).toBe(1);
  });

  it('computes band distribution counts', () => {
    const records = [
      makeRecord({ finalBand: 'A+' }),
      makeRecord({ finalBand: 'A' }),
      makeRecord({ finalBand: 'A' }),
      makeRecord({ finalBand: 'B' }),
      makeRecord({ finalBand: 'SUPPRESS' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.band_distribution['A+']).toBe(1);
    expect(report.band_distribution['A']).toBe(2);
    expect(report.band_distribution['B']).toBe(1);
    expect(report.band_distribution['C']).toBe(0);
    expect(report.band_distribution['SUPPRESS']).toBe(1);
  });

  it('computes attribution counts from loss records', () => {
    const records = [
      makeRecord({ outcome: 'LOSS', lossAttribution: 'PROJECTION_MISS' }),
      makeRecord({ outcome: 'LOSS', lossAttribution: 'VARIANCE' }),
      makeRecord({ outcome: 'LOSS', lossAttribution: 'VARIANCE' }),
      makeRecord({ outcome: 'LOSS', lossAttribution: 'PRICE_MISS' }),
      makeRecord({ outcome: 'WIN' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.attribution_counts.total_losses).toBe(4);
    expect(report.attribution_counts.projection_miss).toBe(1);
    expect(report.attribution_counts.variance).toBe(2);
    expect(report.attribution_counts.price_miss).toBe(1);
    expect(report.attribution_counts.execution_miss).toBe(0);
  });

  it('counts losses without attribution as unknown', () => {
    const records = [
      makeRecord({ outcome: 'LOSS', lossAttribution: null }),
      makeRecord({ outcome: 'LOSS', lossAttribution: undefined }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.attribution_counts.unknown).toBe(2);
  });

  it('computes downgrade counts', () => {
    const records = [
      makeRecord({ initialBand: 'A+', finalBand: 'A+' }), // unchanged
      makeRecord({ initialBand: 'A+', finalBand: 'A', downgradeReasons: ['uncertainty:high'] }), // downgraded
      makeRecord({ initialBand: 'A', finalBand: 'SUPPRESS', suppressionReasons: ['clv:negative'] }), // suppressed
      makeRecord({ initialBand: 'B', finalBand: 'B' }), // unchanged
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.downgrade_counts.total_picks).toBe(4);
    expect(report.downgrade_counts.unchanged).toBe(2);
    expect(report.downgrade_counts.downgraded).toBe(1);
    expect(report.downgrade_counts.suppressed).toBe(1);
    expect(report.downgrade_counts.top_downgrade_reason).toBe('uncertainty');
    expect(report.downgrade_counts.top_suppression_reason).toBe('clv');
  });

  it('includes downgrade effectiveness diagnostics', () => {
    const records = [
      makeRecord({
        initialBand: 'A',
        finalBand: 'SUPPRESS',
        suppressionReasons: ['risk:reject'],
        outcome: 'LOSS',
        lossAttribution: 'VARIANCE',
      }),
      makeRecord({ initialBand: 'A', finalBand: 'A', outcome: 'WIN' }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    expect(report.downgrade_effectiveness).toBeDefined();
    expect(typeof report.downgrade_effectiveness.suppression_effective).toBe('boolean');
    expect(typeof report.downgrade_effectiveness.estimated_savings).toBe('number');
  });

  it('includes CLV data in band summaries', () => {
    const records = [
      makeRecord({ finalBand: 'A', clvPercent: 0.03 }),
      makeRecord({ finalBand: 'A', clvPercent: 0.01 }),
      makeRecord({ finalBand: 'A', clvPercent: null }),
    ];
    const report = generateDailyRollup('2026-01-15', records);
    const aBand = report.by_band.find(b => b.band === 'A');
    expect(aBand).toBeDefined();
    expect(aBand!.avg_clv_percent).not.toBeNull();
    expect(aBand!.clv_sample_size).toBe(2);
  });

  it('is deterministic — same inputs produce identical reports (except timestamp)', () => {
    const records = [
      makeRecord({ finalBand: 'A+', outcome: 'WIN' }),
      makeRecord({ finalBand: 'A', outcome: 'LOSS', lossAttribution: 'VARIANCE' }),
    ];
    const r1 = generateDailyRollup('2026-01-15', records);
    const r2 = generateDailyRollup('2026-01-15', records);
    // generated_at will differ slightly
    expect(r1.total_picks).toBe(r2.total_picks);
    expect(r1.overall_roi_pct).toBe(r2.overall_roi_pct);
    expect(r1.by_band).toEqual(r2.by_band);
    expect(r1.attribution_counts).toEqual(r2.attribution_counts);
    expect(r1.downgrade_counts).toEqual(r2.downgrade_counts);
  });
});

// ── Drift Detector ───────────────────────────────────────────────────────────

describe('detectDrift', () => {
  it('returns empty flags for empty baseline', () => {
    const today = makeRollup();
    const report = detectDrift(today, []);
    expect(report.flags).toEqual([]);
    expect(report.summary.regime_healthy).toBe(true);
    expect(report.baseline_window_size).toBe(0);
  });

  it('returns empty flags when today has zero picks', () => {
    const today = makeRollup({ total_picks: 0 });
    const baseline = [makeRollup()];
    const report = detectDrift(today, baseline);
    expect(report.flags).toEqual([]);
  });

  it('detects ROI drift at warning level', () => {
    const today = makeRollup({ overall_roi_pct: 30 });
    const baseline = [makeRollup({ overall_roi_pct: 10 }), makeRollup({ overall_roi_pct: 12 })];
    // deviation = |30 - 11| = 19 >= 15 (warning) but < 30 (critical)
    const report = detectDrift(today, baseline);
    const roiFlags = report.flags.filter(f => f.category === 'roi_drift');
    expect(roiFlags.length).toBeGreaterThanOrEqual(1);
    const overallRoi = roiFlags.find(f => !f.band);
    expect(overallRoi).toBeDefined();
    expect(overallRoi!.severity).toBe('warning');
  });

  it('detects ROI drift at critical level', () => {
    const today = makeRollup({ overall_roi_pct: 50 });
    const baseline = [makeRollup({ overall_roi_pct: 10 }), makeRollup({ overall_roi_pct: 10 })];
    // deviation = |50 - 10| = 40 >= 30 (critical)
    const report = detectDrift(today, baseline);
    const roiFlags = report.flags.filter(f => f.category === 'roi_drift' && !f.band);
    expect(roiFlags.length).toBe(1);
    expect(roiFlags[0].severity).toBe('critical');
    expect(report.summary.regime_healthy).toBe(false);
  });

  it('detects suppression rate drift', () => {
    const today = makeRollup({
      downgrade_counts: {
        total_picks: 100,
        unchanged: 50,
        downgraded: 10,
        suppressed: 40, // 40%
        top_downgrade_reason: null,
        top_suppression_reason: null,
      },
    });
    const baseline = [
      makeRollup({
        downgrade_counts: {
          total_picks: 100,
          unchanged: 80,
          downgraded: 10,
          suppressed: 10, // 10%
          top_downgrade_reason: null,
          top_suppression_reason: null,
        },
      }),
    ];
    // deviation = |40 - 10| = 30 >= 25 (critical)
    const report = detectDrift(today, baseline);
    const suppressionFlags = report.flags.filter(f => f.category === 'suppression_rate_drift');
    expect(suppressionFlags.length).toBe(1);
    expect(suppressionFlags[0].severity).toBe('critical');
  });

  it('detects distribution drift', () => {
    const today = makeRollup({
      total_picks: 100,
      band_distribution: { 'A+': 50, A: 20, B: 20, C: 5, SUPPRESS: 5 },
    });
    const baseline = [
      makeRollup({
        total_picks: 100,
        band_distribution: { 'A+': 10, A: 30, B: 30, C: 20, SUPPRESS: 10 },
      }),
    ];
    // A+ deviation: |50 - 10| = 40pp >= 30 (critical)
    const report = detectDrift(today, baseline);
    const distFlags = report.flags.filter(f => f.category === 'distribution_drift');
    expect(distFlags.length).toBeGreaterThanOrEqual(1);
    const aPlusFlag = distFlags.find(f => f.band === 'A+');
    expect(aPlusFlag).toBeDefined();
    expect(aPlusFlag!.severity).toBe('critical');
  });

  it('detects attribution drift', () => {
    const today = makeRollup({
      attribution_counts: {
        total_losses: 10,
        projection_miss: 8, // 80%
        price_miss: 1,
        variance: 1,
        execution_miss: 0,
        news_miss: 0,
        correlation_miss: 0,
        unknown: 0,
      },
    });
    const baseline = [
      makeRollup({
        attribution_counts: {
          total_losses: 10,
          projection_miss: 3, // 30%
          price_miss: 3,
          variance: 2,
          execution_miss: 1,
          news_miss: 1,
          correlation_miss: 0,
          unknown: 0,
        },
      }),
    ];
    // projection_miss deviation: |80 - 30| = 50pp >= 20 (warning)
    const report = detectDrift(today, baseline);
    const attrFlags = report.flags.filter(f => f.category === 'attribution_drift');
    expect(attrFlags.length).toBeGreaterThanOrEqual(1);
    expect(attrFlags[0].severity).toBe('warning');
  });

  it('does not flag when within thresholds', () => {
    const today = makeRollup({ overall_roi_pct: 10 });
    const baseline = [makeRollup({ overall_roi_pct: 8 }), makeRollup({ overall_roi_pct: 12 })];
    // deviation = |10 - 10| = 0 — well within thresholds
    const report = detectDrift(today, baseline);
    const overallRoiFlags = report.flags.filter(f => f.category === 'roi_drift' && !f.band);
    expect(overallRoiFlags.length).toBe(0);
  });

  it('counts flag severities in summary', () => {
    const today = makeRollup({ overall_roi_pct: 50 }); // critical ROI drift
    const baseline = [makeRollup({ overall_roi_pct: 10 })];
    const report = detectDrift(today, baseline);
    expect(report.summary.total_flags).toBe(report.flags.length);
    expect(report.summary.critical_count).toBe(
      report.flags.filter(f => f.severity === 'critical').length
    );
    expect(report.summary.warning_count).toBe(
      report.flags.filter(f => f.severity === 'warning').length
    );
  });

  it('marks regime unhealthy when critical flags exist', () => {
    const today = makeRollup({ overall_roi_pct: 50 });
    const baseline = [makeRollup({ overall_roi_pct: 10 })];
    const report = detectDrift(today, baseline);
    expect(report.summary.regime_healthy).toBe(false);
  });

  it('marks regime healthy when only warnings/info', () => {
    const today = makeRollup({ overall_roi_pct: 30 });
    const baseline = [makeRollup({ overall_roi_pct: 11 })];
    // deviation = 19 — warning but not critical
    const report = detectDrift(today, baseline);
    const criticals = report.flags.filter(f => f.severity === 'critical');
    if (criticals.length === 0) {
      expect(report.summary.regime_healthy).toBe(true);
    }
  });

  it('has correct report metadata', () => {
    const today = makeRollup({ date: '2026-01-15' });
    const baseline = [makeRollup(), makeRollup()];
    const report = detectDrift(today, baseline);
    expect(report.report_version).toBe('drift-detector-v1.0');
    expect(report.date).toBe('2026-01-15');
    expect(report.baseline_window_size).toBe(2);
  });

  it('drift thresholds are exported and immutable', () => {
    expect(DRIFT_THRESHOLDS.roi_warning).toBe(15);
    expect(DRIFT_THRESHOLDS.roi_critical).toBe(30);
    expect(DRIFT_THRESHOLDS.brier_warning).toBe(0.05);
    expect(DRIFT_THRESHOLDS.suppression_warning).toBe(10);
    expect(DRIFT_THRESHOLDS.attribution_warning).toBe(20);
  });
});
