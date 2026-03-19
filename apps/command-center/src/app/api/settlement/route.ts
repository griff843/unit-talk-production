/**
 * Settlement Console API Route (UNIFIED-OPS-002 Step 2)
 *
 * GET  /api/settlement?limit=50&sport=NBA  — List unsettled picks
 * POST /api/settlement                     — Settle a pick via governed API lifecycle path
 *
 * UTRP-R3 DEFECT-34: POST previously called manual_settle_pick RPC directly (bypass).
 * Now routes through API /ops/picks/:id/settle-result with internal service token.
 * GET remains Supabase-direct (read-only, no lifecycle bypass).
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

function getApiBaseUrl(): string {
  return process.env.API_SERVICE_URL || 'http://localhost:3010';
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
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
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { pick_id, result, notes } = body;

    if (!pick_id) {
      return NextResponse.json({ success: false, error: 'pick_id is required' }, { status: 400 });
    }

    if (!result || !['win', 'loss', 'push'].includes(result)) {
      return NextResponse.json(
        { success: false, error: 'result must be one of: win, loss, push' },
        { status: 400 }
      );
    }

    // UTRP-R3 DEFECT-34: Route through governed API lifecycle path instead of direct RPC.
    // Uses internal service token so the API can enforce lifecycle control and single-writer.
    const serviceToken = process.env.INTERNAL_SERVICE_TOKEN || '';
    const apiResponse = await fetch(`${getApiBaseUrl()}/ops/picks/${pick_id}/settle-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service-Token': serviceToken,
      },
      body: JSON.stringify({ result, reason: notes || undefined }),
    });

    const apiResult = (await apiResponse.json()) as Record<string, unknown>;

    if (!apiResponse.ok || !apiResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: (apiResult.error as string) || 'Settlement rejected by API',
          details: apiResult,
        },
        { status: apiResponse.status || 422 }
      );
    }

    return NextResponse.json({
      success: true,
      ...apiResult,
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
