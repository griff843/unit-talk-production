export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface RecentPromotionRow {
  unified_pick_id: string;
  promoted_at: string;
  pick_source: string;
  prop_id: string;
  sport: string;
  pick_type: string;
  selection: string;
  line: number;
  odds: number;
  tier_when_placed: string;
  promotion_status: string;
  game_start_time: string;
  processed_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(
      { cookies },
      {
        supabaseKey: process.env['SUPABASE_SERVICE_ROLE_KEY']
      }
    );

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    const { data, error } = await supabase
      .from('v_recent_promotions_24h')
      .select(`
        unified_pick_id,
        promoted_at,
        pick_source,
        prop_id,
        sport,
        pick_type,
        selection,
        line,
        odds,
        tier_when_placed,
        promotion_status,
        game_start_time,
        processed_at
      `)
      .order('promoted_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent promotions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recent promotions data' },
        { status: 500 }
      );
    }

    // Transform the data to ensure proper types
    const promotionsData: RecentPromotionRow[] = (data || []).map(item => ({
      unified_pick_id: String(item.unified_pick_id || ''),
      promoted_at: String(item.promoted_at || ''),
      pick_source: String(item.pick_source || ''),
      prop_id: String(item.prop_id || ''),
      sport: String(item.sport || ''),
      pick_type: String(item.pick_type || ''),
      selection: String(item.selection || ''),
      line: Number(item.line) || 0,
      odds: Number(item.odds) || 0,
      tier_when_placed: String(item.tier_when_placed || ''),
      promotion_status: String(item.promotion_status || ''),
      game_start_time: String(item.game_start_time || ''),
      processed_at: String(item.processed_at || '')
    }));

    return NextResponse.json(promotionsData, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Recent promotions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}