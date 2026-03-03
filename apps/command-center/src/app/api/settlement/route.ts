/**
 * Settlement Console API Route (UNIFIED-OPS-002 Step 2)
 *
 * GET  /api/settlement?limit=50&sport=NBA  — List unsettled picks
 * POST /api/settlement                     — Settle a pick via manual_settle_pick RPC
 *
 * Uses the Command Center's Supabase client (anon key).
 * The RPC is SECURITY DEFINER so it runs with elevated privileges on the DB side.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Supabase client not available', picks: [] },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const sport = searchParams.get('sport');

    let query = client
      .from('unified_picks')
      .select(
        'id, player_name, stat_type, line, side, sport, odds, confidence, professional_score, promotion_band, bet_type, market, capper_id, created_at'
      )
      .or('settlement_status.is.null,settlement_status.eq.pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, picks: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      picks: data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        picks: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Supabase client not available' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { pick_id, result, actual_value, notes, operator } = body;

    if (!pick_id) {
      return NextResponse.json({ success: false, error: 'pick_id is required' }, { status: 400 });
    }

    if (!result || !['win', 'loss', 'push'].includes(result)) {
      return NextResponse.json(
        { success: false, error: 'result must be one of: win, loss, push' },
        { status: 400 }
      );
    }

    const { data, error } = await client.rpc('manual_settle_pick', {
      p_pick_id: pick_id,
      p_result: result,
      p_settled_at: new Date().toISOString(),
      p_meta: {
        actual_value: actual_value ?? 0,
        operator: operator || 'command-center',
        notes: notes || null,
        trace_id: `cc-settle-${Date.now()}`,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rpcResult = data as Record<string, unknown> | null;

    if (!rpcResult?.success) {
      return NextResponse.json(
        {
          success: false,
          error: (rpcResult?.error as string) || 'Settlement rejected',
          details: rpcResult,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      ...rpcResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
