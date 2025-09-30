/**
 * Optimal API Integration for Unit Talk Platform
 * 
 * This module provides integration with the Optimal API for fetching sports betting props.
 * Based on the API documentation at: https://optimal-bet-api.readme.io/reference/getsportsbooks
 * 
 * API Endpoints:
 * - GET /v1/playerPropTypes - Get available prop types
 * - GET /v1/playerProps/{sport} - Get player props for a sport
 * - GET /v1/gamelines/{sport} - Get game lines for a sport  
 * - GET /v1/events - Get available events
 * 
 * Key Features:
 * - Rate limiting (900 requests per hour)
 * - Error handling and retry logic
 * - Multi-league support
 * - Data normalization for Unit Talk schema
 */

import { randomUUID } from 'crypto';

import axios, { AxiosResponse } from 'axios';

import { RawProp } from '../../types/rawProps';
import { creditLogger } from '../../services/creditLogger.js';
import { cacheClient } from '../../services/cacheClient.js';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 900,
  windowMs: 3600000, // 1 hour
  requestQueue: [] as number[]
};

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://api.optimal-bet.com',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Supported sports (based on API endpoints)
const SUPPORTED_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'] as const;
type SupportedSport = typeof SUPPORTED_SPORTS[number];

// Interfaces for API responses
interface OptimalPlayerPropType {
  id: string;
  name: string;
  category: string;
  sport: string;
}

interface OptimalPlayerProp {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  game_id: string;
  game_time: string;
  prop_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  sportsbook: string;
  market: string;
  created_at: string;
  updated_at: string;
}

interface OptimalEvent {
  id: string;
  league: string;
  start_date: string;
  start_date_code: string;
  home: string;
  away: string;
  home_display: string;
  away_display: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  status: string;
}

interface OptimalOffer {
  propType: string;
  line: number;
  offerType: 'over' | 'under';
  oddsAmerican: number;
  oddsDecimal: number;
  sportsbook: string;
  timestamp?: string;
}

interface OptimalPlayer {
  team: string;
  eventId: string;
  statsId: string;
  name: string;
  offers: OptimalOffer[];
  position: string;
}

interface OptimalPlayerPropsResponse {
  players: OptimalPlayer[];
  eventId: string;
  away: string;
  league: string;
  home: string;
}

// Legacy interface for backward compatibility
interface OptimalPlayerProp {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  game_id: string;
  game_time: string;
  prop_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  sportsbook: string;
  market: string;
  created_at: string;
  updated_at: string;
}

interface OptimalGameLine {
  id: string;
  game_id: string;
  sportsbook: string;
  spread_home: number;
  spread_away: number;
  spread_home_odds: number;
  spread_away_odds: number;
  total: number;
  over_odds: number;
  under_odds: number;
  moneyline_home: number;
  moneyline_away: number;
  sport: string;
  created_at: string;
  updated_at: string;
}

/**
 * Rate limiting functions
 */
function canMakeRequest(): boolean {
  const now = Date.now();
  
  // Remove requests outside the current window
  RATE_LIMIT.requestQueue = RATE_LIMIT.requestQueue.filter(
    timestamp => now - timestamp < RATE_LIMIT.windowMs
  );
  
  return RATE_LIMIT.requestQueue.length < RATE_LIMIT.maxRequests;
}

