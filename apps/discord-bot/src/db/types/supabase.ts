export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      unified_picks: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          capper_id: string;
          player_id: string;
          game_id: string;
          stat_type: string;
          line: number;
          odds: number;
          stake: number;
          payout: number;
          result: 'win' | 'loss' | 'push' | 'pending';
          actual_value: number;
          tier: string;
          ticket_type: string;
          sport: string;
          league: string;
          confidence: number;
          analysis: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id: string;
          player_id: string;
          game_id: string;
          stat_type: string;
          line: number;
          odds: number;
          stake: number;
          payout: number;
          result: 'win' | 'loss' | 'push' | 'pending';
          actual_value: number;
          tier: string;
          ticket_type: string;
          sport: string;
          league: string;
          confidence: number;
          analysis?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id?: string;
          player_id?: string;
          game_id?: string;
          stat_type?: string;
          line?: number;
          odds?: number;
          stake?: number;
          payout?: number;
          result?: 'win' | 'loss' | 'push' | 'pending';
          actual_value?: number;
          tier?: string;
          ticket_type?: string;
          sport?: string;
          league?: string;
          confidence?: number;
          analysis?: string | null;
          metadata?: Json | null;
        };
      };
      analytics_summary: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          capper_id: string;
          tier: string;
          ticket_type: string;
          total_volume: number;
          win_rate: number;
          roi: number;
          best_stat_type: string;
          worst_stat_type: string;
          streak_info: Json;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id: string;
          tier: string;
          ticket_type: string;
          total_volume: number;
          win_rate: number;
          roi: number;
          best_stat_type: string;
          worst_stat_type: string;
          streak_info: Json;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id?: string;
          tier?: string;
          ticket_type?: string;
          total_volume?: number;
          win_rate?: number;
          roi?: number;
          best_stat_type?: string;
          worst_stat_type?: string;
          streak_info?: Json;
          metadata?: Json | null;
        };
      };
      roi_by_tier: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          capper_id: string;
          tier: string;
          timeframe_days: number;
          total_picks: number;
          wins: number;
          losses: number;
          win_rate: number;
          roi: number;
          volume: number;
          avg_odds: number;
          profit_loss: number;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id: string;
          tier: string;
          timeframe_days: number;
          total_picks: number;
          wins: number;
          losses: number;
          win_rate: number;
          roi: number;
          volume: number;
          avg_odds: number;
          profit_loss: number;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id?: string;
          tier?: string;
          timeframe_days?: number;
          total_picks?: number;
          wins?: number;
          losses?: number;
          win_rate?: number;
          roi?: number;
          volume?: number;
          avg_odds?: number;
          profit_loss?: number;
          metadata?: Json | null;
        };
      };
      trend_analysis: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          player_id: string;
          stat_type: string;
          trend_direction: 'up' | 'down' | 'neutral';
          streak_length: number;
          avg_performance: number;
          edge_volatility: number;
          confidence: number;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          player_id: string;
          stat_type: string;
          trend_direction: 'up' | 'down' | 'neutral';
          streak_length: number;
          avg_performance: number;
          edge_volatility: number;
          confidence: number;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          player_id?: string;
          stat_type?: string;
          trend_direction?: 'up' | 'down' | 'neutral';
          streak_length?: number;
          avg_performance?: number;
          edge_volatility?: number;
          confidence?: number;
          metadata?: Json | null;
        };
      };
      // SPRINT-ENV-BUILD-TRUTH-LOCK: Stub types for planned features
      // These tables may not exist in production - services using them will fail at runtime
      ab_test_cohorts: {
        Row: {
          id: string;
          name: string;
          description: string;
          test_type: string;
          percentage: number;
          is_active: boolean;
          config: Json;
          end_date: string | null;
          createdAt: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          test_type: string;
          percentage: number;
          is_active?: boolean;
          config?: Json;
          end_date?: string | null;
        };
        Update: Partial<{
          id: string;
          name: string;
          description: string;
          test_type: string;
          percentage: number;
          is_active: boolean;
          config: Json;
          end_date: string | null;
        }>;
      };
      user_cohort_assignments: {
        Row: {
          id: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metadata?: Json;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metadata: Json;
        }>;
      };
      ab_test_results: {
        Row: {
          id: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metric: string;
          value: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metric: string;
          value: number;
          metadata?: Json;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          cohort_id: string;
          test_type: string;
          metric: string;
          value: number;
          metadata: Json;
        }>;
      };
      message_templates: {
        Row: {
          id: string;
          type: 'recap' | 'alert' | 'command_response' | 'notification';
          cohort_id: string;
          template: string;
          variables: string[];
          is_active: boolean;
          createdAt: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: 'recap' | 'alert' | 'command_response' | 'notification';
          cohort_id: string;
          template: string;
          variables?: string[];
          is_active?: boolean;
        };
        Update: Partial<{
          id: string;
          type: 'recap' | 'alert' | 'command_response' | 'notification';
          cohort_id: string;
          template: string;
          variables: string[];
          is_active: boolean;
        }>;
      };
      onboarding_config: {
        Row: {
          id: string;
          config: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config: Json;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          config: Json;
          updated_at: string;
        }>;
      };
      onboarding_flow_edits: {
        Row: {
          id: string;
          flow_id: string;
          field: string;
          old_value: Json;
          new_value: Json;
          edited_by: string;
          edited_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          field: string;
          old_value: Json;
          new_value: Json;
          edited_by: string;
          edited_at?: string;
        };
        Update: Partial<{
          id: string;
          flow_id: string;
          field: string;
          old_value: Json;
          new_value: Json;
          edited_by: string;
          edited_at: string;
        }>;
      };
      system_config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<{
          key: string;
          value: Json;
          updated_at: string;
        }>;
      };
      system_health_checks: {
        Row: {
          id: string;
          timestamp: string;
          performedBy: string;
          database: Json;
          discord: Json;
          services: Json;
          memory: Json;
          uptime: number;
          errors: Json;
          recommendations: string[];
        };
        Insert: {
          id?: string;
          timestamp?: string;
          performedBy: string;
          database: Json;
          discord: Json;
          services: Json;
          memory: Json;
          uptime: number;
          errors?: Json;
          recommendations?: string[];
        };
        Update: Partial<{
          id: string;
          timestamp: string;
          performedBy: string;
          database: Json;
          discord: Json;
          services: Json;
          memory: Json;
          uptime: number;
          errors: Json;
          recommendations: string[];
        }>;
      };
      admin_actions: {
        Row: {
          id: string;
          admin_id: string;
          command: string;
          parameters: Json;
          reason: string;
          status: 'executing' | 'completed' | 'failed';
          result: Json;
          timestamp: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          admin_id: string;
          command: string;
          parameters?: Json;
          reason?: string;
          status?: 'executing' | 'completed' | 'failed';
          result?: Json;
          timestamp?: string;
          completed_at?: string | null;
        };
        Update: Partial<{
          id: string;
          admin_id: string;
          command: string;
          parameters: Json;
          reason: string;
          status: 'executing' | 'completed' | 'failed';
          result: Json;
          timestamp: string;
          completed_at: string | null;
        }>;
      };
      analytics_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string;
          metadata: Json;
          timestamp: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string;
          metadata?: Json;
          timestamp?: string;
        };
        Update: Partial<{
          id: string;
          event_type: string;
          user_id: string;
          metadata: Json;
          timestamp: string;
        }>;
      };
      trial_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          tier: string;
          expires_at: string;
          created_at: string;
        }>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          preferences: Json;
          updated_at: string;
        }>;
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
