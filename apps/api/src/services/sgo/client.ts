/* eslint-disable no-console, max-lines-per-function, complexity, max-depth, security/detect-object-injection */
/**
 * SportsGameOdds (SGO) API Client
 * Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A
 *
 * Typed wrapper for SGO endpoints (teams, players) with:
 * - Rate limiting (respects tier limits)
 * - Bounded retries with exponential backoff
 * - Fail-closed on auth/429 beyond retry budget
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SGO_BASE_URL = 'https://api.sportsgameodds.com/v2';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;
const RATE_LIMIT_DELAY_MS = 6000; // Wait 6s between requests (10 req/min = 1 per 6s)

// ============================================================================
// TYPES - Teams
// ============================================================================

export interface SGOTeamNames {
  short: string;
  medium: string;
  long: string;
}

export interface SGOTeamColors {
  primary?: string;
  secondary?: string;
  contrast?: string;
}

export interface SGOTeam {
  teamID: string;
  sportID: string;
  leagueID: string;
  names: SGOTeamNames;
  colors?: SGOTeamColors;
}

export interface SGOTeamsResponse {
  success: boolean;
  data: Record<string, SGOTeam>;
  nextCursor?: string;
}

// ============================================================================
// TYPES - Players
// ============================================================================

export interface SGOPlayerNames {
  short?: string;
  long?: string;
  first?: string;
  last?: string;
}

export interface SGOPlayer {
  playerID: string;
  teamID?: string;
  leagueID: string;
  sportID: string;
  names: SGOPlayerNames;
  position?: string;
  jersey?: string;
  height?: string;
  weight?: string;
  age?: number;
  salary?: number;
  photoURL?: string;
}

export interface SGOPlayersResponse {
  success: boolean;
  data: Record<string, SGOPlayer>;
  nextCursor?: string;
}

// ============================================================================
// TYPES - Events
// ============================================================================

export interface FetchEventsOptions {
  leagueID: string;
  startsAfter?: string;
  startsBefore?: string;
  finalized?: boolean;
  ended?: boolean;
  includeAltLine?: boolean;
  includeOpposingOdds?: boolean;
  includeOpenCloseOdds?: boolean;
  oddsAvailable?: boolean;
  bookmakerID?: string;
  expandResults?: boolean;
  limit?: number;
  cursor?: string;
}

export interface SGOEventsResponse {
  success: boolean;
  data: SGOEvent[];
  nextCursor?: string;
}

export interface SGOEvent {
  eventID: string;
  leagueID: string;
  sportID: string;
  startsAt?: string;
  status?: {
    startsAt?: string;
    started?: boolean;
    completed?: boolean;
    cancelled?: boolean;
    [key: string]: unknown;
  };
  teams?: {
    home?: {
      teamID: string;
      names?: { full?: string; short?: string; medium?: string; long?: string };
    };
    away?: {
      teamID: string;
      names?: { full?: string; short?: string; medium?: string; long?: string };
    };
  };
  players?: Record<
    string,
    { name?: string; teamID?: string; position?: string; [key: string]: unknown }
  >;
  odds?: Record<string, SGOOddsEntry>;
  info?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SGOOddsEntry {
  statID?: string;
  playerID?: string;
  statEntityID?: string;
  sideID?: string;
  periodID?: string;
  line?: number;
  bookOdds?: number;
  fairOdds?: number;
  openBookOdds?: number;
  openFairOdds?: number;
  closeOdds?: number;
  openOdds?: number;
  fairOverUnder?: string;
  openFairOverUnder?: string;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// TYPES - Client Options
// ============================================================================

export interface SGOClientOptions {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  rateLimitDelayMs?: number;
}

export interface FetchTeamsOptions {
  leagueID?: string;
  sportID?: string;
  teamID?: string;
  limit?: number;
  cursor?: string;
}

export interface FetchPlayersOptions {
  leagueID?: string;
  teamID?: string;
  playerID?: string;
  limit?: number;
  cursor?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SGOError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SGOError';
  }
}

export class SGOAuthError extends SGOError {
  constructor(message: string) {
    super(message, 401, false);
    this.name = 'SGOAuthError';
  }
}

export class SGORateLimitError extends SGOError {
  constructor(message: string) {
    super(message, 429, true);
    this.name = 'SGORateLimitError';
  }
}

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

export class SGOClient {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly rateLimitDelayMs: number;
  private lastRequestTime = 0;

  constructor(options: SGOClientOptions) {
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? RATE_LIMIT_DELAY_MS;

    if (!this.apiKey) {
      throw new SGOAuthError('SGO API key is required');
    }

    this.client = axios.create({
      baseURL: SGO_BASE_URL,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // --------------------------------------------------------------------------
  // Rate Limiting
  // --------------------------------------------------------------------------

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = this.rateLimitDelayMs - timeSinceLastRequest;

    if (waitTime > 0) {
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Retry Logic with Exponential Backoff
  // --------------------------------------------------------------------------

  private async fetchWithRetry<T>(endpoint: string, params: Record<string, unknown>): Promise<T> {
    let lastError: Error | null = null;

    // Add apiKey to params (SGO prefers query param auth)
    const paramsWithKey = { ...params, apiKey: this.apiKey };

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Rate limit
        await this.waitForRateLimit();

        const response = await this.client.get(endpoint, { params: paramsWithKey });

        if (!response.data?.success) {
          throw new SGOError(
            `SGO API returned unsuccessful response: ${JSON.stringify(response.data)}`,
            response.status
          );
        }

        return response.data as T;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AxiosError) {
          const status = error.response?.status;

          // Auth error - fail immediately
          if (status === 401 || status === 403) {
            throw new SGOAuthError(`Authentication failed: ${error.message}`);
          }

          // Rate limit - wait and retry
          if (status === 429) {
            if (attempt < this.maxRetries) {
              const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
              console.warn(
                `[SGO] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${this.maxRetries}`
              );
              await this.sleep(delay);
              continue;
            }
            throw new SGORateLimitError(`Rate limit exceeded after ${this.maxRetries} retries`);
          }

          // Server error - retry with backoff
          if (status && status >= 500) {
            if (attempt < this.maxRetries) {
              const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
              console.warn(
                `[SGO] Server error ${status}, waiting ${delay}ms before retry ${attempt + 1}/${this.maxRetries}`
              );
              await this.sleep(delay);
              continue;
            }
          }

          // Network/timeout error - retry
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            if (attempt < this.maxRetries) {
              const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
              console.warn(
                `[SGO] Timeout, waiting ${delay}ms before retry ${attempt + 1}/${this.maxRetries}`
              );
              await this.sleep(delay);
              continue;
            }
          }
        }

        // Non-retryable error or exhausted retries
        throw lastError;
      }
    }

    throw lastError ?? new SGOError('Unknown error after retries');
  }

  // --------------------------------------------------------------------------
  // Teams Endpoint
  // --------------------------------------------------------------------------

  /**
   * Fetch teams from SGO API
   * @param options - Filter options (leagueID, sportID, teamID)
   * @returns Teams response with data and optional nextCursor
   */
  async fetchTeams(options: FetchTeamsOptions = {}): Promise<SGOTeamsResponse> {
    const params: Record<string, unknown> = {};

    if (options.leagueID) params.leagueID = options.leagueID;
    if (options.sportID) params.sportID = options.sportID;
    if (options.teamID) params.teamID = options.teamID;
    if (options.limit) params.limit = options.limit;
    if (options.cursor) params.cursor = options.cursor;

    return this.fetchWithRetry<SGOTeamsResponse>('/teams', params);
  }

  /**
   * Fetch all teams for a league with pagination
   * @param leagueID - League to fetch (NBA, MLB, NFL, NHL)
   * @returns Array of all teams
   */
  async fetchAllTeams(leagueID: string): Promise<SGOTeam[]> {
    const allTeams: SGOTeam[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 10; // Safety limit

    console.log(`[SGO] Fetching all teams for ${leagueID}...`);

    do {
      const response = await this.fetchTeams({
        leagueID,
        limit: 30,
        cursor,
      });

      const teams = Object.values(response.data);
      allTeams.push(...teams);
      cursor = response.nextCursor;
      pageCount++;

      console.log(
        `[SGO] Page ${pageCount}: fetched ${teams.length} teams (total: ${allTeams.length})`
      );

      if (pageCount >= MAX_PAGES) {
        console.warn(`[SGO] Reached max pages limit (${MAX_PAGES})`);
        break;
      }
    } while (cursor);

    console.log(`[SGO] Completed: ${allTeams.length} teams for ${leagueID}`);
    return allTeams;
  }

  // --------------------------------------------------------------------------
  // Players Endpoint
  // --------------------------------------------------------------------------

  /**
   * Fetch players from SGO API
   * @param options - Filter options (leagueID, teamID, playerID)
   * @returns Players response with data and optional nextCursor
   */
  async fetchPlayers(options: FetchPlayersOptions = {}): Promise<SGOPlayersResponse> {
    const params: Record<string, unknown> = {};

    if (options.leagueID) params.leagueID = options.leagueID;
    if (options.teamID) params.teamID = options.teamID;
    if (options.playerID) params.playerID = options.playerID;
    if (options.limit) params.limit = options.limit;
    if (options.cursor) params.cursor = options.cursor;

    return this.fetchWithRetry<SGOPlayersResponse>('/players', params);
  }

  /**
   * Fetch all players for a league with pagination
   * @param leagueID - League to fetch (NBA, MLB, NFL, NHL)
   * @returns Array of all players
   */
  async fetchAllPlayers(leagueID: string): Promise<SGOPlayer[]> {
    const allPlayers: SGOPlayer[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 100; // Higher limit for players

    console.log(`[SGO] Fetching all players for ${leagueID}...`);

    do {
      const response = await this.fetchPlayers({
        leagueID,
        limit: 30,
        cursor,
      });

      const players = Object.values(response.data);
      allPlayers.push(...players);
      cursor = response.nextCursor;
      pageCount++;

      console.log(
        `[SGO] Page ${pageCount}: fetched ${players.length} players (total: ${allPlayers.length})`
      );

      if (pageCount >= MAX_PAGES) {
        console.warn(`[SGO] Reached max pages limit (${MAX_PAGES})`);
        break;
      }
    } while (cursor);

    console.log(`[SGO] Completed: ${allPlayers.length} players for ${leagueID}`);
    return allPlayers;
  }

  // --------------------------------------------------------------------------
  // Events Endpoint (SPRINT-027A)
  // --------------------------------------------------------------------------

  /**
   * Fetch events from SGO API with optional historical params
   * @param options - Filter options including finalized, includeOpenCloseOdds, etc.
   * @returns Events response with data and optional nextCursor
   */
  async fetchEvents(options: FetchEventsOptions): Promise<SGOEventsResponse> {
    const params: Record<string, unknown> = {};

    params.leagueID = options.leagueID;
    if (options.startsAfter) params.startsAfter = options.startsAfter;
    if (options.startsBefore) params.startsBefore = options.startsBefore;
    if (options.finalized != null) params.finalized = options.finalized;
    if (options.ended != null) params.ended = options.ended;
    if (options.includeAltLine != null) params.includeAltLine = options.includeAltLine;
    if (options.includeOpposingOdds != null)
      params.includeOpposingOdds = options.includeOpposingOdds;
    if (options.includeOpenCloseOdds != null)
      params.includeOpenCloseOdds = options.includeOpenCloseOdds;
    if (options.oddsAvailable != null) params.oddsAvailable = options.oddsAvailable;
    if (options.bookmakerID) params.bookmakerID = options.bookmakerID;
    if (options.expandResults != null) params.expandResults = options.expandResults;
    if (options.limit) params.limit = options.limit;
    if (options.cursor) params.cursor = options.cursor;

    return this.fetchWithRetry<SGOEventsResponse>('/events', params);
  }

  /**
   * Fetch all events for a query with pagination
   * @param options - Event query options
   * @returns Array of all matching events
   */
  async fetchAllEvents(options: FetchEventsOptions): Promise<SGOEvent[]> {
    const allEvents: SGOEvent[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 200;

    do {
      const response = await this.fetchEvents({ ...options, cursor });
      allEvents.push(...response.data);
      cursor = response.nextCursor;
      pageCount++;

      console.log(
        `[SGO] Events page ${pageCount}: fetched ${response.data.length} events (total: ${allEvents.length})`
      );

      if (pageCount >= MAX_PAGES) {
        console.warn(`[SGO] Reached max events pages limit (${MAX_PAGES})`);
        break;
      }
    } while (cursor);

    return allEvents;
  }

  // --------------------------------------------------------------------------
  // Players Endpoint (continued)
  // --------------------------------------------------------------------------

  /**
   * Fetch players for a specific team
   * @param teamID - Team ID to fetch players for
   * @returns Array of players on the team
   */
  async fetchTeamPlayers(teamID: string): Promise<SGOPlayer[]> {
    const allPlayers: SGOPlayer[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 10;

    console.log(`[SGO] Fetching players for team ${teamID}...`);

    do {
      const response = await this.fetchPlayers({
        teamID,
        limit: 30,
        cursor,
      });

      const players = Object.values(response.data);
      allPlayers.push(...players);
      cursor = response.nextCursor;
      pageCount++;

      if (pageCount >= MAX_PAGES) break;
    } while (cursor);

    console.log(`[SGO] Completed: ${allPlayers.length} players for ${teamID}`);
    return allPlayers;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let _sgoClient: SGOClient | null = null;

/**
 * Get or create SGO client singleton
 */
export function getSGOClient(apiKey?: string): SGOClient {
  if (!_sgoClient) {
    const key = apiKey ?? process.env.SGO_API_KEY ?? process.env.SPORTSGAMEODDS_API_KEY ?? '';
    if (!key) {
      throw new SGOAuthError(
        'SGO API key not provided and not found in environment (SGO_API_KEY or SPORTSGAMEODDS_API_KEY)'
      );
    }
    _sgoClient = new SGOClient({ apiKey: key });
  }
  return _sgoClient;
}

/**
 * Reset the client singleton (for testing)
 */
export function resetSGOClient(): void {
  _sgoClient = null;
}

export default SGOClient;
