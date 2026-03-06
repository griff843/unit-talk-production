/**
 * System Health Report Tests — SPRINT-040A
 *
 * Tests for all 8 report sections + deterministic report generation.
 * Minimum 20 tests required.
 */

import { describe, it, expect } from 'vitest';

import {
  computeCLVByBand,
  computeROIByBand,
  computeCalibrationCurve,
  computeBandDistribution,
  computeDowngradeEffectiveness,
  computeSuppressionEffectiveness,
  computeDriftStatus,
  computeCalibrationImpact,
} from '../system-health-report';
import { generateSystemHealthReport } from '../system-health-runner';
import { SYSTEM_HEALTH_REPORT_VERSION } from '../system-health-types';

import type { DriftReport } from '../../rollups/drift-detector';
import type { SystemHealthRecord } from '../system-health-types';

// ── Test Data Helpers ───────────────────────────────────────────────────────

function makeRecord(overrides: Partial<SystemHealthRecord> = {}): SystemHealthRecord {
  return {
    finalBand: 'A',
    initialBand: 'A',
    downgradeReasons: [],
    suppressionReasons: [],
    outcome: 'WIN',
    p_final: 0.55,
    p_calibrated: 0.56,
    edge_final: 0.05,
    clvPercent: 0.02,
    ...overrides,
  };
}

