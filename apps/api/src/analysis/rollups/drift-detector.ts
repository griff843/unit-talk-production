/**
 * Drift Detector — SPRINT-038
 *
 * Compares today's daily rollup to a trailing baseline and emits
 * drift flags when metrics deviate beyond thresholds.
 *
 * Drift categories:
 *   1. ROI drift — daily ROI deviates from trailing average
 *   2. CLV drift — daily CLV deviates from trailing average
 *   3. Calibration drift — Brier score worsens beyond threshold
 *   4. Distribution drift — band distribution shifts significantly
 *   5. Suppression rate drift — suppression rate changes significantly
 *   6. Attribution drift — loss attribution mix shifts
 *
 * All comparisons are deterministic given the same inputs.
 */

import type { DailyRollupReport, DailyBandSummary } from './daily-rollup';
import type { BandTier } from '../promotion/types';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A single drift flag with severity and details.
 */
export interface DriftFlag {
  /** Drift category. */
  category: DriftCategory;
  /** Severity: info, warning, critical. */
  severity: 'info' | 'warning' | 'critical';
  /** Human-readable description. */
  message: string;
  /** Current value. */
  current: number;
  /** Baseline value for comparison. */
  baseline: number;
  /** Absolute deviation from baseline. */
  deviation: number;
  /** Band tier if applicable. */
  band?: BandTier;
}

export type DriftCategory =
  | 'roi_drift'
  | 'clv_drift'
  | 'calibration_drift'
  | 'distribution_drift'
  | 'suppression_rate_drift'
  | 'attribution_drift';

/**
 * Full drift detection report.
 */
export interface DriftReport {
  report_version: string;
  date: string;
  baseline_window_size: number;
  flags: DriftFlag[];
  summary: {
    total_flags: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
    regime_healthy: boolean;
  };
}

// ── Thresholds ──────────────────────────────────────────────────────────────

export const DRIFT_THRESHOLDS = {
  /** ROI deviation that triggers a warning (percentage points). */
  roi_warning: 15,
  /** ROI deviation that triggers a critical flag. */
  roi_critical: 30,

  /** CLV deviation that triggers a warning (percentage points). */
  clv_warning: 0.03,
  /** CLV deviation that triggers a critical flag. */
  clv_critical: 0.06,

  /** Brier score worsening that triggers a warning. */
  brier_warning: 0.05,
  /** Brier score worsening that triggers a critical flag. */
  brier_critical: 0.1,

  /** Band distribution shift that triggers a warning (percentage points). */
  distribution_warning: 15,
  /** Band distribution shift that triggers a critical flag. */
  distribution_critical: 30,

  /** Suppression rate change that triggers a warning (percentage points). */
  suppression_warning: 10,
  /** Suppression rate change that triggers a critical flag. */
  suppression_critical: 25,

  /** Attribution category share change for warning (percentage points). */
  attribution_warning: 20,
} as const;

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Detect drift between today's rollup and a trailing baseline.
 *
 * @param today - Today's daily rollup report.
 * @param baseline - Array of recent daily rollups (trailing window).
 */
export function detectDrift(today: DailyRollupReport, baseline: DailyRollupReport[]): DriftReport {
  const flags: DriftFlag[] = [];

  if (baseline.length === 0 || today.total_picks === 0) {
    return buildReport(today.date, baseline.length, flags);
  }

  // ── 1. ROI Drift ────────────────────────────────────────────────────────
  checkRoiDrift(today, baseline, flags);

  // ── 2. CLV Drift ────────────────────────────────────────────────────────
  checkClvDrift(today, baseline, flags);

  // ── 3. Calibration Drift ────────────────────────────────────────────────
  checkCalibrationDrift(today, baseline, flags);

  // ── 4. Distribution Drift ───────────────────────────────────────────────
  checkDistributionDrift(today, baseline, flags);

  // ── 5. Suppression Rate Drift ───────────────────────────────────────────
  checkSuppressionDrift(today, baseline, flags);

  // ── 6. Attribution Drift ────────────────────────────────────────────────
  checkAttributionDrift(today, baseline, flags);

  return buildReport(today.date, baseline.length, flags);
}

// ── Drift Checks ────────────────────────────────────────────────────────────

function checkRoiDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  const baselineRoi = avgOf(baseline, r => r.overall_roi_pct);
  const deviation = Math.abs(today.overall_roi_pct - baselineRoi);

  if (deviation >= DRIFT_THRESHOLDS.roi_critical) {
    flags.push({
      category: 'roi_drift',
      severity: 'critical',
      message: `Overall ROI deviated ${deviation.toFixed(1)}pp from baseline`,
      current: today.overall_roi_pct,
      baseline: baselineRoi,
      deviation,
    });
  } else if (deviation >= DRIFT_THRESHOLDS.roi_warning) {
    flags.push({
      category: 'roi_drift',
      severity: 'warning',
      message: `Overall ROI deviated ${deviation.toFixed(1)}pp from baseline`,
      current: today.overall_roi_pct,
      baseline: baselineRoi,
      deviation,
    });
  }

  // Per-band ROI drift
  const publishedBands: BandTier[] = ['A+', 'A', 'B', 'C'];
  for (const band of publishedBands) {
    const todayBand = today.by_band.find(b => b.band === band);
    if (!todayBand || todayBand.count === 0) continue;

    const baselineBandRois = baseline
      .map(r => r.by_band.find(b => b.band === band))
      .filter((b): b is DailyBandSummary => b != null && b.count > 0)
      .map(b => b.flat_bet_roi_pct);

    if (baselineBandRois.length === 0) continue;
    const baselineBandRoi = mean(baselineBandRois);
    const bandDeviation = Math.abs(todayBand.flat_bet_roi_pct - baselineBandRoi);

    if (bandDeviation >= DRIFT_THRESHOLDS.roi_critical) {
      flags.push({
        category: 'roi_drift',
        severity: 'critical',
        message: `Band ${band} ROI deviated ${bandDeviation.toFixed(1)}pp from baseline`,
        current: todayBand.flat_bet_roi_pct,
        baseline: baselineBandRoi,
        deviation: bandDeviation,
        band,
      });
    } else if (bandDeviation >= DRIFT_THRESHOLDS.roi_warning) {
      flags.push({
        category: 'roi_drift',
        severity: 'warning',
        message: `Band ${band} ROI deviated ${bandDeviation.toFixed(1)}pp from baseline`,
        current: todayBand.flat_bet_roi_pct,
        baseline: baselineBandRoi,
        deviation: bandDeviation,
        band,
      });
    }
  }
}

function checkClvDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  const publishedBands: BandTier[] = ['A+', 'A', 'B', 'C'];

  for (const band of publishedBands) {
    const todayBand = today.by_band.find(b => b.band === band);
    if (!todayBand || todayBand.avg_clv_percent === null) continue;

    const baselineClvs = baseline
      .map(r => r.by_band.find(b => b.band === band))
      .filter((b): b is DailyBandSummary => b != null && b.avg_clv_percent !== null)
      .map(b => b.avg_clv_percent!);

    if (baselineClvs.length === 0) continue;
    const baselineClv = mean(baselineClvs);
    const deviation = Math.abs(todayBand.avg_clv_percent - baselineClv);

    if (deviation >= DRIFT_THRESHOLDS.clv_critical) {
      flags.push({
        category: 'clv_drift',
        severity: 'critical',
        message: `Band ${band} CLV deviated ${(deviation * 100).toFixed(2)}% from baseline`,
        current: todayBand.avg_clv_percent,
        baseline: baselineClv,
        deviation,
        band,
      });
    } else if (deviation >= DRIFT_THRESHOLDS.clv_warning) {
      flags.push({
        category: 'clv_drift',
        severity: 'warning',
        message: `Band ${band} CLV deviated ${(deviation * 100).toFixed(2)}% from baseline`,
        current: todayBand.avg_clv_percent,
        baseline: baselineClv,
        deviation,
        band,
      });
    }
  }
}

function checkCalibrationDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  const publishedBands: BandTier[] = ['A+', 'A', 'B', 'C'];

  for (const band of publishedBands) {
    const todayBand = today.by_band.find(b => b.band === band);
    if (!todayBand || todayBand.count === 0) continue;

    const baselineBriers = baseline
      .map(r => r.by_band.find(b => b.band === band))
      .filter((b): b is DailyBandSummary => b != null && b.count > 0)
      .map(b => b.brier_score);

    if (baselineBriers.length === 0) continue;
    const baselineBrier = mean(baselineBriers);

    // Only flag worsening (higher Brier = worse)
    const worsening = todayBand.brier_score - baselineBrier;
    if (worsening <= 0) continue;

    if (worsening >= DRIFT_THRESHOLDS.brier_critical) {
      flags.push({
        category: 'calibration_drift',
        severity: 'critical',
        message: `Band ${band} Brier score worsened by ${worsening.toFixed(4)}`,
        current: todayBand.brier_score,
        baseline: baselineBrier,
        deviation: worsening,
        band,
      });
    } else if (worsening >= DRIFT_THRESHOLDS.brier_warning) {
      flags.push({
        category: 'calibration_drift',
        severity: 'warning',
        message: `Band ${band} Brier score worsened by ${worsening.toFixed(4)}`,
        current: todayBand.brier_score,
        baseline: baselineBrier,
        deviation: worsening,
        band,
      });
    }
  }
}

function checkDistributionDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  const allBands: BandTier[] = ['A+', 'A', 'B', 'C', 'SUPPRESS'];
  const todayTotal = today.total_picks;
  if (todayTotal === 0) return;

  for (const band of allBands) {
    const todayPct = (today.band_distribution[band] / todayTotal) * 100;

    const baselinePcts = baseline
      .filter(r => r.total_picks > 0)
      .map(r => (r.band_distribution[band] / r.total_picks) * 100);

    if (baselinePcts.length === 0) continue;
    const baselinePct = mean(baselinePcts);
    const deviation = Math.abs(todayPct - baselinePct);

    if (deviation >= DRIFT_THRESHOLDS.distribution_critical) {
      flags.push({
        category: 'distribution_drift',
        severity: 'critical',
        message: `Band ${band} distribution shifted ${deviation.toFixed(1)}pp`,
        current: todayPct,
        baseline: baselinePct,
        deviation,
        band,
      });
    } else if (deviation >= DRIFT_THRESHOLDS.distribution_warning) {
      flags.push({
        category: 'distribution_drift',
        severity: 'warning',
        message: `Band ${band} distribution shifted ${deviation.toFixed(1)}pp`,
        current: todayPct,
        baseline: baselinePct,
        deviation,
        band,
      });
    }
  }
}

function checkSuppressionDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  if (today.downgrade_counts.total_picks === 0) return;

  const todayRate = (today.downgrade_counts.suppressed / today.downgrade_counts.total_picks) * 100;

  const baselineRates = baseline
    .filter(r => r.downgrade_counts.total_picks > 0)
    .map(r => (r.downgrade_counts.suppressed / r.downgrade_counts.total_picks) * 100);

  if (baselineRates.length === 0) return;
  const baselineRate = mean(baselineRates);
  const deviation = Math.abs(todayRate - baselineRate);

  if (deviation >= DRIFT_THRESHOLDS.suppression_critical) {
    flags.push({
      category: 'suppression_rate_drift',
      severity: 'critical',
      message: `Suppression rate changed ${deviation.toFixed(1)}pp`,
      current: todayRate,
      baseline: baselineRate,
      deviation,
    });
  } else if (deviation >= DRIFT_THRESHOLDS.suppression_warning) {
    flags.push({
      category: 'suppression_rate_drift',
      severity: 'warning',
      message: `Suppression rate changed ${deviation.toFixed(1)}pp`,
      current: todayRate,
      baseline: baselineRate,
      deviation,
    });
  }
}

function checkAttributionDrift(
  today: DailyRollupReport,
  baseline: DailyRollupReport[],
  flags: DriftFlag[]
): void {
  if (today.attribution_counts.total_losses === 0) return;

  const categories = [
    'projection_miss',
    'price_miss',
    'variance',
    'execution_miss',
    'news_miss',
    'correlation_miss',
    'unknown',
  ] as const;

  for (const cat of categories) {
    const todayPct = (today.attribution_counts[cat] / today.attribution_counts.total_losses) * 100;

    const baselinePcts = baseline
      .filter(r => r.attribution_counts.total_losses > 0)
      .map(r => (r.attribution_counts[cat] / r.attribution_counts.total_losses) * 100);

    if (baselinePcts.length === 0) continue;
    const baselinePct = mean(baselinePcts);
    const deviation = Math.abs(todayPct - baselinePct);

    if (deviation >= DRIFT_THRESHOLDS.attribution_warning) {
      flags.push({
        category: 'attribution_drift',
        severity: 'warning',
        message: `${cat} attribution share shifted ${deviation.toFixed(1)}pp`,
        current: todayPct,
        baseline: baselinePct,
        deviation,
      });
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildReport(date: string, baselineSize: number, flags: DriftFlag[]): DriftReport {
  const criticalCount = flags.filter(f => f.severity === 'critical').length;
  const warningCount = flags.filter(f => f.severity === 'warning').length;
  const infoCount = flags.filter(f => f.severity === 'info').length;

  return {
    report_version: 'drift-detector-v1.0',
    date,
    baseline_window_size: baselineSize,
    flags,
    summary: {
      total_flags: flags.length,
      critical_count: criticalCount,
      warning_count: warningCount,
      info_count: infoCount,
      regime_healthy: criticalCount === 0,
    },
  };
}

function avgOf(reports: DailyRollupReport[], fn: (r: DailyRollupReport) => number): number {
  if (reports.length === 0) return 0;
  return reports.reduce((s, r) => s + fn(r), 0) / reports.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