function recordRequest(): void {
  RATE_LIMIT.requestQueue.push(Date.now());
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus() {
  const now = Date.now();
  const requestsInWindow = RATE_LIMIT.requestQueue.filter(
    timestamp => now - timestamp < RATE_LIMIT.windowMs
  ).length;
  
  return {
    requestsInWindow,
    maxRequests: RATE_LIMIT.maxRequests,
    windowMs: RATE_LIMIT.windowMs,
    canMakeRequest: requestsInWindow < RATE_LIMIT.maxRequests
  };
}

/**
 * Make authenticated API request to Optimal
 */
async function makeOptimalRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  const apiKey = process.env['OPTIMAL_API_KEY'];
  
  if (!apiKey) {
    throw new Error('OPTIMAL_API_KEY environment variable is required');
  }

  if (!canMakeRequest()) {
    const firstRequest = RATE_LIMIT.requestQueue[0];
    const waitTime = firstRequest ? Math.ceil((RATE_LIMIT.windowMs - (Date.now() - firstRequest)) / 1000) : 60;
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before making another request.`);
  }

  const url = `${API_CONFIG.baseUrl}${endpoint}`;
  
  // Check cache first if enabled
  const cacheKey = `optimal:${endpoint}:${JSON.stringify(params || {})}`;
  const cachedData = await cacheClient.get(cacheKey);
  if (cachedData && cacheClient.isCacheFirst()) {
    return cachedData;
  }

  try {
    recordRequest();

    // Log the API call with deduplication
    const dedupKey = `optimal-${endpoint}-${Date.now()}`;
    creditLogger.addCall('optimal', 1, 1, dedupKey);

    const response: AxiosResponse<T> = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        // Note: Update authentication method based on actual API requirements
        // Common patterns: 'Authorization': `Bearer ${apiKey}` or 'X-API-Key': apiKey
        'Authorization': `Bearer ${apiKey}`
      },
      params,
      timeout: API_CONFIG.timeout
    });

    // Cache the response
    await cacheClient.set(cacheKey, response.data);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;
      const message = error.response?.data?.message || error.message;

      console.error(`[Optimal] API Error Details:`, {
        status,
        statusText,
        url,
        responseData,
        message
      });

      throw new Error(`Optimal API request failed (${status}): ${message}`);
    }
    throw error;
  }
}

/**
 * Fetch available player prop types
 */
export async function fetchPlayerPropTypes(): Promise<OptimalPlayerPropType[]> {
  console.log('[Optimal] Fetching player prop types...');

  try {
    const propTypes = await makeOptimalRequest<OptimalPlayerPropType[]>('/v1/playerPropTypes');
    console.log(`[Optimal] Fetched ${propTypes.length} prop types`);
    return propTypes;
  } catch (error) {
    console.error('[Optimal] Failed to fetch prop types:', error);
    throw error;
  }
}

/**
 * Fetch player props for a specific sport and event
 */
export async function fetchPlayerProps(sport: string, eventId: string): Promise<OptimalPlayerProp[]> {
  console.log(`[Optimal] Fetching player props for ${sport} event ${eventId}...`);

  try {
    const response = await makeOptimalRequest<OptimalPlayerPropsResponse>(`/v1/playerProps/${sport}`, {
      eventId
    });

    console.log(`[Optimal] Raw response structure for ${sport} event ${eventId}:`, {
      hasPlayers: !!response.players,
      playersCount: response.players?.length || 0,
      samplePlayer: response.players?.[0] ? {
        name: response.players[0].name,
        team: response.players[0].team,
        offersCount: response.players[0].offers?.length || 0
      } : null
    });

    // Convert the new format to legacy format with proper odds parsing
    const legacyProps: OptimalPlayerProp[] = [];

    if (response.players && Array.isArray(response.players)) {
      for (const player of response.players) {
        if (player.offers && Array.isArray(player.offers)) {
          
          // Group offers by propType and line to combine over/under odds
          const offersByPropAndLine = new Map<string, {
            propType: string;
            line: number;
            over_odds?: number;
            under_odds?: number;
            sportsbook: string;
            timestamp?: string;
            over_sportsbook?: string;
            under_sportsbook?: string;
          }>();
          
          // First pass: group by propType and line only (not by sportsbook)
          const propLineOffers = new Map<string, OptimalOffer[]>();
          for (const offer of player.offers) {
            const key = `${offer.propType}-${offer.line}`;
            if (!propLineOffers.has(key)) {
              propLineOffers.set(key, []);
            }
            propLineOffers.get(key)!.push(offer);
          }
          
          // Second pass: create best odds combinations
          for (const [propLineKey, offers] of propLineOffers) {
            const [propType, lineStr] = propLineKey.split('-');
            const line = parseFloat(lineStr);
            
            // Find best over and under odds
            const overOffers = offers.filter(o => o.offerType === 'over');
            const underOffers = offers.filter(o => o.offerType === 'under');
            
            // Get best over odds (most positive for favorites, least negative for underdogs)
            let bestOverOffer: OptimalOffer | null = null;
            if (overOffers.length > 0) {
              bestOverOffer = overOffers.reduce((best, current) => {
                // American odds: higher values are better for bettors
                return current.oddsAmerican > best.oddsAmerican ? current : best;
              });
            }
            
            // Get best under odds (most positive for favorites, least negative for underdogs)
            let bestUnderOffer: OptimalOffer | null = null;
            if (underOffers.length > 0) {
              bestUnderOffer = underOffers.reduce((best, current) => {
                // American odds: higher values are better for bettors
                return current.oddsAmerican > best.oddsAmerican ? current : best;
              });
            }
            
            // Create prop entry if we have at least one side
            if (bestOverOffer || bestUnderOffer) {
              const combinedOffer = {
                propType,
                line,
                over_odds: bestOverOffer ? bestOverOffer.oddsAmerican : undefined,
                under_odds: bestUnderOffer ? bestUnderOffer.oddsAmerican : undefined,
                sportsbook: bestOverOffer ? bestOverOffer.sportsbook : bestUnderOffer!.sportsbook,
                over_sportsbook: bestOverOffer ? bestOverOffer.sportsbook : undefined,
                under_sportsbook: bestUnderOffer ? bestUnderOffer.sportsbook : undefined,
                timestamp: bestOverOffer?.timestamp || bestUnderOffer?.timestamp
              };
              
              const key = `${propType}-${line}-combined`;
              offersByPropAndLine.set(key, combinedOffer);
            }
          }
          
          // Convert to legacy format with smart defaults for missing sides
          for (const [_key, groupedOffer] of offersByPropAndLine) {
            let over_odds = groupedOffer.over_odds;
            let under_odds = groupedOffer.under_odds;
            
            // If we only have one side, estimate the other side using fair market assumptions
            if (over_odds && !under_odds) {
              // Convert American odds to probability, then back to opposite side
              const overProb = over_odds > 0 ? 100 / (over_odds + 100) : Math.abs(over_odds) / (Math.abs(over_odds) + 100);
              const underProb = 1 - overProb;
              under_odds = underProb > 0.5 ? 
                Math.round(-(underProb / (1 - underProb)) * 100) : 
                Math.round((1 - underProb) / underProb * 100);
            } else if (under_odds && !over_odds) {
              // Convert American odds to probability, then back to opposite side
              const underProb = under_odds > 0 ? 100 / (under_odds + 100) : Math.abs(under_odds) / (Math.abs(under_odds) + 100);
              const overProb = 1 - underProb;
              over_odds = overProb > 0.5 ? 
                Math.round(-(overProb / (1 - overProb)) * 100) : 
                Math.round((1 - overProb) / overProb * 100);
            }
            
            // Only include if we have at least one real odds value
            if (groupedOffer.over_odds || groupedOffer.under_odds) {
              legacyProps.push({
                id: `${player.eventId}-${player.statsId}-${groupedOffer.propType}-${groupedOffer.line}`,
                player_id: player.statsId,
                player_name: player.name,
                team: player.team,
                opponent: response.away === player.team ? response.home : response.away,
                game_id: player.eventId,
                game_time: '', // Will be filled from event data
                prop_type: groupedOffer.propType,
                line: groupedOffer.line,
                over_odds: over_odds || -110, // Default if still missing
                under_odds: under_odds || -110, // Default if still missing
                sportsbook: groupedOffer.over_sportsbook && groupedOffer.under_sportsbook ? 
                  `${groupedOffer.over_sportsbook}/${groupedOffer.under_sportsbook}` : 
                  groupedOffer.sportsbook,
                market: groupedOffer.propType,
                created_at: groupedOffer.timestamp || new Date().toISOString(),
                updated_at: groupedOffer.timestamp || new Date().toISOString()
              });
            }
          }
        }
      }
    }

    console.log(`[Optimal] Converted ${legacyProps.length} complete props (with both over/under odds) from ${response.players?.length || 0} players for ${sport} event ${eventId}`);
    return legacyProps;
  } catch (error) {
    console.error(`[Optimal] Error fetching props for ${sport} event ${eventId}:`, error);
    return [];
  }
}

/**
 * Fetch events for all sports
 */
export async function fetchEvents(): Promise<OptimalEvent[]> {
  console.log('[Optimal] Fetching events...');

  try {
    const response = await makeOptimalRequest<{ events: OptimalEvent[] }>('/v1/events');
    console.log(`[Optimal] Found ${response.events.length} events`);

    // Group events by league for logging
    const eventsByLeague: Record<string, number> = {};
    response.events.forEach(event => {
      eventsByLeague[event.league] = (eventsByLeague[event.league] || 0) + 1;
    });

    console.log('[Optimal] Events by league:', eventsByLeague);
    return response.events;
  } catch (error) {
    console.error('[Optimal] Error fetching events:', error);
    return [];
  }
}

/**
 * Fetch game lines for a specific sport
 */
export async function fetchGameLines(sport: SupportedSport): Promise<OptimalGameLine[]> {
  console.log(`[Optimal] Fetching game lines for ${sport}...`);
  
  try {
    const gameLines = await makeOptimalRequest<OptimalGameLine[]>(`/v1/gamelines/${sport}`);
    console.log(`[Optimal] Fetched ${gameLines.length} game lines for ${sport}`);
    return gameLines;
  } catch (error) {
    console.error(`[Optimal] Failed to fetch game lines for ${sport}:`, error);
    throw error;
  }
}

/**
 * Convert Optimal player prop to RawProp format
 */
function convertOptimalPropToRawProp(prop: OptimalPlayerProp): RawProp {
  // Determine sport from game_id
  let sport = 'unknown';
  let sportKey = 'unknown';

  if (prop.game_id) {
    if (prop.game_id.startsWith('NBA-')) {
      sport = 'NBA';
      sportKey = 'nba';
    } else if (prop.game_id.startsWith('NFL-')) {
      sport = 'NFL';
      sportKey = 'nfl';
    } else if (prop.game_id.startsWith('MLB-')) {
      sport = 'MLB';
      sportKey = 'mlb';
    } else if (prop.game_id.startsWith('NHL-')) {
      sport = 'NHL';
      sportKey = 'nhl';
    } else if (prop.game_id.startsWith('WNBA-')) {
      sport = 'WNBA';
      sportKey = 'wnba';
    }
  }

  // Generate a proper UUID
  const uuid = randomUUID();

  return {
    // Required database fields
    id: uuid,
    external_game_id: prop.game_id || `game-${Date.now()}`,
    game_id: null,
    player_name: prop.player_name,
    team: prop.team,
    stat_type: prop.prop_type,
    line: prop.line,
    over_odds: prop.over_odds ?? 0,
    under_odds: prop.under_odds ?? 0,
    provider: 'Optimal',

    // Timing
    game_time: prop.game_time || new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    game_date: prop.game_time ? prop.game_time.split('T')[0] : new Date().toISOString().split('T')[0],

    // Teams
    home_team: null,
    away_team: null,
    opponent: prop.opponent,

    // Sport info - using detected sport instead of prop.sport
    sport: sport,
    sport_key: sportKey,
    matchup: `${prop.team} vs ${prop.opponent}`,

    // Additional Optimal-specific data
    source: 'optimal-api',

    // All other required fields from the database schema - set to appropriate default values
    outcome: null,
    odds: 0,
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
    bet_type: null,
    market_type: null,
    outcomes: undefined,
    player_id: undefined,
    player_slug: undefined, 
    external_id: undefined,
    league: undefined,
    fair_odds: undefined,
    market: undefined,
    start_time: null,
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
    unique_key: null,
    event_id: null,
    book: null,
    updated_at: null,
    is_alt_line: null,
    is_primary: null,
    is_valid: undefined
  };
}

/**
 *    let filteredProps = props;
      if (date) {
        filteredProps = props.filter(prop => {
          const propDate = prop.game_time ? prop.game_time.split('T')[0] : null;
          return propDate === date;
        });
        console.log(`[Optimal] Filtered ${props.length}  props to ${filteredProps.length} for date ${date}`);
      } 
       
      const nor malizedProps = filteredProps.map(convertOptimalPropToRawProp);
      allProps.push(...normalizedProps);
        
      const duration = Date.now() - startTime;
        console.log(`[Optimal] Successfully fetched ${filteredProps.length} props for ${sportName} in ${duration}ms`);
      
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Optimal] Failed to fetch props for ${sportName}:`, errorMessage);
      errors.push(`${sportName}: ${errorMessage}`);
    }
  }
        
  console.log(`[Optimal] Fetch complete. Total props: ${allProps.length}`);
  
  if (errors.length > 0) {
          console.warn(`[Optimal] Encountered ${errors.length} errors:`, errors);
  }
  
  return allProps;
}

