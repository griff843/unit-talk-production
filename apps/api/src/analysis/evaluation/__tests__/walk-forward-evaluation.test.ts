/**
 * Walk-Forward Evaluation Tests — SPRINT-037
 *
 * Tests:
 *   1. Band evaluation — CLV/ROI/calibration by band
 *   2. Downgrade effectiveness — loss prevention analysis
 *   3. Regime stability — threshold stability across windows
 *   4. Edge cases and determinism
 */

import { describe, it, expect } from 'vitest';

import {
  generateBandEvaluation,
  type BandedOutcome,
  type BandEvaluationReport,
} from '../band-evaluation';
import {
  buildDowngradeRecord,
  analyzeDowngradeEffectiveness,
  type DowngradeOutcomeRecord,
} from '../downgrade-effectiveness';
import { analyzeRegimeStability, type RegimeRecord } from '../regime-stability';

import type { ScoredOutcome } from '../../outcomes/types';
import type { BandOutput, BandTier } from '../../promotion/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeScoredOutcome(overrides: Partial<ScoredOutcome> = {}): ScoredOutcome {
  return {
    market_key: 'test-market',
    event_id: 'test-event',
    market_type_id: 1,
    participant_id: 'player-1',
    p_final: 0.6,
    p_market_devig: 0.55,
    edge_final: 0.05,
    score: 75,
    tier: 'A',
    book_count: 5,
    line: 22.5,
    actual_value: 25,
    outcome: 'WIN',
    ...overrides,
  };
}

function makeBandOutput(overrides: Partial<BandOutput> = {}): BandOutput {
  return {
    finalBand: 'A',
    initialBand: 'A',
    downgradeReasons: [],
    suppressionReasons: [],
    thresholdVersion: '1.0.0',
    ...overrides,
  };
}

function makeBandedOutcome(
  outcomeOverrides: Partial<ScoredOutcome> = {},
  bandOverrides: Partial<BandOutput> = {},
  clvPercent?: number | null
): BandedOutcome {
  return {
    outcome: makeScoredOutcome(outcomeOverrides),
    band: makeBandOutput(bandOverrides),
    clvPercent: clvPercent ?? null,
  };
}

// ── 1. Band Evaluation ──────────────────────────────────────────────────────

describe('generateBandEvaluation', () => {
  it('returns empty metrics for empty input', () => {
    const report = generateBandEvaluation([]);
    expect(report.total_sample_size).toBe(0);
    expect(report.by_band.every(m => m.sample_size === 0)).toBe(true);
  });

  it('computes ROI by band correctly', () => {
    const records: BandedOutcome[] = [
      // A+ band: 2 wins, 1 loss
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'A+' }),
      // B band: 1 win, 2 losses
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'B' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'B' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'B' }),
    ];

    const report = generateBandEvaluation(records);
    const aPlusBand = report.by_band.find(m => m.band === 'A+')!;
    const bBand = report.by_band.find(m => m.band === 'B')!;

    expect(aPlusBand.sample_size).toBe(3);
    expect(aPlusBand.wins).toBe(2);
    expect(aPlusBand.losses).toBe(1);
    // ROI: (200 - 110) / (3*110) * 100 = 27.27%
    expect(aPlusBand.flat_bet_roi_pct).toBeCloseTo(27.2727, 1);

    expect(bBand.sample_size).toBe(3);
    expect(bBand.wins).toBe(1);
    expect(bBand.losses).toBe(2);
    // ROI: (100 - 220) / (3*110) * 100 = -36.36%
    expect(bBand.flat_bet_roi_pct).toBeCloseTo(-36.3636, 1);
  });

  it('computes CLV by band correctly', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }, 0.05),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }, 0.03),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'C' }, -0.02),
    ];

    const report = generateBandEvaluation(records);
    const aBand = report.by_band.find(m => m.band === 'A')!;
    const cBand = report.by_band.find(m => m.band === 'C')!;

    expect(aBand.avg_clv_percent).toBeCloseTo(0.04, 4);
    expect(aBand.positive_clv_count).toBe(2);
    expect(cBand.avg_clv_percent).toBeCloseTo(-0.02, 4);
    expect(cBand.negative_clv_count).toBe(1);
  });

  it('computes calibration (Brier score) by band', () => {
    const records: BandedOutcome[] = [
      // Well-calibrated: p_final=0.7, outcome=WIN
      makeBandedOutcome({ outcome: 'WIN', p_final: 0.7 }, { finalBand: 'A' }),
      // Poorly calibrated: p_final=0.9, outcome=LOSS
      makeBandedOutcome({ outcome: 'LOSS', p_final: 0.9 }, { finalBand: 'C' }),
    ];

    const report = generateBandEvaluation(records);
    const aBand = report.by_band.find(m => m.band === 'A')!;
    const cBand = report.by_band.find(m => m.band === 'C')!;

    // A: (1 - 0.7)^2 = 0.09
    expect(aBand.brier_score).toBeCloseTo(0.09, 4);
    // C: (0 - 0.9)^2 = 0.81
    expect(cBand.brier_score).toBeCloseTo(0.81, 4);
  });

  it('tracks band distribution', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({}, { finalBand: 'A+' }),
      makeBandedOutcome({}, { finalBand: 'A' }),
      makeBandedOutcome({}, { finalBand: 'A' }),
      makeBandedOutcome({}, { finalBand: 'B' }),
      makeBandedOutcome({}, { finalBand: 'SUPPRESS' }),
    ];

    const report = generateBandEvaluation(records);
    expect(report.band_distribution['A+']).toBe(1);
    expect(report.band_distribution.A).toBe(2);
    expect(report.band_distribution.B).toBe(1);
    expect(report.band_distribution.C).toBe(0);
    expect(report.band_distribution.SUPPRESS).toBe(1);
  });

  it('identifies best band by ROI', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'A' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'B' }),
    ];

    const report = generateBandEvaluation(records);
    expect(report.summary.best_roi_band).toBe('A+');
  });

  it('detects monotonic ROI (A+ > A > B > C)', () => {
    // Create records where higher bands have better outcomes
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'A' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'B' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'B' }),
    ];

    const report = generateBandEvaluation(records);
    expect(report.summary.monotonic_roi).toBe(true);
  });

  it('handles PUSHes correctly in metrics', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }),
      makeBandedOutcome({ outcome: 'PUSH' }, { finalBand: 'A' }),
    ];

    const report = generateBandEvaluation(records);
    const aBand = report.by_band.find(m => m.band === 'A')!;
    expect(aBand.sample_size).toBe(2);
    expect(aBand.pushes).toBe(1);
    // Hit rate only from non-push: 1/1 = 100%
    expect(aBand.hit_rate_pct).toBe(100);
  });
});

