/**
 * @unit-talk/mcp-intelligence — adapters
 *
 * Pure computation (inlined from @unit-talk/intelligence to avoid module resolution
 * conflicts between node16 and bundler tsconfigs in the monorepo) +
 * Supabase queries + HTTP calls to risk API.
 */

import { createClient } from '@supabase/supabase-js';

import type {
  CalibrationResult,
  ClvResult,
  McpIntelligenceConfig,
  ShadowDivergenceResult,
} from '../schemas/index.js';

// ─── Inline math (derived from @unit-talk/intelligence, kept in sync) ─────────
//
// MATH DRIFT RISK — intentional temporary approximation:
//
// The canonical devigConsensus.ts (apps/api/src/lib/probability/devigConsensus.ts)
// accepts a full BookOffer { overOdds, underOdds } for each book and computes
// the overround exactly: overround = overImplied + underImplied - 1.
// It also applies per-book weighting by liquidity tier, book profile, and data quality.
//
// This MCP inline version:
//   - Accepts only a single odds value per book (one side only)
//   - Approximates the complementary side as: 1 - impliedOver + 0.02 (hardcoded 2% vig)
//   - Uses unweighted average across books
//
// The approximation is acceptable for markets with standard juice (-105 to -115)
// where vig is close to 2%. It diverges meaningfully for:
//   - Heavily juiced lines (e.g. -130/-105 → actual vig ~4.8%)
//   - Alternate spreads with irregular pricing
//   - Futures / outrights
//
// STATUS: Intentionally temporary. A future sprint should wire computeClv to accept
// the full BookOffer shape matching the canonical contract, or proxy to the API.
// Do not use this tool for production-grade edge calculations — use it for
// quick directional checks only.

function americanToImplied(odds: number): number {
  if (odds < 0) {
    return -odds / (-odds + 100);
  }
  return 100 / (odds + 100);
}

function proportionalDevig(over: number, under: number): { over: number; under: number } {
  const total = over + under;
  return { over: over / total, under: under / total };
}

function americanToDecimal(odds: number): number {
  if (odds < 0) return 1 + 100 / -odds;
  return 1 + odds / 100;
}

