/**
 * Unified Data Source Router for Unit Talk Platform
 *
 * Intelligently routes data requests between The Odds API and Optimal API
 * based on sport, market type, and data requirements.
 *
 * Routing Strategy:
 * - Odds API: Primary for NCAAF, settlement data, spreads, totals, moneylines
 * - Optimal API: Secondary for specialized player props in major sports
 */

import { fetchAndPairSGOProps, SGOPairedProp } from '../../logic/providers/sgoFetcher';
import { RawProp } from '../../types/rawProps';

import { fetchOddsApiProps, fetchSettlementData, getCreditUsageStatus } from './oddsApi';
import { fetchOptimalProps } from './optimal';

// Data source identification
export type DataSource = 'odds-api' | 'optimal-api' | 'sgo' | 'unified';

// SGO league support — leagues where SGO can provide player props
const SGO_SUPPORTED_LEAGUES = new Set(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA']);

// Enhanced sport mapping with routing logic
const SPORT_ROUTING_CONFIG = {
  // Odds API Primary (comprehensive coverage)
  NCAAF: {
    primary: 'odds-api' as const,
    secondary: null,
    oddsApiKey: 'americanfootball_ncaaf',
    supports: ['spreads', 'totals', 'moneylines', 'futures', 'settlement'],
  },

  NFL: {
    primary: 'optimal-api' as const,
    secondary: 'odds-api' as const,
    oddsApiKey: 'americanfootball_nfl',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },

  NBA: {
    primary: 'optimal-api' as const,
    secondary: 'odds-api' as const,
    oddsApiKey: 'basketball_nba',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },

  MLB: {
    primary: 'optimal-api' as const,
    secondary: 'odds-api' as const,
    oddsApiKey: 'baseball_mlb',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },

  NHL: {
    primary: 'optimal-api' as const,
    secondary: 'odds-api' as const,
    oddsApiKey: 'icehockey_nhl',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },

  // Odds API Exclusive (new sports)
  NCAAB: {
    primary: 'odds-api' as const,
    secondary: null,
    oddsApiKey: 'basketball_ncaab',
    supports: ['spreads', 'totals', 'moneylines', 'futures', 'settlement'],
  },

  WNBA: {
    primary: 'odds-api' as const,
    secondary: null,
    oddsApiKey: 'basketball_wnba',
    supports: ['spreads', 'totals', 'moneylines', 'settlement'],
  },

  EPL: {
    primary: 'odds-api' as const,
    secondary: null,
    oddsApiKey: 'soccer_epl',
    supports: ['moneylines', 'totals', 'settlement'],
  },

  ATP: {
    primary: 'odds-api' as const,
    secondary: null,
    oddsApiKey: 'tennis_atp',
    supports: ['moneylines', 'settlement'],
  },
} as const;

type SupportedSport = keyof typeof SPORT_ROUTING_CONFIG;
type MarketType = 'player-props' | 'spreads' | 'totals' | 'moneylines' | 'futures' | 'settlement';

// Request configuration interface
interface DataRequest {
  sport: string;
  marketType?: MarketType;
  date?: string;
  forceSource?: DataSource;
  includeSettlement?: boolean;
}

// Response interface with source tracking
interface DataResponse {
  data: RawProp[];
  source: DataSource;
  sport: string;
  marketType?: MarketType;
  timestamp: string;
  metadata: {
    totalRecords: number;
    processingTimeMs: number;
    creditsUsed?: number;
    errors: string[];
  };
}

/**
 * Get routing configuration for a sport
 */
function getRoutingConfig(sport: string) {
  const normalizedSport = sport.toUpperCase();
  return SPORT_ROUTING_CONFIG[normalizedSport as SupportedSport] || null;
}

/**
 * Determine optimal data source based on request
 */
function determineDataSource(request: DataRequest): {
  source: DataSource;
  fallback?: DataSource;
  reason: string;
} {
  // Force source if specified
  if (request.forceSource) {
    return {
      source: request.forceSource,
      reason: 'User-specified force override',
    };
  }

  const config = getRoutingConfig(request.sport);

  // Unknown sport - default to Odds API for broader coverage
  if (!config) {
    return {
      source: 'odds-api',
      reason: `Unknown sport ${request.sport}, defaulting to Odds API for coverage`,
    };
  }

  // Settlement data always goes to Odds API (Optimal doesn't support it)
  if (request.marketType === 'settlement' || request.includeSettlement) {
    return {
      source: 'odds-api',
      reason: 'Settlement data required - only available via Odds API',
    };
  }

  // Player props preference
  if (request.marketType === 'player-props') {
    if ([...config.supports].includes('player-props') && config.primary === 'optimal-api') {
      return {
        source: 'optimal-api',
        fallback: config.secondary || undefined,
        reason: 'Player props specialist - Optimal API preferred',
      };
    } else {
      return {
        source: 'odds-api',
        reason: 'Player props requested but Optimal API not available for this sport',
      };
    }
  }

  // NCAAF always goes to Odds API (Optimal doesn't support)
  if (request.sport.toUpperCase() === 'NCAAF') {
    return {
      source: 'odds-api',
      reason: 'NCAAF only available via Odds API',
    };
  }

  // Use configured primary source
  return {
    source: config.primary,
    fallback: config.secondary || undefined,
    reason: `Using configured primary source for ${request.sport}`,
  };
}

/**
 * Fetch data from Optimal API
 */
async function fetchFromOptimal(request: DataRequest): Promise<RawProp[]> {
  console.log(`[DataRouter] Fetching from Optimal API: ${request.sport}`);

  try {
    return await fetchOptimalProps(request.sport, request.date);
  } catch (error) {
    console.error(`[DataRouter] Optimal API error for ${request.sport}:`, error);
    throw error;
  }
}

/**
 * Fetch data from Odds API
 */
async function fetchFromOddsApi(request: DataRequest): Promise<RawProp[]> {
  console.log(`[DataRouter] Fetching from Odds API: ${request.sport}`);

  const config = getRoutingConfig(request.sport);
  if (!config) {
    throw new Error(`No Odds API configuration found for sport: ${request.sport}`);
  }

  try {
    // Determine markets to fetch
    const markets: any[] = [];

    if (!request.marketType || request.marketType === 'spreads') {
      markets.push('spreads');
    }
    if (!request.marketType || request.marketType === 'totals') {
      markets.push('totals');
    }
    if (!request.marketType || request.marketType === 'moneylines') {
      markets.push('h2h');
    }
    if (request.marketType === 'futures') {
      markets.push('outrights');
    }

    // Default to comprehensive markets if none specified
    if (markets.length === 0) {
      markets.push('h2h', 'spreads', 'totals');
    }

    return await fetchOddsApiProps(config.oddsApiKey as any, markets);
  } catch (error) {
    console.error(`[DataRouter] Odds API error for ${request.sport}:`, error);
    throw error;
  }
}

/**
 * Map SGOPairedProp to RawProp for pipeline compatibility
 * SPRINT-043A: Reuses mapping logic from IngestionAgent/fetchRawProps.ts
 */
function mapSGOPairedToRawProp(prop: SGOPairedProp, league: string): RawProp {
  return {
    id: crypto.randomUUID(),
    provider: 'sgo',
    player_name: prop.playerName ?? 'Unknown',
    sport: league,
    team: null,
    stat_type: prop.statType,
    outcome: null,
    line: typeof prop.line === 'number' ? prop.line : prop.line != null ? Number(prop.line) : 0,
    odds: prop.overOdds ?? -110,
    created_at: new Date().toISOString(),
    source: 'sgo',
    game_id: null,
    scraped_at: new Date().toISOString(),
    game_date: (prop.startsAtUTC ?? '').slice(0, 10),
    matchup: `${prop.awayTeam} @ ${prop.homeTeam}`,
    over_odds: prop.overOdds ?? null,
    under_odds: prop.underOdds ?? null,
    external_prop_id: prop.overMarketKey || prop.underMarketKey || null,
    external_game_id: prop.eventID,
    // Composite external_id: eventID + marketKey + player for uniqueness
    external_id: `sgo:${prop.eventID}:${prop.overMarketKey || prop.underMarketKey || 'unk'}:${(prop.playerName || 'game').replace(/\s/g, '_')}`,
    sport_key: league.toLowerCase(),
    league,
    market: `player_${prop.statType.toLowerCase()}`,
    game_time: prop.startsAtUTC ?? new Date().toISOString(),
    start_time: prop.startsAtUTC ?? new Date().toISOString(),
    home_team: prop.homeTeam,
    home_team_id: null, // SGO team IDs are strings; column expects integer FK
    away_team: prop.awayTeam,
    away_team_id: null, // SGO team IDs are strings; column expects integer FK
    market_type: prop.statType,
    player_id: prop.playerId,
    // SPRINT-042C: Provider keys for settlement traceability
    overMarketKey: prop.overMarketKey,
    underMarketKey: prop.underMarketKey,
    eventID: prop.eventID,
    marketKey: prop.overMarketKey || prop.underMarketKey || null,
  } as RawProp;
}

/**
 * Fetch data from SGO API
 * SPRINT-043A: Integrates SportsGameOdds into the data source router
 */
async function fetchFromSGO(request: DataRequest): Promise<RawProp[]> {
  const league = request.sport.toUpperCase();
  console.log(`[DataRouter] Fetching from SGO API: ${league}`);

  if (!SGO_SUPPORTED_LEAGUES.has(league)) {
    throw new Error(`SGO does not support league: ${league}`);
  }

  const apiKey = process.env['SGO_API_KEY'];
  if (!apiKey) {
    throw new Error('SGO_API_KEY not configured');
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const paired = await fetchAndPairSGOProps({
    apiKey,
    leagueID: league,
    startsAfter: now.toISOString(),
    startsBefore: tomorrow.toISOString(),
    includeOpposingOdds: true,
    oddsAvailable: true,
    limit: 50,
  });

  console.log(`[DataRouter] SGO returned ${paired.length} paired props for ${league}`);

  return paired.map(prop => mapSGOPairedToRawProp(prop, league));
}

/**
 * Main unified data fetching function
 */
export async function fetchUnifiedData(request: DataRequest): Promise<DataResponse> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`[DataRouter] Processing request:`, {
    sport: request.sport,
    marketType: request.marketType,
    date: request.date,
    forceSource: request.forceSource,
  });

  // Determine routing strategy
  const routing = determineDataSource(request);
  console.log(`[DataRouter] Routing decision: ${routing.source} (${routing.reason})`);

  let data: RawProp[] = [];
  let actualSource: DataSource = routing.source;

  try {
    // Attempt primary source
    if (routing.source === 'optimal-api') {
      data = await fetchFromOptimal(request);
    } else if (routing.source === 'odds-api') {
      data = await fetchFromOddsApi(request);
    } else if (routing.source === 'sgo') {
      data = await fetchFromSGO(request);
    }

    console.log(`[DataRouter] Successfully fetched ${data.length} records from ${routing.source}`);
  } catch (primaryError) {
    errors.push(
      `Primary source (${routing.source}) failed: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`
    );
    console.warn(`[DataRouter] Primary source failed, attempting fallback:`, primaryError);

    // Attempt fallback if available
    if (routing.fallback) {
      try {
        actualSource = routing.fallback;

        if (routing.fallback === 'optimal-api') {
          data = await fetchFromOptimal(request);
        } else if (routing.fallback === 'odds-api') {
          data = await fetchFromOddsApi(request);
        } else if (routing.fallback === 'sgo') {
          data = await fetchFromSGO(request);
        }

        console.log(
          `[DataRouter] Fallback successful: ${data.length} records from ${routing.fallback}`
        );
      } catch (fallbackError) {
        errors.push(
          `Fallback source (${routing.fallback}) failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
        console.error(`[DataRouter] Both primary and fallback sources failed`);

        // Return empty result with errors
        actualSource = routing.source; // Keep original for error reporting
      }
    }
  }

  // SPRINT-043A: Try SGO as final fallback if data is still empty
  // Placed outside try/catch so it triggers even when primary returns 0 records without error
  if (
    data.length === 0 &&
    SGO_SUPPORTED_LEAGUES.has(request.sport.toUpperCase()) &&
    actualSource !== 'sgo'
  ) {
    try {
      console.log(`[DataRouter] Attempting SGO as final fallback for ${request.sport}`);
      data = await fetchFromSGO(request);
      actualSource = 'sgo';
      console.log(`[DataRouter] SGO fallback successful: ${data.length} records`);
    } catch (sgoError) {
      errors.push(
        `SGO fallback failed: ${sgoError instanceof Error ? sgoError.message : 'Unknown error'}`
      );
      console.error(`[DataRouter] SGO fallback also failed for ${request.sport}`);
    }
  }

  const processingTime = Date.now() - startTime;

  // Get credit usage info if from Odds API
  let creditsUsed: number | undefined;
  if (actualSource === 'odds-api') {
    getCreditUsageStatus(); // Credit status tracking
    creditsUsed = 1; // Each request typically uses 1 credit
  }

  const response: DataResponse = {
    data,
    source: actualSource,
    sport: request.sport,
    marketType: request.marketType,
    timestamp: new Date().toISOString(),
    metadata: {
      totalRecords: data.length,
      processingTimeMs: processingTime,
      creditsUsed,
      errors,
    },
  };

  console.log(`[DataRouter] Request completed:`, {
    source: actualSource,
    records: data.length,
    timeMs: processingTime,
    hasErrors: errors.length > 0,
  });

  return response;
}

/**
 * Fetch settlement data (always from Odds API)
 */
export async function fetchUnifiedSettlement(
  sport: string,
  daysFrom: number = 1
): Promise<DataResponse> {
  const startTime = Date.now();

  console.log(`[DataRouter] Fetching settlement data for ${sport} (${daysFrom} days)`);

  const config = getRoutingConfig(sport);
  if (!config) {
    throw new Error(`No settlement configuration found for sport: ${sport}`);
  }

  try {
    const settlementData = await fetchSettlementData(config.oddsApiKey as any, daysFrom);

    // Convert settlement data to RawProp format for consistency
    // Note: This would need additional conversion logic for settlement-specific data
    const data: RawProp[] = []; // Placeholder - settlement data has different structure

    const response: DataResponse = {
      data,
      source: 'odds-api',
      sport,
      marketType: 'settlement',
      timestamp: new Date().toISOString(),
      metadata: {
        totalRecords: settlementData.length,
        processingTimeMs: Date.now() - startTime,
        creditsUsed: 1,
        errors: [],
      },
    };

    console.log(`[DataRouter] Settlement data fetched: ${settlementData.length} games`);
    return response;
  } catch (error) {
    console.error(`[DataRouter] Settlement fetch failed for ${sport}:`, error);
    throw error;
  }
}

/**
 * Get routing information for a sport (for debugging/admin)
 */
export function getRoutingInfo(sport: string) {
  const config = getRoutingConfig(sport);

  if (!config) {
    return {
      supported: false,
      message: `Sport ${sport} not found in routing configuration`,
    };
  }

  return {
    supported: true,
    sport: sport.toUpperCase(),
    primary: config.primary,
    secondary: config.secondary,
    oddsApiKey: config.oddsApiKey,
    supportedMarkets: config.supports,
    recommendation:
      config.primary === 'odds-api'
        ? 'Use Odds API for comprehensive market coverage'
        : 'Use Optimal API for specialized player props, Odds API for settlement',
  };
}

/**
 * Get system status across all data sources
 */
export async function getSystemStatus() {
  const creditStatus = getCreditUsageStatus();

  return {
    timestamp: new Date().toISOString(),
    oddsApi: {
      available: true, // Would test connectivity in production
      creditStatus,
      supportedSports: Object.keys(SPORT_ROUTING_CONFIG).filter(
        sport =>
          SPORT_ROUTING_CONFIG[sport as SupportedSport].primary === 'odds-api' ||
          SPORT_ROUTING_CONFIG[sport as SupportedSport].secondary === 'odds-api'
      ).length,
    },
    optimalApi: {
      available: true, // Would test connectivity in production
      supportedSports: Object.keys(SPORT_ROUTING_CONFIG).filter(
        sport => SPORT_ROUTING_CONFIG[sport as SupportedSport].primary === 'optimal-api'
      ).length,
    },
    sgoApi: {
      available: !!process.env['SGO_API_KEY'],
      supportedLeagues: Array.from(SGO_SUPPORTED_LEAGUES),
      role: 'fallback',
    },
    routing: {
      totalSports: Object.keys(SPORT_ROUTING_CONFIG).length,
      oddsApiPrimary: Object.values(SPORT_ROUTING_CONFIG).filter(c => c.primary === 'odds-api')
        .length,
      optimalApiPrimary: Object.values(SPORT_ROUTING_CONFIG).filter(
        c => c.primary === 'optimal-api'
      ).length,
    },
  };
}
