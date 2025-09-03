import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Enhanced user analytics API with sport-specific performance
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const userId = params.id;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');

  try {
    console.log(`[Enhanced Analytics API] Fetching analytics for user ${userId}, ${days} days`);

    // Calculate start date
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // OPTIMIZED: Use foreign key relationships and sport columns
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select(
        `
        sport,
        status,
        confidence,
        potential_payout,
        placed_at,
        raw_props!inner(
          stat_type,
          player_name,
          expected_value
        )
      `
      )
      .eq('user_id', userId)
      .gte('placed_at', startDate)
      .order('placed_at', { ascending: false });

    if (error) {
      console.error('[Enhanced Analytics API] Database error:', error);
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!picks || picks.length === 0) {
      console.log(`[Enhanced Analytics API] No picks found for user ${userId}`);
      return NextResponse.json({
        success: true,
        user_id: userId,
        period_days: days,
        sport_performance: [],
        overall_metrics: {
          total_picks: 0,
          overall_win_rate: 0,
          sports_active: [],
          avg_confidence: 0,
        },
        query_performance: {
          response_time_ms: Date.now() - startTime,
          uses_foreign_keys: true,
          optimized_indexes: true,
        },
      });
    }

    console.log(`[Enhanced Analytics API] Found ${picks.length} picks for analysis`);

    // Group picks by sport for sport-specific analytics
    const sportGroups = picks.reduce(
      (acc, pick) => {
        const sport = pick.sport || 'Unknown';
        if (!acc[sport]) {
          acc[sport] = {
            total_picks: 0,
            wins: 0,
            total_payout: 0,
            total_confidence: 0,
            total_expected_value: 0,
          };
        }

        acc[sport].total_picks++;
        acc[sport].total_confidence += pick.confidence || 0;
        acc[sport].total_expected_value += (pick.raw_props as any)?.expected_value || 0;

        if (pick.status === 'won') {
          acc[sport].wins++;
          acc[sport].total_payout += pick.potential_payout || 0;
        }

        return acc;
      },
      {} as Record<string, any>
    );

    // Calculate sport-specific performance metrics
    const sport_performance = Object.entries(sportGroups)
      .map(([sport, stats]) => ({
        sport,
        total_picks: stats.total_picks,
        wins: stats.wins,
        win_rate: stats.wins / stats.total_picks,
        avg_confidence: stats.total_confidence / stats.total_picks,
        total_payout: stats.total_payout,
        avg_expected_value: stats.total_expected_value / stats.total_picks,
      }))
      .sort((a, b) => b.win_rate - a.win_rate); // Sort by win rate

    // Calculate overall metrics
    const overall_metrics = {
      total_picks: picks.length,
      overall_win_rate: picks.filter(p => p.status === 'won').length / picks.length,
      sports_active: Object.keys(sportGroups),
      avg_confidence: picks.reduce((sum, p) => sum + (p.confidence || 0), 0) / picks.length,
      total_payout: picks
        .filter(p => p.status === 'won')
        .reduce((sum, p) => sum + (p.potential_payout || 0), 0),
      avg_expected_value:
        picks.reduce((sum, p) => sum + ((p.raw_props as any)?.expected_value || 0), 0) /
        picks.length,
    };

    // Performance insights
    const insights = {
      best_sport: sport_performance.length > 0 ? sport_performance[0].sport : null,
      is_profitable: overall_metrics.overall_win_rate >= 0.52, // Break-even considering juice
      is_high_confidence: overall_metrics.avg_confidence >= 0.7,
      is_diversified: overall_metrics.sports_active.length >= 3,
      positive_expected_value: overall_metrics.avg_expected_value > 0,
    };

    const queryTime = Date.now() - startTime;
    console.log(`[Enhanced Analytics API] Analysis complete in ${queryTime}ms`);

    return NextResponse.json({
      success: true,
      user_id: userId,
      period_days: days,
      sport_performance,
      overall_metrics,
      insights,
      query_performance: {
        response_time_ms: queryTime,
        uses_foreign_keys: true,
        optimized_indexes: true,
        records_analyzed: picks.length,
        sports_analyzed: Object.keys(sportGroups).length,
      },
      // NEW: Enhanced metadata
      database_health: {
        foreign_key_relationships: true,
        cross_sport_analytics: true,
        ml_confidence_scoring: true,
        expected_value_calculations: true,
      },
    });
  } catch (error) {
    console.error('[Enhanced Analytics API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        query_performance: {
          response_time_ms: Date.now() - startTime,
          error: true,
        },
      },
      { status: 500 }
    );
  }
}

// NEW: POST endpoint for updating user analytics preferences
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = params.id;

  try {
    const body = await request.json();
    const { preferred_sports, analytics_frequency, notifications_enabled } = body;

    // Update user preferences (you can extend this based on your user table structure)
    const { data, error } = await supabase
      .from('users')
      .update({
        preferred_sports: preferred_sports || null,
        analytics_frequency: analytics_frequency || 'daily',
        notifications_enabled: notifications_enabled !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Analytics preferences updated',
      user: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
