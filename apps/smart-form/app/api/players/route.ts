import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const sport = searchParams.get('sport') || '';

    if (query.length < 2) {
      return NextResponse.json({ players: [] });
    }

    console.log(`[Players API] Searching for "${query}" in ${sport}`);

    // Search in raw_props table for player names
    let dbQuery = supabase
      .from('raw_props')
      .select('player_name, team')
      .ilike('player_name', `%${query}%`)
      .limit(10);

    if (sport) {
      // Add sport filter if available
      dbQuery = dbQuery.eq('sport', sport.toUpperCase());
    }

    const { data: players, error } = await dbQuery;

    if (error) {
      console.error('[Players API] Database error:', error);
      return NextResponse.json({ players: [] });
    }

    // Remove duplicates and format
    const uniquePlayers = Array.from(
      new Map(
        players?.map(p => [
          p.player_name?.toLowerCase(),
          {
            name: p.player_name,
            team: p.team,
            display: `${p.player_name} (${p.team})`,
          },
        ]) || []
      ).values()
    );

    console.log(`[Players API] Found ${uniquePlayers.length} unique players`);

    return NextResponse.json({
      success: true,
      players: uniquePlayers,
      count: uniquePlayers.length,
    });
  } catch (error) {
    console.error('[Players API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search players',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
