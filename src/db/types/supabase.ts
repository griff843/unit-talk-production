export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      daily_picks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          capper_id: string
          capper_discord_id: string
          capper_username: string
          event_date: string
          status: 'pending' | 'finalized' | 'cancelled' | 'deleted'
          pick_type: 'single' | 'parlay'
          total_legs: number
          total_odds: number
          total_units: number
          analysis: string | null
          thread_id: string | null
          message_id: string | null
          legs: Json // Array of pick legs
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id: string
          capper_discord_id: string
          capper_username: string
          event_date: string
          status?: 'pending' | 'finalized' | 'cancelled' | 'deleted'
          pick_type: 'single' | 'parlay'
          total_legs: number
          total_odds: number
          total_units: number
          analysis?: string | null
          thread_id?: string | null
          message_id?: string | null
          legs: Json
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id?: string
          capper_discord_id?: string
          capper_username?: string
          event_date?: string
          status?: 'pending' | 'finalized' | 'cancelled' | 'deleted'
          pick_type?: 'single' | 'parlay'
          total_legs?: number
          total_odds?: number
          total_units?: number
          analysis?: string | null
          thread_id?: string | null
          message_id?: string | null
          legs?: Json
          metadata?: Json | null
        }
      }
      capper_profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          discord_id: string
          username: string
          display_name: string | null
          tier: string
          status: 'active' | 'inactive' | 'suspended'
          onboarded_at: string | null
          thread_id: string | null
          stats: Json // Win rate, ROI, total picks, etc.
          settings: Json | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          discord_id: string
          username: string
          display_name?: string | null
          tier: string
          status?: 'active' | 'inactive' | 'suspended'
          onboarded_at?: string | null
          thread_id?: string | null
          stats?: Json
          settings?: Json | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          discord_id?: string
          username?: string
          display_name?: string | null
          tier?: string
          status?: 'active' | 'inactive' | 'suspended'
          onboarded_at?: string | null
          thread_id?: string | null
          stats?: Json
          settings?: Json | null
          metadata?: Json | null
        }
      }
      analytics_events: {
        Row: {
          id: string
          created_at: string
          event_type: string
          user_id: string | null
          capper_id: string | null
          pick_id: string | null
          event_data: Json
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          event_type: string
          user_id?: string | null
          capper_id?: string | null
          pick_id?: string | null
          event_data: Json
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          event_type?: string
          user_id?: string | null
          capper_id?: string | null
          pick_id?: string | null
          event_data?: Json
          metadata?: Json | null
        }
      }
      sports_game_odds: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          game_id: string
          sport: string
          league: string
          home_team: string
          away_team: string
          game_date: string
          markets: Json // Available betting markets
          players: Json // Player props
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          game_id: string
          sport: string
          league: string
          home_team: string
          away_team: string
          game_date: string
          markets: Json
          players: Json
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          game_id?: string
          sport?: string
          league?: string
          home_team?: string
          away_team?: string
          game_date?: string
          markets?: Json
          players?: Json
          metadata?: Json | null
        }
      }
      final_picks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          capper_id: string
          player_id: string
          game_id: string
          stat_type: string
          line: number
          odds: number
          stake: number
          payout: number
          result: 'win' | 'loss' | 'push' | 'pending'
          actual_value: number
          tier: string
          ticket_type: string
          sport: string
          league: string
          confidence: number
          analysis: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id: string
          player_id: string
          game_id: string
          stat_type: string
          line: number
          odds: number
          stake: number
          payout: number
          result: 'win' | 'loss' | 'push' | 'pending'
          actual_value: number
          tier: string
          ticket_type: string
          sport: string
          league: string
          confidence: number
          analysis?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id?: string
          player_id?: string
          game_id?: string
          stat_type?: string
          line?: number
          odds?: number
          stake?: number
          payout?: number
          result?: 'win' | 'loss' | 'push' | 'pending'
          actual_value?: number
          tier?: string
          ticket_type?: string
          sport?: string
          league?: string
          confidence?: number
          analysis?: string | null
          metadata?: Json | null
        }
      }
      // ... existing code ...
      analytics_summary: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          capper_id: string
          tier: string
          ticket_type: string
          total_volume: number
          win_rate: number
          roi: number
          best_stat_type: string
          worst_stat_type: string
          streak_info: Json
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id: string
          tier: string
          ticket_type: string
          total_volume: number
          win_rate: number
          roi: number
          best_stat_type: string
          worst_stat_type: string
          streak_info: Json
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id?: string
          tier?: string
          ticket_type?: string
          total_volume?: number
          win_rate?: number
          roi?: number
          best_stat_type?: string
          worst_stat_type?: string
          streak_info?: Json
          metadata?: Json | null
        }
      }
      roi_by_tier: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          capper_id: string
          tier: string
          timeframe_days: number
          total_picks: number
          wins: number
          losses: number
          win_rate: number
          roi: number
          volume: number
          avg_odds: number
          profit_loss: number
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id: string
          tier: string
          timeframe_days: number
          total_picks: number
          wins: number
          losses: number
          win_rate: number
          roi: number
          volume: number
          avg_odds: number
          profit_loss: number
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id?: string
          tier?: string
          timeframe_days?: number
          total_picks?: number
          wins?: number
          losses?: number
          win_rate?: number
          roi?: number
          volume?: number
          avg_odds?: number
          profit_loss?: number
          metadata?: Json | null
        }
      }
      trend_analysis: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          player_id: string
          stat_type: string
          trend_direction: 'up' | 'down' | 'neutral'
          streak_length: number
          avg_performance: number
          edge_volatility: number
          confidence: number
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          player_id: string
          stat_type: string
          trend_direction: 'up' | 'down' | 'neutral'
          streak_length: number
          avg_performance: number
          edge_volatility: number
          confidence: number
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          player_id?: string
          stat_type?: string
          trend_direction?: 'up' | 'down' | 'neutral'
          streak_length?: number
          avg_performance?: number
          edge_volatility?: number
          confidence?: number
          metadata?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}