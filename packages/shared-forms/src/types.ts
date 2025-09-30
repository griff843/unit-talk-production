/**
 * Shared form types for Unit Talk Smart Form integration
 * Based on view_props_for_form and unified_picks schema
 */

export interface PropForForm {
  id: number;
  player_name: string;
  team_name: string;
  matchup: string;
  market: string;
  submarket: string | null;
  game_date: string;
  sport: string;
  league: string;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  stat_type: string;
  pick_direction: string | null;
  tier: string | null;
  created_at: string;
  posted_at: string;
  external_game_id: string | null;
  external_prop_id: string | null;
  confidence: number | null;
  professional_score: number | null;
}

export interface AutocompleteOption {
  value: string;
  label: string;
  metadata?: Record<string, any>;
}

export interface PlayerOption extends AutocompleteOption {
  value: string; // player_name
  label: string; // formatted display name
  metadata: {
    team_name: string;
    sport: string;
    recent_props: number;
    tier?: string;
  };
}

export interface MarketOption extends AutocompleteOption {
  value: string; // market
  label: string; // formatted market name
  metadata: {
    submarket?: string;
    sport: string;
    prop_count: number;
  };
}

export interface GameOption extends AutocompleteOption {
  value: string; // external_game_id
  label: string; // formatted matchup
  metadata: {
    game_date: string;
    sport: string;
    league: string;
    matchup: string;
    prop_count: number;
  };
}

export interface AutocompleteFilters {
  sport?: string;
  league?: string;
  market?: string;
  game_date?: string;
  min_confidence?: number;
  tier?: string[];
}

export interface AutocompleteResponse<T extends AutocompleteOption = AutocompleteOption> {
  options: T[];
  meta: {
    total: number;
    filtered: number;
    query: string;
    filters: AutocompleteFilters;
    execution_time_ms: number;
    cache_hit?: boolean;
  };
}