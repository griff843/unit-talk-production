/* eslint-disable no-console */
/**
 * generateRecap.ts -- Operator-grade daily/weekly recap from settled data.
 *
 * Usage (via Docker):
 *   docker exec unit-talk-api sh -c 'cd /app/apps/api && npx tsx src/scripts/recap/generateRecap.ts --mode=daily --date=2026-01-31'
 *   docker exec unit-talk-api sh -c 'cd /app/apps/api && npx tsx src/scripts/recap/generateRecap.ts --mode=weekly --week-ending=2026-02-02'
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

import { buildSummary, renderMarkdown } from './reportBuilder';

import type { DailySummary, IntegrityChecks, SettledPick } from './types';

// ─── Supabase Client ─────────────────────────────────────────────────────────

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CLI Args ────────────────────────────────────────────────────────────────

function parseArgs(): { mode: 'daily' | 'weekly'; date: string; weekEnding: string } {
  const args = process.argv.slice(2);
  let mode: 'daily' | 'weekly' = 'daily';
  let date = '';
  let weekEnding = '';

  for (const arg of args) {
    if (arg.startsWith('--mode=')) mode = arg.split('=')[1] as 'daily' | 'weekly';
    if (arg.startsWith('--date=')) date = arg.split('=')[1];
    if (arg.startsWith('--week-ending=')) weekEnding = arg.split('=')[1];
  }

  if (!date) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split('T')[0];
  }
  if (!weekEnding) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    weekEnding = d.toISOString().split('T')[0];
  }

  return { mode, date, weekEnding };
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

export async function fetchSettledPicks(
  startDate: string,
  endDate: string
): Promise<SettledPick[]> {
  const { data, error } = await supabase
    .from('unified_picks')
    .select(
      'id, sport, promotion_band, settlement_status, settlement_result, actual_outcome, odds, confidence, professional_score, bet_type, market, line, side, created_at, settled_at, capper_id, payout_amount'
    )
    .eq('settlement_status', 'settled')
    .gte('settled_at', `${startDate}T00:00:00Z`)
    .lte('settled_at', `${endDate}T23:59:59Z`)
    .order('settled_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch settled picks:', error.message);
    return [];
  }
  return (data ?? []) as SettledPick[];
}

async function fetchMissingSettlements(pickIds: string[]): Promise<number> {
  if (pickIds.length === 0) return 0;
  const { data } = await supabase
    .from('prop_settlements')
    .select('final_pick_id')
    .in('final_pick_id', pickIds);
  const settledIds = new Set((data ?? []).map(s => s.final_pick_id));
  return pickIds.filter(id => !settledIds.has(id)).length;
}

export async function fetchIntegrity(startDate: string, endDate: string): Promise<IntegrityChecks> {
  const dateFilter = {
    gte: `${startDate}T00:00:00Z`,
    lte: `${endDate}T23:59:59Z`,
  };

  const { data: bandedPicks } = await supabase
    .from('unified_picks')
    .select('id')
    .eq('settlement_status', 'settled')
    .gte('settled_at', dateFilter.gte)
    .lte('settled_at', dateFilter.lte);

  const pickIds = (bandedPicks ?? []).map(p => p.id);
  const safeIds = pickIds.length > 0 ? pickIds : ['__none__'];

  const missingSettlements = await fetchMissingSettlements(pickIds);

  const { data: noGameResult } = await supabase
    .from('prop_settlements')
    .select('id')
    .in('final_pick_id', safeIds)
    .is('game_result_id', null);

  const { data: nullResults } = await supabase
    .from('unified_picks')
    .select('id')
    .eq('settlement_status', 'settled')
    .gte('settled_at', dateFilter.gte)
    .lte('settled_at', dateFilter.lte)
    .is('settlement_result', null);

  const { data: nullBands } = await supabase
    .from('unified_picks')
    .select('id')
    .eq('settlement_status', 'settled')
    .gte('settled_at', dateFilter.gte)
    .lte('settled_at', dateFilter.lte)
    .is('promotion_band', null);

  return {
    missing_settlements: missingSettlements,
    missing_results: (noGameResult ?? []).length,
    null_settlement_result: (nullResults ?? []).length,
    null_promotion_band: (nullBands ?? []).length,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeDateRange(mode: string, date: string, weekEnding: string) {
  if (mode === 'weekly') {
    const endDate = new Date(weekEnding + 'T00:00:00Z');
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    return { dateStart: startDate.toISOString().split('T')[0], dateEnd: weekEnding };
  }
  return { dateStart: date, dateEnd: date };
}

function emptySummary(dateStart: string, dateEnd: string): DailySummary {
  return {
    timestamp: new Date().toISOString(),
    date_range: { start: dateStart, end: dateEnd },
    headline: {
      total_settled: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      win_rate: 0,
      net_units: null,
      net_units_note: 'No data',
    },
    by_band: {},
    by_confidence: [],
    promoted_vs_rejected: {
      promoted: { count: 0, win_rate: 0, avg_score: null },
      rejected: { count: 0, win_rate: 0, avg_score: null },
      delta_win_rate: 0,
      delta_avg_score: null,
    },
    integrity: {
      missing_settlements: 0,
      missing_results: 0,
      null_settlement_result: 0,
      null_promotion_band: 0,
    },
    decision: {
      decision: 'HOLD',
      reasons: ['No settled data in date range'],
      metrics: {
        settled_total: 0,
        promoted_total: 0,
        promoted_win_rate: 0,
        rejected_win_rate: 0,
        hard_win_rate: 0,
        hard_count: 0,
        delta: 0,
        integrity_ok: true,
      },
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, date, weekEnding } = parseArgs();
  const { dateStart, dateEnd } = computeDateRange(mode, date, weekEnding);

  console.error(`[recap] Mode: ${mode}`);
  console.error(`[recap] Date range: ${dateStart} to ${dateEnd}`);

  const picks = await fetchSettledPicks(dateStart, dateEnd);
  console.error(`[recap] Fetched ${picks.length} settled picks`);

  if (picks.length === 0) {
    console.error('[recap] No settled picks in date range.');
    console.log(JSON.stringify(emptySummary(dateStart, dateEnd), null, 2));
    return;
  }

  if (mode === 'weekly' && picks.length < 20) {
    console.error(`[recap] Weekly requires >= 20 picks, got ${picks.length}. Skipping.`);
    const skip = {
      skipped: true,
      reason: `Only ${picks.length} picks (< 20)`,
      date_range: { start: dateStart, end: dateEnd },
    };
    console.log(JSON.stringify(skip, null, 2));
    return;
  }

  const integrity = await fetchIntegrity(dateStart, dateEnd);
  const summary = buildSummary(picks, integrity, dateStart, dateEnd);
  console.log(JSON.stringify(summary, null, 2));
  console.error('\n' + renderMarkdown(summary, mode === 'weekly'));
}

// ─── Callable API for operator endpoints (UNIFIED-OPS-002) ───────────────────

export interface RecapReportOptions {
  mode: 'daily' | 'weekly' | 'monthly';
  date?: string;
  weekEnding?: string;
}

/**
 * Generate recap report programmatically (no CLI args needed).
 * Used by /ops/recap endpoint and RecapAgent activities.
 */