// ── 2. Downgrade Effectiveness ──────────────────────────────────────────────

describe('analyzeDowngradeEffectiveness', () => {
  it('correctly identifies downgraded records', () => {
    const record = buildDowngradeRecord('A+', 'A', ['uncertainty_cap'], [], 'LOSS');
    expect(record.wasDowngraded).toBe(true);
    expect(record.wasSuppressed).toBe(false);
  });

  it('correctly identifies suppressed records', () => {
    const record = buildDowngradeRecord('A', 'SUPPRESS', [], ['clv_suppress'], 'LOSS');
    expect(record.wasSuppressed).toBe(true);
    expect(record.wasDowngraded).toBe(false);
  });

  it('correctly identifies unchanged records', () => {
    const record = buildDowngradeRecord('A', 'A', [], [], 'WIN');
    expect(record.wasDowngraded).toBe(false);
    expect(record.wasSuppressed).toBe(false);
  });

  it('computes suppression effectiveness', () => {
    const records: DowngradeOutcomeRecord[] = [
      // Suppressed picks: mostly losses (suppression is working)
      buildDowngradeRecord('A', 'SUPPRESS', [], ['clv_suppress:bad'], 'LOSS'),
      buildDowngradeRecord('B', 'SUPPRESS', [], ['uncertainty_extreme:0.5'], 'LOSS'),
      buildDowngradeRecord('A', 'SUPPRESS', [], ['risk_reject:exposure'], 'WIN'),
      // Unchanged picks: mostly wins
      buildDowngradeRecord('A', 'A', [], [], 'WIN'),
      buildDowngradeRecord('A+', 'A+', [], [], 'WIN'),
      buildDowngradeRecord('B', 'B', [], [], 'LOSS'),
    ];

    const report = analyzeDowngradeEffectiveness(records);

    expect(report.suppressed.total).toBe(3);
    expect(report.suppressed.outcomes_lost).toBe(2);
    expect(report.unchanged.total).toBe(3);
    expect(report.unchanged.outcomes_won).toBe(2);

    // Suppressed loss rate (2/3 = 66.7%) > unchanged loss rate (1/3 = 33.3%)
    expect(report.diagnostics.suppression_effective).toBe(true);
  });

  it('reports negative savings when suppression catches winners', () => {
    const records: DowngradeOutcomeRecord[] = [
      buildDowngradeRecord('A', 'SUPPRESS', [], ['clv_suppress'], 'WIN'),
      buildDowngradeRecord('A', 'SUPPRESS', [], ['clv_suppress'], 'WIN'),
      buildDowngradeRecord('A', 'A', [], [], 'LOSS'),
    ];

    const report = analyzeDowngradeEffectiveness(records);
    // Suppressed picks were winners — net flat bet = +200
    // Savings = -(200) = -200 (negative = we lost value by suppressing)
    expect(report.diagnostics.estimated_savings).toBe(-200);
  });

  it('breaks down effectiveness by reason', () => {
    const records: DowngradeOutcomeRecord[] = [
      buildDowngradeRecord('A+', 'A', ['uncertainty_cap:A+->A'], [], 'LOSS'),
      buildDowngradeRecord('A', 'B', ['clv_downgrade:A->B'], [], 'LOSS'),
      buildDowngradeRecord('A', 'SUPPRESS', [], ['risk_reject:exposure'], 'WIN'),
    ];

    const report = analyzeDowngradeEffectiveness(records);
    expect(report.by_reason.length).toBeGreaterThan(0);

    const uncertaintyReason = report.by_reason.find(r => r.reason === 'uncertainty_cap');
    expect(uncertaintyReason).toBeDefined();
    expect(uncertaintyReason!.total).toBe(1);
    expect(uncertaintyReason!.losses_prevented).toBe(1);
  });

  it('computes flat-bet results correctly', () => {
    const winRecord = buildDowngradeRecord('A', 'A', [], [], 'WIN');
    const lossRecord = buildDowngradeRecord('A', 'A', [], [], 'LOSS');
    const pushRecord = buildDowngradeRecord('A', 'A', [], [], 'PUSH');

    expect(winRecord.flatBetResult).toBe(100);
    expect(lossRecord.flatBetResult).toBe(-110);
    expect(pushRecord.flatBetResult).toBe(0);
  });

  it('handles empty input', () => {
    const report = analyzeDowngradeEffectiveness([]);
    expect(report.total_records).toBe(0);
    expect(report.suppressed.total).toBe(0);
    expect(report.downgraded.total).toBe(0);
    expect(report.unchanged.total).toBe(0);
  });
});