function fairProbToAmerican(prob: number): number {
  if (prob >= 0.5) return Math.round(-(prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}

function round(n: number, dp: number): number {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
}

// ─── CLV computation ──────────────────────────────────────────────────────────

export function computeClv(
  bookOffers: Array<{
    odds: number;
    book_profile?: 'retail' | 'market_maker' | 'sharp';
    liquidity_tier?: 'low' | 'medium' | 'high';
    data_quality?: 'good' | 'partial' | 'suspect';
  }>,
  devigMethod: 'proportional' | 'shin' | 'power' = 'proportional',
  closingOdds?: number
): ClvResult {
  if (bookOffers.length < 2) {
    throw new Error('At least 2 book offers required for consensus');
  }

  // Simple weighted average of devigged over-probabilities
  const devigged = bookOffers.map(o => {
    const impliedOver = americanToImplied(o.odds);
    // Assume symmetric book (over implied + under implied = 1 + vig)
    // Use proportional devig as default
    const impliedUnder = 1 - impliedOver + 0.02; // ~2% vig assumption
    const dv = proportionalDevig(impliedOver, impliedUnder);
    return dv.over;
  });

  const fairProbOver = round(devigged.reduce((a, b) => a + b, 0) / devigged.length, 4);
  const firstOdds = bookOffers[0]?.odds ?? 0;
  const decimalOdds = americanToDecimal(firstOdds);
  const ev = round(fairProbOver * (decimalOdds - 1) - (1 - fairProbOver), 4);

  let clvEstimate: number | null = null;
  if (closingOdds !== undefined) {
    const closingFair = americanToImplied(closingOdds);
    clvEstimate = round((fairProbOver - closingFair) * 100, 2);
  }

  return {
    consensus_fair_prob: fairProbOver,
    consensus_fair_odds: fairProbToAmerican(fairProbOver),
    edge_pct: round(ev * 100, 2),
    edge_positive: ev > 0,
    clv_estimate: clvEstimate,
    model_version: `inline-${devigMethod}`,
    computed_at: new Date().toISOString(),
  };
}

// ─── Calibration ──────────────────────────────────────────────────────────────

export function computeCalibration(
  predictions: Array<{ predicted_prob: number; actual_outcome: number }>,
  bucketWidth = 0.1
): CalibrationResult {
  const n = predictions.length;
  if (n === 0) throw new Error('No predictions provided');

  // Brier score
  const brier = round(
    predictions.reduce((s, p) => s + Math.pow(p.actual_outcome - p.predicted_prob, 2), 0) / n,
    4
  );

  // Log loss
  const EPS = 1e-7;
  const logLoss = round(
    -predictions.reduce((s, p) => {
      const prob = Math.max(EPS, Math.min(1 - EPS, p.predicted_prob));
      const y = p.actual_outcome;
      return s + y * Math.log(prob) + (1 - y) * Math.log(1 - prob);
    }, 0) / n,
    4
  );

  // Build reliability buckets
  const buckets: Array<{ lower: number; count: number; sumPred: number; sumOutcome: number }> = [];
  for (let lower = 0; lower < 1; lower = round(lower + bucketWidth, 4)) {
    buckets.push({ lower, count: 0, sumPred: 0, sumOutcome: 0 });
  }
  for (const p of predictions) {
    const idx = Math.min(Math.floor(p.predicted_prob / bucketWidth), buckets.length - 1);
    const b = buckets[idx];
    if (b) {
      b.count++;
      b.sumPred += p.predicted_prob;
      b.sumOutcome += p.actual_outcome;
    }
  }

  // ECE
  const ece = round(
    buckets.reduce((s, b) => {
      if (b.count === 0) return s;
      const avgPred = b.sumPred / b.count;
      const obsRate = b.sumOutcome / b.count;
      return s + (b.count / n) * Math.abs(avgPred - obsRate);
    }, 0),
    4
  );

  // MCE
  const mce = round(
    buckets.reduce((max, b) => {
      if (b.count === 0) return max;
      const avgPred = b.sumPred / b.count;
      const obsRate = b.sumOutcome / b.count;
      return Math.max(max, Math.abs(avgPred - obsRate));
    }, 0),
    4
  );

  let status: 'CALIBRATED' | 'DRIFT' | 'MISCALIBRATED';
  if (ece < 0.05 && brier < 0.25) {
    status = 'CALIBRATED';
  } else if (ece < 0.1 && brier < 0.3) {
    status = 'DRIFT';
  } else {
    status = 'MISCALIBRATED';
  }

  return {
    brier_score: brier,
    log_loss: logLoss,
    ece,
    mce,
    n_predictions: n,
    status,
    computed_at: new Date().toISOString(),
  };
}

// ─── Shadow divergence (Supabase) ────────────────────────────────────────────

interface DbShadowRun {
  id: string;
  divergence_detected: boolean | null;
  created_at: string;
}

export async function fetchShadowDivergence(
  config: McpIntelligenceConfig,
  windowDays: number
): Promise<ShadowDivergenceResult> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = supabase
    .from('shadow_scoring_runs')
    .select('id, divergence_detected, created_at')
    .gte('created_at', since.toISOString());

  const { data, error } = (await q) as {
    data: DbShadowRun[] | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const rows = data ?? [];
  const divergent = rows.filter(r => r.divergence_detected === true).length;

  return {
    window_days: windowDays,
    total_runs: rows.length,
    divergent_runs: divergent,
    divergence_rate_pct: rows.length > 0 ? round((divergent / rows.length) * 100, 2) : 0,
    queried_at: now.toISOString(),
  };
}

// ─── Risk metrics (HTTP) ──────────────────────────────────────────────────────
//
// Canonical endpoint: GET /api/risk/status
// Implemented in: apps/api/src/routes/risk.ts (router.get('/status'))
// Returns: { exposure: ExposureState, drift: DriftState, correlation: CorrelationState, drawdown: DrawdownState }
// Auth: No auth required on /api/risk/status (same pattern as /api/health/summary)

export async function fetchRiskMetrics(config: McpIntelligenceConfig): Promise<unknown> {
  const res = await fetch(`${config.apiBaseUrl}/api/risk/status`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from /api/risk/status: ${await res.text().catch(() => '')}`
    );
  }
  return res.json();
}