export async function generateRecapReport(options: RecapReportOptions): Promise<{
  summary: DailySummary;
  markdown: string;
  picks_count: number;
  date_range: { start: string; end: string };
}> {
  const { mode } = options;

  // Determine date range
  let date = options.date || '';
  let weekEnding = options.weekEnding || '';

  if (!date) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split('T')[0];
  }
  if (!weekEnding) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    weekEnding = d.toISOString().split('T')[0];
  }

  // Monthly: use 1st to last day of previous month
  let dateStart: string;
  let dateEnd: string;

  if (mode === 'monthly') {
    const now = new Date();
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    dateStart = firstOfPrevMonth.toISOString().split('T')[0];
    dateEnd = lastOfPrevMonth.toISOString().split('T')[0];
  } else {
    const range = computeDateRange(mode, date, weekEnding);
    dateStart = range.dateStart;
    dateEnd = range.dateEnd;
  }

  const picks = await fetchSettledPicks(dateStart, dateEnd);

  if (picks.length === 0) {
    const summary = emptySummary(dateStart, dateEnd);
    return {
      summary,
      markdown: renderMarkdown(summary, mode === 'weekly'),
      picks_count: 0,
      date_range: { start: dateStart, end: dateEnd },
    };
  }

  const integrity = await fetchIntegrity(dateStart, dateEnd);
  const summary = buildSummary(picks, integrity, dateStart, dateEnd);
  const markdown = renderMarkdown(summary, mode === 'weekly');

  return {
    summary,
    markdown,
    picks_count: picks.length,
    date_range: { start: dateStart, end: dateEnd },
  };
}

// ─── CLI entrypoint ─────────────────────────────────────────────────────────

if (require.main === module) {
  main().catch(err => {
    console.error('generateRecap failed:', err);
    process.exit(1);
  });
}

export { main as runRecap, buildSummary, renderMarkdown };
