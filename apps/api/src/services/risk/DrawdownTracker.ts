/**
 * DrawdownTracker — Computes realized P&L drawdown from settled legs
 * Sprint: SPRINT-RISK-EXPOSURE-CORRELATION
 *
 * Queries ticket_legs with win/loss/push status within the lookback window
 * and computes drawdown as a fraction of bankroll.
 *
 * FAIL-CLOSED: Query errors propagate to RiskEngine (which blocks on any error).
 */

import type { DrawdownState, RiskEngineConfig } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Compute drawdown state from recently settled ticket legs.
 *
 * Returns frozen=true if daily realized loss exceeds threshold.
 */
export async function computeDrawdown(
  supabase: SupabaseClient,
  config: RiskEngineConfig
): Promise<DrawdownState> {
  const lookbackMs = config.drawdown_lookback_days * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs).toISOString();

  // Query settled ticket_legs within lookback window
  // Join to scored_legs for kelly_fraction (bet size proxy)
  const { data: rows, error } = await supabase
    .from('ticket_legs')
    .select(
      `
      id,
      leg_status,
      scored_legs (
        kelly_fraction,
        is_latest
      )
    `
    )
    .in('leg_status', ['win', 'loss', 'push'])
    .gte('created_at', since);

  if (error) {
    throw new Error(`DrawdownTracker query failed: ${error.message}`);
  }

  const legs = rows || [];

  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let realizedPnl = 0;

  for (const leg of legs) {
    const status = leg.leg_status as string;
    // Get the latest kelly_fraction for this leg
    const scoredLegs = (leg as any).scored_legs as Array<{
      kelly_fraction: number;
      is_latest: boolean;
    }> | null;
    const latestScore = scoredLegs?.find((s: any) => s.is_latest) ?? scoredLegs?.[0];
    const kelly = latestScore?.kelly_fraction ?? 0;

    if (status === 'win') {
      wins++;
      realizedPnl += kelly; // Simplified: win = +kelly units
    } else if (status === 'loss') {
      losses++;
      realizedPnl -= kelly; // Simplified: loss = -kelly units
    } else if (status === 'push') {
      pushes++;
      // Push = 0 P&L
    }
  }

  const settledCount = wins + losses + pushes;
  const drawdownFraction =
    config.bankroll_total > 0 ? Math.abs(Math.min(0, realizedPnl)) / config.bankroll_total : 0;

  const frozen = realizedPnl < 0 && drawdownFraction >= config.drawdown_freeze_threshold;

  return {
    realized_pnl: round(realizedPnl, 5),
    settled_count: settledCount,
    wins,
    losses,
    pushes,
    drawdown_fraction: round(drawdownFraction, 5),
    frozen,
    freeze_reason: frozen
      ? `Daily loss ${round(drawdownFraction * 100, 1)}% exceeds ${round(config.drawdown_freeze_threshold * 100, 1)}% threshold`
      : null,
    lookback_days: config.drawdown_lookback_days,
    computed_at: new Date().toISOString(),
  };
}

function round(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}