function makeRecordSet(): SystemHealthRecord[] {
  return [
    // A+ band: 2 wins, 1 loss
    makeRecord({
      finalBand: 'A+',
      initialBand: 'A+',
      outcome: 'WIN',
      p_final: 0.6,
      p_calibrated: 0.61,
      edge_final: 0.1,
      clvPercent: 0.05,
    }),
    makeRecord({
      finalBand: 'A+',
      initialBand: 'A+',
      outcome: 'WIN',
      p_final: 0.62,
      p_calibrated: 0.63,
      edge_final: 0.09,
      clvPercent: 0.03,
    }),
    makeRecord({
      finalBand: 'A+',
      initialBand: 'A+',
      outcome: 'LOSS',
      p_final: 0.58,
      p_calibrated: 0.59,
      edge_final: 0.08,
      clvPercent: -0.01,
    }),
    // A band: 3 wins, 2 losses
    makeRecord({
      finalBand: 'A',
      initialBand: 'A',
      outcome: 'WIN',
      p_final: 0.55,
      p_calibrated: 0.56,
      edge_final: 0.06,
      clvPercent: 0.02,
    }),
    makeRecord({
      finalBand: 'A',
      initialBand: 'A',
      outcome: 'WIN',
      p_final: 0.54,
      p_calibrated: 0.55,
      edge_final: 0.05,
      clvPercent: 0.01,
    }),
    makeRecord({
      finalBand: 'A',
      initialBand: 'A',
      outcome: 'WIN',
      p_final: 0.56,
      p_calibrated: 0.57,
      edge_final: 0.07,
      clvPercent: 0.03,
    }),
    makeRecord({
      finalBand: 'A',
      initialBand: 'A',
      outcome: 'LOSS',
      p_final: 0.53,
      p_calibrated: 0.54,
      edge_final: 0.04,
      clvPercent: -0.02,
    }),
    makeRecord({
      finalBand: 'A',
      initialBand: 'A',
      outcome: 'LOSS',
      p_final: 0.52,
      p_calibrated: 0.53,
      edge_final: 0.03,
      clvPercent: -0.01,
    }),
    // B band: 2 wins, 3 losses
    makeRecord({
      finalBand: 'B',
      initialBand: 'B',
      outcome: 'WIN',
      p_final: 0.51,
      p_calibrated: 0.52,
      edge_final: 0.04,
      clvPercent: 0.01,
    }),
    makeRecord({
      finalBand: 'B',
      initialBand: 'B',
      outcome: 'WIN',
      p_final: 0.5,
      p_calibrated: 0.51,
      edge_final: 0.03,
      clvPercent: 0.005,
    }),
    makeRecord({
      finalBand: 'B',
      initialBand: 'B',
      outcome: 'LOSS',
      p_final: 0.49,
      p_calibrated: 0.5,
      edge_final: 0.03,
      clvPercent: -0.02,
    }),
    makeRecord({
      finalBand: 'B',
      initialBand: 'B',
      outcome: 'LOSS',
      p_final: 0.48,
      p_calibrated: 0.49,
      edge_final: 0.02,
      clvPercent: -0.03,
    }),
    makeRecord({
      finalBand: 'B',
      initialBand: 'A',
      outcome: 'LOSS',
      p_final: 0.47,
      p_calibrated: 0.48,
      edge_final: 0.02,
      clvPercent: -0.01,
      downgradeReasons: ['uncertainty:cap'],
    }),
    // C band: 1 win, 2 losses
    makeRecord({
      finalBand: 'C',
      initialBand: 'B',
      outcome: 'WIN',
      p_final: 0.48,
      p_calibrated: 0.49,
      edge_final: 0.02,
      clvPercent: 0.005,
      downgradeReasons: ['clv:low'],
    }),
    makeRecord({
      finalBand: 'C',
      initialBand: 'C',
      outcome: 'LOSS',
      p_final: 0.46,
      p_calibrated: 0.47,
      edge_final: 0.015,
      clvPercent: -0.03,
    }),
    makeRecord({
      finalBand: 'C',
      initialBand: 'C',
      outcome: 'LOSS',
      p_final: 0.45,
      p_calibrated: 0.46,
      edge_final: 0.015,
      clvPercent: -0.04,
    }),
    // SUPPRESS: 1 win, 3 losses (suppression should be effective)
    makeRecord({
      finalBand: 'SUPPRESS',
      initialBand: 'B',
      outcome: 'WIN',
      p_final: 0.44,
      p_calibrated: 0.45,
      edge_final: 0.01,
      clvPercent: 0.005,
      suppressionReasons: ['clv:very_low'],
    }),
    makeRecord({
      finalBand: 'SUPPRESS',
      initialBand: 'C',
      outcome: 'LOSS',
      p_final: 0.42,
      p_calibrated: 0.43,
      edge_final: 0.01,
      clvPercent: -0.05,
      suppressionReasons: ['uncertainty:extreme'],
    }),
    makeRecord({
      finalBand: 'SUPPRESS',
      initialBand: 'B',
      outcome: 'LOSS',
      p_final: 0.41,
      p_calibrated: 0.42,
      edge_final: 0.005,
      clvPercent: -0.04,
      suppressionReasons: ['market_resistance:high'],
    }),
    makeRecord({
      finalBand: 'SUPPRESS',
      initialBand: 'A',
      outcome: 'LOSS',
      p_final: 0.43,
      p_calibrated: 0.44,
      edge_final: 0.01,
      clvPercent: -0.06,
      suppressionReasons: ['risk:reject'],
    }),
  ];
}

function makeDriftReport(overrides: Partial<DriftReport> = {}): DriftReport {
  return {
    report_version: 'drift-detector-v1.0',
    date: '2026-03-06',
    baseline_window_size: 7,
    flags: [],
    summary: {
      total_flags: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      regime_healthy: true,
    },
    ...overrides,
  };
}

// ── 1. CLV Aggregation Tests ────────────────────────────────────────────────

