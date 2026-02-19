import { NextRequest, NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('GET /api/players', 'GET');

/**
 * DEPRECATED: Legacy player search endpoint
 * SEARCH-CATALOG-CONTRACT-035: Redirects to unified search API
 *
 * Use /api/search?q=...&sport=...&type=player instead
 * This endpoint is maintained for backwards compatibility only.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const sport = searchParams.get('sport') || '';

  log.warn(
    { query, sport },
    'DEPRECATED: /api/players called - use /api/search or /api/catalog/players instead'
  );

  if (query.length < 2) {
    return NextResponse.json({ success: true, players: [], count: 0 });
  }

  try {
    // Proxy to the new unified search endpoint
    const searchUrl = new URL('/api/search', request.url);
    searchUrl.searchParams.set('q', query);
    if (sport) searchUrl.searchParams.set('sport', sport);
    searchUrl.searchParams.set('type', 'player');
    searchUrl.searchParams.set('limit', '15');

    const response = await fetch(searchUrl.toString());
    const data = await response.json();

    // Transform to legacy format for backwards compatibility
    const players = (data.results || []).map((r: any) => ({
      name: r.name,
      team: r.team || '',
      display: r.display_label || `${r.name} (${r.team || r.sport})`,
      // Include new fields for consumers that support them
      value: r.id,
      label: r.display_label || `${r.name} (${r.team || r.sport})`,
      team_id: r.team_id,
    }));

    return NextResponse.json({
      success: true,
      players,
      count: players.length,
      _deprecated: true,
      _migration: 'Use /api/search?type=player or /api/catalog/players instead',
    });
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : 'Unknown' },
      'Legacy player search proxy failed'
    );

    return NextResponse.json(
      { success: false, players: [], error: 'Search unavailable' },
      { status: 503 }
    );
  }
}
