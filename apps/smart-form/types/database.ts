export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      cappers: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          sport: string;
          abbreviation: string;
          active: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          name: string;
          sport: string;
          abbreviation: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sport?: string;
          abbreviation?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          name: string;
          team_id: string;
          sport: string;
          position: string;
          active: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          name: string;
          team_id: string;
          sport: string;
          position: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          team_id?: string;
          sport?: string;
          position?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          sport: string;
          home_team_id: string;
          away_team_id: string;
          game_date: string;
          game_time: string;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          sport: string;
          home_team_id: string;
          away_team_id: string;
          game_date: string;
          game_time: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sport?: string;
          home_team_id?: string;
          away_team_id?: string;
          game_date?: string;
          game_time?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      raw_props: {
        Row: {
          id: string;
          game_id: string;
          player_id?: string;
          team_id?: string;
          prop_type: string;
          market_type: string;
          line: number;
          odds: number;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id?: string;
          team_id?: string;
          prop_type: string;
          market_type: string;
          line: number;
          odds: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_id?: string;
          team_id?: string;
          prop_type?: string;
          market_type?: string;
          line?: number;
          odds?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          capper_id: string;
          ticket_type: string;
          unit_size: number;
          risk_amount: number;
          potential_payout: number;
          odds_format: string;
          auto_parlay: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          capper_id: string;
          ticket_type: string;
          unit_size: number;
          risk_amount: number;
          potential_payout: number;
          odds_format: string;
          auto_parlay: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          capper_id?: string;
          ticket_type?: string;
          unit_size?: number;
          risk_amount?: number;
          potential_payout?: number;
          odds_format?: string;
          auto_parlay?: boolean;
          sport?: string;
          game_date?: string;
          confidence_level?: number;
          user_tier?: string;
          status?: string;
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
