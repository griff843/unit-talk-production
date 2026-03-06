/**
 * ROI Simulation Test
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 *
 * Simulates flat 1-unit betting on all scored markets.
 * Uses CLV as expected value proxy: per_bet_roi = clv_prob / p_open_devig.
 */

import type { JoinedScoringRecord, TestResult } from './types';

interface TierROI {
  count: number;
  net_units: number;
  roi_percent: number;
  avg_clv: number;
  positive_clv_rate: number;
}

export interface EquityCurvePoint {
  bet_number: number;
  cumulative_pnl: number;
}

export function runROISimulation(records: JoinedScoringRecord[]): TestResult {
  if (records.length === 0) {
    return {
      test_name: 'roi_simulation',
      verdict: 'FAIL',
      summary: 'No records for ROI simulation.',
      details: {},
      timestamp: new Date().toISOString(),
    };
  }

  // Compute per-bet ROI: p_close / p_open - 1
  const betROIs: number[] = [];
  for (const r of records) {
    if (r.p_open_devig <= 0 || r.p_open_devig >= 1) continue;
    const roi = r.p_close_devig / r.p_open_devig - 1;
    betROIs.push(roi);
  }

  const totalBets = betROIs.length;
  if (totalBets === 0) {
    return {
      test_name: 'roi_simulation',
      verdict: 'FAIL',
      summary: 'No valid bets after filtering.',
      details: {},
      timestamp: new Date().toISOString(),
    };
  }

  const netUnits = betROIs.reduce((s, v) => s + v, 0);
  const roiPercent = (netUnits / totalBets) * 100;
  const avgClv = records.reduce((s, r) => s + r.clv_prob, 0) / records.length;
  const positiveClvRate = records.filter(r => r.clv_prob > 0).length / records.length;

  // Max drawdown
  let peak = 0;
  let cumPnl = 0;
  let maxDrawdownUnits = 0;

  const equityCurve: EquityCurvePoint[] = [];

  for (let i = 0; i < betROIs.length; i++) {
    cumPnl += betROIs[i]!;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak - cumPnl;
    if (drawdown > maxDrawdownUnits) maxDrawdownUnits = drawdown;

    if (i % 10 === 0 || i === betROIs.length - 1) {
      equityCurve.push({ bet_number: i + 1, cumulative_pnl: round(cumPnl, 4) });
    }
  }

  const maxDrawdownPercent = totalBets > 0 ? (maxDrawdownUnits / totalBets) * 100 : 0;

  // Sharpe ratio
  const meanROI = netUnits / totalBets;
  const variance = betROIs.reduce((s, v) => s + (v - meanROI) ** 2, 0) / totalBets;
  const stdROI = Math.sqrt(variance);
  const sharpeRatio = stdROI > 0 ? (meanROI / stdROI) * Math.sqrt(totalBets) : 0;

  // ROI by tier
  const tierMap = new Map<string, { rois: number[]; clvs: number[] }>();
  for (const r of records) {
    const tier = r.tier || 'unknown';
    let entry = tierMap.get(tier);
    if (!entry) {
      entry = { rois: [], clvs: [] };
      tierMap.set(tier, entry);
    }
    if (r.p_open_devig > 0 && r.p_open_devig < 1) {
      entry.rois.push(r.p_close_devig / r.p_open_devig - 1);
    }
    entry.clvs.push(r.clv_prob);
  }

  const roiByTier: Record<string, TierROI> = {};
  for (const [tier, data] of tierMap) {
    const tNet = data.rois.reduce((s, v) => s + v, 0);
    const tCount = data.rois.length;
    roiByTier[tier] = {
      count: tCount,
      net_units: round(tNet, 4),
      roi_percent: tCount > 0 ? round((tNet / tCount) * 100, 3) : 0,
      avg_clv:
        data.clvs.length > 0
          ? round(data.clvs.reduce((s, v) => s + v, 0) / data.clvs.length, 6)
          : 0,
      positive_clv_rate:
        data.clvs.length > 0 ? round(data.clvs.filter(v => v > 0).length / data.clvs.length, 4) : 0,
    };
  }

  // Verdict
  let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
  if (roiPercent < -1) verdict = 'FAIL';
  else if (roiPercent < 0) verdict = 'WARN';

  return {
    test_name: 'roi_simulation',
    verdict,
    summary: `ROI: ${roiPercent.toFixed(3)}% | Net units: ${netUnits.toFixed(4)} | Bets: ${totalBets} | Sharpe: ${sharpeRatio.toFixed(3)} | Max DD: ${maxDrawdownUnits.toFixed(4)}`,
    details: {
      total_bets: totalBets,
      net_units: round(netUnits, 4),
      roi_percent: round(roiPercent, 3),
      avg_clv_per_bet: round(avgClv, 6),
      positive_clv_rate: round(positiveClvRate, 4),
      max_drawdown_units: round(maxDrawdownUnits, 4),
      max_drawdown_percent: round(maxDrawdownPercent, 3),
      sharpe_ratio: round(sharpeRatio, 3),
      roi_by_tier: roiByTier,
      equity_curve_sample: equityCurve,
      methodology:
        'Flat 1-unit bets. ROI = p_close_devig / p_open_devig - 1 (CLV-based expected value).',
    },
    timestamp: new Date().toISOString(),
  };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