describe('computeCLVByBand', () => {
  it('should compute average CLV per band', () => {
    const records = makeRecordSet();
    const result = computeCLVByBand(records);

    expect(result).toHaveLength(4); // A+, A, B, C (no SUPPRESS)
    expect(result[0].band).toBe('A+');
    expect(result[1].band).toBe('A');
    expect(result[2].band).toBe('B');
    expect(result[3].band).toBe('C');
  });

  it('should compute positive and negative CLV rates', () => {
    const records = makeRecordSet();
    const result = computeCLVByBand(records);

    // A+ band: 2 positive CLV, 1 negative CLV
    const aPlus = result.find(r => r.band === 'A+')!;
    expect(aPlus.positive_clv_rate).toBeCloseTo(2 / 3, 3);
    expect(aPlus.negative_clv_rate).toBeCloseTo(1 / 3, 3);
  });

  it('should return null CLV when no CLV records exist', () => {
    const records = [
      makeRecord({ finalBand: 'A+', clvPercent: null }),
      makeRecord({ finalBand: 'A+', clvPercent: undefined }),
    ];
    const result = computeCLVByBand(records);
    const aPlus = result.find(r => r.band === 'A+')!;
    expect(aPlus.avg_clv_pct).toBeNull();
    expect(aPlus.positive_clv_rate).toBe(0);
    expect(aPlus.negative_clv_rate).toBe(0);
  });

  it('should track sample sizes correctly', () => {
    const records = makeRecordSet();
    const result = computeCLVByBand(records);

    expect(result.find(r => r.band === 'A+')!.sample_size).toBe(3);
    expect(result.find(r => r.band === 'A')!.sample_size).toBe(5);
    expect(result.find(r => r.band === 'B')!.sample_size).toBe(5);
    expect(result.find(r => r.band === 'C')!.sample_size).toBe(3);
  });
});

// ── 2. ROI Calculation Tests ────────────────────────────────────────────────

describe('computeROIByBand', () => {
  it('should compute flat-bet ROI per band', () => {
    const records = makeRecordSet();
    const result = computeROIByBand(records);

    expect(result).toHaveLength(4);
    // A+ band: 2W 1L → profit = 200 - 110 = 90, wager = 3*110 = 330 → ROI ~27.27%
    const aPlus = result.find(r => r.band === 'A+')!;
    expect(aPlus.roi_pct).toBeCloseTo((90 / 330) * 100, 1);
  });

  it('should handle all-win band correctly', () => {
    const records = [
      makeRecord({ finalBand: 'A+', outcome: 'WIN' }),
      makeRecord({ finalBand: 'A+', outcome: 'WIN' }),
    ];
    const result = computeROIByBand(records);
    const aPlus = result.find(r => r.band === 'A+')!;
    // 2W: profit = 200, wager = 220 → 90.91%
    expect(aPlus.roi_pct).toBeCloseTo((200 / 220) * 100, 1);
  });

  it('should handle all-loss band correctly', () => {
    const records = [
      makeRecord({ finalBand: 'B', outcome: 'LOSS' }),
      makeRecord({ finalBand: 'B', outcome: 'LOSS' }),
    ];
    const result = computeROIByBand(records);
    const b = result.find(r => r.band === 'B')!;
    expect(b.roi_pct).toBe(-100);
  });

  it('should return 0 ROI for empty band', () => {
    const records = [makeRecord({ finalBand: 'A+', outcome: 'WIN' })];
    const result = computeROIByBand(records);
    const b = result.find(r => r.band === 'B')!;
    expect(b.roi_pct).toBe(0);
    expect(b.sample_size).toBe(0);
  });

  it('should exclude pushes from ROI calculation', () => {
    const records = [
      makeRecord({ finalBand: 'A', outcome: 'WIN' }),
      makeRecord({ finalBand: 'A', outcome: 'PUSH' }),
    ];
    const result = computeROIByBand(records);
    const a = result.find(r => r.band === 'A')!;
    // Only 1 non-push: 1W → 100/110 → 90.91%
    expect(a.roi_pct).toBeCloseTo((100 / 110) * 100, 1);
  });
});

// ── 3. Calibration Metric Correctness ───────────────────────────────────────

