/**
 * Client-side API utilities for Smart Form
 * SEARCH-CATALOG-CONTRACT-035: Uses canonical catalog endpoints
 */

import { createComponentLogger } from './logger';

const log = createComponentLogger('api-client');

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical DB types
export interface ApiCapper {
  id: string;
  name: string;
  active: boolean;
  tier?: string;
  discordId?: string;
}

export interface ApiGame {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  commence_time?: string;
  status: string;
  matchup?: string;
  is_live?: boolean;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy aliases for backward compatibility
export type Capper = ApiCapper;
export type Game = ApiGame;

// SEARCH-CATALOG-CONTRACT-035: Catalog types
export interface CatalogTeam {
  id: string;
  name: string;
  abbr: string | null;
  sport: string;
  team_uuid: string | null;
  logo_url: string | null;
}

export interface CatalogPlayer {
  id: string;
  name: string;
  sport: string;
  team_id: string | null;
  team_name: string | null;
  team_abbr: string | null;
  position: string | null;
}

export interface CatalogGame {
  id: string;
  sport: string;
  league: string;
  game_date: string;
  start_time: string | null;
  status: string;
  home_team: { id: string | null; name: string; abbr: string | null };
  away_team: { id: string | null; name: string; abbr: string | null };
  display_label: string;
  odds?: {
    spread: number | null;
    total: number | null;
    moneyline_home: number | null;
    moneyline_away: number | null;
  };
}

export interface CatalogProp {
  id: string;
  sport: string;
  player_name: string;
  team: string | null;
  stat_type: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  game_id: string | null;
  game_date: string | null;
  display_label: string;
}

export interface SearchResult {
  type: 'player' | 'team' | 'game';
  id: string;
  name: string;
  sport: string;
  team?: string;
  team_id?: string;
  abbr?: string;
  display_label?: string;
}

export interface Prop {
  id: string;
  game_id: string;
  player_id?: string;
  team_id?: string;
  player_name: string;
  team: string;
  prop_type: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  confidence?: number;
  expected_value?: number;
  sport: string;
  selection_options: Array<{
    value: string;
    label: string;
    odds: number;
    confidence?: number;
  }>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private async makeRequest<T>(url: string, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      log.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          url,
          method: options.method || 'GET',
        },
        'API request failed'
      );

