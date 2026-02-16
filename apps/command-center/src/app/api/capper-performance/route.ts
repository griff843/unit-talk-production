/**
 * Capper Performance API
 *
 * GET /api/capper-performance
 *   ?capper_id=<uuid>   — optional: filter to one capper
 *   &window=10          — rolling window days (default 10)
 *
 * POST /api/capper-performance
 *   Admin-only MV refresh
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET — capper performance rollups
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const capperId = searchParams.get('capper_id');
    const window = parseInt(searchParams.get('window') || '10', 10);

    const cappers = await fetchCappers(client);
    const rollups = await fetchRollups(client, capperId, window, cappers.length);
    const streaks = await fetchStreaks(client, capperId);
    const summaries = buildSummaries(cappers, rollups, streaks, window);

    return NextResponse.json({
      success: true,
      window,
      capper_count: cappers.length,
      cappers: summaries,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST — admin MV refresh
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 503 });
    }
    const { error } = await client.rpc('refresh_capper_rollups');
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      message: 'MV refreshed',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : header;
  return supplied === token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCappers(client: any) {
  const { data, error } = await client
    .from('users')
    .select('id, username, active, tier, capper_tier')
    .eq('role', 'capper')
    .eq('active', true)
    .order('username', { ascending: true });
  if (error) throw new Error(`Cappers: ${error.message}`);
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRollups(
  client: any,
  capperId: string | null,
  window: number,
  capperCount: number
) {
  let q = client
    .from('mv_capper_daily_rollup')
    .select('capper_id, day, picks, wins, losses, pushes, units_wagered, units_profit, roi')
    .order('day', { ascending: false })
    .limit(window * (capperCount || 11));
  if (capperId) q = q.eq('capper_id', capperId);
  const { data } = await q;
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStreaks(client: any, capperId: string | null) {
  let q = client
    .from('v_capper_streaks')
    .select('capper_id, current_streak_type, current_streak_len');
  if (capperId) q = q.eq('capper_id', capperId);
  const { data } = await q;
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSummaries(cappers: any[], rollups: any[], streaks: any[], window: number) {
  return cappers.map(capper => {
    const cr = rollups.filter((r: { capper_id: string }) => r.capper_id === capper.id);
    const cs = streaks.find((s: { capper_id: string }) => s.capper_id === capper.id);
    const totals = aggregateRollups(cr);
    return {
      capper_id: capper.id,
      username: capper.username,
      tier: capper.tier,
      capper_tier: capper.capper_tier,
      active: capper.active,
      rolling_window_days: window,
      stats: totals,
      streak: cs ? { type: cs.current_streak_type, length: cs.current_streak_len } : null,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aggregateRollups(rows: any[]) {
  const p = rows.reduce((s, r) => s + (r.picks || 0), 0);
  const w = rows.reduce((s, r) => s + (r.wins || 0), 0);
  const l = rows.reduce((s, r) => s + (r.losses || 0), 0);
  const pu = rows.reduce((s, r) => s + (r.pushes || 0), 0);
  const wag = rows.reduce((s, r) => s + parseFloat(r.units_wagered || '0'), 0);
  const prof = rows.reduce((s, r) => s + parseFloat(r.units_profit || '0'), 0);
  const wr = p - pu > 0 ? (w / (p - pu)) * 100 : 0;
  const roi = wag > 0 ? (prof / wag) * 100 : 0;
  return {
    picks: p,
    wins: w,
    losses: l,
    pushes: pu,
    units_wagered: Math.round(wag * 100) / 100,
    units_profit: Math.round(prof * 100) / 100,
    win_rate: Math.round(wr * 10) / 10,
    roi: Math.round(roi * 10) / 10,
  };
}

function errorResponse(err: unknown) {
  return NextResponse.json(
    { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
    { status: 500 }
  );
}