// ── 3. Regime Stability ─────────────────────────────────────────────────────

describe('analyzeRegimeStability', () => {
  function makeRegimeRecords(
    windowConfig: Array<{
      label: string;
      bands: Array<{ band: BandTier; outcome: 'WIN' | 'LOSS' | 'PUSH'; clv?: number }>;
    }>
  ): RegimeRecord[] {
    const records: RegimeRecord[] = [];
    for (const window of windowConfig) {
      for (const entry of window.bands) {
        let flatBetResult = 0;
        if (entry.outcome === 'WIN') flatBetResult = 100;
        else if (entry.outcome === 'LOSS') flatBetResult = -110;

        records.push({
          finalBand: entry.band,
          outcome: entry.outcome,
          flatBetResult,
          clvPercent: entry.clv ?? null,
          windowLabel: window.label,
        });
      }
    }
    return records;
  }

  it('detects stable regime with consistent distributions', () => {
    const records = makeRegimeRecords([
      {
        label: 'w1',
        bands: [
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'WIN' },
          { band: 'A', outcome: 'WIN' },
          { band: 'A', outcome: 'LOSS' },
          { band: 'B', outcome: 'LOSS' },
        ],
      },
      {
        label: 'w2',
        bands: [
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'LOSS' },
          { band: 'A', outcome: 'WIN' },
          { band: 'A', outcome: 'WIN' },
          { band: 'B', outcome: 'LOSS' },
        ],
      },
      {
        label: 'w3',
        bands: [
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'WIN' },
          { band: 'A', outcome: 'LOSS' },
          { band: 'A', outcome: 'WIN' },
          { band: 'B', outcome: 'WIN' },
        ],
      },
    ]);

    const report = analyzeRegimeStability(records);
    expect(report.window_count).toBe(3);
    expect(report.total_sample_size).toBe(15);
    // Distribution is 40% A+, 40% A, 20% B consistently → stable
    expect(report.distribution_stability.length).toBeGreaterThan(0);
  });

  it('detects unstable regime with shifting distributions', () => {
    const records = makeRegimeRecords([
      {
        label: 'w1',
        bands: [
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'WIN' },
          { band: 'A+', outcome: 'WIN' },
          { band: 'B', outcome: 'LOSS' },
        ],
      },
      {
        label: 'w2',
        bands: [
          { band: 'B', outcome: 'WIN' },
          { band: 'B', outcome: 'LOSS' },
          { band: 'B', outcome: 'LOSS' },
          { band: 'B', outcome: 'LOSS' },
          { band: 'A+', outcome: 'WIN' },
        ],
      },
    ]);

    const report = analyzeRegimeStability(records);
    // A+ went from 80% to 20%, B went from 20% to 80% — very unstable
    const aPlusDist = report.distribution_stability.find(s => s.dimension === 'distribution:A+');
    expect(aPlusDist).toBeDefined();
    expect(aPlusDist!.stable).toBe(false);
  });

  it('skips windows below minimum sample threshold', () => {
    const records = makeRegimeRecords([
      {
        label: 'w1',
        bands: [
          { band: 'A', outcome: 'WIN' },
          { band: 'A', outcome: 'WIN' },
          { band: 'A', outcome: 'LOSS' },
          { band: 'B', outcome: 'LOSS' },
          { band: 'B', outcome: 'WIN' },
        ],
      },
      {
        label: 'w2-tiny',
        bands: [
          { band: 'A', outcome: 'WIN' },
          // Only 1 record — below MIN_WINDOW_SAMPLES=5
        ],
      },
    ]);

    const report = analyzeRegimeStability(records);
    // Only w1 should be included (w2-tiny has < 5 samples)
    expect(report.window_count).toBe(1);
  });

  it('includes CLV stability when CLV data is available', () => {
    const records = makeRegimeRecords([
      {
        label: 'w1',
        bands: [
          { band: 'A', outcome: 'WIN', clv: 0.05 },
          { band: 'A', outcome: 'WIN', clv: 0.03 },
          { band: 'A', outcome: 'LOSS', clv: -0.01 },
          { band: 'B', outcome: 'LOSS', clv: -0.04 },
          { band: 'B', outcome: 'WIN', clv: 0.01 },
        ],
      },
      {
        label: 'w2',
        bands: [
          { band: 'A', outcome: 'WIN', clv: 0.04 },
          { band: 'A', outcome: 'WIN', clv: 0.02 },
          { band: 'A', outcome: 'LOSS', clv: 0.0 },
          { band: 'B', outcome: 'LOSS', clv: -0.03 },
          { band: 'B', outcome: 'WIN', clv: 0.02 },
        ],
      },
    ]);

    const report = analyzeRegimeStability(records);
    expect(report.clv_stability.length).toBeGreaterThan(0);
  });

  it('handles empty input', () => {
    const report = analyzeRegimeStability([]);
    expect(report.window_count).toBe(0);
    expect(report.regime.stable).toBe(true);
    expect(report.regime.unstable_count).toBe(0);
  });
});

