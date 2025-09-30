import axios, { AxiosError } from "axios";
import { DateTime } from "luxon";
import { creditLogger } from "../../services/creditLogger.js";
import { cacheClient } from "../../services/cacheClient.js";
import { sgoApiKeyManager, getValidatedSGOApiKey } from "../../utils/sgoApiKeyManager.js";
import { logger } from "../../utils/logger.js";
import { sgoApiMonitoring, CircuitBreakerState } from "../../services/SGOApiMonitoring.js";

// ---- Type definitions ----
export interface SGOFlattenedProp {
  eventID: string;
  leagueID: string;
  sportID: string;
  startsAtUTC: string;
  startsAtET: string;
  homeTeam: string;
  homeTeamID: string;
  awayTeam: string;
  awayTeamID: string;
  playerId: string | null;
  playerName: string | null;
  statType: string;
  ou: string | null;
  direction: string | null;
  marketKey: string;
  line: number | string | null;
  odds: number | string | null;
  sportsbook: string | null;
  period: string | null;
  meta: any;
}

// ---- Enhanced Fetcher function ----
export async function fetchSGOEvents({
  apiKey: providedApiKey,
  leagueID,
  startsAfter,
  startsBefore,
  includeAltLine = true,
  oddsAvailable,
  limit = 50,
  oddIDs,
  eventID,
  finalized,
  oddsPresent,
}: {
  apiKey?: string;
  leagueID?: string;
  startsAfter?: string;
  startsBefore?: string;
  includeAltLine?: boolean;
  oddsAvailable?: boolean;
  limit?: number;
  oddIDs?: string | string[]; // Support for specific prop queries
  eventID?: string; // Support for direct event lookup
  finalized?: boolean; // Support for historic/settled data
  oddsPresent?: boolean; // Alternative to oddsAvailable
}): Promise<any[]> {
  const endpoint = "https://api.sportsgameodds.com/v2/events";

  // Check circuit breaker
  if (!sgoApiMonitoring.shouldAllowRequest()) {
    const health = sgoApiMonitoring.getHealthStatus();
    logger.warn('SGO API request blocked by circuit breaker', {
      circuitState: health.circuitState,
      issues: health.issues
    });
    throw new Error('[SGO] Service temporarily unavailable (circuit breaker open)');
  }

  // Get validated API key
  const apiKey = providedApiKey || await getValidatedSGOApiKey();

  logger.debug('SGO API Request', {
    endpoint,
    leagueID,
    startsAfter,
    startsBefore,
    hasApiKey: !!apiKey
  });

  // Build params object dynamically, only including defined values
  const params: any = { apiKey };

  if (leagueID) params.leagueID = leagueID;
  if (startsAfter) params.startsAfter = startsAfter;
  if (startsBefore) params.startsBefore = startsBefore;
  if (includeAltLine !== undefined) params.includeAltLine = includeAltLine;
  if (limit) params.limit = limit;
  if (finalized !== undefined) params.finalized = finalized;
  if (eventID) params.eventID = eventID;

  // Handle odds parameters - SGO API doesn't allow finalized=true with oddsAvailable=true
  if (finalized === true) {
    // For finalized historical data, don't set oddsAvailable
    // The finalized events already contain odds data in the response
    console.log('   🔍 Using finalized=true for historical data (oddsAvailable disabled)');
  } else {
    // Only set oddsAvailable if not using finalized
    if (oddsAvailable !== undefined) params.oddsAvailable = oddsAvailable;
    else params.oddsAvailable = true; // Default for non-finalized queries
  }
  if (oddsPresent !== undefined) params.oddsPresent = oddsPresent;

  // Handle oddIDs parameter (can be string or array)
  if (oddIDs) {
    if (Array.isArray(oddIDs)) {
      params.oddIDs = oddIDs.join(',');
    } else {
      params.oddID = oddIDs; // Single oddID uses oddID parameter
    }
  }

  // Check cache first if enabled
  const cacheKey = `sgo:${endpoint}:${JSON.stringify(params)}`;
  const cachedData = await cacheClient.get(cacheKey);
  if (cachedData && cacheClient.isCacheFirst()) {
    return cachedData;
  }

  // Make API call with credit logging and enhanced error handling
  const dedupKey = `sgo-${endpoint}-${Date.now()}`;
  creditLogger.addCall('sgo', 1, 1, dedupKey);

  try {
    const startTime = Date.now();

    const resp = await axios.get(endpoint, {
      params,
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Unit-Talk-Platform/3.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    // Update rate limit information
    sgoApiKeyManager.updateRateLimitInfo(resp.headers);

    // Update quota monitoring
    const rateLimitRemaining = resp.headers['x-ratelimit-remaining'];
    const rateLimitReset = resp.headers['x-ratelimit-reset'];
    const rateLimitLimit = resp.headers['x-ratelimit-limit'];

    sgoApiMonitoring.updateQuotaUsage(
      rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
      rateLimitReset ? parseInt(rateLimitReset) : undefined,
      rateLimitLimit ? parseInt(rateLimitLimit) : undefined
    );

    // Check for rate limit warnings
    if (sgoApiKeyManager.isNearRateLimit()) {
      logger.warn('SGO API rate limit approaching', sgoApiKeyManager.getRateLimitStatus());
    }

    if (!resp.data?.success || !Array.isArray(resp.data?.data)) {
      logger.error('SGO API returned invalid response format', {
        status: resp.status,
        data: resp.data,
        endpoint,
        params
      });
      sgoApiMonitoring.recordError('other', new Error('Invalid response format'));
      throw new Error(`[SGO] Bad response format: ${JSON.stringify(resp.data)}`);
    }

    // Record successful request
    sgoApiMonitoring.recordSuccess(responseTime);

    // Cache the response
    await cacheClient.set(cacheKey, resp.data.data);

    logger.debug('SGO API request successful', {
      endpoint,
      resultCount: resp.data.data.length,
      responseTime,
      rateLimitStatus: sgoApiKeyManager.getRateLimitStatus()
    });

    return resp.data.data;

  } catch (error) {
    // Enhanced error handling for different error types
    if (error instanceof AxiosError) {
      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      logger.error('SGO API request failed', {
        status: statusCode,
        statusText: error.response?.statusText,
        data: errorData,
        endpoint,
        params: { ...params, apiKey: '***masked***' },
        message: error.message
      });

      // Handle specific HTTP status codes and record appropriate error types
      switch (statusCode) {
        case 401:
          sgoApiMonitoring.recordError('auth', error);
          throw new Error('[SGO] Authentication failed - Invalid API key');
        case 403:
          sgoApiMonitoring.recordError('auth', error);
          throw new Error('[SGO] Access forbidden - Check API key permissions and account status');
        case 429:
          const resetTime = error.response?.headers['x-ratelimit-reset'];
          sgoApiMonitoring.recordError('rateLimit', error);
          throw new Error(`[SGO] Rate limit exceeded${resetTime ? `, resets at ${new Date(parseInt(resetTime) * 1000).toISOString()}` : ''}`);
        case 404:
          sgoApiMonitoring.recordError('other', error);
          throw new Error('[SGO] API endpoint not found - Check API version');
        case 500:
        case 502:
        case 503:
        case 504:
          sgoApiMonitoring.recordError('server', error);
          throw new Error(`[SGO] Server error (${statusCode}) - API may be temporarily unavailable`);
        default:
          sgoApiMonitoring.recordError('other', error);
          throw new Error(`[SGO] HTTP ${statusCode}: ${error.message}`);
      }
    }

    // Re-throw other errors
    logger.error('SGO API unexpected error', error);
    sgoApiMonitoring.recordError('other', error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }
}

// ---- Flattener function ----
export function flattenSGOEvents(events: any[]): SGOFlattenedProp[] {
  const results: SGOFlattenedProp[] = [];
  for (const evt of events) {
    const {
      eventID,
      leagueID,
      sportID,
      teams,
      odds,
      startsAt,
      status,
      players,
      info,
    } = evt;

    if (!odds || typeof odds !== "object" || Object.keys(odds).length === 0) {
      // No odds to flatten
      continue;
    }

    // Format UTC and ET
    const startsAtUTC = startsAt ?? status?.startsAt;
    const startsAtET = startsAtUTC
      ? DateTime.fromISO(startsAtUTC, { zone: "utc" })
          .setZone("America/New_York")
          .toFormat("yyyy-MM-dd HH:mm z")
      : "";

    // Meta info
    const meta = {
      ...info,
      status,
      players,
      teams,
    };

    // Extract teams
    const homeTeam = teams?.home?.names?.full ?? teams?.home?.teamID ?? "";
    const awayTeam = teams?.away?.names?.full ?? teams?.away?.teamID ?? "";
    const homeTeamID = teams?.home?.teamID ?? "";
    const awayTeamID = teams?.away?.teamID ?? "";

    // Core fix: Typecast each offer so TS doesn't whine
    for (const [marketKey, offerRaw] of Object.entries(odds ?? {})) {
      const offer = offerRaw as any;

      let playerId: string | null = null;
      let playerName: string | null = null;
      const statType: string = offer.statID ?? "";

      if (offer.playerID && players?.[offer.playerID]?.name) {
        playerId = offer.playerID;
        playerName = players[offer.playerID].name;
      } else if (offer.statEntityID && players?.[offer.statEntityID]?.name) {
        playerId = offer.statEntityID;
        playerName = players[offer.statEntityID].name;
      }

      const ou: string | null =
        offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
      const line: number | string | null =
        offer.line ?? offer.ou ?? offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
      const odds: number | string | null =
        offer.bookOdds ?? offer.fairOdds ?? offer.openBookOdds ?? offer.openFairOdds ?? null;
      const direction: string | null = offer.sideID ?? null;

      results.push({
        eventID,
        leagueID,
        sportID,
        startsAtUTC,
        startsAtET,
        homeTeam,
        homeTeamID,
        awayTeam,
        awayTeamID,
        playerId,
        playerName,
        statType,
        ou,
        direction,
        marketKey,
        line,
        odds,
        sportsbook: null,
        period: offer.periodID ?? null,
        meta,
      });
    }
  }
  return results;
}

// ---- COMBINED: Fetch and Flatten in One ----
export async function fetchAndFlattenSGOProps(opts: Parameters<typeof fetchSGOEvents>[0]): Promise<SGOFlattenedProp[]> {
  const events = await fetchSGOEvents(opts);
  return flattenSGOEvents(events);
}

// ---- PAGINATED FETCH FOR HISTORICAL DATA ----
export async function fetchSGOEventsWithPagination({
  apiKey,
  leagueID,
  startsAfter,
  startsBefore,
  finalized = true,
  includeAltLine = true,
  maxPages = 20, // Prevent infinite loops
}: {
  apiKey: string;
  leagueID: string;
  startsAfter: string;
  startsBefore: string;
  finalized?: boolean;
  includeAltLine?: boolean;
  maxPages?: number;
}): Promise<any[]> {
  const allEvents: any[] = [];
  let page = 1;
  let hasMoreData = true;

  console.log(`   🔄 Starting paginated fetch for ${leagueID} from ${startsAfter} to ${startsBefore}`);

  while (hasMoreData && page <= maxPages) {
    try {
      console.log(`      📄 Fetching page ${page}/${maxPages}...`);

      const events = await fetchSGOEvents({
        apiKey,
        leagueID,
        startsAfter,
        startsBefore,
        finalized,
        includeAltLine,
        limit: 50, // SGO maximum
      });

      if (!events || events.length === 0) {
        console.log(`      ✅ No more data on page ${page}, stopping pagination`);
        hasMoreData = false;
      } else {
        allEvents.push(...events);
        console.log(`      ✅ Page ${page}: Found ${events.length} events (Total: ${allEvents.length})`);

        // If we got less than the limit, we've reached the end
        if (events.length < 50) {
          console.log(`      🏁 Reached end of data (got ${events.length} < 50)`);
          hasMoreData = false;
        } else {
          page++;
          // Rate limiting between pages
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error: any) {
      console.error(`      ❌ Error on page ${page}:`, error.message);
      hasMoreData = false;
    }
  }

  console.log(`   ✅ Pagination complete: ${allEvents.length} total events across ${page - 1} pages`);
  return allEvents;
}

// ---- Helper Functions for Enhanced SGO Queries ----

/**
 * Fetch specific player props for a given player
 * Example: fetchSGOPlayerProps(apiKey, "NBA", "JALEN_DUREN_1_NBA", ["points", "rebounds"])
 */
export async function fetchSGOPlayerProps({
  apiKey,
  leagueID,
  playerID,
  propTypes,
  startsAfter,
  startsBefore,
  finalized = false,
}: {
  apiKey: string;
  leagueID: string;
  playerID: string;
  propTypes: string[]; // e.g., ["points", "rebounds", "assists"]
  startsAfter?: string;
  startsBefore?: string;
  finalized?: boolean;
}): Promise<SGOFlattenedProp[]> {
  // Build oddIDs for both over/under for each prop type
  const oddIDs: string[] = [];
  propTypes.forEach(propType => {
    oddIDs.push(`${propType}-${playerID}-game-ou-over`);
    oddIDs.push(`${propType}-${playerID}-game-ou-under`);
  });

  const events = await fetchSGOEvents({
    apiKey,
    leagueID,
    oddIDs,
    startsAfter,
    startsBefore,
    finalized,
    oddsAvailable: true,
  });

  return flattenSGOEvents(events);
}

/**
 * Fetch historic league data for backtesting
 * Example: fetchSGOHistoricData(apiKey, "NBA", "2024-03-28T07:00:00Z", "2024-09-30T06:59:59Z")
 */
export async function fetchSGOHistoricData({
  apiKey,
  leagueID,
  startsAfter,
  startsBefore,
  includeAltLine = true,
  limit = 100,
}: {
  apiKey: string;
  leagueID: string;
  startsAfter: string;
  startsBefore: string;
  includeAltLine?: boolean;
  limit?: number;
}): Promise<SGOFlattenedProp[]> {
  const events = await fetchSGOEvents({
    apiKey,
    leagueID,
    startsAfter,
    startsBefore,
    includeAltLine,
    finalized: true,
    limit,
  });

  return flattenSGOEvents(events);
}

/**
 * Fetch specific event by ID
 * Example: fetchSGOEventByID(apiKey, "EPL", "THE_EVENT_ID")
 */
export async function fetchSGOEventByID({
  apiKey,
  leagueID,
  eventID,
}: {
  apiKey: string;
  leagueID: string;
  eventID: string;
}): Promise<SGOFlattenedProp[]> {
  const events = await fetchSGOEvents({
    apiKey,
    leagueID,
    eventID,
  });

  return flattenSGOEvents(events);
}

/**
 * Fetch upcoming games for a league starting after a specific time
 * Example: fetchSGOUpcomingGames(apiKey, "NCAAB", "2025-02-27T18:00:00Z")
 */
export async function fetchSGOUpcomingGames({
  apiKey,
  leagueID,
  startsAfter,
  limit = 100,
}: {
  apiKey: string;
  leagueID: string;
  startsAfter: string;
  limit?: number;
}): Promise<SGOFlattenedProp[]> {
  const events = await fetchSGOEvents({
    apiKey,
    leagueID,
    startsAfter,
    limit,
    oddsPresent: true,
  });

  return flattenSGOEvents(events);
}
