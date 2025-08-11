export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tickets: {
        Row: {
          id: string;
          created_at: string;
          capper: string;
          ticket_type: string;
          unit_size: number;
          auto_parlay: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status: string;
          legs: {
            id: string;
            bet_type: string;
            stat_type: string;
            player_name: string;
            team: string;
            line: string;
            odds: string;
            outcome: string;
            matchup: string;
            is_primary: boolean;
            created_at: string;
          }[];
          metadata: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          capper: string;
          ticket_type: string;
          unit_size: number;
          auto_parlay?: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status?: string;
          legs: {
            id: string;
            bet_type: string;
            stat_type: string;
            player_name: string;
            team: string;
            line: string;
            odds: string;
            outcome: string;
            matchup: string;
            is_primary: boolean;
            created_at: string;
          }[];
          metadata?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          capper?: string;
          ticket_type?: string;
          unit_size?: number;
          auto_parlay?: boolean;
          sport?: string;
          game_date?: string;
          confidence_level?: number;
          user_tier?: string;
          status?: string;
          legs?: {
            id: string;
            bet_type: string;
            stat_type: string;
            player_name: string;
            team: string;
            line: string;
            odds: string;
            outcome: string;
            matchup: string;
            is_primary: boolean;
            created_at: string;
          }[];
          metadata?: Json;
        };
      };
      health_check: {
        Row: {
          id: string;
          timestamp: string;
          status: string;
        };
        Insert: {
          id?: string;
          timestamp?: string;
          status: string;
        };
        Update: {
          id?: string;
          timestamp?: string;
          status?: string;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          default_sport: string;
          default_unit_size: number;
          favorite_teams: string[];
          favorite_players: string[];
          preferred_bet_types: string[];
          recent_picks: Json[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_sport?: string;
          default_unit_size?: number;
          favorite_teams?: string[];
          favorite_players?: string[];
          preferred_bet_types?: string[];
          recent_picks?: Json[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_sport?: string;
          default_unit_size?: number;
          favorite_teams?: string[];
          favorite_players?: string[];
          preferred_bet_types?: string[];
          recent_picks?: Json[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
