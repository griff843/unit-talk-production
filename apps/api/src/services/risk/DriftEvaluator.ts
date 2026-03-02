/* eslint-disable no-console, max-lines-per-function */
/**
 * DriftEvaluator — Computes model calibration drift from settled scored legs
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Since no model_calibration_metrics table exists, drift is computed on-the-fly
 * from settled legs: legs where leg_status IN ('win','loss') and p_final IS NOT NULL.
 *
 * Metrics:
 * - Brier score: mean((p_final - outcome)^2) where outcome=1 for win, 0 for loss
 * - Calibration gap: |mean(p_final) - actual_win_rate|
 */

import type { DriftState, RiskEngineConfig } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Evaluate model calibration drift from recently settled scored legs.
 */
export async function evaluateDrift(
  supabase: SupabaseClient,
  config: RiskEngineConfig
): Promise<DriftState> {
  // Query settled legs with probability data from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: rows, error } = await supabase
    .from('scored_legs')
    .select(
      `
      p_final,
      ticket_legs!inner (
        leg_status,
        settled_at
      )
    `
    )
    .eq('is_latest', true)
    .not('p_final', 'is', null);

  if (error) {
    throw new Error(`DriftEvaluator query failed: ${error.message}`);
  }

  // Filter to settled legs within window
  const settledRows = (rows || []).filter((r: any) => {
    const legStatus = r.ticket_legs?.leg_status;
    const settledAt = r.ticket_legs?.settled_at;
    if (legStatus !== 'win' && legStatus !== 'loss') return false;
    if (!settledAt) return false;
    return new Date(settledAt) >= sevenDaysAgo;
  });

  const sampleSize = settledRows.length;
  const sufficientData = sampleSize >= config.drift_min_settled;

  if (sampleSize === 0) {
    return {
      global_brier: null,
      calibration_gap: null,
      win_rate_actual: null,
      win_rate_predicted: null,
      sample_size: 0,
      sufficient_data: false,
      blocked: false,
      computed_at: new Date().toISOString(),
    };
  }

  // Compute Brier score and calibration gap
  let brierSum = 0;
  let pFinalSum = 0;
  let wins = 0;

  for (const row of settledRows) {
    const pFinal = Number((row as any).p_final);
    const outcome = (row as any).ticket_legs?.leg_status === 'win' ? 1 : 0;

    brierSum += (pFinal - outcome) ** 2;
    pFinalSum += pFinal;
    wins += outcome;
  }

  const brierScore = brierSum / sampleSize;
  const winRateActual = wins / sampleSize;
  const winRatePredicted = pFinalSum / sampleSize;
  const calibrationGap = Math.abs(winRateActual - winRatePredicted);

  // Determine if drift is blocking
  const blocked = sufficientData && brierScore > config.drift_brier_block;

  return {
    global_brier: round(brierScore, 6),
    calibration_gap: round(calibrationGap, 6),
    win_rate_actual: round(winRateActual, 6),
    win_rate_predicted: round(winRatePredicted, 6),
    sample_size: sampleSize,
    sufficient_data: sufficientData,
    blocked,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Record a drift snapshot to the database for audit trail.
 */
export async function recordDriftSnapshot(
  supabase: SupabaseClient,
  drift: DriftState,
  config: RiskEngineConfig
): Promise<void> {
  const { error } = await supabase.from('drift_snapshots').insert({
    computed_at: drift.computed_at,
    sample_size: drift.sample_size,
    brier_score: drift.global_brier,
    win_rate_actual: drift.win_rate_actual,
    win_rate_predicted: drift.win_rate_predicted,
    calibration_gap: drift.calibration_gap,
    is_blocked: drift.blocked,
    config_at_compute: config,
  });

  if (error) {
    // Non-fatal: log but don't throw. Drift snapshot recording failure
    // should not block the risk decision itself.
    console.error('[DriftEvaluator] Failed to record snapshot:', error.message);
  }
}

function round(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}
