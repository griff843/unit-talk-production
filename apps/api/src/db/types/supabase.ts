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
      unified_picks: {
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
      raw_props: {
        Row: {
          id: number
          sport: string
          stat_type?: string
          player_name?: string
          line?: number
          over_odds?: number
          under_odds?: number
          is_valid?: boolean
          processed_at?: string
          processed_by?: string
          error_message?: string
          error_at?: string
          created_at?: string
          updated_at?: string
          settled_at?: string
          status?: string
          result?: string
          actual_value?: number
          external_id?: string
          source?: string
          start_time?: string
          game_id?: string
          external_prop_id?: string
          outcome?: string
          promoted_to_picks?: boolean
          promoted_at?: string
          team?: string
          opponent?: string
          market?: string
          market_type?: string
          league?: string
          game_date?: string
          metadata?: Json
          over?: number
          under?: number
          trend_confidence?: number
          edge_score?: number
          matchup_quality?: number
          expected_value?: number
          sharp_money?: number
          line_movement?: number
          player_form?: number
          injury_impact?: number
          weather_impact?: number
          market_intelligence?: number
          volume_profile?: number
          closing_line_value?: number
          steam_detected?: boolean
          predicted_closing_line?: number
          optimal_betting_time?: string
          best_available_line?: number
          best_book?: string
          public_betting_percentage?: number
          sharp_betting_percentage?: number
          contrarian_opportunity?: boolean
          injury_timing_advantage?: number
          cross_market_arbitrage?: number
          player_fatigue?: number
          venue_advantage?: number
          referee_impact?: number
          pace_impact?: number
          motivational_factors?: number
          correlation_risk?: number
          volatility?: number
          portfolio_impact?: number
          bid_ask_spread?: number
          data_completeness?: number
          outlier_score?: number
          consistency_score?: number
          data_validation_score?: number
          pro_attempts?: number
          processing_error?: string
          prop_type?: string
          home_team?: string
          away_team?: string
          odds?: number
          org_id?: string
          prop_id?: string
          player_id?: string
          professional_score?: number
          kelly_fraction?: number
          clv_tracking_id?: string
          sharp_money_indicator?: boolean
          public_percentage?: number
          tier?: string
          confidence?: number
          feature_contributions?: Json
          grading_version?: string
          quality_flags?: Json
          processing_batch_id?: string
          game_start?: string
        }
        Insert: {
          id?: number
          sport: string
          stat_type?: string
          player_name?: string
          line?: number
          over_odds?: number
          under_odds?: number
          is_valid?: boolean
          processed_at?: string
          processed_by?: string
          error_message?: string
          error_at?: string
          created_at?: string
          updated_at?: string
          settled_at?: string
          status?: string
          result?: string
          actual_value?: number
          external_id?: string
          source?: string
          start_time?: string
          game_id?: string
          external_prop_id?: string
          outcome?: string
          promoted_to_picks?: boolean
          promoted_at?: string
          team?: string
          opponent?: string
          market?: string
          market_type?: string
          league?: string
          game_date?: string
          metadata?: Json
          over?: number
          under?: number
          trend_confidence?: number
          edge_score?: number
          matchup_quality?: number
          expected_value?: number
          sharp_money?: number
          line_movement?: number
          player_form?: number
          injury_impact?: number
          weather_impact?: number
          market_intelligence?: number
          volume_profile?: number
          closing_line_value?: number
          steam_detected?: boolean
          predicted_closing_line?: number
          optimal_betting_time?: string
          best_available_line?: number
          best_book?: string
          public_betting_percentage?: number
          sharp_betting_percentage?: number
          contrarian_opportunity?: boolean
          injury_timing_advantage?: number
          cross_market_arbitrage?: number
          player_fatigue?: number
          venue_advantage?: number
          referee_impact?: number
          pace_impact?: number
          motivational_factors?: number
          correlation_risk?: number
          volatility?: number
          portfolio_impact?: number
          bid_ask_spread?: number
          data_completeness?: number
          outlier_score?: number
          consistency_score?: number
          data_validation_score?: number
          pro_attempts?: number
          processing_error?: string
          prop_type?: string
          home_team?: string
          away_team?: string
          odds?: number
          org_id?: string
          prop_id?: string
          player_id?: string
          professional_score?: number
          kelly_fraction?: number
          clv_tracking_id?: string
          sharp_money_indicator?: boolean
          public_percentage?: number
          tier?: string
          confidence?: number
          feature_contributions?: Json
          grading_version?: string
          quality_flags?: Json
          processing_batch_id?: string
          game_start?: string
        }
        Update: {
          id?: number
          sport?: string
          stat_type?: string
          player_name?: string
          line?: number
          over_odds?: number
          under_odds?: number
          is_valid?: boolean
          processed_at?: string
          processed_by?: string
          error_message?: string
          error_at?: string
          created_at?: string
          updated_at?: string
          settled_at?: string
          status?: string
          result?: string
          actual_value?: number
          external_id?: string
          source?: string
          start_time?: string
          game_id?: string
          external_prop_id?: string
          outcome?: string
          promoted_to_picks?: boolean
          promoted_at?: string
          team?: string
          opponent?: string
          market?: string
          market_type?: string
          league?: string
          game_date?: string
          metadata?: Json
          over?: number
          under?: number
          trend_confidence?: number
          edge_score?: number
          matchup_quality?: number
          expected_value?: number
          sharp_money?: number
          line_movement?: number
          player_form?: number
          injury_impact?: number
          weather_impact?: number
          market_intelligence?: number
          volume_profile?: number
          closing_line_value?: number
          steam_detected?: boolean
          predicted_closing_line?: number
          optimal_betting_time?: string
          best_available_line?: number
          best_book?: string
          public_betting_percentage?: number
          sharp_betting_percentage?: number
          contrarian_opportunity?: boolean
          injury_timing_advantage?: number
          cross_market_arbitrage?: number
          player_fatigue?: number
          venue_advantage?: number
          referee_impact?: number
          pace_impact?: number
          motivational_factors?: number
          correlation_risk?: number
          volatility?: number
          portfolio_impact?: number
          bid_ask_spread?: number
          data_completeness?: number
          outlier_score?: number
          consistency_score?: number
          data_validation_score?: number
          pro_attempts?: number
          processing_error?: string
          prop_type?: string
          home_team?: string
          away_team?: string
          odds?: number
          org_id?: string
          prop_id?: string
          player_id?: string
          professional_score?: number
          kelly_fraction?: number
          clv_tracking_id?: string
          sharp_money_indicator?: boolean
          public_percentage?: number
          tier?: string
          confidence?: number
          feature_contributions?: Json
          grading_version?: string
          quality_flags?: Json
          processing_batch_id?: string
          game_start?: string
        }
      }
      games: {
        Row: {
          id: string
          sport: string
          league?: string
          home_team_id?: string
          away_team_id?: string
          home_team?: string
          away_team?: string
          game_date?: string
          game_time?: string
          commence_time?: string
          start_time?: string
          status?: string
          spread?: string
          total?: string
          moneyline_home?: string
          moneyline_away?: string
          spread_odds?: string
          total_over_odds?: string
          total_under_odds?: string
          matchup?: string
          away_team_meta?: Json
          home_team_meta?: Json
          home_odds?: number
          away_odds?: number
          home_spread?: number
          away_spread?: number
          home_spread_odds?: number
          away_spread_odds?: number
          venue?: string
          source?: string
          created_at?: string
          updated_at?: string
          game_id?: string
          provider?: string
          external_data?: Json
        }
        Insert: {
          id?: string
          sport: string
          league?: string
          home_team_id?: string
          away_team_id?: string
          home_team?: string
          away_team?: string
          game_date?: string
          game_time?: string
          commence_time?: string
          start_time?: string
          status?: string
          spread?: string
          total?: string
          moneyline_home?: string
          moneyline_away?: string
          spread_odds?: string
          total_over_odds?: string
          total_under_odds?: string
          matchup?: string
          away_team_meta?: Json
          home_team_meta?: Json
          home_odds?: number
          away_odds?: number
          home_spread?: number
          away_spread?: number
          home_spread_odds?: number
          away_spread_odds?: number
          venue?: string
          source?: string
          created_at?: string
          updated_at?: string
          game_id?: string
          provider?: string
          external_data?: Json
        }
        Update: {
          id?: string
          sport?: string
          league?: string
          home_team_id?: string
          away_team_id?: string
          home_team?: string
          away_team?: string
          game_date?: string
          game_time?: string
          commence_time?: string
          start_time?: string
          status?: string
          spread?: string
          total?: string
          moneyline_home?: string
          moneyline_away?: string
          spread_odds?: string
          total_over_odds?: string
          total_under_odds?: string
          matchup?: string
          away_team_meta?: Json
          home_team_meta?: Json
          home_odds?: number
          away_odds?: number
          home_spread?: number
          away_spread?: number
          home_spread_odds?: number
          away_spread_odds?: number
          venue?: string
          source?: string
          created_at?: string
          updated_at?: string
          game_id?: string
          provider?: string
          external_data?: Json
        }
      }
      shadow_decisions: {
        Row: {
          id: string
          created_at?: string
          unified_pick_id?: string
          raw_prop_id?: string
          sport: string
          market: string
          player: string
          team?: string
          book?: string
          odds_open?: number
          odds_now?: number
          line?: number
          event_time?: string
          tier?: string
          confidence?: number
          professional_score?: number
          devigged_win_prob?: number
          devigged_edge?: number
          clv_pct?: number
          kelly_fraction?: number
          risk?: number
          chaos_muted?: boolean
          steam_muted?: boolean
          is_instant?: boolean
          group_key?: string
          decided_action: string
          decision_type?: string
          reasons?: Json
        }
        Insert: {
          id?: string
          created_at?: string
          unified_pick_id?: string
          raw_prop_id?: string
          sport: string
          market: string
          player: string
          team?: string
          book?: string
          odds_open?: number
          odds_now?: number
          line?: number
          event_time?: string
          tier?: string
          confidence?: number
          professional_score?: number
          devigged_win_prob?: number
          devigged_edge?: number
          clv_pct?: number
          kelly_fraction?: number
          risk?: number
          chaos_muted?: boolean
          steam_muted?: boolean
          is_instant?: boolean
          group_key?: string
          decided_action: string
          decision_type?: string
          reasons?: Json
        }
        Update: {
          id?: string
          created_at?: string
          unified_pick_id?: string
          raw_prop_id?: string
          sport?: string
          market?: string
          player?: string
          team?: string
          book?: string
          odds_open?: number
          odds_now?: number
          line?: number
          event_time?: string
          tier?: string
          confidence?: number
          professional_score?: number
          devigged_win_prob?: number
          devigged_edge?: number
          clv_pct?: number
          kelly_fraction?: number
          risk?: number
          chaos_muted?: boolean
          steam_muted?: boolean
          is_instant?: boolean
          group_key?: string
          decided_action?: string
          decision_type?: string
          reasons?: Json
        }
      }
      steam_moves: {
        Row: {
          id: string
          prop_id: number
          line_change: number
          volume_delta: number
          confidence_score?: number
          source: string
          detected_at?: string
          previous_line?: number
          new_line?: number
          time_window_minutes?: number
          significance_level?: 'low' | 'medium' | 'high' | 'critical'
        }
        Insert: {
          id?: string
          prop_id: number
          line_change: number
          volume_delta: number
          confidence_score?: number
          source: string
          detected_at?: string
          previous_line?: number
          new_line?: number
          time_window_minutes?: number
          significance_level?: 'low' | 'medium' | 'high' | 'critical'
        }
        Update: {
          id?: string
          prop_id?: number
          line_change?: number
          volume_delta?: number
          confidence_score?: number
          source?: string
          detected_at?: string
          previous_line?: number
          new_line?: number
          time_window_minutes?: number
          significance_level?: 'low' | 'medium' | 'high' | 'critical'
        }
      }
      injury_impacts: {
        Row: {
          id: string
          player_id: string
          injury_type: string
          severity?: 'questionable' | 'probable' | 'doubtful' | 'out' | 'ir'
          affected_props: Json
          impact_score?: number
          reported_at?: string
          injury_description?: string
          expected_return_date?: string
          source?: string
          status?: 'active' | 'resolved' | 'updated'
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          player_id: string
          injury_type: string
          severity?: 'questionable' | 'probable' | 'doubtful' | 'out' | 'ir'
          affected_props: Json
          impact_score?: number
          reported_at?: string
          injury_description?: string
          expected_return_date?: string
          source?: string
          status?: 'active' | 'resolved' | 'updated'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          injury_type?: string
          severity?: 'questionable' | 'probable' | 'doubtful' | 'out' | 'ir'
          affected_props?: Json
          impact_score?: number
          reported_at?: string
          injury_description?: string
          expected_return_date?: string
          source?: string
          status?: 'active' | 'resolved' | 'updated'
          created_at?: string
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: string
          name: string
          sport: string
          team?: string
          position?: string
          jersey_number?: number
          external_id?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          sport: string
          team?: string
          position?: string
          jersey_number?: number
          external_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sport?: string
          team?: string
          position?: string
          jersey_number?: number
          external_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      clv_tracking: {
        Row: {
          id: string
          pick_id?: number
          prop_id?: string
          betline?: number
          closing_line?: number
          clv_value?: number
          tracking_start?: string
          line_close_time?: string
          status?: string
          created_at?: string
          betLine?: number
        }
        Insert: {
          id?: string
          pick_id?: number
          prop_id?: string
          betline?: number
          closing_line?: number
          clv_value?: number
          tracking_start?: string
          line_close_time?: string
          status?: string
          created_at?: string
          betLine?: number
        }
        Update: {
          id?: string
          pick_id?: number
          prop_id?: string
          betline?: number
          closing_line?: number
          clv_value?: number
          tracking_start?: string
          line_close_time?: string
          status?: string
          created_at?: string
          betLine?: number
        }
      }
      agent_health: {
        Row: {
          id: number
          agent_name?: string
          status?: string
          last_heartbeat?: string
        }
        Insert: {
          id?: number
          agent_name?: string
          status?: string
          last_heartbeat?: string
        }
        Update: {
          id?: number
          agent_name?: string
          status?: string
          last_heartbeat?: string
        }
      }
      agent_metrics: {
        Row: {
          id: string
          agent_name: string
          metric_name: string
          metric_data: Json
          recorded_at?: string
        }
        Insert: {
          id?: string
          agent_name: string
          metric_name: string
          metric_data: Json
          recorded_at?: string
        }
        Update: {
          id?: string
          agent_name?: string
          metric_name?: string
          metric_data?: Json
          recorded_at?: string
        }
      }
      users: {
        Row: {
          id: number
          username: string
          discord_id?: string
          tier?: string
          created_at?: string
        }
        Insert: {
          id?: number
          username: string
          discord_id?: string
          tier?: string
          created_at?: string
        }
        Update: {
          id?: number
          username?: string
          discord_id?: string
          tier?: string
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          abbreviation: string
          team_name: string
          city: string
          sport: string
          created_at?: string
        }
        Insert: {
          id?: string
          abbreviation: string
          team_name: string
          city: string
          sport: string
          created_at?: string
        }
        Update: {
          id?: string
          abbreviation?: string
          team_name?: string
          city?: string
          sport?: string
          created_at?: string
        }
      }
      agent_job_runs: {
        Row: {
          id: string
          agent: string
          workflow: string
          job_name: string
          status: 'cancelled' | 'timeout' | 'running' | 'success' | 'failed'
          metadata: Json
          error_message?: string
          started_at: string
          completed_at?: string
          created_at?: string
          job_id?: string
        }
        Insert: {
          id?: string
          agent: string
          workflow: string
          job_name: string
          status: 'cancelled' | 'timeout' | 'running' | 'success' | 'failed'
          metadata: Json
          error_message?: string
          started_at: string
          completed_at?: string
          created_at?: string
          job_id?: string
        }
        Update: {
          id?: string
          agent?: string
          workflow?: string
          job_name?: string
          status?: 'cancelled' | 'timeout' | 'running' | 'success' | 'failed'
          metadata?: Json
          error_message?: string
          started_at?: string
          completed_at?: string
          created_at?: string
          job_id?: string
        }
      }
      best_odds: {
        Row: {
          id: string
          prop_id?: string
          market: string
          best_over_odds?: number
          best_under_odds?: number
          best_over_book?: string
          best_under_book?: string
          last_updated?: string
          created_at?: string
        }
        Insert: {
          id?: string
          prop_id?: string
          market: string
          best_over_odds?: number
          best_under_odds?: number
          best_over_book?: string
          best_under_book?: string
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          prop_id?: string
          market?: string
          best_over_odds?: number
          best_under_odds?: number
          best_over_book?: string
          best_under_book?: string
          last_updated?: string
          created_at?: string
        }
      }
      bridge_outbox: {
        Row: {
          id: string
          bet_slip_id?: string
          event_type: string
          event_data: Json
          status: string
          created_at?: string
          processed_at?: string
          error_message?: string
        }
        Insert: {
          id?: string
          bet_slip_id?: string
          event_type: string
          event_data: Json
          status: string
          created_at?: string
          processed_at?: string
          error_message?: string
        }
        Update: {
          id?: string
          bet_slip_id?: string
          event_type?: string
          event_data?: Json
          status?: string
          created_at?: string
          processed_at?: string
          error_message?: string
        }
      }
      ticket_states: {
        Row: {
          id: string
          ticket_id: string
          state: string
          metadata: Json
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          ticket_id: string
          state: string
          metadata: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          state?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      arbitrage_opportunities: {
        Row: {
          id: string
          prop_ids: string[]
          combined_odds: Json
          profit_margin: number
          expiry_time: string
          status?: string
          min_bet_amount?: number
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          prop_ids: string[]
          combined_odds: Json
          profit_margin: number
          expiry_time: string
          status?: string
          min_bet_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prop_ids?: string[]
          combined_odds?: Json
          profit_margin?: number
          expiry_time?: string
          status?: string
          min_bet_amount?: number
          created_at?: string
          updated_at?: string
        }
      }
      slo_definitions: {
        Row: {
          id: string
          name: string
          description?: string
          target_value: number
          current_value?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          target_value: number
          current_value?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          target_value?: number
          current_value?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      slo_measurements: {
        Row: {
          id: string
          slo_definition_id: string
          measured_value: number
          measurement_time: string
          status?: string
          created_at?: string
        }
        Insert: {
          id?: string
          slo_definition_id: string
          measured_value: number
          measurement_time: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          slo_definition_id?: string
          measured_value?: number
          measurement_time?: string
          status?: string
          created_at?: string
        }
      }
      api_quota_configs: {
        Row: {
          id: string
          provider: string
          quota_limit: number
          time_window: string
          current_usage?: number
          last_reset?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          provider: string
          quota_limit: number
          time_window: string
          current_usage?: number
          last_reset?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: string
          quota_limit?: number
          time_window?: string
          current_usage?: number
          last_reset?: string
          created_at?: string
          updated_at?: string
        }
      }
      api_quota_usage: {
        Row: {
          id: string
          provider: string
          endpoint?: string
          usage_count: number
          time_period: string
          created_at?: string
        }
        Insert: {
          id?: string
          provider: string
          endpoint?: string
          usage_count: number
          time_period: string
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          endpoint?: string
          usage_count?: number
          time_period?: string
          created_at?: string
        }
      }
      api_emergency_states: {
        Row: {
          id: string
          state_name: string
          is_active: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          state_name: string
          is_active: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          state_name?: string
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      system_health_snapshot: {
        Row: {
          id?: string
          snapshot_time?: string
          system_status: string
          health_data: Json
          created_at?: string
        }
        Insert: {
          id?: string
          snapshot_time?: string
          system_status: string
          health_data: Json
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_time?: string
          system_status?: string
          health_data?: Json
          created_at?: string
        }
      }
      prop_settlements: {
        Row: {
          id: string
          prop_id: string
          settlement_result?: string
          settlement_value?: number
          settlement_method?: string
          settlement_timestamp?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          prop_id: string
          settlement_result?: string
          settlement_value?: number
          settlement_method?: string
          settlement_timestamp?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prop_id?: string
          settlement_result?: string
          settlement_value?: number
          settlement_method?: string
          settlement_timestamp?: string
          created_at?: string
          updated_at?: string
        }
      }
      game_results: {
        Row: {
          id: string
          game_id: string
          sport: string
          final_score: Json
          player_stats?: Json
          game_status: string
          finished_at?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          game_id: string
          sport: string
          final_score: Json
          player_stats?: Json
          game_status: string
          finished_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          sport?: string
          final_score?: Json
          player_stats?: Json
          game_status?: string
          finished_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          prop_id: string
          result: string
          settled_value?: number
          settlement_method?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          prop_id: string
          result: string
          settled_value?: number
          settlement_method?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prop_id?: string
          result?: string
          settled_value?: number
          settlement_method?: string
          created_at?: string
          updated_at?: string
        }
      }
      graded_props: {
        Row: {
          id: string
          prop_id: string
          grade: string
          graded_value?: number
          grading_method?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          prop_id: string
          grade: string
          graded_value?: number
          grading_method?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prop_id?: string
          grade?: string
          graded_value?: number
          grading_method?: string
          created_at?: string
          updated_at?: string
        }
      }
      members: {
        Row: {
          id: string
          user_id?: string
          discord_id?: string
          membership_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id?: string
          discord_id?: string
          membership_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          discord_id?: string
          membership_type?: string
          status?: string
          created_at?: string
          updated_at?: string
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