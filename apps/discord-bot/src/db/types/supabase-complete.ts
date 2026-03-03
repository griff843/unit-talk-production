export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      // Existing tables from original schema
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
          // Admin override fields
          result_overridden_by: string | null;
          result_override_reason: string | null;
          tier_changed_by: string | null;
          tier_change_reason: string | null;
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
          result_overridden_by?: string | null;
          result_override_reason?: string | null;
          tier_changed_by?: string | null;
          tier_change_reason?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string | Date;
          capper_id?: string;
          player_id?: string;
          game_id?: string;
          stat_type?: string;
          line?: number;
          odds?: number;
          stake?: number;
          payout?: number;
          result?: 'win' | 'loss' | 'push' | 'pending' | string;
          actual_value?: number;
          tier?: string;
          ticket_type?: string;
          sport?: string;
          league?: string;
          confidence?: number;
          analysis?: string | null;
          metadata?: Json | null;
          result_overridden_by?: string | null;
          result_override_reason?: string | null;
          tier_changed_by?: string | null;
          tier_change_reason?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      // Onboarding tables from existing schema
      onboarding_config: {
        Row: {
          id: string;
          config: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_progress: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string;
          flow_type: string;
          current_step: string | null;
          step_data: Json;
          preferences: Json;
          status: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          started_at: string;
          completed_at: string | null;
          last_activity: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id: string;
          flow_type: string;
          current_step?: string | null;
          step_data?: Json;
          preferences?: Json;
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          started_at?: string;
          completed_at?: string | null;
          last_activity?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string;
          flow_type?: string;
          current_step?: string | null;
          step_data?: Json;
          preferences?: Json;
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          started_at?: string;
          completed_at?: string | null;
          last_activity?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dm_failures: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string;
          step: string;
          failure_reason: string;
          error_message: string | null;
          attempted_at: string;
          retry_count: number;
          resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id: string;
          step: string;
          failure_reason: string;
          error_message?: string | null;
          attempted_at?: string;
          retry_count?: number;
          resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string;
          step?: string;
          failure_reason?: string;
          error_message?: string | null;
          attempted_at?: string;
          retry_count?: number;
          resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string;
          event_type: string;
          event_data: Json;
          timestamp: string;
          session_id: string | null;
          user_agent: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id: string;
          event_type: string;
          event_data?: Json;
          timestamp?: string;
          session_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string;
          event_type?: string;
          event_data?: Json;
          timestamp?: string;
          session_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_journeys: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string;
          started_at: string;
          completed_at: string | null;
          status: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          flow_type: string;
          steps: Json;
          total_duration: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id: string;
          started_at?: string;
          completed_at?: string | null;
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          flow_type: string;
          steps?: Json;
          total_duration?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed';
          flow_type?: string;
          steps?: Json;
          total_duration?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_flow_edits: {
        Row: {
          id: string;
          flow_id: string;
          field: string;
          old_value: Json | null;
          new_value: Json | null;
          edited_by: string;
          edited_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          field: string;
          old_value?: Json | null;
          new_value?: Json | null;
          edited_by: string;
          edited_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          field?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          edited_by?: string;
          edited_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_actions: {
        Row: {
          id: string;
          admin_user_id: string;
          guild_id: string;
          action_type: string;
          target_user_id: string | null;
          action_data: Json;
          timestamp: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          guild_id: string;
          action_type: string;
          target_user_id?: string | null;
          action_data?: Json;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          guild_id?: string;
          action_type?: string;
          target_user_id?: string | null;
          action_data?: Json;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string;
          sports: string[];
          notification_level: string | null;
          experience_level: string | null;
          betting_style: string | null;
          bankroll_size: string | null;
          risk_tolerance: string | null;
          notification_timing: string | null;
          custom_preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id: string;
          sports?: string[];
          notification_level?: string | null;
          experience_level?: string | null;
          betting_style?: string | null;
          bankroll_size?: string | null;
          risk_tolerance?: string | null;
          notification_timing?: string | null;
          custom_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string;
          sports?: string[];
          notification_level?: string | null;
          experience_level?: string | null;
          betting_style?: string | null;
          bankroll_size?: string | null;
          risk_tolerance?: string | null;
          notification_timing?: string | null;
          custom_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_templates: {
        Row: {
          id: string;
          template_key: string;
          template_type: string;
          content: Json;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_key: string;
          template_type: string;
          content: Json;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_key?: string;
          template_type?: string;
          content?: Json;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Missing tables identified from code analysis
      user_profiles: {
        Row: {
          id: string;
          discord_id: string;
          username: string | null;
          discriminator: string | null;
          avatar: string | null;
          tier: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
          subscription_tier: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS';
          created_at: string;
          updated_at: string;
          last_active: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          discord_id: string;
          username?: string | null;
          discriminator?: string | null;
          avatar?: string | null;
          tier?: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
          subscription_tier?: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS';
          created_at?: string;
          updated_at?: string;
          last_active?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          discord_id?: string;
          username?: string | null;
          discriminator?: string | null;
          avatar?: string | null;
          tier?: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
          subscription_tier?: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS';
          created_at?: string;
          updated_at?: string;
          last_active?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      game_threads: {
        Row: {
          id: string;
          game_id: string;
          channel_id: string;
          thread_id: string;
          sport: string;
          teams: string[];
          game_time: string;
          is_active: boolean;
          pick_count: number;
          user_count: number;
          is_pinned: boolean;
          last_activity: string;
          name: string | null;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          game_id: string;
          channel_id: string;
          thread_id: string;
          sport: string;
          teams: string[];
          game_time: string;
          is_active?: boolean;
          pick_count?: number;
          user_count?: number;
          is_pinned?: boolean;
          last_activity?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          game_id?: string;
          channel_id?: string;
          thread_id?: string;
          sport?: string;
          teams?: string[];
          game_time?: string;
          is_active?: boolean;
          pick_count?: number;
          user_count?: number;
          is_pinned?: boolean;
          last_activity?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      user_picks: {
        Row: {
          id: string;
          user_id: string;
          discord_id: string;
          game_id: string | null;
          thread_id: string | null;
          pick_type: string;
          player_name: string | null;
          stat_type: string | null;
          line: number | null;
          over_under: 'over' | 'under' | null;
          odds: number | null;
          stake: number;
          confidence: number | null;
          reasoning: string | null;
          result: 'win' | 'loss' | 'push' | 'pending';
          actual_value: number | null;
          profit_loss: number | null;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          discord_id: string;
          game_id?: string | null;
          thread_id?: string | null;
          pick_type: string;
          player_name?: string | null;
          stat_type?: string | null;
          line?: number | null;
          over_under?: 'over' | 'under' | null;
          odds?: number | null;
          stake?: number;
          confidence?: number | null;
          reasoning?: string | null;
          result?: 'win' | 'loss' | 'push' | 'pending';
          actual_value?: number | null;
          profit_loss?: number | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          discord_id?: string;
          game_id?: string | null;
          thread_id?: string | null;
          pick_type?: string;
          player_name?: string | null;
          stat_type?: string | null;
          line?: number | null;
          over_under?: 'over' | 'under' | null;
          odds?: number | null;
          stake?: number;
          confidence?: number | null;
          reasoning?: string | null;
          result?: 'win' | 'loss' | 'push' | 'pending';
          actual_value?: number | null;
          profit_loss?: number | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      thread_stats: {
        Row: {
          id: string;
          thread_id: string;
          game_id: string;
          total_picks: number;
          unique_users: number;
          messages_count: number;
          last_activity: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          game_id: string;
          total_picks?: number;
          unique_users?: number;
          messages_count?: number;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          game_id?: string;
          total_picks?: number;
          unique_users?: number;
          messages_count?: number;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      thread_followers: {
        Row: {
          id: string;
          thread_id: string;
          user_id: string;
          discord_id: string;
          followed_at: string;
          notifications_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          user_id: string;
          discord_id: string;
          followed_at?: string;
          notifications_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          user_id?: string;
          discord_id?: string;
          followed_at?: string;
          notifications_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_cooldowns: {
        Row: {
          id: string;
          user_id: string;
          discord_id: string;
          command_type: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          discord_id: string;
          command_type: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          discord_id?: string;
          command_type?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pick_gradings: {
        Row: {
          id: string;
          pick_id: string;
          user_id: string;
          grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
          reasoning: string | null;
          confidence_score: number | null;
          edge_analysis: Json;
          graded_by: string;
          graded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_id: string;
          user_id: string;
          grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
          reasoning?: string | null;
          confidence_score?: number | null;
          edge_analysis?: Json;
          graded_by: string;
          graded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_id?: string;
          user_id?: string;
          grade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
          reasoning?: string | null;
          confidence_score?: number | null;
          edge_analysis?: Json;
          graded_by?: string;
          graded_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      coaching_sessions: {
        Row: {
          id: string;
          user_id: string;
          discord_id: string;
          coach_id: string;
          session_type: string;
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          duration_minutes: number | null;
          notes: string | null;
          feedback: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          discord_id: string;
          coach_id: string;
          session_type: string;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          scheduled_at: string;
          started_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          feedback?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          discord_id?: string;
          coach_id?: string;
          session_type?: string;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          feedback?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_feedback: {
        Row: {
          id: string;
          message_id: string;
          channel_id: string;
          user_id: string;
          feedback_type: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate';
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          channel_id: string;
          user_id: string;
          feedback_type: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate';
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          channel_id?: string;
          user_id?: string;
          feedback_type?: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate';
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback_messages: {
        Row: {
          id: string;
          user_id: string;
          discord_id: string;
          feedback_type: string;
          subject: string | null;
          message: string;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          assigned_to: string | null;
          response: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          discord_id: string;
          feedback_type: string;
          subject?: string | null;
          message: string;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_to?: string | null;
          response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          discord_id?: string;
          feedback_type?: string;
          subject?: string | null;
          message?: string;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_to?: string | null;
          response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          details: Json;
          timestamp: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          details?: Json;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          details?: Json;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      config_edit_sessions: {
        Row: {
          id: string;
          user_id: string;
          config_type: string;
          started_at: string;
          status: 'active' | 'completed' | 'abandoned';
          changes: Json;
          current_config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          config_type: string;
          started_at?: string;
          status?: 'active' | 'completed' | 'abandoned';
          changes?: Json;
          current_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          config_type?: string;
          started_at?: string;
          status?: 'active' | 'completed' | 'abandoned';
          changes?: Json;
          current_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      config_changes: {
        Row: {
          id: string;
          session_id: string;
          field_path: string;
          old_value: Json | null;
          new_value: Json | null;
          changed_by: string;
          changed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          field_path: string;
          old_value?: Json | null;
          new_value?: Json | null;
          changed_by: string;
          changed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          field_path?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          changed_by?: string;
          changed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_health_checks: {
        Row: {
          id: string;
          agent_id: string;
          agent_name: string;
          status: 'healthy' | 'warning' | 'critical' | 'offline';
          last_heartbeat: string | null;
          response_time_ms: number | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          agent_name: string;
          status: 'healthy' | 'warning' | 'critical' | 'offline';
          last_heartbeat?: string | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          agent_name?: string;
          status?: 'healthy' | 'warning' | 'critical' | 'offline';
          last_heartbeat?: string | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      keyword_triggers: {
        Row: {
          id: string;
          keyword: string;
          trigger_type: string;
          response_template: string;
          is_active: boolean;
          match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with';
          case_sensitive: boolean;
          cooldown_minutes: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          keyword: string;
          trigger_type: string;
          response_template: string;
          is_active?: boolean;
          match_type?: 'exact' | 'contains' | 'starts_with' | 'ends_with';
          case_sensitive?: boolean;
          cooldown_minutes?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          keyword?: string;
          trigger_type?: string;
          response_template?: string;
          is_active?: boolean;
          match_type?: 'exact' | 'contains' | 'starts_with' | 'ends_with';
          case_sensitive?: boolean;
          cooldown_minutes?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      emoji_triggers: {
        Row: {
          id: string;
          emoji: string;
          trigger_type: string;
          response_template: string;
          is_active: boolean;
          cooldown_minutes: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          emoji: string;
          trigger_type: string;
          response_template: string;
          is_active?: boolean;
          cooldown_minutes?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          emoji?: string;
          trigger_type?: string;
          response_template?: string;
          is_active?: boolean;
          cooldown_minutes?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auto_dm_templates: {
        Row: {
          id: string;
          template_name: string;
          template_type: string;
          content: Json;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_name: string;
          template_type: string;
          content: Json;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_name?: string;
          template_type?: string;
          content?: Json;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trigger_activation_logs: {
        Row: {
          id: string;
          trigger_id: string;
          trigger_type: 'keyword' | 'emoji';
          user_id: string;
          channel_id: string;
          message_id: string;
          triggered_content: string;
          response_sent: boolean;
          response_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trigger_id: string;
          trigger_type: 'keyword' | 'emoji';
          user_id: string;
          channel_id: string;
          message_id: string;
          triggered_content: string;
          response_sent?: boolean;
          response_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trigger_id?: string;
          trigger_type?: 'keyword' | 'emoji';
          user_id?: string;
          channel_id?: string;
          message_id?: string;
          triggered_content?: string;
          response_sent?: boolean;
          response_message_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vip_notification_sequences: {
        Row: {
          id: string;
          sequence_name: string;
          sequence_type: string;
          steps: Json;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_name: string;
          sequence_type: string;
          steps?: Json;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sequence_name?: string;
          sequence_type?: string;
          steps?: Json;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vip_welcome_flows: {
        Row: {
          id: string;
          flow_name: string;
          tier_level: string;
          welcome_message: Json;
          follow_up_sequence: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flow_name: string;
          tier_level: string;
          welcome_message: Json;
          follow_up_sequence?: string | null;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flow_name?: string;
          tier_level?: string;
          welcome_message?: Json;
          follow_up_sequence?: string | null;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_logs: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          sequence_id: string | null;
          step_number: number | null;
          status: 'sent' | 'failed' | 'pending' | 'cancelled';
          sent_at: string;
          error_message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_type: string;
          sequence_id?: string | null;
          step_number?: number | null;
          status?: 'sent' | 'failed' | 'pending' | 'cancelled';
          sent_at?: string;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_type?: string;
          sequence_id?: string | null;
          step_number?: number | null;
          status?: 'sent' | 'failed' | 'pending' | 'cancelled';
          sent_at?: string;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      // SPRINT-ENV-BUILD-TRUTH-LOCK: A/B Testing stub types for planned features
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          test_type: string;
          percentage: number;
          is_active?: boolean;
          config?: Json;
          end_date?: string | null;
          createdAt?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          test_type?: string;
          percentage?: number;
          is_active?: boolean;
          config?: Json;
          end_date?: string | null;
          createdAt?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cohort_id?: string;
          test_type?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
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
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cohort_id?: string;
          test_type?: string;
          metric?: string;
          value?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: 'recap' | 'alert' | 'command_response' | 'notification';
          cohort_id: string;
          template: string;
          variables?: string[];
          is_active?: boolean;
          createdAt?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: 'recap' | 'alert' | 'command_response' | 'notification';
          cohort_id?: string;
          template?: string;
          variables?: string[];
          is_active?: boolean;
          createdAt?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_health_checks: {
        Row: {
          id: string;
          timestamp: string;
          performedBy: string;
          performed_by: string;
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
          performedBy?: string;
          performed_by?: string;
          database: Json;
          discord: Json;
          services: Json;
          memory: Json;
          uptime: number;
          errors?: Json;
          recommendations?: string[];
        };
        Update: {
          id?: string;
          timestamp?: string;
          performedBy?: string;
          performed_by?: string;
          database?: Json;
          discord?: Json;
          services?: Json;
          memory?: Json;
          uptime?: number;
          errors?: Json;
          recommendations?: string[];
        };
        Relationships: [];
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
        Update: {
          id?: string;
          user_id?: string;
          tier?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      // Additional missing tables - SPRINT-ENV-BUILD-TRUTH-LOCK
      user_trials: {
        Row: {
          id: string;
          discord_id: string;
          user_id: string;
          active: boolean;
          expires_at: string;
          tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          discord_id: string;
          user_id: string;
          active?: boolean;
          expires_at: string;
          tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          discord_id?: string;
          user_id?: string;
          active?: boolean;
          expires_at?: string;
          tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          id: string;
          error_type: string;
          message: string;
          stack: string | null;
          metadata: Json;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          error_type: string;
          message: string;
          stack?: string | null;
          metadata?: Json;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          error_type?: string;
          message?: string;
          stack?: string | null;
          metadata?: Json;
          timestamp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      event_logs: {
        Row: {
          id: string;
          event_type: string;
          data: Json;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          data?: Json;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          data?: Json;
          timestamp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      thread_linking_rules: {
        Row: {
          id: string;
          source_type: string;
          target_type: string;
          config: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_type: string;
          target_type: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_type?: string;
          target_type?: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      cross_post_configs: {
        Row: {
          id: string;
          source_channel: string;
          target_channels: string[];
          config: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_channel: string;
          target_channels: string[];
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_channel?: string;
          target_channels?: string[];
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          sport: string;
          league: string;
          home_team: string;
          away_team: string;
          game_time: string;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sport: string;
          league: string;
          home_team: string;
          away_team: string;
          game_time: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sport?: string;
          league?: string;
          home_team?: string;
          away_team?: string;
          game_time?: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      thread_trivia: {
        Row: {
          id: string;
          thread_id: string;
          question: string;
          answer: string;
          options: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          question: string;
          answer: string;
          options?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          question?: string;
          answer?: string;
          options?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      thread_rules: {
        Row: {
          id: string;
          thread_id: string;
          rule_type: string;
          config: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          rule_type: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          rule_type?: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_grading_results: {
        Row: {
          id: string;
          pick_id: string;
          grade: string;
          reasoning: string;
          confidence: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_id: string;
          grade: string;
          reasoning?: string;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_id?: string;
          grade?: string;
          reasoning?: string;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_coaching_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_type: string;
          messages: Json;
          status: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_type: string;
          messages?: Json;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_type?: string;
          messages?: Json;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_pick_recommendations: {
        Row: {
          id: string;
          user_id: string;
          recommendations: Json;
          generated_at: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recommendations?: Json;
          generated_at?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recommendations?: Json;
          generated_at?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      alert_preferences: {
        Row: {
          id: string;
          user_id: string;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      betting_pattern_analyses: {
        Row: {
          id: string;
          user_id: string;
          analysis: Json;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          analysis?: Json;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          analysis?: Json;
          generated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      live_coaching_sessions: {
        Row: {
          id: string;
          user_id: string;
          coach_id: string;
          status: string;
          messages: Json;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          coach_id: string;
          status?: string;
          messages?: Json;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          coach_id?: string;
          status?: string;
          messages?: Json;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      multi_lang_responses: {
        Row: {
          id: string;
          key: string;
          language: string;
          response: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          language: string;
          response: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          language?: string;
          response?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pick_analytics: {
        Row: {
          id: string;
          pick_id: string;
          analytics: Json;
          calculated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_id: string;
          analytics?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_id?: string;
          analytics?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pick_trends: {
        Row: {
          id: string;
          stat_type: string;
          trend_data: Json;
          calculated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          stat_type: string;
          trend_data?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          stat_type?: string;
          trend_data?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      picks: {
        Row: {
          id: string;
          user_id: string;
          sport: string;
          pick_type: string;
          data: Json;
          status: string;
          result: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sport: string;
          pick_type: string;
          data?: Json;
          status?: string;
          result?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sport?: string;
          pick_type?: string;
          data?: Json;
          status?: string;
          result?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_pick_stats: {
        Row: {
          id: string;
          user_id: string;
          stats: Json;
          calculated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stats?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stats?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          discord_id: string;
          username: string;
          email: string | null;
          tier: string;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          discord_id: string;
          username: string;
          email?: string | null;
          tier?: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          discord_id?: string;
          username?: string;
          email?: string | null;
          tier?: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dm_analytics: {
        Row: {
          id: string;
          user_id: string;
          metrics: Json;
          calculated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metrics?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metrics?: Json;
          calculated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dm_logs: {
        Row: {
          id: string;
          user_id: string;
          message_type: string;
          content: string;
          status: string;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message_type: string;
          content: string;
          status?: string;
          sent_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message_type?: string;
          content?: string;
          status?: string;
          sent_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dm_templates: {
        Row: {
          id: string;
          name: string;
          template: string;
          variables: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          template: string;
          variables?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          template?: string;
          variables?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      dm_triggers: {
        Row: {
          id: string;
          trigger_type: string;
          config: Json;
          template_id: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trigger_type: string;
          config?: Json;
          template_id: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trigger_type?: string;
          config?: Json;
          template_id?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      enhanced_players: {
        Row: {
          id: string;
          name: string;
          team: string;
          sport: string;
          position: string | null;
          stats: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          team: string;
          sport: string;
          position?: string | null;
          stats?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          team?: string;
          sport?: string;
          position?: string | null;
          stats?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enhanced_games: {
        Row: {
          id: string;
          sport: string;
          league: string;
          home_team: string;
          away_team: string;
          game_time: string;
          odds: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sport: string;
          league: string;
          home_team: string;
          away_team: string;
          game_time: string;
          odds?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sport?: string;
          league?: string;
          home_team?: string;
          away_team?: string;
          game_time?: string;
          odds?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enhanced_tickets: {
        Row: {
          id: string;
          user_id: string;
          ticket_type: string;
          legs: Json;
          status: string;
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticket_type: string;
          legs?: Json;
          status?: string;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticket_type?: string;
          legs?: Json;
          status?: string;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      onboarding_stats: {
        Row: {
          flow_type: string | null;
          status: string | null;
          count: number | null;
          avg_duration_ms: number | null;
        };
      };
      dm_failure_stats: {
        Row: {
          failure_reason: string | null;
          count: number | null;
          unresolved_count: number | null;
          avg_retry_count: number | null;
        };
      };
      daily_onboarding_metrics: {
        Row: {
          date: string | null;
          started: number | null;
          completed: number | null;
          abandoned: number | null;
          failed: number | null;
          completion_rate: number | null;
        };
      };
      cappers: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          discord_id: string;
          username: string;
          display_name: string | null;
          tier: 'rookie' | 'pro' | 'elite' | 'legend';
          status: 'active' | 'inactive' | 'suspended';
          total_picks: number;
          wins: number;
          losses: number;
          pushes: number;
          total_units: number;
          roi: number;
          win_rate: number;
          current_streak: number;
          best_streak: number;
          worst_streak: number;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          discord_id: string;
          username: string;
          display_name?: string | null;
          tier: 'rookie' | 'pro' | 'elite' | 'legend';
          status?: 'active' | 'inactive' | 'suspended';
          total_picks?: number;
          wins?: number;
          losses?: number;
          pushes?: number;
          total_units?: number;
          roi?: number;
          win_rate?: number;
          current_streak?: number;
          best_streak?: number;
          worst_streak?: number;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          discord_id?: string;
          username?: string;
          display_name?: string | null;
          tier?: 'rookie' | 'pro' | 'elite' | 'legend';
          status?: 'active' | 'inactive' | 'suspended';
          total_picks?: number;
          wins?: number;
          losses?: number;
          pushes?: number;
          total_units?: number;
          roi?: number;
          win_rate?: number;
          current_streak?: number;
          best_streak?: number;
          worst_streak?: number;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      capper_evaluations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          capper_id: string;
          pick_id: string;
          result: 'win' | 'loss' | 'push' | 'pending';
          units_won: number;
          units_lost: number;
          evaluation_date: string;
          notes: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id: string;
          pick_id: string;
          result: 'win' | 'loss' | 'push' | 'pending';
          units_won?: number;
          units_lost?: number;
          evaluation_date: string;
          notes?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          capper_id?: string;
          pick_id?: string;
          result?: 'win' | 'loss' | 'push' | 'pending';
          units_won?: number;
          units_lost?: number;
          evaluation_date?: string;
          notes?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      update_user_stats: {
        Args: {
          user_discord_id: string;
          pick_result: string;
          units_change: number;
        };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
