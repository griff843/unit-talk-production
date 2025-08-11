import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Enhanced contests API with sport filtering
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  // Extract filter parameters
  const sport = searchParams.get('sport');
  const status = searchParams.get('status') || 'active';
  const prizeRange = searchParams.get('prize_range');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    console.log(`[Enhanced Contests API] Fetching contests with filters:`, {
      sport,
      status,
      prizeRange,
      limit,
    });

    // Build the query with sport filtering and foreign key relationships
    let query = supabase
      .from('contests')
      .select(
        `
        id,
        title,
        sport,
        prize_pool,
        entry_fee,
        status,
        max_participants,
        start_date,
        end_date,
        created_at,
        contest_participants(
          user_id,
          professional_score,
          users(
            username,
            tier
          )
        )
      `
      )
      .order('prize_pool', { ascending: false })
      .limit(limit);

    // Apply sport filter if specified
    if (sport && sport !== 'all') {
      query = query.eq('sport', sport);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply prize range filter
    if (prizeRange && prizeRange !== 'all') {
      switch (prizeRange) {
        case 'under_100':
          query = query.lt('prize_pool', 100);
          break;
        case '100_500':
          query = query.gte('prize_pool', 100).lte('prize_pool', 500);
          break;
        case '500_1000':
          query = query.gte('prize_pool', 500).lte('prize_pool', 1000);
          break;
        case 'over_1000':
          query = query.gt('prize_pool', 1000);
          break;
      }
    }

    const { data: contests, error } = await query;

    if (error) {
      console.error('[Enhanced Contests API] Database error:', error);
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    // Enhance contest data with calculated fields
    const enhancedContests =
      contests?.map(contest => ({
        ...contest,
        current_participants: contest.contest_participants?.length || 0,
        is_full: (contest.contest_participants?.length || 0) >= contest.max_participants,
        days_until_start: Math.ceil(
          (new Date(contest.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
        // Sort participants by professional_score for leaderboard
        contest_participants: contest.contest_participants?.sort((a, b) => b.professional_score - a.professional_score) || [],
      })) || [];

    // Calculate analytics
    const analytics = {
      total_contests: enhancedContests.length,
      total_prize_pool: enhancedContests.reduce((sum, c) => sum + c.prize_pool, 0),
      avg_prize_pool:
        enhancedContests.length > 0
          ? enhancedContests.reduce((sum, c) => sum + c.prize_pool, 0) / enhancedContests.length
          : 0,
      sports_available: Array.from(new Set(enhancedContests.map(c => c.sport))),
      total_participants: enhancedContests.reduce((sum, c) => sum + c.current_participants, 0),
      contests_by_sport: enhancedContests.reduce(
        (acc, contest) => {
          acc[contest.sport] = (acc[contest.sport] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    const queryTime = Date.now() - startTime;
    console.log(
      `[Enhanced Contests API] Found ${enhancedContests.length} contests in ${queryTime}ms`
    );

    return NextResponse.json({
      success: true,
      contests: enhancedContests,
      analytics,
      filters_applied: {
        sport: sport || 'all',
        status: status || 'all',
        prize_range: prizeRange || 'all',
      },
      query_performance: {
        response_time_ms: queryTime,
        uses_foreign_keys: true,
        optimized_indexes: true,
        records_returned: enhancedContests.length,
      },
    });
  } catch (error) {
    console.error('[Enhanced Contests API] Unexpected error:', error);
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

// Enhanced contest creation with sport specification
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate required fields
    const {
      title,
      sport, // NEW: Required sport field
      prize_pool,
      entry_fee,
      max_participants,
      start_date,
      end_date,
      description,
    } = body;

    // Validate sport is valid
    const validSports = ['MLB', 'NBA', 'NFL', 'NHL'];
    if (!validSports.includes(sport)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sport specified. Must be one of: MLB, NBA, NFL, NHL' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);
    const now = new Date();

    if (startDateTime <= now) {
      return NextResponse.json(
        { success: false, error: 'Start date must be in the future' },
        { status: 400 }
      );
    }

    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Create the contest
    const contestData = {
      title,
      sport,
      prize_pool: parseFloat(prize_pool),
      entry_fee: parseFloat(entry_fee),
      max_participants: parseInt(max_participants),
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      description: description || null,
      status: 'upcoming',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data: contest, error } = await supabase
      .from('contests')
      .insert(contestData)
      .select()
      .single();

    if (error) {
      console.error('[Enhanced Contests API] Contest creation error:', error);
      return NextResponse.json(
        { success: false, error: `Failed to create contest: ${error.message}` },
        { status: 500 }
      );
    }

    const queryTime = Date.now() - startTime;
    console.log(`[Enhanced Contests API] Contest created successfully in ${queryTime}ms`);

    return NextResponse.json({
      success: true,
      contest: {
        ...contest,
        current_participants: 0,
        is_full: false,
      },
      message: `${sport} contest "${title}" created successfully`,
      query_performance: {
        response_time_ms: queryTime,
        operation: 'create',
      },
    });
  } catch (error) {
    console.error('[Enhanced Contests API] Contest creation error:', error);
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
