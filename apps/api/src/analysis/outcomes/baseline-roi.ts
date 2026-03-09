/**
 * Baseline ROI Report — capstone outcome tracking module
 * Sprint: SPRINT-034 — Outcome Tracking Foundation
 * Issue: UNI-10 — Outcome tracking and baseline ROI
 *
 * Composes performance report, alpha evaluation, and loss attribution
 * into a single diagnostic report that answers:
 *   - Is the system profitable?
 *   - How well calibrated is the model?
 *   - Why are losses occurring?
 *   - What should be improved?
 */

import { computeAlphaEvaluation } from '../evaluation/alpha-evaluation';

import { summarizeLossAttributions } from './loss-attribution';
import { bridgeBatchToEvaluation } from './outcome-bridge';
import { generatePerformanceReport } from './performance-report';

import type { LossAttributionOutput, LossAttributionSummary } from './loss-attribution';
import type { ScoredOutcome, PerformanceReport } from './types';
import type { AlphaEvaluationReport } from '../evaluation/alpha-evaluation';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BaselineROIReport {
  report_version: string;
  generated_at: string;
  sample_size: number;

  /** Core performance: hit rate, ROI, breakdowns */
  performance: PerformanceReport;

  /** Alpha evaluation: Brier score, log loss, ECE, alpha buckets */
  alpha_evaluation: AlphaEvaluationReport;

  /** Loss attribution: category breakdown + actionable insights */
  loss_attribution: LossAttributionSummary;

  /** Summary diagnostics for quick consumption */
  diagnostics: {
    is_profitable: boolean;
    flat_bet_roi_pct: number;
    directional_accuracy_pct: number;
    brier_score: number;
    top_loss_category: string;
    recommendation: string;
  };
}

export type BaselineROIResult =
  | { ok: true; data: BaselineROIReport }
  | { ok: false; reason: string };

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * Generate a comprehensive baseline ROI report from scored outcomes
 * and loss attributions.
 */
export function generateBaselineROIReport(
  scoredOutcomes: ScoredOutcome[],
  lossAttributions: LossAttributionOutput[],
  options?: { sport?: string }
): BaselineROIResult {
  if (scoredOutcomes.length === 0) {
    return { ok: false, reason: 'No scored outcomes provided' };
  }

  // Performance report (hit rate, ROI, breakdowns)
  const performance = generatePerformanceReport(scoredOutcomes);

  // Bridge to EvaluationRecords for alpha evaluation
  const bridgeResult = bridgeBatchToEvaluation(scoredOutcomes, options);
  const alpha_evaluation = computeAlphaEvaluation(bridgeResult.records);

  // Loss attribution summary
  const loss_attribution = summarizeLossAttributions(lossAttributions);

  // Compose diagnostics
  const isProfitable = performance.overall.flat_bet_roi_pct > 0;
  const topCategory = loss_attribution.total_losses > 0 ? loss_attribution.top_category : 'N/A';

  const recommendation = deriveRecommendation(
    isProfitable,
    performance.overall.flat_bet_roi_pct,
    topCategory,
    loss_attribution,
    alpha_evaluation.brier_score
  );

  return {
    ok: true,
    data: {
      report_version: 'baseline-roi-v1.0',
      generated_at: new Date().toISOString(),
      sample_size: scoredOutcomes.length,
      performance,
      alpha_evaluation,
      loss_attribution,
      diagnostics: {
        is_profitable: isProfitable,
        flat_bet_roi_pct: performance.overall.flat_bet_roi_pct,
        directional_accuracy_pct: performance.overall.directional_accuracy_pct,
        brier_score: alpha_evaluation.brier_score,
        top_loss_category: topCategory,
        recommendation,
      },
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveRecommendation(
  isProfitable: boolean,
  roiPct: number,
  topCategory: string,
  lossAttribution: LossAttributionSummary,
  brierScore: number
): string {
  if (lossAttribution.total_losses === 0) {
    if (isProfitable)
      return 'Profitable with no tracked losses. Instrument loss attribution for deeper analysis.';
    return 'Not profitable. Instrument loss attribution for diagnosis.';
  }

  const topPct = lossAttribution.by_category[0]?.pct ?? 0;
  const prefix = isProfitable
    ? `Profitable (${roiPct > 0 ? '+' : ''}${roiPct.toFixed(1)}% ROI).`
    : `Unprofitable (${roiPct.toFixed(1)}% ROI).`;

  const brierNote = brierScore > 0.25 ? ' Model calibration is weak (Brier > 0.25).' : '';

  const categoryNote = ` Primary loss driver: ${topCategory} (${topPct.toFixed(0)}% of losses).`;

  const actionMap: Record<string, string> = {
    PROJECTION_MISS: ' Focus on improving stat projection accuracy.',
    PRICE_MISS: ' Focus on line timing and closing line capture.',
    VARIANCE: ' Losses are within expected variance — maintain course.',
    UNKNOWN: ' Improve feature snapshot instrumentation.',
  };

  const action = actionMap[topCategory] ?? '';

  return `${prefix}${brierNote}${categoryNote}${action}`;
}
