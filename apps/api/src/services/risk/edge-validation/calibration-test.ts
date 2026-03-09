/**
 * Probability Calibration Test
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 *
 * Tests whether p_final (model probability) tracks p_close_devig
 * (closing line benchmark). Uses closing line as efficient market truth.
 */

import type { JoinedScoringRecord, TestResult } from './types';

export interface CalibrationBin {
  bin_label: string;
  bin_lower: number;
  bin_upper: number;
  count: number;
  avg_p_predicted: number;
  avg_p_benchmark: number;
  calibration_error: number;
}

export function runCalibrationTest(records: JoinedScoringRecord[]): TestResult {
  if (records.length === 0) {
    return {
      test_name: 'calibration_test',
      verdict: 'FAIL',
      summary: 'No records to calibrate.',
      details: {},
      timestamp: new Date().toISOString(),
    };
  }

  // Define bins
  const binDefs: [number, number][] = [
    [0.0, 0.4],
    [0.4, 0.45],
    [0.45, 0.5],
    [0.5, 0.55],
    [0.55, 0.6],
    [0.6, 0.65],
    [0.65, 0.7],
    [0.7, 1.01],
  ];

  const bins: CalibrationBin[] = binDefs.map(([lo, hi]) => ({
    bin_label: `${lo.toFixed(2)}-${hi.toFixed(2)}`,
    bin_lower: lo,
    bin_upper: hi,
    count: 0,
    avg_p_predicted: 0,
    avg_p_benchmark: 0,
    calibration_error: 0,
  }));

  // Accumulate
  const binSums = binDefs.map(() => ({ sumPred: 0, sumBench: 0, count: 0 }));

  for (const r of records) {
    const p = r.p_final;
    for (let i = 0; i < binDefs.length; i++) {
      const [lo, hi] = binDefs[i]!;
      if (p >= lo && p < hi) {
        binSums[i]!.sumPred += p;
        binSums[i]!.sumBench += r.p_close_devig;
        binSums[i]!.count++;
        break;
      }
    }
  }

  // Compute per-bin metrics
  const nonEmptyBins: CalibrationBin[] = [];

  for (let i = 0; i < bins.length; i++) {
    const sum = binSums[i]!;
    bins[i]!.count = sum.count;
    if (sum.count > 0) {
      bins[i]!.avg_p_predicted = sum.sumPred / sum.count;
      bins[i]!.avg_p_benchmark = sum.sumBench / sum.count;
      bins[i]!.calibration_error = Math.abs(bins[i]!.avg_p_predicted - bins[i]!.avg_p_benchmark);
      nonEmptyBins.push(bins[i]!);
    }
  }

  // Mean calibration error (simple average across non-empty bins)
  const meanCalError =
    nonEmptyBins.length > 0
      ? nonEmptyBins.reduce((s, b) => s + b.calibration_error, 0) / nonEmptyBins.length
      : 0;

  // Weighted calibration error (ECE)
  const totalCount = records.length;
  const weightedCalError = nonEmptyBins.reduce(
    (s, b) => s + (b.count / totalCount) * b.calibration_error,
    0
  );

  // Max calibration error
  const maxCalError =
    nonEmptyBins.length > 0 ? Math.max(...nonEmptyBins.map(b => b.calibration_error)) : 0;
  const worstBin = nonEmptyBins.find(b => b.calibration_error === maxCalError)?.bin_label ?? 'N/A';

  // Pearson r between p_final and p_close_devig
  const pearsonR = computePearsonR(
    records.map(r => r.p_final),
    records.map(r => r.p_close_devig)
  );

  // Bias: mean(p_final - p_close_devig)
  const meanBias = records.reduce((s, r) => s + (r.p_final - r.p_close_devig), 0) / records.length;

  // Verdict
  let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
  if (meanCalError > 0.05) verdict = 'FAIL';
  else if (maxCalError > 0.08) verdict = 'WARN';

  return {
    test_name: 'calibration_test',
    verdict,
    summary: `Mean calibration error: ${(meanCalError * 100).toFixed(2)}% | ECE: ${(weightedCalError * 100).toFixed(2)}% | Pearson r: ${pearsonR.toFixed(4)} | Bias: ${(meanBias * 100).toFixed(3)}%`,
    details: {
      bins,
      mean_calibration_error: meanCalError,
      weighted_calibration_error_ece: weightedCalError,
      max_calibration_error: maxCalError,
      worst_bin: worstBin,
      total_records: records.length,
      pearson_r: pearsonR,
      mean_bias: meanBias,
      methodology:
        'Closing line (p_close_devig) used as efficient market benchmark. Not outcome-based calibration.',
    },
    timestamp: new Date().toISOString(),
  };
}

function computePearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom === 0 ? 0 : sumXY / denom;
}

/** Generate CSV rows for calibration curve artifact */
export function generateCalibrationCSV(bins: CalibrationBin[]): string {
  const header =
    'bin_label,bin_lower,bin_upper,count,avg_p_predicted,avg_p_benchmark,calibration_error';
  const rows = bins.map(
    b =>
      `${b.bin_label},${b.bin_lower},${b.bin_upper},${b.count},${b.avg_p_predicted.toFixed(6)},${b.avg_p_benchmark.toFixed(6)},${b.calibration_error.toFixed(6)}`
  );
  return [header, ...rows].join('\n');
}
