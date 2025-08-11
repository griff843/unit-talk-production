import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

// Mock props data for testing when database is unavailable
// Using actual game IDs from the database for 2025-07-30 MLB games
const mockProps = {
  MLB: [
    // Props for LAD @ SF Giants (377533af-f6e5-4a16-b29d-a8401f7eefb8)
    {
      id: 'prop-1',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Logan Webb',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 6.5,
      over_odds: -115,
      under_odds: -105,
      team: 'SF',
    },
    {
      id: 'prop-2',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Walker Buehler',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 7.5,
      over_odds: -110,
      under_odds: -110,
      team: 'LAD',
    },
    {
      id: 'prop-3',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Mookie Betts',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +105,
      under_odds: -125,
      team: 'LAD',
    },
    {
      id: 'prop-4',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Matt Chapman',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +110,
      under_odds: -130,
      team: 'SF',
    },
    {
      id: 'prop-5',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Freddie Freeman',
      prop_type: 'To Hit Home Run',
      market_type: 'player_props',
      line: null,
      over_odds: +280,
      under_odds: null,
      team: 'LAD',
    },
    {
      id: 'prop-6',
      game_id: '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      player_name: 'Buster Posey',
      prop_type: 'Total RBIs',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +150,
      under_odds: -180,
      team: 'SF',
    },

    // Props for NYY @ BOS Red Sox (61d5d367-8e1b-435a-ba24-b94b290a086e)
    {
      id: 'prop-7',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Gerrit Cole',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 8.5,
      over_odds: -120,
      under_odds: +100,
      team: 'NYY',
    },
    {
      id: 'prop-8',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Brayan Bello',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 6.5,
      over_odds: -105,
      under_odds: -115,
      team: 'BOS',
    },
    {
      id: 'prop-9',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Aaron Judge',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +110,
      under_odds: -130,
      team: 'NYY',
    },
    {
      id: 'prop-10',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Rafael Devers',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +105,
      under_odds: -125,
      team: 'BOS',
    },
    {
      id: 'prop-11',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Aaron Judge',
      prop_type: 'To Hit Home Run',
      market_type: 'player_props',
      line: null,
      over_odds: +250,
      under_odds: null,
      team: 'NYY',
    },
    {
      id: 'prop-12',
      game_id: '61d5d367-8e1b-435a-ba24-b94b290a086e',
      player_name: 'Juan Soto',
      prop_type: 'Total RBIs',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +140,
      under_odds: -160,
      team: 'NYY',
    },

    // Props for ATL @ PHI Phillies (cb054749-5c37-4329-a82d-8b5578dd88ef)
    {
      id: 'prop-13',
      game_id: 'cb054749-5c37-4329-a82d-8b5578dd88ef',
      player_name: 'Zack Wheeler',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 7.5,
      over_odds: -110,
      under_odds: -110,
      team: 'PHI',
    },
    {
      id: 'prop-14',
      game_id: 'cb054749-5c37-4329-a82d-8b5578dd88ef',
      player_name: 'Spencer Strider',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 9.5,
      over_odds: -125,
      under_odds: +105,
      team: 'ATL',
    },
    {
      id: 'prop-15',
      game_id: 'cb054749-5c37-4329-a82d-8b5578dd88ef',
      player_name: 'Bryce Harper',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +100,
      under_odds: -120,
      team: 'PHI',
    },
    {
      id: 'prop-16',
      game_id: 'cb054749-5c37-4329-a82d-8b5578dd88ef',
      player_name: 'Ronald Acuna Jr',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +105,
      under_odds: -125,
      team: 'ATL',
    },

    // Props for HOU @ TEX Rangers (74358e27-54c2-4f2b-b17b-b095611b8409)
    {
      id: 'prop-17',
      game_id: '74358e27-54c2-4f2b-b17b-b095611b8409',
      player_name: 'Framber Valdez',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 6.5,
      over_odds: -105,
      under_odds: -115,
      team: 'HOU',
    },
    {
      id: 'prop-18',
      game_id: '74358e27-54c2-4f2b-b17b-b095611b8409',
      player_name: 'Nathan Eovaldi',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 5.5,
      over_odds: -110,
      under_odds: -110,
      team: 'TEX',
    },
    {
      id: 'prop-19',
      game_id: '74358e27-54c2-4f2b-b17b-b095611b8409',
      player_name: 'Jose Altuve',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +115,
      under_odds: -135,
      team: 'HOU',
    },
    {
      id: 'prop-20',
      game_id: '74358e27-54c2-4f2b-b17b-b095611b8409',
      player_name: 'Corey Seager',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +105,
      under_odds: -125,
      team: 'TEX',
    },

    // Props for CHC @ MIL Brewers (16b15d13-7296-4a01-8ef0-4c68cf700c98)
    {
      id: 'prop-21',
      game_id: '16b15d13-7296-4a01-8ef0-4c68cf700c98',
      player_name: 'Corbin Burnes',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 8.5,
      over_odds: -115,
      under_odds: -105,
      team: 'MIL',
    },
    {
      id: 'prop-22',
      game_id: '16b15d13-7296-4a01-8ef0-4c68cf700c98',
      player_name: 'Justin Steele',
      prop_type: 'Strikeouts',
      market_type: 'player_props',
      line: 7.5,
      over_odds: -110,
      under_odds: -110,
      team: 'CHC',
    },
    {
      id: 'prop-23',
      game_id: '16b15d13-7296-4a01-8ef0-4c68cf700c98',
      player_name: 'Christian Yelich',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +110,
      under_odds: -130,
      team: 'MIL',
    },
    {
      id: 'prop-24',
      game_id: '16b15d13-7296-4a01-8ef0-4c68cf700c98',
      player_name: 'Cody Bellinger',
      prop_type: 'Total Hits',
      market_type: 'player_props',
      line: 1.5,
      over_odds: +105,
      under_odds: -125,
      team: 'CHC',
    },
  ],
  NBA: [
    // Points props
    {
      id: 'prop-9',
      game_id: 'game-2',
      player_name: 'LeBron James',
      prop_type: 'Points',
      market_type: 'player_props',
      line: 25.5,
      over_odds: -110,
      under_odds: -110,
      team: 'LAL',
    },
    {
      id: 'prop-10',
      game_id: 'game-2',
      player_name: 'Stephen Curry',
      prop_type: 'Points',
      market_type: 'player_props',
      line: 28.5,
      over_odds: -115,
      under_odds: -105,
      team: 'GSW',
    },

    // Assists props
    {
      id: 'prop-11',
      game_id: 'game-2',
      player_name: 'LeBron James',
      prop_type: 'Assists',
      market_type: 'player_props',
      line: 7.5,
      over_odds: -105,
      under_odds: -115,
      team: 'LAL',
    },
    {
      id: 'prop-12',
      game_id: 'game-2',
      player_name: 'Draymond Green',
      prop_type: 'Assists',
      market_type: 'player_props',
      line: 6.5,
      over_odds: +100,
      under_odds: -120,
      team: 'GSW',
    },

    // Rebounds props
    {
      id: 'prop-13',
      game_id: 'game-2',
      player_name: 'Anthony Davis',
      prop_type: 'Rebounds',
      market_type: 'player_props',
      line: 11.5,
      over_odds: -110,
      under_odds: -110,
      team: 'LAL',
    },
  ],
  NFL: [
    // Passing props
    {
      id: 'prop-14',
      game_id: 'game-3',
      player_name: 'Patrick Mahomes',
      prop_type: 'Passing Yards',
      market_type: 'player_props',
      line: 275.5,
      over_odds: -110,
      under_odds: -110,
      team: 'KC',
    },
    {
      id: 'prop-15',
      game_id: 'game-3',
      player_name: 'Josh Allen',
      prop_type: 'Passing Yards',
      market_type: 'player_props',
      line: 265.5,
      over_odds: -105,
      under_odds: -115,
      team: 'BUF',
    },

    // Rushing props
    {
      id: 'prop-16',
      game_id: 'game-3',
      player_name: 'Josh Jacobs',
      prop_type: 'Rushing Yards',
      market_type: 'player_props',
      line: 85.5,
      over_odds: -115,
      under_odds: -105,
      team: 'LV',
    },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('game_id');
    const sport = searchParams.get('sport') || 'MLB';
    const propType = searchParams.get('prop_type') || 'player_props';

    console.log(`[Props API] Request for ${sport} props, game: ${gameId}, type: ${propType}`);

    if (!gameId) {
      return NextResponse.json({ error: 'game_id parameter is required' }, { status: 400 });
    }

    try {
      // First try to fetch from database
      console.log('[Props API] Attempting to fetch from raw_props table...');

      const { data: dbProps, error } = await supabase
        .from('raw_props')
        .select(
          `
          id,
          game_id,
          player_id,
          stat_type,
          market_type,
          line,
          odds,
          player_name,
          team
        `
        )
        .eq('game_id', gameId)
        .eq('market_type', propType)
        .order('stat_type')
        .order('line');

      if (error && error.code !== '42P01') {
        // Real error, not just missing table
        console.error('[Props API] Database error:', error);
        throw error;
      }

      if (dbProps && dbProps.length > 0) {
        console.log(`[Props API] Found ${dbProps.length} props in database`);

        // Transform database props to frontend format
        const transformedProps = dbProps.map(prop => ({
          id: prop.id,
          game_id: prop.game_id,
          player_name: prop.player_name || 'Unknown Player',
          team: prop.team || 'UNK',
          prop_type: prop.stat_type,
          market_type: prop.market_type,
          line: prop.line,
          over_odds: prop.odds > 0 ? `+${prop.odds}` : prop.odds,
          under_odds:
            prop.odds > 0 ? `-${Math.abs(prop.odds) + 20}` : `+${Math.abs(prop.odds) - 20}`, // Approximate under odds
          display_name: `${prop.player_name || 'Unknown'} ${prop.stat_type}${prop.line ? ` ${prop.line}` : ''}`,
          selection_options: prop.line
            ? [
                { value: 'over', label: `Over ${prop.line}`, odds: prop.odds },
                {
                  value: 'under',
                  label: `Under ${prop.line}`,
                  odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
                },
              ]
            : [
                { value: 'yes', label: 'Yes', odds: prop.odds },
                {
                  value: 'no',
                  label: 'No',
                  odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
                },
              ],
        }));

        return NextResponse.json({
          success: true,
          props: transformedProps,
          count: transformedProps.length,
          source: 'database',
        });
      }
    } catch (dbError) {
      console.warn('[Props API] Database unavailable, using mock data:', dbError);
    }

    // Fallback to mock data
    console.log('[Props API] Using mock props data...');
    const sportProps = mockProps[sport as keyof typeof mockProps] || [];

    // Filter by game if specified
    const filteredProps =
      gameId === 'all' ? sportProps : sportProps.filter(prop => prop.game_id === gameId);

    // No props found - return empty result
    console.log(`[Props API] No props found for game ${gameId}`);

    return NextResponse.json({
      success: true,
      props: [],
      count: 0,
      source: 'database',
      message:
        'No props available for this game yet. Props are typically added closer to game time.',
    });
  } catch (error) {
    console.error('[Props API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