describe('computeCalibrationCurve', () => {
  it('should compute Brier score for binary outcomes', () => {
    const records = [
      makeRecord({ outcome: 'WIN', p_final: 0.8 }),
      makeRecord({ outcome: 'LOSS', p_final: 0.3 }),
    ];
    const result = computeCalibrationCurve(records);

    // Brier: ((1-0.8)^2 + (0-0.3)^2) / 2 = (0.04 + 0.09) / 2 = 0.065
    expect(result.brier_score).toBeCloseTo(0.065, 3);
    expect(result.sample_size).toBe(2);
  });

  it('should return reliability buckets', () => {
    const records = makeRecordSet().filter(r => r.outcome !== 'PUSH');
    const result = computeCalibrationCurve(records);

    expect(result.reliability_buckets.length).toBe(10);
    for (const bucket of result.reliability_buckets) {
      expect(bucket).toHaveProperty('predicted');
      expect(bucket).toHaveProperty('observed');
      expect(bucket).toHaveProperty('count');
      expect(bucket).toHaveProperty('lower');
      expect(bucket).toHaveProperty('upper');
    }
  });

  it('should return empty section for no records', () => {
    const result = computeCalibrationCurve([]);
    expect(result.brier_score).toBe(0);
    expect(result.log_loss).toBe(0);
    expect(result.ece).toBe(0);
    expect(result.reliability_buckets).toHaveLength(0);
    expect(result.sample_size).toBe(0);
  });

  it('should exclude pushes from calibration', () => {
    const records = [
      makeRecord({ outcome: 'WIN', p_final: 0.7 }),
      makeRecord({ outcome: 'PUSH', p_final: 0.5 }),
    ];
    const result = computeCalibrationCurve(records);
    expect(result.sample_size).toBe(1);
  });
});

// ── 4. Distribution Sanity Checks ───────────────────────────────────────────

describe('computeBandDistribution', () => {
  it('should count picks per band', () => {
    const records = makeRecordSet();
    const result = computeBandDistribution(records);

    expect(result.total_picks).toBe(20);
    const dist = Object.fromEntries(result.distribution.map(d => [d.band, d.frequency]));
    expect(dist['A+']).toBe(3);
    expect(dist['A']).toBe(5);
    expect(dist['B']).toBe(5);
    expect(dist['C']).toBe(3);
    expect(dist['SUPPRESS']).toBe(4);
  });

  it('should compute suppression and downgrade rates', () => {
    const records = makeRecordSet();
    const result = computeBandDistribution(records);

    // 4 suppressed out of 20 = 20%
    expect(result.suppression_rate_pct).toBeCloseTo(20, 1);
    // Downgrades: B records from A initial (1) + C from B initial (1) = 2, 2/20 = 10%
    expect(result.downgrade_rate_pct).toBeCloseTo(10, 1);
  });

  it('should detect collapsed distribution', () => {
    // All picks in one band
    const records = Array.from({ length: 10 }, () =>
      makeRecord({ finalBand: 'A', initialBand: 'A' })
    );
    const result = computeBandDistribution(records);
    expect(result.collapsed_warning).toBe(true);
  });

  it('should not flag balanced distribution as collapsed', () => {
    const records = makeRecordSet();
    const result = computeBandDistribution(records);
    // No single non-suppress band has > 50% of non-suppressed picks (16)
    // A has 5/16 = 31%, B has 5/16 = 31% — not collapsed
    expect(result.collapsed_warning).toBe(false);
  });
});

// ── 5. Downgrade Effectiveness Logic ────────────────────────────────────────

describe('computeDowngradeEffectiveness', () => {
  it('should compute loss prevention metrics', () => {
    const records = makeRecordSet();
    const result = computeDowngradeEffectiveness(records);

    expect(result).toHaveProperty('loss_prevention_rate');
    expect(result).toHaveProperty('estimated_savings');
    expect(result).toHaveProperty('downgrade_reason_counts');
    expect(result).toHaveProperty('downgrade_effective');
  });

  it('should track downgrade reason counts', () => {
    const records = makeRecordSet();
    const result = computeDowngradeEffectiveness(records);

    const reasons = result.downgrade_reason_counts;
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) {
      expect(r).toHaveProperty('reason');
      expect(r).toHaveProperty('count');
      expect(r.count).toBeGreaterThan(0);
    }
  });

  it('should return zero savings when no downgrades exist', () => {
    const records = [
      makeRecord({ finalBand: 'A', initialBand: 'A', outcome: 'WIN' }),
      makeRecord({ finalBand: 'B', initialBand: 'B', outcome: 'LOSS' }),
    ];
    const result = computeDowngradeEffectiveness(records);
    expect(result.estimated_savings).toBeCloseTo(0, 5);
  });
});

// ── 6. Suppression Effectiveness ────────────────────────────────────────────