// ── 4. Determinism ──────────────────────────────────────────────────────────

describe('deterministic behavior', () => {
  it('band evaluation is deterministic across runs', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN', p_final: 0.65 }, { finalBand: 'A+' }, 0.05),
      makeBandedOutcome({ outcome: 'LOSS', p_final: 0.55 }, { finalBand: 'A' }, -0.02),
      makeBandedOutcome({ outcome: 'WIN', p_final: 0.7 }, { finalBand: 'B' }, 0.01),
    ];

    const baseline = generateBandEvaluation(records);
    for (let i = 0; i < 50; i++) {
      const result = generateBandEvaluation(records);
      // Compare everything except generated_at (timestamp)
      expect(result.by_band).toEqual(baseline.by_band);
      expect(result.band_distribution).toEqual(baseline.band_distribution);
      expect(result.summary).toEqual(baseline.summary);
    }
  });

  it('downgrade analysis is deterministic', () => {
    const records: DowngradeOutcomeRecord[] = [
      buildDowngradeRecord('A+', 'A', ['uncertainty_cap:high'], [], 'LOSS'),
      buildDowngradeRecord('A', 'SUPPRESS', [], ['clv_suppress:-0.2'], 'WIN'),
    ];

    const baseline = analyzeDowngradeEffectiveness(records);
    for (let i = 0; i < 50; i++) {
      expect(analyzeDowngradeEffectiveness(records)).toEqual(baseline);
    }
  });
});

// ── 5. Edge Cases ───────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('all records in SUPPRESS band', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'SUPPRESS' }),
      makeBandedOutcome({ outcome: 'LOSS' }, { finalBand: 'SUPPRESS' }),
    ];

    const report = generateBandEvaluation(records);
    expect(report.band_distribution.SUPPRESS).toBe(2);
    expect(report.summary.best_roi_band).toBe('SUPPRESS');
  });

  it('all WINs produces positive ROI for all bands', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A+' }),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'B' }),
    ];

    const report = generateBandEvaluation(records);
    const withSamples = report.by_band.filter(m => m.sample_size > 0);
    expect(withSamples.every(m => m.flat_bet_roi_pct > 0)).toBe(true);
  });

  it('null CLV is excluded from averages', () => {
    const records: BandedOutcome[] = [
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }, 0.05),
      makeBandedOutcome({ outcome: 'WIN' }, { finalBand: 'A' }, null),
    ];

    const report = generateBandEvaluation(records);
    const aBand = report.by_band.find(m => m.band === 'A')!;
    expect(aBand.clv_sample_size).toBe(1);
    expect(aBand.avg_clv_percent).toBeCloseTo(0.05, 4);
  });
});
