import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface PromoBacklogRow {
  raw_prop_id: string;
  sport: string;
  pick_type: string;
  line: number;
  odds: number;
  tier: string;
  processed_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(
      { cookies },
      {
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    );

    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');
    const tier = searchParams.get('tier');
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    // Build query with optional filters
    let query = supabase
      .from('v_promo_backlog')
      .select(`
        raw_prop_id,
        sport,
        pick_type,
        line,
        odds,
        tier,
        processed_at
      `)
      .order('processed_at', { ascending: false })
      .limit(limit);

    // Apply filters if provided
    if (sport && sport !== 'all') {
      query = query.eq('sport', sport);
    }

    if (tier && tier !== 'all') {
      query = query.eq('tier', tier);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching promo backlog:', error);
      return NextResponse.json(
        { error: 'Failed to fetch promo backlog data' },
        { status: 500 }
      );
    }

    // Transform the data to ensure proper types
    const backlogData: PromoBacklogRow[] = (data || []).map(item => ({
      raw_prop_id: String(item.raw_prop_id || ''),
      sport: String(item.sport || ''),
      pick_type: String(item.pick_type || ''),
      line: Number(item.line) || 0,
      odds: Number(item.odds) || 0,
      tier: String(item.tier || ''),
      processed_at: String(item.processed_at || '')
    }));

    return NextResponse.json(backlogData, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Promo backlog API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}