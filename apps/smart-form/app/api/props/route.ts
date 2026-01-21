import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { 
  createRouteLogger, 
  logDatabaseOperation, 
  logApiPerformance,
  logValidationError 
} from '@/lib/logger';

const log = createRouteLogger('GET /api/props', 'GET');

// Validation schema for query parameters
const QuerySchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
  team_id: z.string().uuid().nullish(),
  player_id: z.string().uuid().nullish(),
  game_id: z.string().uuid().nullish(),
});


export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport') || 'NFL',
      team_id: searchParams.get('team_id'),
      player_id: searchParams.get('player_id'),
      game_id: searchParams.get('game_id'),
    };

    // Validate query parameters
    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      logValidationError(log, queryValidation.error.errors, rawQuery);
      
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      }, { status: 400 });
    }

    const { sport, team_id, player_id, game_id } = queryValidation.data;

    log.info({
      query: { sport, team_id, player_id, game_id },
    }, `Fetching ${sport} props`);

    const supabase = supabaseServer();

    try {
      // Build query with sport-scoped filtering
      let query = supabase
        .from('raw_props')
        .select(`
          id,
          game_id,
          external_game_id,
          player_name,
          team_id,
          player_id,
          team,
          opponent,
          stat_type,
          market_type,
          line,
          over_odds,
          under_odds,
          odds,
          confidence,
          expected_value,
          provider,
          sport,
          game_time
        `)
        .eq('sport', sport)
        .not('odds', 'is', null)
        .not('line', 'is', null);

      // Add filters based on parameters
      if (team_id) {
        query = query.eq('team_id', team_id);
      }
      
      if (player_id) {
        query = query.eq('player_id', player_id);
      }
      
      if (game_id) {
        query = query.or(`game_id.eq.${game_id},external_game_id.eq.${game_id}`);
      }

      query = query
        .order('confidence', { ascending: false })
        .order('player_name')
        .order('stat_type')
        .limit(100); // Prevent excessive results

      const { data: dbProps, error } = await query;

      logDatabaseOperation(log, 'SELECT', 'raw_props', dbProps, error);

      if (error && error.code !== '42P01') {
        // Real error, not just missing table
        log.error({
          error: error.message,
          code: error.code,
          sport,
          filters: { team_id, player_id, game_id },
        }, 'Database error fetching props');
        
        return NextResponse.json({
          error: 'Failed to fetch props',
          message: error.message,
        }, { status: 500 });
      }

      if (dbProps && dbProps.length > 0) {
        log.info({
          props_found: dbProps.length,
          sport,
          filters: { team_id, player_id, game_id },
        }, `Found ${dbProps.length} props in database`);

        // Transform props with enhanced analytics data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedProps = (dbProps as any[]).map(prop => {
          const propType = prop.stat_type || 'Unknown Prop';
          const playerName = prop.player_name || 'Unknown Player';
          const team = prop.team || 'UNK';
          const line = prop.line || 0;

          // Handle different odds field structures
          const overOdds = prop.over_odds || prop.odds || -110;
          const underOdds =
            prop.under_odds ||
            (overOdds > 0 ? -(Math.abs(overOdds) + 20) : Math.abs(overOdds) - 20);

          return {
            id: prop.id,
            game_id: prop.game_id || prop.external_game_id,
            player_id: prop.player_id,
            team_id: prop.team_id,
            player_name: playerName,
            team: team,
            opponent: prop.opponent,
            prop_type: propType,
            stat_type: propType,
            market_type: prop.market_type || 'player_props',
            line: line,
            over_odds: overOdds,
            under_odds: underOdds,
            confidence: prop.confidence || 0,
            expected_value: prop.expected_value || 0,
            provider: prop.provider,
            sport: prop.sport,
            game_time: prop.game_time,
            display_name: `${playerName} ${propType}${line ? ` ${line}` : ''}`,
            selection_options: line
              ? [
                  {
                    value: 'over',
                    label: `Over ${line}`,
                    odds: overOdds,
                    confidence: prop.confidence || 0,
                    expected_value: prop.expected_value || 0,
                  },
                  {
                    value: 'under',
                    label: `Under ${line}`,
                    odds: underOdds,
                    confidence: prop.confidence || 0,
                    expected_value: prop.expected_value || 0,
                  },
                ]
              : [
                  {
                    value: 'yes',
                    label: 'Yes',
                    odds: overOdds,
                    confidence: prop.confidence || 0,
                    expected_value: prop.expected_value || 0,
                  },
                  {
                    value: 'no',
                    label: 'No',
                    odds: underOdds,
                    confidence: prop.confidence || 0,
                    expected_value: prop.expected_value || 0,
                  },
                ],
          };
        });

        // Calculate analytics metadata
        const analytics = {
          total_props: transformedProps.length,
          high_confidence_props: transformedProps.filter(p => p.confidence >= 0.7).length,
          avg_confidence:
            transformedProps.reduce((sum, p) => sum + p.confidence, 0) / transformedProps.length ||
            0,
          avg_expected_value:
            transformedProps.reduce((sum, p) => sum + p.expected_value, 0) /
              transformedProps.length || 0,
          providers: [...new Set(transformedProps.map(p => p.provider).filter(Boolean))],
          prop_types: [...new Set(transformedProps.map(p => p.prop_type))],
        };

        logApiPerformance(log, 'fetch-props', startTime, {
          props_count: transformedProps.length,
          sport,
          filters_applied: [team_id, player_id, game_id].filter(Boolean).length,
        });

        return NextResponse.json({
          props: transformedProps,
          meta: {
            count: transformedProps.length,
            sport,
            filters: { team_id, player_id, game_id },
            source: 'database',
            timestamp: new Date().toISOString(),
          },
          analytics,
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300', // 3min cache
          },
        });
      }
    } catch (dbError) {
      log.error({
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        sport,
      }, 'Database error fetching props');
      
      return NextResponse.json({
        error: 'Database unavailable',
        message: 'Unable to fetch props at this time',
      }, { status: 503 });
    }

    // No props found - return empty result
    log.info({
      sport,
      filters: { team_id, player_id, game_id },
    }, 'No props found for query');

    logApiPerformance(log, 'fetch-props', startTime, {
      props_count: 0,
      sport,
      no_results: true,
    });

    return NextResponse.json({
      props: [],
      meta: {
        count: 0,
        sport,
        filters: { team_id, player_id, game_id },
        source: 'database',
        message: 'No props available for the specified criteria',
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error in props endpoint');
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching props',
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('raw_props').select('count').limit(1).single();
    
    if (error) {
      return NextResponse.json(null, { status: 503 });
    }
    
    return NextResponse.json(null, { status: 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
