import { NextRequest, NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('GET /api/catalog/leagues', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Leagues Catalog Endpoint
 *
 * Returns the canonical list of supported sports/leagues.
 * This is static data - no database query needed.
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.A
 */

interface League {
  code: string;
  name: string;
  active: boolean;
  sport: string;
}

// Static league data - single source of truth
const LEAGUES: League[] = [
  { code: 'NFL', name: 'National Football League', active: true, sport: 'NFL' },
  { code: 'NBA', name: 'National Basketball Association', active: true, sport: 'NBA' },
  { code: 'MLB', name: 'Major League Baseball', active: true, sport: 'MLB' },
  { code: 'NHL', name: 'National Hockey League', active: true, sport: 'NHL' },
  { code: 'NCAAF', name: 'NCAA Football', active: true, sport: 'NCAAF' },
  { code: 'NCAAB', name: 'NCAA Basketball', active: true, sport: 'NCAAB' },
];

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  log.info({}, 'Fetching leagues catalog');

  const activeLeagues = LEAGUES.filter(l => l.active);

  log.info(
    { league_count: activeLeagues.length, duration_ms: Date.now() - startTime },
    `Returning ${activeLeagues.length} leagues`
  );

  return NextResponse.json(
    {
      leagues: activeLeagues,
      meta: {
        total: activeLeagues.length,
        source: 'static',
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 200,
      headers: {
        // Static data - cache for 1 hour
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  );
}

// Health check
export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}
