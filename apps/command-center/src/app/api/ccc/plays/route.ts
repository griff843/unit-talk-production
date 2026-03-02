/**
 * CCC Plays API Route
 * Sprint: CAPPER-COMMAND-CENTER-MVP-001
 *
 * GET /api/ccc/plays
 * Returns ranked plays with elimination counts
 *
 * SPEC CONFORMANCE:
 * - Server-side filtering and ranking (no browser-side ranking)
 * - Fail-closed behavior
 * - Returns minimal payload for UI
 */

import { NextResponse } from 'next/server';

import {
  processPlays,
  DEFAULT_GATE_CONFIG,
  type ScoredLegInput,
  type GateConfig,
} from '@/lib/ccc/rankingEngine';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse optional config overrides from query params
    const config: GateConfig = {
      EDGE_MIN: parseFloat(searchParams.get('edge_min') ?? '') || DEFAULT_GATE_CONFIG.EDGE_MIN,
      U_MAX: parseFloat(searchParams.get('u_max') ?? '') || DEFAULT_GATE_CONFIG.U_MAX,
      CLV_GATE_ENABLED:
        searchParams.get('clv_gate') === 'true' || DEFAULT_GATE_CONFIG.CLV_GATE_ENABLED,
      MIN_BOOKS: parseInt(searchParams.get('min_books') ?? '', 10) || DEFAULT_GATE_CONFIG.MIN_BOOKS,
    };

    const topN = parseInt(searchParams.get('top') ?? '', 10) || 10;

    // Get Supabase client
    const supabase = createClient();

    // Fetch from view_scored_legs_latest with probability fields
    const { data: legs, error } = await supabase
      .from('view_scored_legs_latest')
      .select(
        `
        scored_leg_id,
        leg_id,
        ticket_id,
        bet_slip_id,
        selection,
        provider_line,
        provider_odds,
        provider,
        leg_status,
        ticket_status,
        model_name,
        model_version,
        edge_score,
        confidence_score,
        tier,
        promotion_band,
        kelly_fraction,
        expected_value,
        p_final,
        uncertainty_final,
        edge_final,
        clv_forecast,
        p_market_devig,
        devig_method,
        consensus_weights_json,
        probability_model_version
      `
      )
      .order('computed_at', { ascending: false })
      .limit(500); // Fetch more than topN to allow for filtering

    if (error) {
      console.error('[CCC] Failed to fetch scored legs:', error.message);
      return NextResponse.json(
        {
          error: 'FETCH_FAILED',
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!legs || legs.length === 0) {
      // Return empty response with zero elimination (expected if no data)
      return NextResponse.json({
        plays: [],
        eliminationBanner: {
          totalRemoved: 0,
          removedByReason: {
            MISSING_PRIMITIVE: 0,
            INSUFFICIENT_BOOKS: 0,
            HIGH_UNCERTAINTY: 0,
            LOW_EDGE: 0,
            NEGATIVE_CLV: 0,
          },
        },
        configUsed: {
          ...config,
          RANKING_VERSION: 'ccc_rank_v1.0.0',
        },
        timestamp: new Date().toISOString(),
        message: 'No scored legs found in view_scored_legs_latest',
      });
    }

    // Process through ranking engine
    const response = processPlays(legs as ScoredLegInput[], config, topN);

    console.log(
      `[CCC] Processed ${legs.length} legs: ${response.plays.length} eligible, ${response.eliminationBanner.totalRemoved} eliminated`
    );

    return NextResponse.json(response);
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
