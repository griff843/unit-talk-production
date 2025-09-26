/**
 * The Odds API Integration for Unit Talk Platform
 * 
 * This module provides integration with The Odds API for comprehensive sports betting data.
 * API Documentation: https://the-odds-api.com/liveapi/guides/v4/
 * 
 * Key Features:
 * - Multi-sport coverage (70+ sports including NCAAF)
 * - Live odds, spreads, totals, and moneylines
 * - Settlement data via scores endpoint
 * - Credit-based usage monitoring
 * - Rate limiting and error handling
 * - Unified data format for existing pipeline
 */

import { randomUUID } from 'crypto';

import axios, { AxiosResponse } from 'axios';

import { RawProp } from '../../types/rawProps';
import { creditLogger } from '../../services/creditLogger.js';
import { cacheClient } from '../../services/cacheClient.js';

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://api.the-odds-api.com/v4',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Credit monitoring for free tier (500 credits/month)
const CREDIT_MONITOR = {
  monthlyLimit: 500,
  dailyBudget: 16, // ~500/30 days
  currentUsage: 0,
  resetDate: new Date()
};

// Supported sports with their API keys
const SUPPORTED_SPORTS = {
  // American Football
  'americanfootball_nfl': 'NFL',
  'americanfootball_ncaaf': 'NCAAF',
  
  // Basketball  
  'basketball_nba': 'NBA',
  'basketball_ncaab': 'NCAAB',
  'basketball_wnba': 'WNBA',
  
  // Baseball
  'baseball_mlb': 'MLB',
  
  // Hockey
  'icehockey_nhl': 'NHL',
  
  // Soccer (major leagues)
  'soccer_epl': 'EPL',
  'soccer_uefa_champs_league': 'UEFA Champions League',
  
  // Tennis
  'tennis_atp': 'ATP',
  'tennis_wta': 'WTA'
} as const;

type SupportedSportKey = keyof typeof SUPPORTED_SPORTS;

// Betting markets available
const BETTING_MARKETS = {
  h2h: 'Head to Head (Moneyline)',
  spreads: 'Point Spreads', 
  totals: 'Over/Under Totals',
  outrights: 'Tournament/Season Futures'
} as const;

type BettingMarket = keyof typeof BETTING_MARKETS;

// Bookmaker regions
const BOOKMAKER_REGIONS = {
  us: 'US Bookmakers',
  uk: 'UK Bookmakers', 
  eu: 'European Bookmakers',
  au: 'Australian Bookmakers'
} as const;

type BookmakerRegion = keyof typeof BOOKMAKER_REGIONS;

// API Response Interfaces
interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number; // For spreads and totals
}

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

interface OddsApiScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: Array<{
    name: string;
    score: string | number;
  }> | null;
  last_update: string | null;
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

/**
 * Resolve Odds API configuration from environment and CLI args
 *
 * Priority: CLI args > ENV vars > defaults
 * Logs the final resolved configuration
 *
 * @param cliOverrides - Optional CLI overrides
 * @returns Resolved configuration object
 */
export function resolveOddsConfig(cliOverrides?: {
  markets?: string[];
  regions?: string;
  bookmakers?: string[];
  oddsFormat?: 'decimal' | 'american';
  dateFormat?: 'iso' | 'unix';
  eventBatchSize?: number;
  eventLookaheadHours?: number;
  minRemainingCredits?: number;
}) {
  const config = {
    markets: cliOverrides?.markets ||
             (process.env.FEED_MARKETS?.split(',').map(m => m.trim()) ?? ['h2h', 'spreads', 'totals']),
    regions: cliOverrides?.regions || process.env.FEED_REGIONS || 'us',
    bookmakers: cliOverrides?.bookmakers ||
                (process.env.FEED_BOOKMAKERS?.split(',').map(b => b.trim()) ?? ['draftkings', 'fanduel', 'betmgm', 'caesars']),
    oddsFormat: (cliOverrides?.oddsFormat || process.env.ODDS_API_ODDS_FORMAT || 'american') as 'decimal' | 'american',
    dateFormat: (cliOverrides?.dateFormat || process.env.ODDS_API_DATE_FORMAT || 'iso') as 'iso' | 'unix',
    eventBatchSize: cliOverrides?.eventBatchSize || parseInt(process.env.FEED_EVENT_BATCH_SIZE || '20', 10),
    eventLookaheadHours: cliOverrides?.eventLookaheadHours || parseInt(process.env.FEED_EVENT_LOOKAHEAD_HOURS || '48', 10),
    minRemainingCredits: cliOverrides?.minRemainingCredits || parseInt(process.env.ODDS_API_MIN_REMAINING || '25', 10)
  };

  console.log('[OddsAPI] Resolved config =>', JSON.stringify(config, null, 2));
  return config;
}