      return {
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  // ============================================
  // SEARCH-CATALOG-CONTRACT-035: Catalog Methods
  // ============================================

  /**
   * Unified search across teams, players, and games
   */
  async searchUnified(
    query: string,
    options: {
      sport?: string;
      type?: 'player' | 'team' | 'game' | 'all';
      limit?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (options.sport) params.set('sport', options.sport);
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', options.limit.toString());

    const result = await this.makeRequest<{ results: SearchResult[] }>(
      `/api/search?${params.toString()}`
    );

    if (result.error) {
      log.warn({ error: result.error, query }, 'Unified search failed');
      return [];
    }

    return result.data?.results || [];
  }

  /**
   * Fetch teams from catalog
   */
  async fetchCatalogTeams(sport: string, query?: string): Promise<CatalogTeam[]> {
    const params = new URLSearchParams({ sport });
    if (query) params.set('q', query);

    const result = await this.makeRequest<{ teams: CatalogTeam[] }>(
      `/api/catalog/teams?${params.toString()}`
    );

    if (result.error) {
      log.warn({ error: result.error, sport }, 'Catalog teams fetch failed');
      return [];
    }

    return result.data?.teams || [];
  }

  /**
   * Fetch players from catalog
   */
  async fetchCatalogPlayers(
    sport: string,
    options: {
      teamId?: string;
      query?: string;
      limit?: number;
    } = {}
  ): Promise<CatalogPlayer[]> {
    const params = new URLSearchParams({ sport });
    if (options.teamId) params.set('team_id', options.teamId);
    if (options.query) params.set('q', options.query);
    if (options.limit) params.set('limit', options.limit.toString());

    const result = await this.makeRequest<{ players: CatalogPlayer[] }>(
      `/api/catalog/players?${params.toString()}`
    );

    if (result.error) {
      log.warn({ error: result.error, sport }, 'Catalog players fetch failed');
      return [];
    }

    return result.data?.players || [];
  }

  /**
   * Fetch games from catalog
   */
  async fetchCatalogGames(
    sport: string,
    options: {
      date?: string;
      teamId?: string;
      status?: 'scheduled' | 'in_progress' | 'final' | 'all';
    } = {}
  ): Promise<CatalogGame[]> {
    const params = new URLSearchParams({ sport });
    if (options.date) params.set('date', options.date);
    if (options.teamId) params.set('team_id', options.teamId);
    if (options.status) params.set('status', options.status);

    const result = await this.makeRequest<{ games: CatalogGame[] }>(
      `/api/catalog/games?${params.toString()}`
    );

    if (result.error) {
      log.warn({ error: result.error, sport }, 'Catalog games fetch failed');
      return [];
    }

    return result.data?.games || [];
  }

  /**
   * Fetch props from catalog
   */
  async fetchCatalogProps(
    sport: string,
    options: {
      playerName?: string;
      statType?: string;
      team?: string;
      limit?: number;
    } = {}
  ): Promise<CatalogProp[]> {
    const params = new URLSearchParams({ sport });
    if (options.playerName) params.set('player_name', options.playerName);
    if (options.statType) params.set('stat_type', options.statType);
    if (options.team) params.set('team', options.team);
    if (options.limit) params.set('limit', options.limit.toString());

    const result = await this.makeRequest<{ props: CatalogProp[]; stat_types: string[] }>(
      `/api/catalog/props?${params.toString()}`
    );

    if (result.error) {
      log.warn({ error: result.error, sport }, 'Catalog props fetch failed');
      return [];
    }

    return result.data?.props || [];
  }

  // ============================================
  // Legacy Methods (maintained for compatibility)
  // ============================================

  /**
   * Fetch active cappers
   */
  async fetchCappers(sport?: string): Promise<Capper[]> {
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);

    const result = await this.makeRequest<{ cappers: Capper[] }>(
      `/api/cappers?${params.toString()}`
    );

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data?.cappers || [];
  }

  /**
   * Fetch games for a sport
   */
  async fetchGames(sport: string, teamId?: string, refresh = false): Promise<Game[]> {
    const params = new URLSearchParams({ sport });
    if (teamId) params.set('team_id', teamId);
    if (refresh) params.set('refresh', 'true');

    const result = await this.makeRequest<{ games: Game[] }>(`/api/games?${params.toString()}`);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data?.games || [];
  }

  /**
   * Fetch props for a sport/game/player
   */
  async fetchProps(
    sport: string,
    options: {
      teamId?: string;
      playerId?: string;
      gameId?: string;
    } = {}
  ): Promise<Prop[]> {
    const params = new URLSearchParams({ sport });
    if (options.teamId) params.set('team_id', options.teamId);
    if (options.playerId) params.set('player_id', options.playerId);
    if (options.gameId) params.set('game_id', options.gameId);

    const result = await this.makeRequest<{ props: Prop[] }>(`/api/props?${params.toString()}`);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data?.props || [];
  }

  /**
   * Submit a ticket
   */
  async submitTicket(ticketData: {
    capper_id: string;
    sport: string;
    ticket_type: string;
    selections: Array<{
      sport: string;
      team_id?: string;
      player_id?: string;
      player_name?: string;
      team?: string;
      bet_type?: string;
      stat_type: string;
      line: number;
      leg_odds: number;
      source: 'api' | 'manual';
      // V1.1 COMPLIANCE: selection is any string (API validates with z.string().min(1))
      selection: string;
      direction?: 'over' | 'under';
      confidence?: number;
    }>;
    parlay_odds?: number;
    total_units?: number;
    notes?: string;
  }) {
    const result = await this.makeRequest('/api/submit-ticket', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * Development: Simulate bridge processing
   * HARDENED: Only available in development mode
   */
  async simulateBridge(betSlipId: string) {
    // V1.1 HARDENED: Dev routes guarded behind NODE_ENV
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Dev routes are not available in production');
    }

    const result = await this.makeRequest(`/api/dev/simulate-bridge?id=${betSlipId}`);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Legacy compatibility functions for existing components
export const fetchCappers = (sport?: string) => apiClient.fetchCappers(sport);
export const fetchGames = (
  sport: string,
  startDate?: string,
  endDate?: string,
  teamId?: string
) => {
  // Legacy function signature - just use sport and teamId
  return apiClient.fetchGames(sport, teamId);
};
export const fetchProps = (gameId: string, marketType?: string) => {
  // Legacy signature - adapt to new API
  return apiClient.fetchProps('NFL', { gameId }); // Default sport for compatibility
};

// SEARCH-CATALOG-CONTRACT-035: Updated functions using catalog endpoints
export const fetchTeams = async (sport: string) => {
  return apiClient.fetchCatalogTeams(sport);
};

export const searchTeams = async (sport: string, query: string) => {
  return apiClient.fetchCatalogTeams(sport, query);
};

export const searchPlayers = async (sport: string, query: string) => {
  // Now uses the unified search endpoint
  return apiClient.searchUnified(query, { sport, type: 'player' });
};

// Types for backward compatibility
// Capper and Game are already exported above as legacy aliases
export type { ApiCapper as DBCapper, ApiGame as DBGame };
export interface DBTeam {
  id: string;
  name: string;
  sport: string;
}
