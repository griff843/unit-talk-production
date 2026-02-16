/**
 * Ops Recap API
 *
 * POST /api/ops-recap  { mode: 'daily' | 'weekly' | 'monthly' }
 * Generates recap summaries by querying settled picks for the time window.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const mode = body.mode as 'daily' | 'weekly' | 'monthly';

    if (!['daily', 'weekly', 'monthly'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'mode must be daily|weekly|monthly' },
        { status: 400 }
      );
    }

    const range = getDateRange(mode);
    const stats = await fetchSettledStats(client, range.start, range.end);

    return NextResponse.json({
      success: true,
      mode,
      date_range: { start: range.start, end: range.end },
      summary: buildSummary(stats),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(mode: string) {
  const end = new Date().toISOString().slice(0, 10);
  const d = new Date();
  if (mode === 'daily') d.setDate(d.getDate() - 1);
  else if (mode === 'weekly') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return { start: d.toISOString().slice(0, 10), end };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSettledStats(client: any, start: string, end: string) {
  const { data } = await client
    .from('unified_picks')
    .select('settlement_result')
    .eq('settlement_status', 'settled')
    .gte('settled_at', start)
    .lte('settled_at', end);

  const rows = data ?? [];
  const wins = rows.filter(
    (r: { settlement_result: string }) => r.settlement_result === 'win'
  ).length;
  const losses = rows.filter(
    (r: { settlement_result: string }) => r.settlement_result === 'loss'
  ).length;
  return { total: rows.length, wins, losses, pushes: rows.length - wins - losses };
}

function buildSummary(stats: { total: number; wins: number; losses: number; pushes: number }) {
  const decided = stats.wins + stats.losses;
  const winRate = decided > 0 ? stats.wins / decided : 0;

  let decision = 'HOLD';
  const reasons: string[] = [];
  if (winRate >= 0.55 && stats.total >= 5) {
    decision = 'PROMOTE';
    reasons.push(`Win rate ${(winRate * 100).toFixed(1)}% above threshold`);
  } else if (winRate < 0.45 && stats.total >= 5) {
    decision = 'DEMOTE';
    reasons.push(`Win rate ${(winRate * 100).toFixed(1)}% below threshold`);
  } else {
    reasons.push('Insufficient data or within hold range');
  }

  return {
    headline: {
      total_settled: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      win_rate: winRate,
    },
    decision: { decision, reasons },
  };
}