/**
 * Expand market alias tokens to valid Odds API market names
 *
 * CRITICAL: "player-props" is NOT a valid Odds API market token.
 * This function routes to props flow (should be handled separately).
 *
 * @param sport - Sport key (e.g., 'americanfootball_nfl', 'basketball_nba')
 * @param tokens - Array of market tokens (may include 'player-props' alias)
 * @returns Array of valid Odds API market names (player-props filtered out)
 */
export function expandMarketAliases(sport: string, tokens: string[]): string[] {
  const expanded: string[] = [];

  for (const token of tokens) {
    const lowerToken = token.toLowerCase().trim();

    if (lowerToken === 'player-props') {
      // SKIP player-props - route to separate props flow instead
      console.log(`[OddsAPI] Detected 'player-props' alias - routing to props flow (not core markets)`);
      continue;
    } else {
      // Pass through unchanged (h2h, spreads, totals)
      expanded.push(token.trim());
    }
  }

  return expanded;
}

/**
 * Credit usage tracking and monitoring with guard logic
 */
let lastRemainingCredits: number | null = null;

function trackCreditUsage(creditsUsed: number, remainingCredits?: string): void {
  CREDIT_MONITOR.currentUsage += creditsUsed;

  // Reset monthly usage if needed
  const now = new Date();
  if (now.getMonth() !== CREDIT_MONITOR.resetDate.getMonth()) {
    CREDIT_MONITOR.currentUsage = creditsUsed;
    CREDIT_MONITOR.resetDate = now;
  }

  // Update last remaining credits from header
  if (remainingCredits) {
    lastRemainingCredits = parseInt(remainingCredits, 10);
  }

  console.log(`[OddsAPI] Credits used: ${creditsUsed} | Monthly total: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit} | Remaining: ${lastRemainingCredits ?? 'unknown'}`);

  // Warn if approaching limits
  if (CREDIT_MONITOR.currentUsage >= CREDIT_MONITOR.monthlyLimit * 0.8) {
    console.warn(`[OddsAPI] ⚠️ Approaching monthly credit limit: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit}`);
  }
}

/**
 * Check if we should skip props based on remaining credits
 */
export function shouldSkipProps(threshold: number = 25): boolean {
  if (lastRemainingCredits !== null && lastRemainingCredits < threshold) {
    console.warn(`[OddsAPI] ⚠️ Remaining credits (${lastRemainingCredits}) below threshold (${threshold}) - skipping props`);
    return true;
  }
  return false;
}

function canMakeRequest(): { allowed: boolean; reason?: string } {
  if (CREDIT_MONITOR.currentUsage >= CREDIT_MONITOR.monthlyLimit) {
    return { 
      allowed: false, 
      reason: `Monthly credit limit exceeded: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit}` 
    };
  }
  
  const dailyUsage = Math.floor(CREDIT_MONITOR.currentUsage / (new Date().getDate()));
  if (dailyUsage >= CREDIT_MONITOR.dailyBudget * 1.5) {
    return { 
      allowed: false, 
      reason: `Daily credit budget exceeded: ${dailyUsage}/${CREDIT_MONITOR.dailyBudget}` 
    };
  }
  
  return { allowed: true };
}

/**
 * Get current credit usage status
 */
export function getCreditUsageStatus() {
  const now = new Date();
  const dailyEstimate = Math.floor(CREDIT_MONITOR.currentUsage / now.getDate());
  
  return {
    monthlyUsed: CREDIT_MONITOR.currentUsage,
    monthlyLimit: CREDIT_MONITOR.monthlyLimit,
    dailyBudget: CREDIT_MONITOR.dailyBudget,
    dailyEstimate,
    percentUsed: Math.round((CREDIT_MONITOR.currentUsage / CREDIT_MONITOR.monthlyLimit) * 100),
    daysRemaining: 30 - now.getDate(),
    resetDate: CREDIT_MONITOR.resetDate.toISOString()
  };
}

