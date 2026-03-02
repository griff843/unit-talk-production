/**
 * CCC Actions API Route
 * Sprint: CAPPER-COMMAND-CENTER-MVP-001
 *
 * POST /api/ccc/actions
 * Logs capper approve/reject/override actions
 *
 * SPEC CONFORMANCE:
 * - CAPPER_COMMAND_CENTER_SPEC_v1.0.md Section 8: Logging and Accountability
 * - Override requires reason
 * - Snapshot primitives at decision time
 */

import { NextResponse } from 'next/server';

import { RANKING_VERSION } from '@/lib/ccc/rankingEngine';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ActionRequest {
  legId: string;
  scoredLegId?: string;
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE';
  overrideReason?: string;
  actorId: string;
  actorName?: string;

  // Snapshot fields
  pFinal?: number;
  pMarketDevig?: number;
  edgeFinal?: number;
  uncertaintyFinal?: number;
  clvForecast?: number;
  booksUsed?: number;
  tier?: string;
  promotionBand?: string;
  rankPosition?: number;

  // Session metrics
  pageLoadAt?: string;
  firstActionLatencyMs?: number;
}

export async function POST(request: Request) {
  try {
    const body: ActionRequest = await request.json();

    // Validate required fields
    if (!body.legId || !body.action || !body.actorId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Missing required fields: legId, action, actorId',
        },
        { status: 400 }
      );
    }

    // Validate action type
    if (!['APPROVE', 'REJECT', 'OVERRIDE'].includes(body.action)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid action. Must be APPROVE, REJECT, or OVERRIDE',
        },
        { status: 400 }
      );
    }

    // Override requires reason (fail-closed)
    if (body.action === 'OVERRIDE' && !body.overrideReason) {
      return NextResponse.json(
        {
          error: 'OVERRIDE_REASON_REQUIRED',
          message: 'Override action requires a reason',
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Insert action record
    const { data, error } = await supabase
      .from('capper_actions')
      .insert({
        leg_id: body.legId,
        scored_leg_id: body.scoredLegId,
        action: body.action,
        override_reason: body.overrideReason,
        actor_id: body.actorId,
        actor_name: body.actorName,
        p_final: body.pFinal,
        p_market_devig: body.pMarketDevig,
        edge_final: body.edgeFinal,
        uncertainty_final: body.uncertaintyFinal,
        clv_forecast: body.clvForecast,
        books_used: body.booksUsed,
        tier: body.tier,
        promotion_band: body.promotionBand,
        rank_position: body.rankPosition,
        ranking_version: RANKING_VERSION,
        page_load_at: body.pageLoadAt,
        first_action_latency_ms: body.firstActionLatencyMs,
      })
      .select()
      .single();

    if (error) {
      console.error('[CCC] Failed to log action:', error.message);
      return NextResponse.json(
        {
          error: 'INSERT_FAILED',
          message: error.message,
        },
        { status: 500 }
      );
    }

    console.log(`[CCC] Action logged: ${body.action} on leg ${body.legId} by ${body.actorId}`);

    return NextResponse.json({
      success: true,
      actionId: data.id,
      action: body.action,
      legId: body.legId,
      timestamp: data.created_at,
    });
  } catch (err) {
    console.error('[CCC] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving action history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const legId = searchParams.get('leg_id');
    const actorId = searchParams.get('actor_id');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const supabase = createClient();

    let query = supabase
      .from('capper_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (legId) {
      query = query.eq('leg_id', legId);
    }
    if (actorId) {
      query = query.eq('actor_id', actorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CCC] Failed to fetch actions:', error.message);
      return NextResponse.json(
        {
          error: 'FETCH_FAILED',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      actions: data,
      count: data?.length ?? 0,
    });
  } catch (err) {
    console.error('[CCC] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