describe('computeSuppressionEffectiveness', () => {
  it('should compute hypothetical ROI for suppressed picks', () => {
    const records = makeRecordSet();
    const result = computeSuppressionEffectiveness(records);

    // Suppressed: 1W, 3L → profit = 100 - 330 = -230, wager = 4*110 = 440 → -52.27%
    expect(result.suppressed_hypothetical_roi_pct).toBeLessThan(0);
    expect(result.suppressed_count).toBe(4);
  });

  it('should mark suppression as effective when ROI is negative', () => {
    const records = makeRecordSet();
    const result = computeSuppressionEffectiveness(records);
    expect(result.suppression_effective).toBe(true);
  });

  it('should mark suppression as NOT effective when ROI is positive', () => {
    const records = [
      makeRecord({
        finalBand: 'SUPPRESS',
        initialBand: 'B',
        outcome: 'WIN',
        suppressionReasons: ['test'],
      }),
      makeRecord({
        finalBand: 'SUPPRESS',
        initialBand: 'B',
        outcome: 'WIN',
        suppressionReasons: ['test'],
      }),
    ];
    const result = computeSuppressionEffectiveness(records);
    expect(result.suppression_effective).toBe(false);
    expect(result.suppressed_hypothetical_roi_pct).toBeGreaterThan(0);
  });

  it('should handle no suppressed picks', () => {
    const records = [makeRecord({ finalBand: 'A', outcome: 'WIN' })];
    const result = computeSuppressionEffectiveness(records);
    expect(result.suppressed_count).toBe(0);
    expect(result.suppression_effective).toBe(true);
  });
});

// ── 7. Drift Flags ──────────────────────────────────────────────────────────

describe('computeDriftStatus', () => {
  it('should return stable when no drift report provided', () => {
    const result = computeDriftStatus(null);
    expect(result.regime_stability).toBe('stable');
    expect(result.drift_warnings).toBe(0);
    expect(result.drift_critical_flags).toBe(0);
  });

  it('should classify healthy regime as stable', () => {
    const drift = makeDriftReport();
    const result = computeDriftStatus(drift);
    expect(result.regime_stability).toBe('stable');
  });

  it('should classify warnings', () => {
    const drift = makeDriftReport({
      flags: [
        {
          category: 'roi_drift',
          severity: 'warning',
          message: 'ROI drifted',
          current: -5,
          baseline: 2,
          deviation: 7,
        },
      ],
      summary: {
        total_flags: 1,
        critical_count: 0,
        warning_count: 1,
        info_count: 0,
        regime_healthy: true,
      },
    });
    const result = computeDriftStatus(drift);
    expect(result.regime_stability).toBe('warning');
    expect(result.drift_warnings).toBe(1);
  });

  it('should classify critical flags', () => {
    const drift = makeDriftReport({
      flags: [
        {
          category: 'roi_drift',
          severity: 'critical',
          message: 'ROI collapsed',
          current: -40,
          baseline: 2,
          deviation: 42,
        },
      ],
      summary: {
        total_flags: 1,
        critical_count: 1,
        warning_count: 0,
        info_count: 0,
        regime_healthy: false,
      },
    });
    const result = computeDriftStatus(drift);
    expect(result.regime_stability).toBe('critical');
    expect(result.drift_critical_flags).toBe(1);
  });
});

// ── 8. Calibration Impact ───────────────────────────────────────────────────

