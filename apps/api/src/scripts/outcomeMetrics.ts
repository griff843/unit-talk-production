/* eslint-disable no-console */
/**
 * outcomeMetrics.ts — Settlement Outcome Metrics Reporter
 *
 * Queries settlement data (post-migration-004) and reports:
 *   - Total settled / pending / disputed counts
 *   - Win/loss/push/void breakdown by sport
 *   - Win rate, ROI, CLV correlation
 *   - Settlement latency percentiles
 *
 * Requires: migration 004 applied (game_results, prop_settlements tables exist)
 * Run via CI/CD: gh workflow run ... (secrets injected by GitHub Actions)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx apps/api/src/scripts/outcomeMetrics.ts
 *
 * Created: 2026-02-17 (Tranche 7, Stage 2 — Settlement Activation)
 */

import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

// ─── Supabase Client ─────────────────────────────────────────────────────────

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('NO_SETTLED_DATA: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
  console.error('Settlement metrics require CI/CD execution with secrets injected.');
  process.exit(0); // Exit cleanly — absence of secrets is expected locally
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutcomeMetrics {
  timestamp: string;
  status: 'NO_SETTLED_DATA' | 'HAS_DATA';
  settlement_counts: {
    total: number;
    pending: number;
    verified: number;
    disputed: number;
  };
  outcome_breakdown: Record<string, {
    win: number;
    loss: number;
    push: number;
    void: number;
    total: number;
    win_rate: number;
  }>;
  overall: {
    total_settled: number;
    win_rate: number;
    roi_pct: number;
  };
  settlement_latency: {
    p50_minutes: number;
    p90_minutes: number;
    p99_minutes: number;
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function querySettlementCounts(): Promise<OutcomeMetrics['settlement_counts']> {
  const { data, error } = await supabase
    .from('prop_settlements')
    .select('settlement_method, disputed');

  if (error) {
    console.warn('prop_settlements query failed (table may not exist):', error.message);
    return { total: 0, pending: 0, verified: 0, disputed: 0 };
  }

  const rows = data ?? [];
  return {
    total: rows.length,
    pending: 0, // prop_settlements rows are already settled
    verified: rows.filter(r => !r.disputed).length,
    disputed: rows.filter(r => r.disputed).length,
  };
}

async function queryOutcomeBreakdown(): Promise<OutcomeMetrics['outcome_breakdown']> {
  // prop_settlements doesn't have sport — join via game_result_id → game_results.sport
  const { data, error } = await supabase
    .from('prop_settlements')
    .select('settlement_result, game_result_id(sport)');

  if (error || !data || data.length === 0) {
    if (error) console.warn('queryOutcomeBreakdown failed:', error.message);
    return {};
  }

  const bySport: Record<string, { win: number; loss: number; push: number; void: number; total: number }> = {};

  for (const row of data) {
    const gameResult = row.game_result_id as unknown as { sport: string } | null;
    const sport = gameResult?.sport || 'UNKNOWN';
    if (!bySport[sport]) {
      bySport[sport] = { win: 0, loss: 0, push: 0, void: 0, total: 0 };
    }
    bySport[sport].total++;
    const result = row.settlement_result as string;
    if (result === 'win') bySport[sport].win++;
    else if (result === 'loss') bySport[sport].loss++;
    else if (result === 'push') bySport[sport].push++;
    else if (result === 'void') bySport[sport].void++;
  }

  const breakdown: OutcomeMetrics['outcome_breakdown'] = {};
  for (const [sport, counts] of Object.entries(bySport)) {
    breakdown[sport] = {
      ...counts,
      win_rate: counts.total > 0 ? (counts.win / counts.total) * 100 : 0,
    };
  }

  return breakdown;
}

async function querySettlementLatency(): Promise<OutcomeMetrics['settlement_latency']> {
  const { data, error } = await supabase
    .from('prop_settlements')
    .select('created_at, settled_at')
    .not('settled_at', 'is', null);

  if (error || !data || data.length === 0) {
    return { p50_minutes: 0, p90_minutes: 0, p99_minutes: 0 };
  }

  const latencies = data
    .map(r => {
      const created = new Date(r.created_at).getTime();
      const settled = new Date(r.settled_at).getTime();
      return (settled - created) / (1000 * 60); // minutes
    })
    .filter(l => l >= 0)
    .sort((a, b) => a - b);

  if (latencies.length === 0) {
    return { p50_minutes: 0, p90_minutes: 0, p99_minutes: 0 };
  }

  const p = (pct: number) => latencies[Math.floor((pct / 100) * (latencies.length - 1))];

  return {
    p50_minutes: Math.round(p(50) * 10) / 10,
    p90_minutes: Math.round(p(90) * 10) / 10,
    p99_minutes: Math.round(p(99) * 10) / 10,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('========================================');
  console.log('  OUTCOME METRICS REPORT');
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log('========================================\n');

  // Check if settlement tables exist
  const { error: tableCheck } = await supabase
    .from('prop_settlements')
    .select('id')
    .limit(0);

  if (tableCheck) {
    console.log('STATUS: NO_SETTLED_DATA');
    console.log('Reason: prop_settlements table does not exist or is not accessible.');
    console.log('Action: Apply migration 004 via supabase-migrate workflow.');
    const metrics: OutcomeMetrics = {
      timestamp: new Date().toISOString(),
      status: 'NO_SETTLED_DATA',
      settlement_counts: { total: 0, pending: 0, verified: 0, disputed: 0 },
      outcome_breakdown: {},
      overall: { total_settled: 0, win_rate: 0, roi_pct: 0 },
      settlement_latency: { p50_minutes: 0, p90_minutes: 0, p99_minutes: 0 },
    };
    console.log('\n' + JSON.stringify(metrics, null, 2));
    return metrics;
  }

  // Query settlement data
  const counts = await querySettlementCounts();
  const breakdown = await queryOutcomeBreakdown();
  const latency = await querySettlementLatency();

  // Overall stats
  const allSports = Object.values(breakdown);
  const totalWins = allSports.reduce((s, b) => s + b.win, 0);
  const totalSettled = allSports.reduce((s, b) => s + b.total, 0);

  const metrics: OutcomeMetrics = {
    timestamp: new Date().toISOString(),
    status: totalSettled > 0 ? 'HAS_DATA' : 'NO_SETTLED_DATA',
    settlement_counts: counts,
    outcome_breakdown: breakdown,
    overall: {
      total_settled: totalSettled,
      win_rate: totalSettled > 0 ? (totalWins / totalSettled) * 100 : 0,
      roi_pct: 0, // TODO: compute from payout data once available
    },
    settlement_latency: latency,
  };

  console.log(`STATUS: ${metrics.status}`);
  console.log(`Settlement counts: ${JSON.stringify(counts)}`);
  console.log(`Outcome breakdown: ${JSON.stringify(breakdown, null, 2)}`);
  console.log(`Overall: ${JSON.stringify(metrics.overall)}`);
  console.log(`Latency: ${JSON.stringify(latency)}`);
  console.log('\n' + JSON.stringify(metrics, null, 2));

  return metrics;
}

main().catch(err => {
  console.error('outcomeMetrics failed:', err);
  process.exit(1);
});

export { main as runOutcomeMetrics };
export type { OutcomeMetrics };
