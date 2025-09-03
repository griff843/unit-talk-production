/**
 * Client-side API utilities for Smart Form
 * Replaces direct Supabase calls with API route calls
 */

import { createComponentLogger } from './logger';

const log = createComponentLogger('api-client');

export interface Capper {
  id: string;
  name: string;
  active: boolean;
  tier?: string;
  discordId?: string;
}

export interface Game {
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
  private async makeRequest<T>(
    url: string,
    options: any = {}
  ): Promise<ApiResponse<T>> {
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
      log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        method: options.method || 'GET',
      }, 'API request failed');

      return {
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

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

    const result = await this.makeRequest<{ games: Game[] }>(
      `/api/games?${params.toString()}`
    );

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

    const result = await this.makeRequest<{ props: Prop[] }>(
      `/api/props?${params.toString()}`
    );

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
      stat_type: string;
      line: number;
      leg_odds: number;
      source: 'api' | 'manual';
      selection: 'over' | 'under' | 'yes' | 'no';
      confidence?: number;
    }>;
    parlay_odds?: number;
    total_units?: number;
    notes?: string;
  }) {
    const result = await this.makeRequest(
      '/api/submit-ticket',
      {
        method: 'POST',
        body: JSON.stringify(ticketData),
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * Development: Simulate bridge processing
   */
  async simulateBridge(betSlipId: string) {
    const result = await this.makeRequest(
      `/api/dev/simulate-bridge?id=${betSlipId}`
    );

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
export const fetchGames = (sport: string, startDate?: string, endDate?: string, teamId?: string) => {
  // Legacy function signature - just use sport and teamId
  return apiClient.fetchGames(sport, teamId);
};
export const fetchProps = (gameId: string, marketType?: string) => {
  // Legacy signature - adapt to new API
  return apiClient.fetchProps('NFL', { gameId }); // Default sport for compatibility
};

// Mock functions for components that still expect them
export const fetchTeams = async (sport: string) => {
  // Teams are now embedded in games - return empty for compatibility
  log.warn('fetchTeams called - teams are now embedded in games data');
  return [];
};

export const searchTeams = async (sport: string, query: string) => {
  // Deprecated - return empty for compatibility
  log.warn('searchTeams called - function is deprecated');
  return [];
};

export const searchPlayers = async (teamId: string, query: string) => {
  // Deprecated - return empty for compatibility
  log.warn('searchPlayers called - function is deprecated');
  return [];
};

// Types for backward compatibility
export type { Capper as DBCapper, Game as DBGame };
export interface DBTeam {
  id: string;
  name: string;
  sport: string;
}