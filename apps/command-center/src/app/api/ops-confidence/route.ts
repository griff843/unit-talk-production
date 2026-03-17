/**
 * Ops Confidence API
 *
 * GET /api/ops-confidence — read-only operational confidence indicators
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 503 });
    }

    const [lastSettled, unsettled, latestRollup, settledToday, totalSettled] = await Promise.all([
      fetchLastSettled(client),
      fetchCount(client, 'neq'),
      fetchLatestRollup(client),
      fetchSettledToday(client),
      fetchCount(client, 'eq'),
    ]);

    const result = computeConfidence({
      lastSettleAt: lastSettled,
      unsettledCount: unsettled,
      mvDay: latestRollup,
      settledTodayCount: settledToday,
      totalSettledCount: totalSettled,
    });
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLastSettled(client: any) {
  const { data } = await client
    .from('unified_picks')
    .select('settled_at')
    .eq('settlement_status', 'settled')
    .not('settled_at', 'is', null)
    .order('settled_at', { ascending: false })
    .limit(1)
    .single();
  return data?.settled_at ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCount(client: any, op: 'eq' | 'neq') {
  let q = client.from('unified_picks').select('id', { count: 'exact', head: true });
  q =
    op === 'eq'
      ? q.eq('settlement_status', 'settled')
      : q.neq('settlement_status', 'settled').not('settlement_status', 'is', null);
  const { count } = await q;
  return count ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLatestRollup(client: any) {
  const { data } = await client
    .from('mv_capper_daily_rollup')
    .select('day')
    .order('day', { ascending: false })
    .limit(1)
    .single();
  return data?.day ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSettledToday(client: any) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await client
    .from('unified_picks')
    .select('id', { count: 'exact', head: true })
    .eq('settlement_status', 'settled')
    .gte('settled_at', start.toISOString());
  return count ?? 0;
}

interface ConfidenceInput {
  lastSettleAt: string | null;
  unsettledCount: number;
  mvDay: string | null;
  settledTodayCount: number;
  totalSettledCount: number;
}

function resolveLevel(hoursSince: number, daysSinceMv: number): 'high' | 'medium' | 'low' {
  if (hoursSince < 24 && daysSinceMv <= 1) return 'high';
  if (hoursSince < 72 && daysSinceMv <= 3) return 'medium';
  return 'low';
}

function computeConfidence(input: ConfidenceInput) {
  const { lastSettleAt, unsettledCount, mvDay, settledTodayCount, totalSettledCount } = input;
  const lastTime = lastSettleAt ? new Date(lastSettleAt).getTime() : 0;
  const hoursSince = lastTime ? (Date.now() - lastTime) / 3_600_000 : Infinity;
  const mvDate = mvDay ? new Date(mvDay) : null;
  const daysSinceMv = mvDate ? Math.floor((Date.now() - mvDate.getTime()) / 86_400_000) : Infinity;

  return {
    confidence: resolveLevel(hoursSince, daysSinceMv),
    last_settle: lastSettleAt,
    hours_since_settle: lastTime ? Math.round(hoursSince * 10) / 10 : null,
    unsettled_count: unsettledCount,
    settled_today: settledTodayCount,
    total_settled: totalSettledCount,
    mv_latest_day: mvDay,
    days_since_mv_refresh: mvDate ? daysSinceMv : null,
  };
}
