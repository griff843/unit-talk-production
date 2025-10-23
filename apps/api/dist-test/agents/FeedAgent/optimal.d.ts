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
import { RawProp } from '../../types/rawProps';
declare const SUPPORTED_SPORTS: readonly ["NFL", "NBA", "MLB", "NHL"];
type SupportedSport = typeof SUPPORTED_SPORTS[number];
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
 * Get current rate limit status
 */
export declare function getRateLimitStatus(): {
    requestsInWindow: number;
    maxRequests: number;
    windowMs: number;
    canMakeRequest: boolean;
};
/**
 * Fetch available player prop types
 */
export declare function fetchPlayerPropTypes(): Promise<OptimalPlayerPropType[]>;
/**
 * Fetch player props for a specific sport and event
 */
export declare function fetchPlayerProps(sport: string, eventId: string): Promise<OptimalPlayerProp[]>;
/**
 * Fetch events for all sports
 */
export declare function fetchEvents(): Promise<OptimalEvent[]>;
/**
 * Fetch game lines for a specific sport
 */
export declare function fetchGameLines(sport: SupportedSport): Promise<OptimalGameLine[]>;
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
export declare function clearRateLimitCache(): void;
/**
 * Clear prop type cache (for testing) - placeholder for compatibility
 */
export declare function clearPropTypeCache(): void;
/**
 * Main function to fetch props from Optimal API
 * @param sport - Sport to fetch props for
 * @param date - Date to fetch props for (optional)
 * @returns Promise<RawProp[]> - Array of normalized raw props
 */
export declare function fetchOptimalProps(sport: string, date?: string): Promise<RawProp[]>;
/**
 * OptimalClient class for compatibility with existing code
 */
export declare class OptimalClient {
    constructor(_apiKey?: string);
    fetchPlayerPropTypes(): Promise<OptimalPlayerPropType[]>;
    fetchPlayerProps(sport: string, eventId: string): Promise<OptimalPlayerProp[]>;
    fetchEvents(): Promise<OptimalEvent[]>;
    fetchGameLines(sport: SupportedSport): Promise<OptimalGameLine[]>;
    fetchOptimalProps(sport: string, date?: string): Promise<RawProp[]>;
    getRateLimitStatus(): {
        requestsInWindow: number;
        maxRequests: number;
        windowMs: number;
        canMakeRequest: boolean;
    };
    clearRateLimitCache(): void;
    clearPropTypeCache(): void;
}
export {};
//# sourceMappingURL=optimal.d.ts.map