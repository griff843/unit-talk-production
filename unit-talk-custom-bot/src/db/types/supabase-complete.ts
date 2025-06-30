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
      // Existing tables from original schema
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
      // Onboarding tables from existing schema
      onboarding_config: {
        Row: {
          id: string
          config: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          config: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      onboarding_progress: {
        Row: {
          id: string
          user_id: string
          guild_id: string
          flow_type: string
          current_step: string | null
          step_data: Json
          preferences: Json
          status: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          started_at: string
          completed_at: string | null
          last_activity: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guild_id: string
          flow_type: string
          current_step?: string | null
          step_data?: Json
          preferences?: Json
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          started_at?: string
          completed_at?: string | null
          last_activity?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guild_id?: string
          flow_type?: string
          current_step?: string | null
          step_data?: Json
          preferences?: Json
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          started_at?: string
          completed_at?: string | null
          last_activity?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      dm_failures: {
        Row: {
          id: string
          user_id: string
          guild_id: string
          step: string
          failure_reason: string
          error_message: string | null
          attempted_at: string
          retry_count: number
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guild_id: string
          step: string
          failure_reason: string
          error_message?: string | null
          attempted_at?: string
          retry_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guild_id?: string
          step?: string
          failure_reason?: string
          error_message?: string | null
          attempted_at?: string
          retry_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          user_id: string
          guild_id: string
          event_type: string
          event_data: Json
          timestamp: string
          session_id: string | null
          user_agent: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guild_id: string
          event_type: string
          event_data?: Json
          timestamp?: string
          session_id?: string | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guild_id?: string
          event_type?: string
          event_data?: Json
          timestamp?: string
          session_id?: string | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
      }
      user_journeys: {
        Row: {
          id: string
          user_id: string
          guild_id: string
          started_at: string
          completed_at: string | null
          status: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          flow_type: string
          steps: Json
          total_duration: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guild_id: string
          started_at?: string
          completed_at?: string | null
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          flow_type: string
          steps?: Json
          total_duration?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guild_id?: string
          started_at?: string
          completed_at?: string | null
          status?: 'in_progress' | 'completed' | 'abandoned' | 'failed'
          flow_type?: string
          steps?: Json
          total_duration?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      onboarding_flow_edits: {
        Row: {
          id: string
          flow_id: string
          field: string
          old_value: Json | null
          new_value: Json | null
          edited_by: string
          edited_at: string
          created_at: string
        }
        Insert: {
          id?: string
          flow_id: string
          field: string
          old_value?: Json | null
          new_value?: Json | null
          edited_by: string
          edited_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          flow_id?: string
          field?: string
          old_value?: Json | null
          new_value?: Json | null
          edited_by?: string
          edited_at?: string
          created_at?: string
        }
      }
      admin_actions: {
        Row: {
          id: string
          admin_user_id: string
          guild_id: string
          action_type: string
          target_user_id: string | null
          action_data: Json
          timestamp: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id: string
          guild_id: string
          action_type: string
          target_user_id?: string | null
          action_data?: Json
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string
          guild_id?: string
          action_type?: string
          target_user_id?: string | null
          action_data?: Json
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          guild_id: string
          sports: string[]
          notification_level: string | null
          experience_level: string | null
          betting_style: string | null
          bankroll_size: string | null
          risk_tolerance: string | null
          notification_timing: string | null
          custom_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guild_id: string
          sports?: string[]
          notification_level?: string | null
          experience_level?: string | null
          betting_style?: string | null
          bankroll_size?: string | null
          risk_tolerance?: string | null
          notification_timing?: string | null
          custom_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guild_id?: string
          sports?: string[]
          notification_level?: string | null
          experience_level?: string | null
          betting_style?: string | null
          bankroll_size?: string | null
          risk_tolerance?: string | null
          notification_timing?: string | null
          custom_preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      onboarding_templates: {
        Row: {
          id: string
          template_key: string
          template_type: string
          content: Json
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_key: string
          template_type: string
          content: Json
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_key?: string
          template_type?: string
          content?: Json
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      // Missing tables identified from code analysis
      user_profiles: {
        Row: {
          id: string
          discord_id: string
          username: string | null
          discriminator: string | null
          avatar: string | null
          tier: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner'
          subscription_tier: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS'
          created_at: string
          updated_at: string
          last_active: string
          metadata: Json
        }
        Insert: {
          id?: string
          discord_id: string
          username?: string | null
          discriminator?: string | null
          avatar?: string | null
          tier?: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner'
          subscription_tier?: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS'
          created_at?: string
          updated_at?: string
          last_active?: string
          metadata?: Json
        }
        Update: {
          id?: string
          discord_id?: string
          username?: string | null
          discriminator?: string | null
          avatar?: string | null
          tier?: 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner'
          subscription_tier?: 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS'
          created_at?: string
          updated_at?: string
          last_active?: string
          metadata?: Json
        }
      }
      game_threads: {
        Row: {
          id: string
          game_id: string
          channel_id: string
          thread_id: string
          sport: string
          teams: string[]
          game_time: string
          is_active: boolean
          pick_count: number
          user_count: number
          is_pinned: boolean
          last_activity: string
          name: string | null
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          game_id: string
          channel_id: string
          thread_id: string
          sport: string
          teams: string[]
          game_time: string
          is_active?: boolean
          pick_count?: number
          user_count?: number
          is_pinned?: boolean
          last_activity?: string
          name?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          game_id?: string
          channel_id?: string
          thread_id?: string
          sport?: string
          teams?: string[]
          game_time?: string
          is_active?: boolean
          pick_count?: number
          user_count?: number
          is_pinned?: boolean
          last_activity?: string
          name?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      user_picks: {
        Row: {
          id: string
          user_id: string
          discord_id: string
          game_id: string | null
          thread_id: string | null
          pick_type: string
          player_name: string | null
          stat_type: string | null
          line: number | null
          over_under: 'over' | 'under' | null
          odds: number | null
          stake: number
          confidence: number | null
          reasoning: string | null
          result: 'win' | 'loss' | 'push' | 'pending'
          actual_value: number | null
          profit_loss: number | null
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          discord_id: string
          game_id?: string | null
          thread_id?: string | null
          pick_type: string
          player_name?: string | null
          stat_type?: string | null
          line?: number | null
          over_under?: 'over' | 'under' | null
          odds?: number | null
          stake?: number
          confidence?: number | null
          reasoning?: string | null
          result?: 'win' | 'loss' | 'push' | 'pending'
          actual_value?: number | null
          profit_loss?: number | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          game_id?: string | null
          thread_id?: string | null
          pick_type?: string
          player_name?: string | null
          stat_type?: string | null
          line?: number | null
          over_under?: 'over' | 'under' | null
          odds?: number | null
          stake?: number
          confidence?: number | null
          reasoning?: string | null
          result?: 'win' | 'loss' | 'push' | 'pending'
          actual_value?: number | null
          profit_loss?: number | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      thread_stats: {
        Row: {
          id: string
          thread_id: string
          game_id: string
          total_picks: number
          unique_users: number
          messages_count: number
          last_activity: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          game_id: string
          total_picks?: number
          unique_users?: number
          messages_count?: number
          last_activity?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          game_id?: string
          total_picks?: number
          unique_users?: number
          messages_count?: number
          last_activity?: string
          created_at?: string
          updated_at?: string
        }
      }
      thread_followers: {
        Row: {
          id: string
          thread_id: string
          user_id: string
          discord_id: string
          followed_at: string
          notifications_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          user_id: string
          discord_id: string
          followed_at?: string
          notifications_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          user_id?: string
          discord_id?: string
          followed_at?: string
          notifications_enabled?: boolean
          created_at?: string
        }
      }
      user_cooldowns: {
        Row: {
          id: string
          user_id: string
          discord_id: string
          command_type: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          discord_id: string
          command_type: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          command_type?: string
          expires_at?: string
          created_at?: string
        }
      }
      pick_gradings: {
        Row: {
          id: string
          pick_id: string
          user_id: string
          grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'
          reasoning: string | null
          confidence_score: number | null
          edge_analysis: Json
          graded_by: string
          graded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          pick_id: string
          user_id: string
          grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'
          reasoning?: string | null
          confidence_score?: number | null
          edge_analysis?: Json
          graded_by: string
          graded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          pick_id?: string
          user_id?: string
          grade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'
          reasoning?: string | null
          confidence_score?: number | null
          edge_analysis?: Json
          graded_by?: string
          graded_at?: string
          created_at?: string
        }
      }
      coaching_sessions: {
        Row: {
          id: string
          user_id: string
          discord_id: string
          coach_id: string
          session_type: string
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at: string
          started_at: string | null
          completed_at: string | null
          duration_minutes: number | null
          notes: string | null
          feedback: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          discord_id: string
          coach_id: string
          session_type: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at: string
          started_at?: string | null
          completed_at?: string | null
          duration_minutes?: number | null
          notes?: string | null
          feedback?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          coach_id?: string
          session_type?: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          duration_minutes?: number | null
          notes?: string | null
          feedback?: Json
          created_at?: string
          updated_at?: string
        }
      }
      message_feedback: {
        Row: {
          id: string
          message_id: string
          channel_id: string
          user_id: string
          feedback_type: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate'
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          channel_id: string
          user_id: string
          feedback_type: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate'
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          channel_id?: string
          user_id?: string
          feedback_type?: 'helpful' | 'not_helpful' | 'spam' | 'inappropriate'
          comment?: string | null
          created_at?: string
        }
      }
      feedback_messages: {
        Row: {
          id: string
          user_id: string
          discord_id: string
          feedback_type: string
          subject: string | null
          message: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to: string | null
          response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          discord_id: string
          feedback_type: string
          subject?: string | null
          message: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          feedback_type?: string
          subject?: string | null
          message?: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          response?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          details: Json
          timestamp: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          details?: Json
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          details?: Json
          timestamp?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      config_edit_sessions: {
        Row: {
          id: string
          user_id: string
          config_type: string
          started_at: string
          status: 'active' | 'completed' | 'abandoned'
          changes: Json
          current_config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          config_type: string
          started_at?: string
          status?: 'active' | 'completed' | 'abandoned'
          changes?: Json
          current_config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          config_type?: string
          started_at?: string
          status?: 'active' | 'completed' | 'abandoned'
          changes?: Json
          current_config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      config_changes: {
        Row: {
          id: string
          session_id: string
          field_path: string
          old_value: Json | null
          new_value: Json | null
          changed_by: string
          changed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          field_path: string
          old_value?: Json | null
          new_value?: Json | null
          changed_by: string
          changed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          field_path?: string
          old_value?: Json | null
          new_value?: Json | null
          changed_by?: string
          changed_at?: string
          created_at?: string
        }
      }
      agent_health_checks: {
        Row: {
          id: string
          agent_id: string
          agent_name: string
          status: 'healthy' | 'warning' | 'critical' | 'offline'
          last_heartbeat: string | null
          response_time_ms: number | null
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          agent_name: string
          status: 'healthy' | 'warning' | 'critical' | 'offline'
          last_heartbeat?: string | null
          response_time_ms?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          agent_name?: string
          status?: 'healthy' | 'warning' | 'critical' | 'offline'
          last_heartbeat?: string | null
          response_time_ms?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      keyword_triggers: {
        Row: {
          id: string
          keyword: string
          trigger_type: string
          response_template: string
          is_active: boolean
          match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with'
          case_sensitive: boolean
          cooldown_minutes: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          keyword: string
          trigger_type: string
          response_template: string
          is_active?: boolean
          match_type?: 'exact' | 'contains' | 'starts_with' | 'ends_with'
          case_sensitive?: boolean
          cooldown_minutes?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          keyword?: string
          trigger_type?: string
          response_template?: string
          is_active?: boolean
          match_type?: 'exact' | 'contains' | 'starts_with' | 'ends_with'
          case_sensitive?: boolean
          cooldown_minutes?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      emoji_triggers: {
        Row: {
          id: string
          emoji: string
          trigger_type: string
          response_template: string
          is_active: boolean
          cooldown_minutes: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          emoji: string
          trigger_type: string
          response_template: string
          is_active?: boolean
          cooldown_minutes?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          emoji?: string
          trigger_type?: string
          response_template?: string
          is_active?: boolean
          cooldown_minutes?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      auto_dm_templates: {
        Row: {
          id: string
          template_name: string
          template_type: string
          content: Json
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_name: string
          template_type: string
          content: Json
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_name?: string
          template_type?: string
          content?: Json
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      trigger_activation_logs: {
        Row: {
          id: string
          trigger_id: string
          trigger_type: 'keyword' | 'emoji'
          user_id: string
          channel_id: string
          message_id: string
          triggered_content: string
          response_sent: boolean
          response_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trigger_id: string
          trigger_type: 'keyword' | 'emoji'
          user_id: string
          channel_id: string
          message_id: string
          triggered_content: string
          response_sent?: boolean
          response_message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trigger_id?: string
          trigger_type?: 'keyword' | 'emoji'
          user_id?: string
          channel_id?: string
          message_id?: string
          triggered_content?: string
          response_sent?: boolean
          response_message_id?: string | null
          created_at?: string
        }
      }
      vip_notification_sequences: {
        Row: {
          id: string
          sequence_name: string
          sequence_type: string
          steps: Json
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sequence_name: string
          sequence_type: string
          steps?: Json
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sequence_name?: string
          sequence_type?: string
          steps?: Json
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      vip_welcome_flows: {
        Row: {
          id: string
          flow_name: string
          tier_level: string
          welcome_message: Json
          follow_up_sequence: string | null
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          flow_name: string
          tier_level: string
          welcome_message: Json
          follow_up_sequence?: string | null
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          flow_name?: string
          tier_level?: string
          welcome_message?: Json
          follow_up_sequence?: string | null
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      notification_logs: {
        Row: {
          id: string
          user_id: string
          notification_type: string
          sequence_id: string | null
          step_number: number | null
          status: 'sent' | 'failed' | 'pending' | 'cancelled'
          sent_at: string
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: string
          sequence_id?: string | null
          step_number?: number | null
          status?: 'sent' | 'failed' | 'pending' | 'cancelled'
          sent_at?: string
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notification_type?: string
          sequence_id?: string | null
          step_number?: number | null
          status?: 'sent' | 'failed' | 'pending' | 'cancelled'
          sent_at?: string
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
      }
    }
    Views: {
      onboarding_stats: {
        Row: {
          flow_type: string | null
          status: string | null
          count: number | null
          avg_duration_ms: number | null
        }
      }
      dm_failure_stats: {
        Row: {
          failure_reason: string | null
          count: number | null
          unresolved_count: number | null
          avg_retry_count: number | null
        }
      }
      daily_onboarding_metrics: {
        Row: {
          date: string | null
          started: number | null
          completed: number | null
          abandoned: number | null
          failed: number | null
          completion_rate: number | null
        }
      }
      cappers: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          discord_id: string
          username: string
          display_name: string | null
          tier: 'rookie' | 'pro' | 'elite' | 'legend'
          status: 'active' | 'inactive' | 'suspended'
          total_picks: number
          wins: number
          losses: number
          pushes: number
          total_units: number
          roi: number
          win_rate: number
          current_streak: number
          best_streak: number
          worst_streak: number
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          discord_id: string
          username: string
          display_name?: string | null
          tier: 'rookie' | 'pro' | 'elite' | 'legend'
          status?: 'active' | 'inactive' | 'suspended'
          total_picks?: number
          wins?: number
          losses?: number
          pushes?: number
          total_units?: number
          roi?: number
          win_rate?: number
          current_streak?: number
          best_streak?: number
          worst_streak?: number
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          discord_id?: string
          username?: string
          display_name?: string | null
          tier?: 'rookie' | 'pro' | 'elite' | 'legend'
          status?: 'active' | 'inactive' | 'suspended'
          total_picks?: number
          wins?: number
          losses?: number
          pushes?: number
          total_units?: number
          roi?: number
          win_rate?: number
          current_streak?: number
          best_streak?: number
          worst_streak?: number
          metadata?: Json | null
        }
      }
      capper_evaluations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          capper_id: string
          pick_id: string
          result: 'win' | 'loss' | 'push' | 'pending'
          units_won: number
          units_lost: number
          evaluation_date: string
          notes: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id: string
          pick_id: string
          result: 'win' | 'loss' | 'push' | 'pending'
          units_won?: number
          units_lost?: number
          evaluation_date: string
          notes?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          capper_id?: string
          pick_id?: string
          result?: 'win' | 'loss' | 'push' | 'pending'
          units_won?: number
          units_lost?: number
          evaluation_date?: string
          notes?: string | null
          metadata?: Json | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}