/**
 * Make authenticated API request to The Odds API
 */
async function makeOddsApiRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  const apiKey = process.env['ODDS_API_KEY'] || '8014c48eb8a05f289de049c0961ac4cf';
  
  if (!apiKey) {
    throw new Error('ODDS_API_KEY environment variable is required');
  }

  // Check credit limits before making request
  const creditCheck = canMakeRequest();
  if (!creditCheck.allowed) {
    throw new Error(`Request blocked: ${creditCheck.reason}`);
  }

  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  // Check cache first if enabled
  const cacheKey = `oddsapi:${endpoint}:${JSON.stringify(params || {})}`;
  const cachedData = await cacheClient.get(cacheKey);
  if (cachedData && cacheClient.isCacheFirst()) {
    return cachedData;
  }

  try {
    // Log the API call with deduplication
    const dedupKey = `oddsapi-${endpoint}-${Date.now()}`;
    creditLogger.addCall('oddsapi', 1, 1, dedupKey);

    const response: AxiosResponse<T> = await axios.get(url, {
      params: {
        apiKey,
        ...params
      },
      timeout: API_CONFIG.timeout
    });

    // Track credit usage (1 credit per request)
    const remainingCredits = response.headers['x-requests-remaining'];
    trackCreditUsage(1, remainingCredits);

    // Log remaining credits from response headers
    if (remainingCredits) {
      console.log(`[OddsAPI] Remaining credits: ${remainingCredits}`);
    }

    // Cache the response
    await cacheClient.set(cacheKey, response.data);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;
      
      console.error(`[OddsAPI] API Error:`, {
        status,
        statusText,
        url,
        responseData,
        params
      });

      // Handle specific error codes
      if (status === 401) {
        throw new Error('Invalid API key for The Odds API');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded for The Odds API');
      } else if (status === 422) {
        throw new Error(`Invalid request parameters: ${JSON.stringify(responseData)}`);
      }

      throw new Error(`Odds API request failed (${status}): ${responseData?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Get list of available sports
 */
export async function fetchAvailableSports(): Promise<OddsApiSport[]> {
  console.log('[OddsAPI] Fetching available sports...');
  
  try {
    const sports = await makeOddsApiRequest<OddsApiSport[]>('/sports');
    console.log(`[OddsAPI] Found ${sports.length} available sports`);
    
    // Filter to show only active sports we support
    const supportedSports = sports.filter(sport => 
      Object.keys(SUPPORTED_SPORTS).includes(sport.key) && sport.active
    );
    
    console.log(`[OddsAPI] Supported active sports: ${supportedSports.length}`);
    supportedSports.forEach(sport => {
      console.log(`  - ${sport.title} (${sport.key})`);
    });
    
    return supportedSports;
  } catch (error) {
    console.error('[OddsAPI] Failed to fetch sports:', error);
    throw error;
  }
}

/**
 * Fetch odds for a specific sport and market
 */
export async function fetchOdds(
  sportKey: SupportedSportKey,
  markets: BettingMarket[] = ['h2h', 'spreads', 'totals'],
  regions: BookmakerRegion[] = ['us'],
  oddsFormat: 'decimal' | 'american' = 'american'
): Promise<OddsApiGame[]> {
  console.log(`[OddsAPI] Fetching odds for ${sportKey} - Markets: ${markets.join(', ')}`);
  
  try {
    const games = await makeOddsApiRequest<OddsApiGame[]>('/sports/' + sportKey + '/odds', {
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat,
      dateFormat: 'iso'
    });
    
    console.log(`[OddsAPI] Fetched odds for ${games.length} games in ${sportKey}`);
    return games;
  } catch (error) {
    console.error(`[OddsAPI] Failed to fetch odds for ${sportKey}:`, error);
    throw error;
  }
}

/**
 * Fetch scores/results for settlement data
 */
export async function fetchScores(
  sportKey: SupportedSportKey,
  daysFrom: number = 1
): Promise<OddsApiScore[]> {
  console.log(`[OddsAPI] Fetching scores for ${sportKey} (${daysFrom} days)`);

  try {
    const scores = await makeOddsApiRequest<OddsApiScore[]>('/sports/' + sportKey + '/scores', {
      daysFrom,
      dateFormat: 'iso'
    });

    console.log(`[OddsAPI] Fetched scores for ${scores.length} games in ${sportKey}`);
    return scores;
  } catch (error) {
    console.error(`[OddsAPI] Failed to fetch scores for ${sportKey}:`, error);
    throw error;
  }
}

/**
 * Fetch events (schedule) for a sport - Event-First Flow Step 1
 *
 * This is the first step in the event-first architecture.
 * Get the list of upcoming events, then fetch odds per event.
 *
 * @param sportKey - Sport key (e.g., 'americanfootball_nfl')
 * @param daysFrom - Number of days from now (default 1 = next 24 hours)
 * @returns List of events with IDs
 */
export async function fetchEvents(
  sportKey: SupportedSportKey,
  daysFrom: number = 1
): Promise<OddsApiEvent[]> {
  console.log(`[OddsAPI] Fetching events for ${sportKey} (daysFrom=${daysFrom})`);

  try {
    const events = await makeOddsApiRequest<OddsApiEvent[]>(
      `/sports/${sportKey}/events`,
      {
        daysFrom,
        dateFormat: 'iso'
      }
    );

    console.log(`[OddsAPI] Found ${events.length} events for ${sportKey}`);
    return events;
  } catch (error) {
    console.error(`[OddsAPI] Failed to fetch events for ${sportKey}:`, error);
    throw error;
  }
}

/**
 * Fetch odds for specific event IDs - Event-First Flow Step 2
 *
 * This is the second step in the event-first architecture.
 * Given a list of event IDs, fetch odds for those specific events.
 *
 * IMPORTANT: Batch event IDs to avoid URL length limits (recommend 20 per request)
 *
 * @param params - Configuration object
 * @returns Odds data for the specified events
 */
export async function fetchOddsByEventIds(params: {
  sportKey: SupportedSportKey;
  eventIds: string[];
  markets: string[];
  regions: string;
  bookmakers?: string[];
  oddsFormat: 'decimal' | 'american';
  dateFormat: 'iso' | 'unix';
}): Promise<OddsApiGame[]> {
  const { sportKey, eventIds, markets, regions, bookmakers, oddsFormat, dateFormat } = params;

  if (eventIds.length === 0) {
    console.warn(`[OddsAPI] No event IDs provided for ${sportKey}`);
    return [];
  }

  console.log(`[OddsAPI] Fetching odds for ${eventIds.length} events in ${sportKey}`);
  console.log(`[OddsAPI] Resolved config => { sport: ${sportKey}, regions: ${regions}, markets: ${markets.join(',')}, bookmakers: ${bookmakers?.join(',') || 'all'}, oddsFormat: ${oddsFormat}, dateFormat: ${dateFormat} }`);

  try {
    const requestParams: Record<string, any> = {
      eventIds: eventIds.join(','),
      regions,
      markets: markets.join(','),
      oddsFormat,
      dateFormat
    };

    // Add bookmakers filter if specified
    if (bookmakers && bookmakers.length > 0) {
      requestParams.bookmakers = bookmakers.join(',');
    }

    const games = await makeOddsApiRequest<OddsApiGame[]>(
      `/sports/${sportKey}/odds`,
      requestParams
    );

    console.log(`[OddsAPI] Fetched odds for ${games.length} games (requested ${eventIds.length} events)`);
    return games;
  } catch (error) {
    console.error(`[OddsAPI] Failed to fetch odds for event IDs:`, error);
    throw error;
  }
}

/**
 * Convert Odds API game data to RawProp format for existing pipeline
 */
function convertOddsApiToRawProp(
  game: OddsApiGame, 
  market: OddsApiMarket, 
  outcome: OddsApiOutcome,
  bookmaker: OddsApiBookmaker
): RawProp {
  const uuid = randomUUID();
  
  // Fix: Properly map sport_key to consistent sport/league values
  const sportMapping = SUPPORTED_SPORTS[game.sport_key as SupportedSportKey];
  const sport = sportMapping || game.sport_title || 'UNKNOWN';
  const league = sportMapping || game.sport_title || 'UNKNOWN';
  
  // Add validation logging for unmapped sports
  if (!sportMapping) {
    console.warn(`[OddsAPI] Unmapped sport_key: ${game.sport_key} → defaulting to: ${sport}`);
  }
  
  // Determine bet type based on market
  let betType = 'unknown';
  let line = outcome.point || 0;
  let statType = market.key;
  
  switch (market.key) {
    case 'h2h':
      betType = 'moneyline';
      statType = 'moneyline';
      break;
    case 'spreads':
      betType = 'spread';
      statType = 'spread';
      line = outcome.point || 0;
      break;
    case 'totals':
      betType = 'total';
      statType = 'total';
      line = outcome.point || 0;
      break;
  }
  
  // Convert American odds to over/under format
  const odds = outcome.price;
  const isPositive = odds > 0;
  
  return {
    // Required database fields
    id: uuid,
    external_game_id: game.id,
    game_id: null,
    player_name: outcome.name, // Team name for team-based bets
    team: outcome.name.includes(game.home_team) ? game.home_team : game.away_team,
    stat_type: statType,
    line: line,
    over_odds: isPositive ? odds : 0,
    under_odds: isPositive ? 0 : Math.abs(odds),
    provider: 'The Odds API',

    // Timing
    game_time: game.commence_time,
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    game_date: game.commence_time.split('T')[0],

    // Teams
    home_team: game.home_team,
    away_team: game.away_team,
    opponent: outcome.name.includes(game.home_team) ? game.away_team : game.home_team,

    // Sport info - Fixed to use proper sport mapping
    sport: sport,
    sport_key: game.sport_key,
    matchup: `${game.away_team} @ ${game.home_team}`,

    // Source identification
    source: 'odds-api',

    // Default values for existing pipeline compatibility
    outcome: null,
    odds: Math.abs(odds),
    trend_confidence: 0,
    matchup_quality: 0,
    line_value_score: 0,
    role_stability: 0,
    confidence_score: 0,
    edge_score: 0,
    tier_tag: null,
    auto_approved: false,
    context_flag: false,
    promoted_to_picks: false,
    promoted_at: null,
    promoted: false,
    is_promoted: false,
    bet_type: betType,
    market_type: statType,
    outcomes: undefined,
    player_id: undefined,
    player_slug: undefined,
    external_id: game.id,
    league: league,
    fair_odds: undefined,
    market: bookmaker.title,
    start_time: game.commence_time,
    home_team_id: null,
    away_team_id: null,
    unit_size: null,
    tier: null,
    ev_percent: null,
    trend_score: null,
    matchup_score: null,
    line_score: null,
    role_score: null,
    direction: null,
    unique_key: `${game.id}-${market.key}-${outcome.name}-${bookmaker.key}`,
    event_id: game.id,
    book: bookmaker.title,
    updated_at: market.last_update,
    is_alt_line: null,
    is_primary: null,
    is_valid: undefined
  };
}

/**
 * Main function to fetch comprehensive odds data and convert to RawProp format
 *
 * NOW USES EVENT-FIRST ARCHITECTURE:
 * 1. Fetch events (schedule)
 * 2. Batch event IDs (20 per request)
 * 3. Fetch odds per batch
 * 4. Aggregate and convert to RawProp[]
 *
 * @param sportKey - Sport key (e.g., 'americanfootball_nfl')
 * @param markets - Markets to fetch (supports market aliases like 'player-props')
 * @param regions - Bookmaker regions (default 'us')
 * @param oddsFormat - Odds format (default 'american')
 * @param dateFormat - Date format (default 'iso')
 * @param daysFrom - Days from now to fetch events (default 1)
 * @returns Array of RawProp objects
 */
export async function fetchOddsApiProps(
  sportKey: SupportedSportKey = 'americanfootball_ncaaf',
  markets: string[] = ['h2h', 'spreads', 'totals'],
  regions: string = 'us',
  oddsFormat: 'decimal' | 'american' = 'american',
  dateFormat: 'iso' | 'unix' = 'iso',
  daysFrom: number = 1
): Promise<RawProp[]> {
  try {
    console.log(`[OddsAPI] Fetching comprehensive data for ${sportKey} using event-first flow`);

    // Expand market aliases (e.g., 'player-props' → valid per-sport markets)
    const expandedMarkets = expandMarketAliases(sportKey, markets);
    console.log(`[OddsAPI] Markets after alias expansion: ${expandedMarkets.join(', ')}`);

    // Step 1: Fetch events (schedule)
    const events = await fetchEvents(sportKey, daysFrom);

    if (events.length === 0) {
      console.log(`[OddsAPI] No events found for ${sportKey}`);
      return [];
    }

    // Resolve config for batching
    const config = resolveOddsConfig({ oddsFormat, dateFormat });

    // Step 2: Batch event IDs (use config batchSize)
    const batchSize = config.eventBatchSize;
    const eventIdBatches: string[][] = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize).map(e => e.id);
      eventIdBatches.push(batch);
    }

    console.log(`[OddsAPI] Processing ${events.length} events in ${eventIdBatches.length} batches (batchSize=${batchSize})`);

    // Step 3: Fetch odds per batch
    const allGames: OddsApiGame[] = [];

    for (let i = 0; i < eventIdBatches.length; i++) {
      const batch = eventIdBatches[i];
      console.log(`[OddsAPI] Fetching batch ${i + 1}/${eventIdBatches.length} (${batch.length} events)`);

      const games = await fetchOddsByEventIds({
        sportKey,
        eventIds: batch,
        markets: expandedMarkets,
        regions,
        bookmakers: config.bookmakers,
        oddsFormat,
        dateFormat
      });

      allGames.push(...games);
    }

    // Step 4: Convert to RawProp format
    const rawProps: RawProp[] = [];

    for (const game of allGames) {
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          // Check if this market was requested (use expanded markets list)
          if (expandedMarkets.includes(market.key)) {
            for (const outcome of market.outcomes) {
              const rawProp = convertOddsApiToRawProp(game, market, outcome, bookmaker);
              rawProps.push(rawProp);
            }
          }
        }
      }
    }

    console.log(`[OddsAPI] Event-first flow complete: ${allGames.length} games processed, ${rawProps.length} odds converted`);
    return rawProps;

  } catch (error) {
    console.error(`[OddsAPI] Error fetching props for ${sportKey}:`, error);
    return [];
  }
}

/**
 * Get settlement data for completed games
 */
export async function fetchSettlementData(
  sportKey: SupportedSportKey,
  daysFrom: number = 1
): Promise<OddsApiScore[]> {
  try {
    const scores = await fetchScores(sportKey, daysFrom);
    
    // Filter to only completed games with scores
    const settledGames = scores.filter(scoreItem => 
      scoreItem.completed && 
      scoreItem.scores && 
      scoreItem.scores.length > 0
    );
    
    console.log(`[OddsAPI] Found ${settledGames.length} completed games with settlement data`);
    return settledGames;
    
  } catch (error) {
    console.error(`[OddsAPI] Error fetching settlement data for ${sportKey}:`, error);
    return [];
  }
}

/**
 * Fetch props for specific events (feature-flagged)
 *
 * Only runs when FEED_ENABLE_PROPS=1
 * Uses per-event calls with explicit prop market keys
 * Respects credit guard and batching
 *
 * @param sportKey - Sport key
 * @param eventIds - Event IDs to fetch props for
 * @returns Array of RawProp objects
 */
export async function fetchPropsByEventIds(
  sportKey: SupportedSportKey,
  eventIds: string[]
): Promise<RawProp[]> {
  // Check if props are enabled
  const propsEnabled = process.env.FEED_ENABLE_PROPS === '1';
  if (!propsEnabled) {
    console.log('[OddsAPI] Props disabled (FEED_ENABLE_PROPS!=1)');
    return [];
  }

  // Check credit guard
  const minRemaining = parseInt(process.env.ODDS_API_MIN_REMAINING || '25', 10);
  if (shouldSkipProps(minRemaining)) {
    console.warn('[OddsAPI] Skipping props due to low credits');
    return [];
  }

  // Get sport-specific prop markets
  const sportUpper = sportKey.toUpperCase().replace('AMERICANFOOTBALL_', '').replace('BASKETBALL_', '').replace('BASEBALL_', '').replace('ICEHOCKEY_', '');
  const propMarketsEnv = process.env[`FEED_PROP_MARKETS_${sportUpper}`];

  if (!propMarketsEnv) {
    console.log(`[OddsAPI] No prop markets configured for ${sportUpper}`);
    return [];
  }

  const propMarkets = propMarketsEnv.split(',').map(m => m.trim());
  const propBookmakers = process.env.FEED_PROP_BOOKMAKERS?.split(',').map(b => b.trim()) ?? ['draftkings', 'fanduel'];
  const config = resolveOddsConfig();

  console.log(`[OddsAPI] Fetching props for ${sportKey}: ${propMarkets.join(', ')}`);

  // Batch eventIds (20 per request)
  const batchSize = config.eventBatchSize;
  const allGames: OddsApiGame[] = [];

  for (let i = 0; i < eventIds.length; i += batchSize) {
    const batch = eventIds.slice(i, i + batchSize);
    console.log(`[OddsAPI] Fetching prop batch ${Math.floor(i / batchSize) + 1} (${batch.length} events)`);

    try {
      const games = await fetchOddsByEventIds({
        sportKey,
        eventIds: batch,
        markets: propMarkets,
        regions: config.regions,
        bookmakers: propBookmakers,
        oddsFormat: config.oddsFormat,
        dateFormat: config.dateFormat
      });

      allGames.push(...games);
    } catch (error) {
      console.error(`[OddsAPI] Error fetching prop batch:`, error);
      // Continue with next batch
    }
  }

  // Convert to RawProp format
  const rawProps: RawProp[] = [];
  for (const game of allGames) {
    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          const rawProp = convertOddsApiToRawProp(game, market, outcome, bookmaker);
          rawProps.push(rawProp);
        }
      }
    }
  }

  console.log(`[OddsAPI] Fetched ${rawProps.length} props for ${sportKey}`);
  return rawProps;
}

/**
 * Clear credit usage cache (for testing)
 */
export function clearCreditUsageCache(): void {
  CREDIT_MONITOR.currentUsage = 0;
  CREDIT_MONITOR.resetDate = new Date();
}

/**
 * Test API connectivity and credit status
 */
export async function testOddsApiConnection(): Promise<{
  connected: boolean;
  availableSports: number;
  creditStatus: any;
  error?: string;
}> {
  try {
    console.log('[OddsAPI] Testing API connection...');
    
    const sports = await fetchAvailableSports();
    const creditStatus = getCreditUsageStatus();
    
    return {
      connected: true,
      availableSports: sports.length,
      creditStatus
    };
  } catch (error) {
    return {
      connected: false,
      availableSports: 0,
      creditStatus: getCreditUsageStatus(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * OddsApiClient class for compatibility with existing code
 */
export class OddsApiClient {
  // private _apiKey: string; // Unused - commented out
  
  constructor(_apiKey?: string) {
    // this._apiKey = apiKey || process.env['ODDS_API_KEY'] || '8014c48eb8a05f289de049c0961ac4cf';
    // API key handling removed as unused
  }

  async fetchAvailableSports(): Promise<OddsApiSport[]> {
    return fetchAvailableSports();
  }

  async fetchOdds(
    sportKey: SupportedSportKey,
    markets: BettingMarket[] = ['h2h', 'spreads', 'totals'],
    regions: BookmakerRegion[] = ['us'],
    oddsFormat: 'decimal' | 'american' = 'american'
  ): Promise<OddsApiGame[]> {
    return fetchOdds(sportKey, markets, regions, oddsFormat);
  }

  async fetchScores(sportKey: SupportedSportKey, daysFrom: number = 1): Promise<OddsApiScore[]> {
    return fetchScores(sportKey, daysFrom);
  }

  async fetchOddsApiProps(
    sportKey: SupportedSportKey = 'americanfootball_ncaaf',
    markets: BettingMarket[] = ['h2h', 'spreads', 'totals']
  ): Promise<RawProp[]> {
    return fetchOddsApiProps(sportKey, markets);
  }

  async fetchSettlementData(sportKey: SupportedSportKey, daysFrom: number = 1): Promise<OddsApiScore[]> {
    return fetchSettlementData(sportKey, daysFrom);
  }

  async testConnection() {
    return testOddsApiConnection();
  }

  getCreditUsageStatus() {
    return getCreditUsageStatus();
  }

  clearCreditUsageCache() {
    return clearCreditUsageCache();
  }
}