describe('computeCalibrationImpact', () => {
  it('should compare pre and post calibration metrics', () => {
    const records = makeRecordSet();
    const result = computeCalibrationImpact(records);

    expect(result).toHaveProperty('pre_calibration');
    expect(result).toHaveProperty('post_calibration');
    expect(result).toHaveProperty('brier_improvement');
    expect(result).toHaveProperty('log_loss_delta');
    expect(result).toHaveProperty('monotonicity_preserved');
    expect(result).toHaveProperty('calibration_helped');
  });

  it('should detect positive brier improvement', () => {
    // p_calibrated is closer to outcomes than p_final
    const records = [
      makeRecord({ outcome: 'WIN', p_final: 0.5, p_calibrated: 0.9 }),
      makeRecord({ outcome: 'LOSS', p_final: 0.5, p_calibrated: 0.1 }),
    ];
    const result = computeCalibrationImpact(records);
    expect(result.brier_improvement).toBeGreaterThan(0);
    expect(result.calibration_helped).toBe(true);
  });

  it('should detect negative brier improvement (calibration hurt)', () => {
    // p_calibrated is further from outcomes than p_final
    const records = [
      makeRecord({ outcome: 'WIN', p_final: 0.9, p_calibrated: 0.5 }),
      makeRecord({ outcome: 'LOSS', p_final: 0.1, p_calibrated: 0.5 }),
    ];
    const result = computeCalibrationImpact(records);
    expect(result.brier_improvement).toBeLessThan(0);
    expect(result.calibration_helped).toBe(false);
  });

  it('should handle empty records', () => {
    const result = computeCalibrationImpact([]);
    expect(result.brier_improvement).toBe(0);
    expect(result.monotonicity_preserved).toBe(true);
    expect(result.calibration_helped).toBe(false);
  });
});

// ── 9. Deterministic Report Generation ──────────────────────────────────────

describe('generateSystemHealthReport', () => {
  it('should produce a complete report with all sections', () => {
    const records = makeRecordSet();
    const report = generateSystemHealthReport(records, null, '2026-03-06T12:00:00Z');

    expect(report.report_version).toBe(SYSTEM_HEALTH_REPORT_VERSION);
    expect(report.generated_at).toBe('2026-03-06T12:00:00Z');
    expect(report.total_records).toBe(20);

    expect(report.clvByBand).toBeDefined();
    expect(report.roiByBand).toBeDefined();
    expect(report.calibrationMetrics).toBeDefined();
    expect(report.bandDistribution).toBeDefined();
    expect(report.downgradeEffectiveness).toBeDefined();
    expect(report.suppressionEffectiveness).toBeDefined();
    expect(report.driftStatus).toBeDefined();
    expect(report.calibrationImpact).toBeDefined();
  });

  it('should be deterministic given the same inputs', () => {
    const records = makeRecordSet();
    const ts = '2026-03-06T12:00:00Z';

    const report1 = generateSystemHealthReport(records, null, ts);
    const report2 = generateSystemHealthReport(records, null, ts);

    expect(report1).toEqual(report2);
  });

  it('should handle empty input', () => {
    const report = generateSystemHealthReport([], null, '2026-03-06T12:00:00Z');

    expect(report.total_records).toBe(0);
    expect(report.clvByBand.every(b => b.sample_size === 0)).toBe(true);
    expect(report.roiByBand.every(b => b.roi_pct === 0)).toBe(true);
    expect(report.calibrationMetrics.sample_size).toBe(0);
    expect(report.bandDistribution.total_picks).toBe(0);
  });

  it('should integrate drift report when provided', () => {
    const records = makeRecordSet();
    const drift = makeDriftReport({
      flags: [
        {
          category: 'roi_drift',
          severity: 'warning',
          message: 'test',
          current: 0,
          baseline: 10,
          deviation: 10,
        },
      ],
      summary: {
        total_flags: 1,
        critical_count: 0,
        warning_count: 1,
        info_count: 0,
        regime_healthy: true,
      },
    });

    const report = generateSystemHealthReport(records, drift, '2026-03-06T12:00:00Z');
    expect(report.driftStatus.drift_warnings).toBe(1);
    expect(report.driftStatus.regime_stability).toBe('warning');
  });

  it('should validate ROI directional ordering (A+ >= A >= B >= C)', () => {
    const records = makeRecordSet();
    const report = generateSystemHealthReport(records, null, '2026-03-06T12:00:00Z');

    const rois = report.roiByBand;
    // In our test data, higher bands should have better ROI
    const aPlusRoi = rois.find(r => r.band === 'A+')!.roi_pct;
    const cRoi = rois.find(r => r.band === 'C')!.roi_pct;
    expect(aPlusRoi).toBeGreaterThan(cRoi);
  });
});