/**
 * Clear rate limit cache (for testing)
 */
export function clearRateLimitCache(): void {
        RATE_LIMIT.requestQueue = [];
}

/**
 * Clear prop type cache (for testing) - placeholder for compatibility
 */
export function clearPropTypeCache(): void {
  // This function exists for test compatibility
  // No actual cache to clear in current implementation
}

/**
 * Main function to fetch props from Optimal API
 * @param sport - Sport to fetch props for
 * @param date - Date to fetch props for (optional)
 * @returns Promise<RawProp[]> - Array of normalized raw props
 */
export async function fetchOptimalProps(sport: string, date?: string): Promise<RawProp[]> {
  try {
    console.log(`[Optimal] Fetching ${sport} props for ${date || 'today'}`);

    // Check rate limit
    const rateLimitStatus = getRateLimitStatus();
    if (!rateLimitStatus.canMakeRequest) {
      console.warn(`[Optimal] Rate limit exceeded. ${rateLimitStatus.requestsInWindow}/${rateLimitStatus.maxRequests} requests used`);
      return [];
    }

    // Map sport name to Optimal API format
    const sportMapping: { [key: string]: SupportedSport } = {
      'NBA': 'NBA',
      'NFL': 'NFL',
      'MLB': 'MLB',
      'NHL': 'NHL',
      'nba': 'NBA',
      'nfl': 'NFL',
      'mlb': 'MLB',
      'nhl': 'NHL'
    };

    const optimalSport = sportMapping[sport];
    if (!optimalSport) {
      console.warn(`[Optimal] Unsupported sport: ${sport}`);
      return [];
    }

    // First, fetch all available events
    const events = await fetchEvents();

    // Filter events for the requested sport
    const sportEvents = events.filter(event =>
      event.league.toUpperCase() === optimalSport.toUpperCase()
    );

    if (sportEvents.length === 0) {
      console.log(`[Optimal] No events found for ${sport}`);
      return [];
    }

    console.log(`[Optimal] Found ${sportEvents.length} events for ${sport}`);

    // Fetch props for each event
    const allProps: OptimalPlayerProp[] = [];
    for (const event of sportEvents) {
      const eventProps = await fetchPlayerProps(optimalSport, event.id);
      allProps.push(...eventProps);

      // Add small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Convert to RawProp format
    const rawProps = allProps.map(convertOptimalPropToRawProp);

    console.log(`[Optimal] Successfully fetched ${rawProps.length} props for ${sport}`);
    return rawProps;

  } catch (error) {
    console.error(`[Optimal] Error fetching props for ${sport}:`, error);
    return [];
  }
}

/**
 * OptimalClient class for compatibility with existing code
 */
export class OptimalClient {
  // private _apiKey: string; // Unused - commented out

  constructor(_apiKey?: string) {
    // this._apiKey = apiKey || process.env['OPTIMAL_API_KEY'] || '';
    // API key handling removed as unused
  }

  async fetchPlayerPropTypes(): Promise<OptimalPlayerPropType[]> {
    return fetchPlayerPropTypes();
  }

  async fetchPlayerProps(sport: string, eventId: string): Promise<OptimalPlayerProp[]> {
    return fetchPlayerProps(sport, eventId);
  }

  async fetchEvents(): Promise<OptimalEvent[]> {
    return fetchEvents();
  }

  async fetchGameLines(sport: SupportedSport): Promise<OptimalGameLine[]> {
    return fetchGameLines(sport);
  }

  async fetchOptimalProps(sport: string, date?: string): Promise<RawProp[]> {
    return fetchOptimalProps(sport, date);
  }

  getRateLimitStatus() {
    return getRateLimitStatus();
  }

  clearRateLimitCache() {
    return clearRateLimitCache();
  }

  clearPropTypeCache() {
    return clearPropTypeCache();
  }
}