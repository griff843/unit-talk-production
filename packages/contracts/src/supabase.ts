export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      _deprecated_cappers_v2: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          canary_thread_id: string | null;
          created_at: string | null;
          default_thread_id: string;
          discord_user_id: string | null;
          display_name: string | null;
          handle: string;
          id: string;
          picks_thread_id: string | null;
          qa_thread_id: string | null;
          status: Database['public']['Enums']['capper_status'] | null;
          tier: string | null;
          trust_level: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          canary_thread_id?: string | null;
          created_at?: string | null;
          default_thread_id?: string;
          discord_user_id?: string | null;
          display_name?: string | null;
          handle: string;
          id?: string;
          picks_thread_id?: string | null;
          qa_thread_id?: string | null;
          status?: Database['public']['Enums']['capper_status'] | null;
          tier?: string | null;
          trust_level?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          canary_thread_id?: string | null;
          created_at?: string | null;
          default_thread_id?: string;
          discord_user_id?: string | null;
          display_name?: string | null;
          handle?: string;
          id?: string;
          picks_thread_id?: string | null;
          qa_thread_id?: string | null;
          status?: Database['public']['Enums']['capper_status'] | null;
          tier?: string | null;
          trust_level?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cappers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_keep_objects: {
        Row: {
          kind: string;
          name: string;
        };
        Insert: {
          kind: string;
          name: string;
        };
        Update: {
          kind?: string;
          name?: string;
        };
        Relationships: [];
      };
      agent_health: {
        Row: {
          agent: string;
          created_at: string;
          details: Json | null;
          id: string;
          last_heartbeat: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          agent: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          last_heartbeat?: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          agent?: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          last_heartbeat?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_lifecycle_events: {
        Row: {
          agent_id: string;
          correlation_id: string | null;
          event_type: string;
          id: string;
          metadata: Json | null;
          new_state: string | null;
          previous_state: string | null;
          reason: string | null;
          requested_by: string | null;
          timestamp: string | null;
        };
        Insert: {
          agent_id: string;
          correlation_id?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          new_state?: string | null;
          previous_state?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          timestamp?: string | null;
        };
        Update: {
          agent_id?: string;
          correlation_id?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          new_state?: string | null;
          previous_state?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          timestamp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_lifecycle_events_agent_id_fkey';
            columns: ['agent_id'];
            isOneToOne: false;
            referencedRelation: 'agent_registry';
            referencedColumns: ['agent_id'];
          },
        ];
      };
      agent_metrics: {
        Row: {
          agent: string;
          created_at: string;
          id: string;
          meta: Json | null;
          metric_type: string;
          value: number;
        };
        Insert: {
          agent: string;
          created_at?: string;
          id?: string;
          meta?: Json | null;
          metric_type: string;
          value: number;
        };
        Update: {
          agent?: string;
          created_at?: string;
          id?: string;
          meta?: Json | null;
          metric_type?: string;
          value?: number;
        };
        Relationships: [];
      };
      agent_metrics_snapshots: {
        Row: {
          agent_id: string;
          avg_latency_ms: number | null;
          backlog_size: number | null;
          collected_at: string | null;
          cpu_usage_percent: number | null;
          events_failed: number | null;
          events_processed: number | null;
          failure_count: number | null;
          id: string;
          memory_usage_mb: number | null;
          p50_latency_ms: number | null;
          p95_latency_ms: number | null;
          p99_latency_ms: number | null;
          run_count: number | null;
          success_count: number | null;
        };
        Insert: {
          agent_id: string;
          avg_latency_ms?: number | null;
          backlog_size?: number | null;
          collected_at?: string | null;
          cpu_usage_percent?: number | null;
          events_failed?: number | null;
          events_processed?: number | null;
          failure_count?: number | null;
          id?: string;
          memory_usage_mb?: number | null;
          p50_latency_ms?: number | null;
          p95_latency_ms?: number | null;
          p99_latency_ms?: number | null;
          run_count?: number | null;
          success_count?: number | null;
        };
        Update: {
          agent_id?: string;
          avg_latency_ms?: number | null;
          backlog_size?: number | null;
          collected_at?: string | null;
          cpu_usage_percent?: number | null;
          events_failed?: number | null;
          events_processed?: number | null;
          failure_count?: number | null;
          id?: string;
          memory_usage_mb?: number | null;
          p50_latency_ms?: number | null;
          p95_latency_ms?: number | null;
          p99_latency_ms?: number | null;
          run_count?: number | null;
          success_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_metrics_snapshots_agent_id_fkey';
            columns: ['agent_id'];
            isOneToOne: false;
            referencedRelation: 'agent_registry';
            referencedColumns: ['agent_id'];
          },
        ];
      };
      agent_registry: {
        Row: {
          agent_id: string;
          agent_type: string;
          config: Json | null;
          created_at: string | null;
          current_state: string;
          description: string | null;
          desired_state: string;
          display_name: string;
          heartbeat_interval_ms: number | null;
          heartbeat_timeout_ms: number | null;
          id: string;
          last_heartbeat: string | null;
          metadata: Json | null;
          state_changed_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          agent_id: string;
          agent_type: string;
          config?: Json | null;
          created_at?: string | null;
          current_state?: string;
          description?: string | null;
          desired_state?: string;
          display_name: string;
          heartbeat_interval_ms?: number | null;
          heartbeat_timeout_ms?: number | null;
          id?: string;
          last_heartbeat?: string | null;
          metadata?: Json | null;
          state_changed_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          agent_id?: string;
          agent_type?: string;
          config?: Json | null;
          created_at?: string | null;
          current_state?: string;
          description?: string | null;
          desired_state?: string;
          display_name?: string;
          heartbeat_interval_ms?: number | null;
          heartbeat_timeout_ms?: number | null;
          id?: string;
          last_heartbeat?: string | null;
          metadata?: Json | null;
          state_changed_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      alert_cooldowns: {
        Row: {
          alert_type: string;
          cooldown_until: string;
          created_at: string | null;
          entity_key: string;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          alert_type: string;
          cooldown_until: string;
          created_at?: string | null;
          entity_key: string;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          alert_type?: string;
          cooldown_until?: string;
          created_at?: string | null;
          entity_key?: string;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      alert_events: {
        Row: {
          acknowledged: boolean | null;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string | null;
          current_value: number | null;
          data_source: string;
          fingerprint: string;
          id: string;
          message: string;
          metadata: Json | null;
          resolved: boolean | null;
          resolved_at: string | null;
          severity: string;
          slo_name: string;
          threshold: number;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          acknowledged?: boolean | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string | null;
          current_value?: number | null;
          data_source: string;
          fingerprint: string;
          id?: string;
          message: string;
          metadata?: Json | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          severity: string;
          slo_name: string;
          threshold: number;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          acknowledged?: boolean | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string | null;
          current_value?: number | null;
          data_source?: string;
          fingerprint?: string;
          id?: string;
          message?: string;
          metadata?: Json | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          severity?: string;
          slo_name?: string;
          threshold?: number;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          alert_type: string;
          created_at: string;
          id: string;
          message: string;
          severity: string;
        };
        Insert: {
          alert_type: string;
          created_at?: string;
          id?: string;
          message: string;
          severity: string;
        };
        Update: {
          alert_type?: string;
          created_at?: string;
          id?: string;
          message?: string;
          severity?: string;
        };
        Relationships: [];
      };
      api_quota_configs: {
        Row: {
          cache_ttl_seconds: number;
          daily_limit: number;
          emergency_freeze: boolean;
          enabled: boolean;
          min_remaining_threshold: number;
          monthly_limit: number;
          provider: string;
          reset_at: string;
          rpm: number;
          sport_market_allowlist: Json | null;
          updated_at: string;
          used_today: number;
        };
        Insert: {
          cache_ttl_seconds?: number;
          daily_limit?: number;
          emergency_freeze?: boolean;
          enabled?: boolean;
          min_remaining_threshold?: number;
          monthly_limit?: number;
          provider: string;
          reset_at?: string;
          rpm?: number;
          sport_market_allowlist?: Json | null;
          updated_at?: string;
          used_today?: number;
        };
        Update: {
          cache_ttl_seconds?: number;
          daily_limit?: number;
          emergency_freeze?: boolean;
          enabled?: boolean;
          min_remaining_threshold?: number;
          monthly_limit?: number;
          provider?: string;
          reset_at?: string;
          rpm?: number;
          sport_market_allowlist?: Json | null;
          updated_at?: string;
          used_today?: number;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string;
          correlation_id: string | null;
          created_at: string | null;
          details: Json | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          ip_address: unknown;
          trace_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor?: string;
          correlation_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          trace_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          correlation_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          trace_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      autopilot_decisions: {
        Row: {
          created_at: string | null;
          data_age_minutes: number | null;
          decision: string;
          decision_reason: string;
          evaluated_at: string | null;
          evaluation_run_id: string;
          execution_time_ms: number | null;
          id: string;
          is_stale: boolean | null;
          metadata: Json | null;
          mode: string;
          odds_staleness_minutes: number | null;
          pick_data: Json;
          pick_id: string | null;
          publish_blocked_reason: string | null;
          publish_channel: string | null;
          risk_factors: Json | null;
          risk_score: number | null;
          slo_snapshot: Json | null;
          would_publish: boolean;
        };
        Insert: {
          created_at?: string | null;
          data_age_minutes?: number | null;
          decision: string;
          decision_reason: string;
          evaluated_at?: string | null;
          evaluation_run_id: string;
          execution_time_ms?: number | null;
          id?: string;
          is_stale?: boolean | null;
          metadata?: Json | null;
          mode: string;
          odds_staleness_minutes?: number | null;
          pick_data: Json;
          pick_id?: string | null;
          publish_blocked_reason?: string | null;
          publish_channel?: string | null;
          risk_factors?: Json | null;
          risk_score?: number | null;
          slo_snapshot?: Json | null;
          would_publish?: boolean;
        };
        Update: {
          created_at?: string | null;
          data_age_minutes?: number | null;
          decision?: string;
          decision_reason?: string;
          evaluated_at?: string | null;
          evaluation_run_id?: string;
          execution_time_ms?: number | null;
          id?: string;
          is_stale?: boolean | null;
          metadata?: Json | null;
          mode?: string;
          odds_staleness_minutes?: number | null;
          pick_data?: Json;
          pick_id?: string | null;
          publish_blocked_reason?: string | null;
          publish_channel?: string | null;
          risk_factors?: Json | null;
          risk_score?: number | null;
          slo_snapshot?: Json | null;
          would_publish?: boolean;
        };
        Relationships: [];
      };
      bridge_outbox: {
        Row: {
          bet_slip_id: string | null;
          created_at: string | null;
          error_message: string | null;
          event_data: Json;
          event_type: string;
          id: string;
          processed_at: string | null;
          resolved_channel_id: string | null;
          resolved_thread_id: string | null;
          retry_count: number | null;
          routing_status: string | null;
          status: string | null;
          trace_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          bet_slip_id?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          event_data: Json;
          event_type: string;
          id?: string;
          processed_at?: string | null;
          resolved_channel_id?: string | null;
          resolved_thread_id?: string | null;
          retry_count?: number | null;
          routing_status?: string | null;
          status?: string | null;
          trace_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          bet_slip_id?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          event_data?: Json;
          event_type?: string;
          id?: string;
          processed_at?: string | null;
          resolved_channel_id?: string | null;
          resolved_thread_id?: string | null;
          retry_count?: number | null;
          routing_status?: string | null;
          status?: string | null;
          trace_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      canonical_events: {
        Row: {
          away_participant_id: string | null;
          away_score: number | null;
          completed_at: string | null;
          created_at: string | null;
          event_type: string;
          external_id: string | null;
          home_participant_id: string | null;
          home_score: number | null;
          id: string;
          league: string | null;
          meta: Json | null;
          scheduled_at: string;
          sport: string;
          started_at: string | null;
          status: string | null;
          updated_at: string | null;
          venue: string | null;
        };
        Insert: {
          away_participant_id?: string | null;
          away_score?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          event_type: string;
          external_id?: string | null;
          home_participant_id?: string | null;
          home_score?: number | null;
          id?: string;
          league?: string | null;
          meta?: Json | null;
          scheduled_at: string;
          sport: string;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          venue?: string | null;
        };
        Update: {
          away_participant_id?: string | null;
          away_score?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          event_type?: string;
          external_id?: string | null;
          home_participant_id?: string | null;
          home_score?: number | null;
          id?: string;
          league?: string | null;
          meta?: Json | null;
          scheduled_at?: string;
          sport?: string;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_away_participant_id_fkey';
            columns: ['away_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'canonical_events_home_participant_id_fkey';
            columns: ['home_participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
        ];
      };
      canonical_games: {
        Row: {
          away_score: number | null;
          away_team: string;
          away_team_alias: string | null;
          created_at: string;
          external_ids: Json | null;
          game_time: string;
          home_score: number | null;
          home_team: string;
          home_team_alias: string | null;
          id: string;
          league: string;
          metadata: Json | null;
          season: string;
          sport: string;
          status: string;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          away_score?: number | null;
          away_team: string;
          away_team_alias?: string | null;
          created_at?: string;
          external_ids?: Json | null;
          game_time: string;
          home_score?: number | null;
          home_team: string;
          home_team_alias?: string | null;
          id?: string;
          league: string;
          metadata?: Json | null;
          season: string;
          sport: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          away_score?: number | null;
          away_team?: string;
          away_team_alias?: string | null;
          created_at?: string;
          external_ids?: Json | null;
          game_time?: string;
          home_score?: number | null;
          home_team?: string;
          home_team_alias?: string | null;
          id?: string;
          league?: string;
          metadata?: Json | null;
          season?: string;
          sport?: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      canonical_players: {
        Row: {
          created_at: string;
          current_team: string | null;
          external_ids: Json | null;
          first_name: string | null;
          full_name: string;
          id: string;
          jersey_number: string | null;
          last_name: string | null;
          metadata: Json | null;
          name_variations: string[] | null;
          position: string | null;
          sport: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_team?: string | null;
          external_ids?: Json | null;
          first_name?: string | null;
          full_name: string;
          id?: string;
          jersey_number?: string | null;
          last_name?: string | null;
          metadata?: Json | null;
          name_variations?: string[] | null;
          position?: string | null;
          sport: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_team?: string | null;
          external_ids?: Json | null;
          first_name?: string | null;
          full_name?: string;
          id?: string;
          jersey_number?: string | null;
          last_name?: string | null;
          metadata?: Json | null;
          name_variations?: string[] | null;
          position?: string | null;
          sport?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      capper_calibration: {
        Row: {
          avg_internal_score: number | null;
          avg_self_score: number | null;
          avg_variance: number | null;
          brier_score: number | null;
          calculated_at: string | null;
          calibration_accuracy: number | null;
          id: string;
          last_30_picks_variance: number | null;
          metadata: Json | null;
          tenant_id: string;
          total_picks: number | null;
          updated_at: string | null;
          user_id: string;
          variance_trend: string | null;
        };
        Insert: {
          avg_internal_score?: number | null;
          avg_self_score?: number | null;
          avg_variance?: number | null;
          brier_score?: number | null;
          calculated_at?: string | null;
          calibration_accuracy?: number | null;
          id?: string;
          last_30_picks_variance?: number | null;
          metadata?: Json | null;
          tenant_id: string;
          total_picks?: number | null;
          updated_at?: string | null;
          user_id: string;
          variance_trend?: string | null;
        };
        Update: {
          avg_internal_score?: number | null;
          avg_self_score?: number | null;
          avg_variance?: number | null;
          brier_score?: number | null;
          calculated_at?: string | null;
          calibration_accuracy?: number | null;
          id?: string;
          last_30_picks_variance?: number | null;
          metadata?: Json | null;
          tenant_id?: string;
          total_picks?: number | null;
          updated_at?: string | null;
          user_id?: string;
          variance_trend?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'capper_calibration_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'capper_calibration_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      capper_channel_mappings: {
        Row: {
          capper_id: string;
          capper_username: string;
          channel_id: string;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          priority: number | null;
          sport: string | null;
          thread_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          capper_id: string;
          capper_username: string;
          channel_id: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          priority?: number | null;
          sport?: string | null;
          thread_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          capper_id?: string;
          capper_username?: string;
          channel_id?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          priority?: number | null;
          sport?: string | null;
          thread_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_capper_channel_mappings_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_capper_channel_mappings_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_capper_channel_mappings_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_capper_channel_mappings_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_capper_channel_mappings_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
        ];
      };
      cappers: {
        Row: {
          created_at: string;
          display_name: string;
          external_id: string | null;
          id: string;
          is_active: boolean;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          external_id?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          external_id?: string | null;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      closing_snapshots: {
        Row: {
          book: string;
          captured_at: string;
          created_at: string;
          id: string;
          is_final_window: boolean | null;
          line: number;
          odds: number | null;
          pick_id: string;
        };
        Insert: {
          book: string;
          captured_at?: string;
          created_at?: string;
          id?: string;
          is_final_window?: boolean | null;
          line: number;
          odds?: number | null;
          pick_id: string;
        };
        Update: {
          book?: string;
          captured_at?: string;
          created_at?: string;
          id?: string;
          is_final_window?: boolean | null;
          line?: number;
          odds?: number | null;
          pick_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'closing_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
        ];
      };
      clv_tracking: {
        Row: {
          beat_closing_line: boolean | null;
          bookmaker: string | null;
          closing_line: number | null;
          closing_odds: number | null;
          closing_time: string | null;
          clv_cents: number | null;
          clv_percentage: number | null;
          clv_standard_deviations: number | null;
          clv_tier: string | null;
          created_at: string | null;
          id: string;
          line_movement_total: number | null;
          metadata: Json | null;
          pick_id: string;
          submitted_at: string;
          submitted_line: number | null;
          submitted_odds: number | null;
          tenant_id: string;
          time_to_close_minutes: number | null;
        };
        Insert: {
          beat_closing_line?: boolean | null;
          bookmaker?: string | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_time?: string | null;
          clv_cents?: number | null;
          clv_percentage?: number | null;
          clv_standard_deviations?: number | null;
          clv_tier?: string | null;
          created_at?: string | null;
          id?: string;
          line_movement_total?: number | null;
          metadata?: Json | null;
          pick_id: string;
          submitted_at: string;
          submitted_line?: number | null;
          submitted_odds?: number | null;
          tenant_id: string;
          time_to_close_minutes?: number | null;
        };
        Update: {
          beat_closing_line?: boolean | null;
          bookmaker?: string | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_time?: string | null;
          clv_cents?: number | null;
          clv_percentage?: number | null;
          clv_standard_deviations?: number | null;
          clv_tier?: string | null;
          created_at?: string | null;
          id?: string;
          line_movement_total?: number | null;
          metadata?: Json | null;
          pick_id?: string;
          submitted_at?: string;
          submitted_line?: number | null;
          submitted_odds?: number | null;
          tenant_id?: string;
          time_to_close_minutes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clv_tracking_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      conflict_events: {
        Row: {
          created_at: string;
          details: Json | null;
          event_type: string;
          id: string;
          occurred_at: string;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          event_type: string;
          id?: string;
          occurred_at?: string;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          event_type?: string;
          id?: string;
          occurred_at?: string;
        };
        Relationships: [];
      };
      dm_analytics: {
        Row: {
          content_type: string;
          created_at: string;
          id: string;
          sent_at: string;
          tier: string;
          user_id: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          id?: string;
          sent_at?: string;
          tier: string;
          user_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          id?: string;
          sent_at?: string;
          tier?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      dm_templates: {
        Row: {
          content: string;
          created_at: string;
          embeds: Json | null;
          id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embeds?: Json | null;
          id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embeds?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      dm_triggers: {
        Row: {
          created_at: string;
          id: string;
          last_triggered: string | null;
          trigger_count: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_triggered?: string | null;
          trigger_count?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_triggered?: string | null;
          trigger_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_segments: {
        Row: {
          away_score: number | null;
          completed_at: string | null;
          created_at: string | null;
          event_id: string;
          home_score: number | null;
          id: string;
          meta: Json | null;
          segment_number: number;
          segment_type: string;
          started_at: string | null;
        };
        Insert: {
          away_score?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          event_id: string;
          home_score?: number | null;
          id?: string;
          meta?: Json | null;
          segment_number: number;
          segment_type: string;
          started_at?: string | null;
        };
        Update: {
          away_score?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          event_id?: string;
          home_score?: number | null;
          id?: string;
          meta?: Json | null;
          segment_number?: number;
          segment_type?: string;
          started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_segments_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_segments_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_segments_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
        ];
      };
      event_subscribers: {
        Row: {
          cooldown_until: string | null;
          created_at: string | null;
          event_type: string;
          id: string;
          is_active: boolean | null;
          last_processed_at: string | null;
          last_processed_id: string | null;
          processing_config: Json | null;
          subscriber_name: string;
          updated_at: string | null;
        };
        Insert: {
          cooldown_until?: string | null;
          created_at?: string | null;
          event_type: string;
          id?: string;
          is_active?: boolean | null;
          last_processed_at?: string | null;
          last_processed_id?: string | null;
          processing_config?: Json | null;
          subscriber_name: string;
          updated_at?: string | null;
        };
        Update: {
          cooldown_until?: string | null;
          created_at?: string | null;
          event_type?: string;
          id?: string;
          is_active?: boolean | null;
          last_processed_at?: string | null;
          last_processed_id?: string | null;
          processing_config?: Json | null;
          subscriber_name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          aggregate_id: string;
          aggregate_type: string;
          created_at: string | null;
          created_by: string | null;
          event_data: Json;
          event_type: string;
          failed_at: string | null;
          id: string;
          idempotency_key: string;
          max_retries: number | null;
          metadata: Json | null;
          processed_at: string | null;
          retry_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          aggregate_id: string;
          aggregate_type: string;
          created_at?: string | null;
          created_by?: string | null;
          event_data: Json;
          event_type: string;
          failed_at?: string | null;
          id?: string;
          idempotency_key: string;
          max_retries?: number | null;
          metadata?: Json | null;
          processed_at?: string | null;
          retry_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          aggregate_id?: string;
          aggregate_type?: string;
          created_at?: string | null;
          created_by?: string | null;
          event_data?: Json;
          event_type?: string;
          failed_at?: string | null;
          id?: string;
          idempotency_key?: string;
          max_retries?: number | null;
          metadata?: Json | null;
          processed_at?: string | null;
          retry_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      feature_snapshots: {
        Row: {
          clv_at_bet: number | null;
          clv_at_close: number | null;
          computed_at: string;
          created_at: string | null;
          feature_vector: Json;
          historical_edge: number | null;
          home_away_impact: number | null;
          id: string;
          injury_impact: number | null;
          leg_id: string;
          market_efficiency: number | null;
          meta: Json | null;
          model_name: string;
          model_version: string;
          rest_impact: number | null;
          weather_impact: number | null;
        };
        Insert: {
          clv_at_bet?: number | null;
          clv_at_close?: number | null;
          computed_at?: string;
          created_at?: string | null;
          feature_vector: Json;
          historical_edge?: number | null;
          home_away_impact?: number | null;
          id?: string;
          injury_impact?: number | null;
          leg_id: string;
          market_efficiency?: number | null;
          meta?: Json | null;
          model_name: string;
          model_version: string;
          rest_impact?: number | null;
          weather_impact?: number | null;
        };
        Update: {
          clv_at_bet?: number | null;
          clv_at_close?: number | null;
          computed_at?: string;
          created_at?: string | null;
          feature_vector?: Json;
          historical_edge?: number | null;
          home_away_impact?: number | null;
          id?: string;
          injury_impact?: number | null;
          leg_id?: string;
          market_efficiency?: number | null;
          meta?: Json | null;
          model_name?: string;
          model_version?: string;
          rest_impact?: number | null;
          weather_impact?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_snapshots_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_legs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feature_snapshots_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'view_scoring_audit';
            referencedColumns: ['leg_id'];
          },
        ];
      };
      game_mappings: {
        Row: {
          canonical_game_id: string;
          confidence_score: number;
          conflict_count: number;
          created_at: string;
          external_game_id: string;
          id: string;
          is_primary: boolean;
          last_verified_at: string | null;
          mapping_method: string;
          metadata: Json | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          canonical_game_id: string;
          confidence_score?: number;
          conflict_count?: number;
          created_at?: string;
          external_game_id: string;
          id?: string;
          is_primary?: boolean;
          last_verified_at?: string | null;
          mapping_method?: string;
          metadata?: Json | null;
          source: string;
          updated_at?: string;
        };
        Update: {
          canonical_game_id?: string;
          confidence_score?: number;
          conflict_count?: number;
          created_at?: string;
          external_game_id?: string;
          id?: string;
          is_primary?: boolean;
          last_verified_at?: string | null;
          mapping_method?: string;
          metadata?: Json | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'game_mappings_canonical_game_id_fkey';
            columns: ['canonical_game_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_games';
            referencedColumns: ['id'];
          },
        ];
      };
      game_results: {
        Row: {
          actual_start_time: string | null;
          away_score: number | null;
          away_team: string;
          completed: boolean | null;
          completion_time: string | null;
          created_at: string | null;
          data_source: string;
          external_game_id: string;
          game_id: string | null;
          home_score: number | null;
          home_team: string;
          id: string;
          period_scores: Json | null;
          scheduled_time: string;
          settlement_status: string | null;
          settlement_timestamp: string | null;
          source_last_update: string | null;
          sport: string;
          sport_key: string | null;
          status: string;
          unresolved_reason: string | null;
          updated_at: string | null;
        };
        Insert: {
          actual_start_time?: string | null;
          away_score?: number | null;
          away_team: string;
          completed?: boolean | null;
          completion_time?: string | null;
          created_at?: string | null;
          data_source?: string;
          external_game_id: string;
          game_id?: string | null;
          home_score?: number | null;
          home_team: string;
          id?: string;
          period_scores?: Json | null;
          scheduled_time: string;
          settlement_status?: string | null;
          settlement_timestamp?: string | null;
          source_last_update?: string | null;
          sport: string;
          sport_key?: string | null;
          status?: string;
          unresolved_reason?: string | null;
          updated_at?: string | null;
        };
        Update: {
          actual_start_time?: string | null;
          away_score?: number | null;
          away_team?: string;
          completed?: boolean | null;
          completion_time?: string | null;
          created_at?: string | null;
          data_source?: string;
          external_game_id?: string;
          game_id?: string | null;
          home_score?: number | null;
          home_team?: string;
          id?: string;
          period_scores?: Json | null;
          scheduled_time?: string;
          settlement_status?: string | null;
          settlement_timestamp?: string | null;
          source_last_update?: string | null;
          sport?: string;
          sport_key?: string | null;
          status?: string;
          unresolved_reason?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      games: {
        Row: {
          away_team: string;
          away_team_id: string | null;
          created_at: string;
          external_game_id: string;
          game_date: string;
          home_team: string;
          home_team_id: string | null;
          id: string;
          league: string;
          meta: Json | null;
          sport: string;
          start_time: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          away_team: string;
          away_team_id?: string | null;
          created_at?: string;
          external_game_id: string;
          game_date: string;
          home_team: string;
          home_team_id?: string | null;
          id?: string;
          league: string;
          meta?: Json | null;
          sport: string;
          start_time?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          away_team?: string;
          away_team_id?: string | null;
          created_at?: string;
          external_game_id?: string;
          game_date?: string;
          home_team?: string;
          home_team_id?: string | null;
          id?: string;
          league?: string;
          meta?: Json | null;
          sport?: string;
          start_time?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_games_away_team_canonical';
            columns: ['away_team_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_teams_v1';
            referencedColumns: ['external_team_id'];
          },
          {
            foreignKeyName: 'fk_games_away_team_canonical';
            columns: ['away_team_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_teams';
            referencedColumns: ['team_uuid'];
          },
          {
            foreignKeyName: 'fk_games_away_team_canonical';
            columns: ['away_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['team_uuid'];
          },
          {
            foreignKeyName: 'fk_games_home_team_canonical';
            columns: ['home_team_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_teams_v1';
            referencedColumns: ['external_team_id'];
          },
          {
            foreignKeyName: 'fk_games_home_team_canonical';
            columns: ['home_team_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_teams';
            referencedColumns: ['team_uuid'];
          },
          {
            foreignKeyName: 'fk_games_home_team_canonical';
            columns: ['home_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['team_uuid'];
          },
        ];
      };
      historical_props: {
        Row: {
          actual_value: number | null;
          archived_at: string | null;
          away_team: string | null;
          beat_closing: boolean | null;
          bet_line: number | null;
          bet_odds: number | null;
          bet_side: string | null;
          bet_timestamp: string | null;
          capper_id: string | null;
          capper_tier: string | null;
          capper_username: string | null;
          closing_line: number | null;
          closing_odds: number | null;
          closing_over_odds: number | null;
          closing_timestamp: string | null;
          closing_under_odds: number | null;
          clv_cents: number | null;
          clv_pct: number | null;
          confidence_score: number | null;
          created_at: string | null;
          devigged_edge: number | null;
          external_game_id: string | null;
          external_prop_id: string | null;
          feature_contributions: Json | null;
          game_date: string | null;
          game_time: string | null;
          home_team: string | null;
          id: string;
          kelly_fraction: number | null;
          opening_line: number | null;
          opening_odds: number | null;
          opening_over_odds: number | null;
          opening_timestamp: string | null;
          opening_under_odds: number | null;
          opponent: string | null;
          player_name: string | null;
          professional_score: number | null;
          raw_prop_id: string | null;
          result: string | null;
          settled_at: string | null;
          source: string | null;
          sport: string | null;
          stat_type: string | null;
          team: string | null;
          tier: string | null;
          unified_pick_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          actual_value?: number | null;
          archived_at?: string | null;
          away_team?: string | null;
          beat_closing?: boolean | null;
          bet_line?: number | null;
          bet_odds?: number | null;
          bet_side?: string | null;
          bet_timestamp?: string | null;
          capper_id?: string | null;
          capper_tier?: string | null;
          capper_username?: string | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_over_odds?: number | null;
          closing_timestamp?: string | null;
          closing_under_odds?: number | null;
          clv_cents?: number | null;
          clv_pct?: number | null;
          confidence_score?: number | null;
          created_at?: string | null;
          devigged_edge?: number | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          feature_contributions?: Json | null;
          game_date?: string | null;
          game_time?: string | null;
          home_team?: string | null;
          id?: string;
          kelly_fraction?: number | null;
          opening_line?: number | null;
          opening_odds?: number | null;
          opening_over_odds?: number | null;
          opening_timestamp?: string | null;
          opening_under_odds?: number | null;
          opponent?: string | null;
          player_name?: string | null;
          professional_score?: number | null;
          raw_prop_id?: string | null;
          result?: string | null;
          settled_at?: string | null;
          source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          team?: string | null;
          tier?: string | null;
          unified_pick_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          actual_value?: number | null;
          archived_at?: string | null;
          away_team?: string | null;
          beat_closing?: boolean | null;
          bet_line?: number | null;
          bet_odds?: number | null;
          bet_side?: string | null;
          bet_timestamp?: string | null;
          capper_id?: string | null;
          capper_tier?: string | null;
          capper_username?: string | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_over_odds?: number | null;
          closing_timestamp?: string | null;
          closing_under_odds?: number | null;
          clv_cents?: number | null;
          clv_pct?: number | null;
          confidence_score?: number | null;
          created_at?: string | null;
          devigged_edge?: number | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          feature_contributions?: Json | null;
          game_date?: string | null;
          game_time?: string | null;
          home_team?: string | null;
          id?: string;
          kelly_fraction?: number | null;
          opening_line?: number | null;
          opening_odds?: number | null;
          opening_over_odds?: number | null;
          opening_timestamp?: string | null;
          opening_under_odds?: number | null;
          opponent?: string | null;
          player_name?: string | null;
          professional_score?: number | null;
          raw_prop_id?: string | null;
          result?: string | null;
          settled_at?: string | null;
          source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          team?: string | null;
          tier?: string | null;
          unified_pick_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      injury_alerts: {
        Row: {
          affected_prop_count: number | null;
          alert_channel: string | null;
          alert_sent: boolean | null;
          created_at: string | null;
          estimated_line_impact: number | null;
          id: string;
          new_status: string;
          old_status: string | null;
          player_name: string;
          sent_at: string | null;
          sport: string;
          team: string;
          urgency: string | null;
        };
        Insert: {
          affected_prop_count?: number | null;
          alert_channel?: string | null;
          alert_sent?: boolean | null;
          created_at?: string | null;
          estimated_line_impact?: number | null;
          id?: string;
          new_status: string;
          old_status?: string | null;
          player_name: string;
          sent_at?: string | null;
          sport: string;
          team: string;
          urgency?: string | null;
        };
        Update: {
          affected_prop_count?: number | null;
          alert_channel?: string | null;
          alert_sent?: boolean | null;
          created_at?: string | null;
          estimated_line_impact?: number | null;
          id?: string;
          new_status?: string;
          old_status?: string | null;
          player_name?: string;
          sent_at?: string | null;
          sport?: string;
          team?: string;
          urgency?: string | null;
        };
        Relationships: [];
      };
      injury_history: {
        Row: {
          created_at: string | null;
          id: string;
          injury_id: string | null;
          new_status: string;
          old_status: string | null;
          player_name: string;
          source: string | null;
          sport: string;
          status_changed_at: string | null;
          team: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          injury_id?: string | null;
          new_status: string;
          old_status?: string | null;
          player_name: string;
          source?: string | null;
          sport: string;
          status_changed_at?: string | null;
          team: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          injury_id?: string | null;
          new_status?: string;
          old_status?: string | null;
          player_name?: string;
          source?: string | null;
          sport?: string;
          status_changed_at?: string | null;
          team?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'injury_history_injury_id_fkey';
            columns: ['injury_id'];
            isOneToOne: false;
            referencedRelation: 'player_injuries';
            referencedColumns: ['id'];
          },
        ];
      };
      internal_scores: {
        Row: {
          clv_pct: number | null;
          confidence_interval: Json | null;
          created_at: string | null;
          devigged_edge: number | null;
          devigged_win_prob: number | null;
          feature_set: Json | null;
          features_used: string[] | null;
          grading_duration_ms: number | null;
          grading_engine: string;
          id: string;
          internal_score: number;
          kelly_fraction: number | null;
          market_timing_score: number | null;
          metadata: Json | null;
          pick_id: string;
          scoring_model_version: string;
          steam_detected: boolean | null;
          tenant_id: string;
          updated_at: string | null;
          variance_from_self_score: number | null;
        };
        Insert: {
          clv_pct?: number | null;
          confidence_interval?: Json | null;
          created_at?: string | null;
          devigged_edge?: number | null;
          devigged_win_prob?: number | null;
          feature_set?: Json | null;
          features_used?: string[] | null;
          grading_duration_ms?: number | null;
          grading_engine?: string;
          id?: string;
          internal_score: number;
          kelly_fraction?: number | null;
          market_timing_score?: number | null;
          metadata?: Json | null;
          pick_id: string;
          scoring_model_version: string;
          steam_detected?: boolean | null;
          tenant_id: string;
          updated_at?: string | null;
          variance_from_self_score?: number | null;
        };
        Update: {
          clv_pct?: number | null;
          confidence_interval?: Json | null;
          created_at?: string | null;
          devigged_edge?: number | null;
          devigged_win_prob?: number | null;
          feature_set?: Json | null;
          features_used?: string[] | null;
          grading_duration_ms?: number | null;
          grading_engine?: string;
          id?: string;
          internal_score?: number;
          kelly_fraction?: number | null;
          market_timing_score?: number | null;
          metadata?: Json | null;
          pick_id?: string;
          scoring_model_version?: string;
          steam_detected?: boolean | null;
          tenant_id?: string;
          updated_at?: string | null;
          variance_from_self_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'internal_scores_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      kill_confirmations: {
        Row: {
          agent_id: string;
          confirmation_token: string;
          confirmed_at: string | null;
          created_at: string | null;
          expires_at: string;
          id: string;
          reason: string;
          requested_by: string;
          status: string;
        };
        Insert: {
          agent_id: string;
          confirmation_token: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          expires_at: string;
          id?: string;
          reason: string;
          requested_by: string;
          status?: string;
        };
        Update: {
          agent_id?: string;
          confirmation_token?: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          reason?: string;
          requested_by?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'kill_confirmations_agent_id_fkey';
            columns: ['agent_id'];
            isOneToOne: false;
            referencedRelation: 'agent_registry';
            referencedColumns: ['agent_id'];
          },
        ];
      };
      kpis: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          target: number | null;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          target?: number | null;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          target?: number | null;
          value?: number;
        };
        Relationships: [];
      };
      leagues: {
        Row: {
          active: boolean | null;
          code: string;
          country: string | null;
          created_at: string | null;
          display_name: string;
          has_playoffs: boolean | null;
          id: number;
          level: string | null;
          meta: Json | null;
          playoff_format: string | null;
          sport_id: number | null;
        };
        Insert: {
          active?: boolean | null;
          code: string;
          country?: string | null;
          created_at?: string | null;
          display_name: string;
          has_playoffs?: boolean | null;
          id?: number;
          level?: string | null;
          meta?: Json | null;
          playoff_format?: string | null;
          sport_id?: number | null;
        };
        Update: {
          active?: boolean | null;
          code?: string;
          country?: string | null;
          created_at?: string | null;
          display_name?: string;
          has_playoffs?: boolean | null;
          id?: number;
          level?: string | null;
          meta?: Json | null;
          playoff_format?: string | null;
          sport_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leagues_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leagues_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'view_sports_active';
            referencedColumns: ['id'];
          },
        ];
      };
      line_snapshots: {
        Row: {
          captured_at: string;
          game_time: string | null;
          id: string;
          line: number;
          over_odds: number | null;
          pick_id: string | null;
          player_name: string;
          prop_ref: string;
          raw_prop_id: string | null;
          snapshot_type: string | null;
          sport: string;
          sportsbook: string;
          stat_type: string;
          under_odds: number | null;
        };
        Insert: {
          captured_at?: string;
          game_time?: string | null;
          id?: string;
          line: number;
          over_odds?: number | null;
          pick_id?: string | null;
          player_name: string;
          prop_ref: string;
          raw_prop_id?: string | null;
          snapshot_type?: string | null;
          sport: string;
          sportsbook?: string;
          stat_type: string;
          under_odds?: number | null;
        };
        Update: {
          captured_at?: string;
          game_time?: string | null;
          id?: string;
          line?: number;
          over_odds?: number | null;
          pick_id?: string | null;
          player_name?: string;
          prop_ref?: string;
          raw_prop_id?: string | null;
          snapshot_type?: string | null;
          sport?: string;
          sportsbook?: string;
          stat_type?: string;
          under_odds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_snapshots_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'line_snapshots_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_props_for_form_v1';
            referencedColumns: ['prop_id'];
          },
          {
            foreignKeyName: 'line_snapshots_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'mv_props_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_snapshots_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'raw_props';
            referencedColumns: ['id'];
          },
        ];
      };
      logs: {
        Row: {
          created_at: string;
          id: string;
          log_type: string;
          message: string;
          meta: Json | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          log_type: string;
          message: string;
          meta?: Json | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          log_type?: string;
          message?: string;
          meta?: Json | null;
        };
        Relationships: [];
      };
      market_groups: {
        Row: {
          active: boolean | null;
          code: string;
          created_at: string | null;
          display_name: string;
          id: number;
          meta: Json | null;
          parent_group_id: number | null;
          sort_order: number | null;
        };
        Insert: {
          active?: boolean | null;
          code: string;
          created_at?: string | null;
          display_name: string;
          id?: number;
          meta?: Json | null;
          parent_group_id?: number | null;
          sort_order?: number | null;
        };
        Update: {
          active?: boolean | null;
          code?: string;
          created_at?: string | null;
          display_name?: string;
          id?: number;
          meta?: Json | null;
          parent_group_id?: number | null;
          sort_order?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'market_groups_parent_group_id_fkey';
            columns: ['parent_group_id'];
            isOneToOne: false;
            referencedRelation: 'market_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_groups_parent_group_id_fkey';
            columns: ['parent_group_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_groups_hierarchy';
            referencedColumns: ['id'];
          },
        ];
      };
      market_props: {
        Row: {
          best_available_line: number | null;
          best_book: string | null;
          bookmaker_key: string | null;
          created_at: string | null;
          external_game_id: string | null;
          external_prop_id: string | null;
          game_date: string | null;
          game_id: string | null;
          game_time: string | null;
          id: string;
          line: number | null;
          market: string | null;
          metadata: Json | null;
          odds: number | null;
          opponent: string | null;
          over_odds: number | null;
          player_name: string | null;
          selection: string | null;
          sport: string | null;
          status: string | null;
          team: string | null;
          under_odds: number | null;
          updated_at: string | null;
        };
        Insert: {
          best_available_line?: number | null;
          best_book?: string | null;
          bookmaker_key?: string | null;
          created_at?: string | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          game_date?: string | null;
          game_id?: string | null;
          game_time?: string | null;
          id?: string;
          line?: number | null;
          market?: string | null;
          metadata?: Json | null;
          odds?: number | null;
          opponent?: string | null;
          over_odds?: number | null;
          player_name?: string | null;
          selection?: string | null;
          sport?: string | null;
          status?: string | null;
          team?: string | null;
          under_odds?: number | null;
          updated_at?: string | null;
        };
        Update: {
          best_available_line?: number | null;
          best_book?: string | null;
          bookmaker_key?: string | null;
          created_at?: string | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          game_date?: string | null;
          game_id?: string | null;
          game_time?: string | null;
          id?: string;
          line?: number | null;
          market?: string | null;
          metadata?: Json | null;
          odds?: number | null;
          opponent?: string | null;
          over_odds?: number | null;
          player_name?: string | null;
          selection?: string | null;
          sport?: string | null;
          status?: string | null;
          team?: string | null;
          under_odds?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      market_taxonomy: {
        Row: {
          active: boolean | null;
          aliases: string[] | null;
          bet_type: string;
          category: string;
          created_at: string | null;
          description: string | null;
          display_name: string;
          id: string;
          market_key: string;
          sort_order: number | null;
          sport: string;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          aliases?: string[] | null;
          bet_type?: string;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          display_name: string;
          id?: string;
          market_key: string;
          sort_order?: number | null;
          sport: string;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          aliases?: string[] | null;
          bet_type?: string;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          display_name?: string;
          id?: string;
          market_key?: string;
          sort_order?: number | null;
          sport?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      market_types: {
        Row: {
          active: boolean | null;
          created_at: string | null;
          display_name: string;
          id: number;
          is_derivative: boolean | null;
          is_future: boolean | null;
          league_id: number | null;
          market_group_id: number | null;
          market_key: string;
          meta: Json | null;
          outcome_type_id: number | null;
          participant_scope: string;
          requires_line: boolean;
          requires_participant: boolean;
          segment_type_id: number | null;
          settlement_rule: Json | null;
          sport_id: number | null;
          supports_alt_lines: boolean | null;
          supports_live: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string | null;
          display_name: string;
          id?: number;
          is_derivative?: boolean | null;
          is_future?: boolean | null;
          league_id?: number | null;
          market_group_id?: number | null;
          market_key: string;
          meta?: Json | null;
          outcome_type_id?: number | null;
          participant_scope?: string;
          requires_line?: boolean;
          requires_participant?: boolean;
          segment_type_id?: number | null;
          settlement_rule?: Json | null;
          sport_id?: number | null;
          supports_alt_lines?: boolean | null;
          supports_live?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          created_at?: string | null;
          display_name?: string;
          id?: number;
          is_derivative?: boolean | null;
          is_future?: boolean | null;
          league_id?: number | null;
          market_group_id?: number | null;
          market_key?: string;
          meta?: Json | null;
          outcome_type_id?: number | null;
          participant_scope?: string;
          requires_line?: boolean;
          requires_participant?: boolean;
          segment_type_id?: number | null;
          settlement_rule?: Json | null;
          sport_id?: number | null;
          supports_alt_lines?: boolean | null;
          supports_live?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'market_types_market_group_id_fkey';
            columns: ['market_group_id'];
            isOneToOne: false;
            referencedRelation: 'market_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_types_market_group_id_fkey';
            columns: ['market_group_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_groups_hierarchy';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_types_outcome_type_id_fkey';
            columns: ['outcome_type_id'];
            isOneToOne: false;
            referencedRelation: 'outcome_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_types_segment_type_id_fkey';
            columns: ['segment_type_id'];
            isOneToOne: false;
            referencedRelation: 'segment_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_types_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'sports_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_types_sport_id_fkey';
            columns: ['sport_id'];
            isOneToOne: false;
            referencedRelation: 'view_sports_active';
            referencedColumns: ['id'];
          },
        ];
      };
      markets: {
        Row: {
          active: boolean | null;
          bet_structure: string;
          canonical_key: string;
          category: string;
          created_at: string | null;
          default_segment: string | null;
          display_name: string;
          id: string;
          meta: Json | null;
          segment_applicable: boolean | null;
          settlement_source: string | null;
          sport: string | null;
          stat_type: string | null;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          bet_structure: string;
          canonical_key: string;
          category: string;
          created_at?: string | null;
          default_segment?: string | null;
          display_name: string;
          id?: string;
          meta?: Json | null;
          segment_applicable?: boolean | null;
          settlement_source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          bet_structure?: string;
          canonical_key?: string;
          category?: string;
          created_at?: string | null;
          default_segment?: string | null;
          display_name?: string;
          id?: string;
          meta?: Json | null;
          segment_applicable?: boolean | null;
          settlement_source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      model_predictions: {
        Row: {
          absolute_error: number | null;
          actual_value: number | null;
          correct_side: boolean | null;
          edge_vs_market: number | null;
          external_game_id: string | null;
          feature_importances: Json | null;
          feature_values: Json | null;
          game_date: string | null;
          game_time: string | null;
          id: string;
          market_line: number | null;
          model_id: string | null;
          player_name: string;
          predicted_at: string | null;
          predicted_value: number;
          prediction_confidence: number | null;
          prediction_error: number | null;
          prediction_interval_high: number | null;
          prediction_interval_low: number | null;
          prop_ref: string;
          raw_prop_id: string | null;
          recommended_side: string | null;
          settled_at: string | null;
          sport: string;
          stat_type: string;
          top_factors: string[] | null;
          unified_pick_id: string | null;
        };
        Insert: {
          absolute_error?: number | null;
          actual_value?: number | null;
          correct_side?: boolean | null;
          edge_vs_market?: number | null;
          external_game_id?: string | null;
          feature_importances?: Json | null;
          feature_values?: Json | null;
          game_date?: string | null;
          game_time?: string | null;
          id?: string;
          market_line?: number | null;
          model_id?: string | null;
          player_name: string;
          predicted_at?: string | null;
          predicted_value: number;
          prediction_confidence?: number | null;
          prediction_error?: number | null;
          prediction_interval_high?: number | null;
          prediction_interval_low?: number | null;
          prop_ref: string;
          raw_prop_id?: string | null;
          recommended_side?: string | null;
          settled_at?: string | null;
          sport: string;
          stat_type: string;
          top_factors?: string[] | null;
          unified_pick_id?: string | null;
        };
        Update: {
          absolute_error?: number | null;
          actual_value?: number | null;
          correct_side?: boolean | null;
          edge_vs_market?: number | null;
          external_game_id?: string | null;
          feature_importances?: Json | null;
          feature_values?: Json | null;
          game_date?: string | null;
          game_time?: string | null;
          id?: string;
          market_line?: number | null;
          model_id?: string | null;
          player_name?: string;
          predicted_at?: string | null;
          predicted_value?: number;
          prediction_confidence?: number | null;
          prediction_error?: number | null;
          prediction_interval_high?: number | null;
          prediction_interval_low?: number | null;
          prop_ref?: string;
          raw_prop_id?: string | null;
          recommended_side?: string | null;
          settled_at?: string | null;
          sport?: string;
          stat_type?: string;
          top_factors?: string[] | null;
          unified_pick_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'model_predictions_model_id_fkey';
            columns: ['model_id'];
            isOneToOne: false;
            referencedRelation: 'projection_models';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'model_predictions_model_id_fkey';
            columns: ['model_id'];
            isOneToOne: false;
            referencedRelation: 'v_model_performance';
            referencedColumns: ['model_id'];
          },
        ];
      };
      mra_alert_log: {
        Row: {
          alert_data: Json | null;
          alert_type: string;
          created_at: string;
          id: string;
          pick_id: string;
          sent_at: string;
        };
        Insert: {
          alert_data?: Json | null;
          alert_type: string;
          created_at?: string;
          id?: string;
          pick_id: string;
          sent_at?: string;
        };
        Update: {
          alert_data?: Json | null;
          alert_type?: string;
          created_at?: string;
          id?: string;
          pick_id?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mra_alert_log_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
        ];
      };
      notification_logs: {
        Row: {
          created_at: string;
          id: string;
          notification_type: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notification_type: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notification_type?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      offer_quarantine: {
        Row: {
          captured_at: string;
          created_at: string | null;
          id: string;
          provider_id: number | null;
          provider_key: string;
          raw_payload: Json;
          reason_code: string;
          reason_detail: Json;
          resolution_action: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          captured_at: string;
          created_at?: string | null;
          id?: string;
          provider_id?: number | null;
          provider_key: string;
          raw_payload: Json;
          reason_code: string;
          reason_detail?: Json;
          resolution_action?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          captured_at?: string;
          created_at?: string | null;
          id?: string;
          provider_id?: number | null;
          provider_key?: string;
          raw_payload?: Json;
          reason_code?: string;
          reason_detail?: Json;
          resolution_action?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'offer_quarantine_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offer_quarantine_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      outcome_types: {
        Row: {
          code: string;
          created_at: string | null;
          display_name: string;
          id: number;
          is_numeric: boolean | null;
          meta: Json | null;
          outcome_count: number;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          display_name: string;
          id?: number;
          is_numeric?: boolean | null;
          meta?: Json | null;
          outcome_count: number;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          display_name?: string;
          id?: number;
          is_numeric?: boolean | null;
          meta?: Json | null;
          outcome_count?: number;
        };
        Relationships: [];
      };
      participant_memberships: {
        Row: {
          created_at: string | null;
          id: string;
          meta: Json | null;
          participant_id: string;
          role: string | null;
          team_id: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          meta?: Json | null;
          participant_id: string;
          role?: string | null;
          team_id: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          meta?: Json | null;
          participant_id?: string;
          role?: string | null;
          team_id?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
        ];
      };
      participants: {
        Row: {
          active: boolean | null;
          created_at: string | null;
          display_name: string | null;
          external_id: string | null;
          id: string;
          identity_status: Database['public']['Enums']['identity_status_type'] | null;
          identity_status_updated_at: string | null;
          league: string | null;
          meta: Json | null;
          name: string;
          sport: string;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string | null;
          display_name?: string | null;
          external_id?: string | null;
          id?: string;
          identity_status?: Database['public']['Enums']['identity_status_type'] | null;
          identity_status_updated_at?: string | null;
          league?: string | null;
          meta?: Json | null;
          name: string;
          sport: string;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          created_at?: string | null;
          display_name?: string | null;
          external_id?: string | null;
          id?: string;
          identity_status?: Database['public']['Enums']['identity_status_type'] | null;
          identity_status_updated_at?: string | null;
          league?: string | null;
          meta?: Json | null;
          name?: string;
          sport?: string;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pick_events: {
        Row: {
          causation_id: string | null;
          correlation_id: string;
          created_at: string | null;
          created_by: string | null;
          event_data: Json;
          event_type: string;
          id: string;
          metadata: Json | null;
          pick_id: string;
          tenant_id: string;
        };
        Insert: {
          causation_id?: string | null;
          correlation_id: string;
          created_at?: string | null;
          created_by?: string | null;
          event_data: Json;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          pick_id: string;
          tenant_id: string;
        };
        Update: {
          causation_id?: string | null;
          correlation_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          event_data?: Json;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          pick_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pick_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_events_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      pick_publish: {
        Row: {
          attempts: number | null;
          channel: string;
          confirmed_at: string | null;
          created_at: string | null;
          dedupe_key: string | null;
          discord_channel_id: string | null;
          error: string | null;
          external_message_id: string | null;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          max_attempts: number | null;
          metadata: Json | null;
          next_attempt_at: string | null;
          next_retry_at: string | null;
          pick_id: string | null;
          processing_started_at: string | null;
          scheduled_for: string | null;
          sent_at: string | null;
          status: string;
          tenant_id: string;
          thread_id: string | null;
          updated_at: string | null;
          worker_id: string | null;
        };
        Insert: {
          attempts?: number | null;
          channel?: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          dedupe_key?: string | null;
          discord_channel_id?: string | null;
          error?: string | null;
          external_message_id?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number | null;
          metadata?: Json | null;
          next_attempt_at?: string | null;
          next_retry_at?: string | null;
          pick_id?: string | null;
          processing_started_at?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: string;
          tenant_id: string;
          thread_id?: string | null;
          updated_at?: string | null;
          worker_id?: string | null;
        };
        Update: {
          attempts?: number | null;
          channel?: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          dedupe_key?: string | null;
          discord_channel_id?: string | null;
          error?: string | null;
          external_message_id?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number | null;
          metadata?: Json | null;
          next_attempt_at?: string | null;
          next_retry_at?: string | null;
          pick_id?: string | null;
          processing_started_at?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string;
          thread_id?: string | null;
          updated_at?: string | null;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_publish_pick_id_unified_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'pick_publish_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      player_injuries: {
        Row: {
          created_at: string | null;
          expected_return: string | null;
          id: string;
          impact_rating: number | null;
          injury_detail: string | null;
          injury_type: string | null;
          player_id: string | null;
          player_name: string;
          reported_at: string | null;
          roster_impact: string | null;
          source: string | null;
          source_url: string | null;
          sport: string;
          status: string;
          team: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          expected_return?: string | null;
          id?: string;
          impact_rating?: number | null;
          injury_detail?: string | null;
          injury_type?: string | null;
          player_id?: string | null;
          player_name: string;
          reported_at?: string | null;
          roster_impact?: string | null;
          source?: string | null;
          source_url?: string | null;
          sport: string;
          status: string;
          team: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          expected_return?: string | null;
          id?: string;
          impact_rating?: number | null;
          injury_detail?: string | null;
          injury_type?: string | null;
          player_id?: string | null;
          player_name?: string;
          reported_at?: string | null;
          roster_impact?: string | null;
          source?: string | null;
          source_url?: string | null;
          sport?: string;
          status?: string;
          team?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      player_mappings: {
        Row: {
          canonical_player_id: string;
          confidence_score: number;
          conflict_count: number;
          created_at: string;
          external_player_id: string | null;
          external_player_name: string;
          id: string;
          is_primary: boolean;
          last_verified_at: string | null;
          mapping_method: string;
          metadata: Json | null;
          similarity_score: number | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          canonical_player_id: string;
          confidence_score?: number;
          conflict_count?: number;
          created_at?: string;
          external_player_id?: string | null;
          external_player_name: string;
          id?: string;
          is_primary?: boolean;
          last_verified_at?: string | null;
          mapping_method?: string;
          metadata?: Json | null;
          similarity_score?: number | null;
          source: string;
          updated_at?: string;
        };
        Update: {
          canonical_player_id?: string;
          confidence_score?: number;
          conflict_count?: number;
          created_at?: string;
          external_player_id?: string | null;
          external_player_name?: string;
          id?: string;
          is_primary?: boolean;
          last_verified_at?: string | null;
          mapping_method?: string;
          metadata?: Json | null;
          similarity_score?: number | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'player_mappings_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_players';
            referencedColumns: ['id'];
          },
        ];
      };
      player_projections: {
        Row: {
          computed_at: string;
          confidence: number;
          created_at: string | null;
          game_date: string;
          id: string;
          model_version: string;
          opponent: string | null;
          participant_id: string | null;
          player_name: string;
          projected_value: number;
          source_data: Json | null;
          sport: string;
          stat_type: string;
          updated_at: string | null;
          venue: string | null;
        };
        Insert: {
          computed_at?: string;
          confidence?: number;
          created_at?: string | null;
          game_date: string;
          id?: string;
          model_version: string;
          opponent?: string | null;
          participant_id?: string | null;
          player_name: string;
          projected_value: number;
          source_data?: Json | null;
          sport: string;
          stat_type: string;
          updated_at?: string | null;
          venue?: string | null;
        };
        Update: {
          computed_at?: string;
          confidence?: number;
          created_at?: string | null;
          game_date?: string;
          id?: string;
          model_version?: string;
          opponent?: string | null;
          participant_id?: string | null;
          player_name?: string;
          projected_value?: number;
          source_data?: Json | null;
          sport?: string;
          stat_type?: string;
          updated_at?: string | null;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'player_projections_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
        ];
      };
      player_season_stats: {
        Row: {
          assists_per_game: number | null;
          batting_average: number | null;
          blocked_shots_per_game: number | null;
          blocks_per_game: number | null;
          completions_per_game: number | null;
          consistency_score: number | null;
          data_quality_score: number | null;
          earned_runs_per_game: number | null;
          era: number | null;
          field_goal_pct: number | null;
          free_throw_pct: number | null;
          games_played: number | null;
          goals_against_per_game: number | null;
          goals_per_game: number | null;
          hit_rate_primary: number | null;
          hits_allowed_per_game: number | null;
          hits_per_game: number | null;
          hits_per_game_hockey: number | null;
          hockey_assists_per_game: number | null;
          hockey_points_per_game: number | null;
          home_runs_per_game: number | null;
          id: string;
          innings_pitched_per_game: number | null;
          interceptions_per_game: number | null;
          last_10_avg: number | null;
          last_5_avg: number | null;
          last_updated: string | null;
          minutes_per_game: number | null;
          on_base_pct: number | null;
          passing_attempts_per_game: number | null;
          passing_tds_per_game: number | null;
          passing_yards_per_game: number | null;
          player_id: string | null;
          player_name: string;
          points_per_game: number | null;
          pra_per_game: number | null;
          rbis_per_game: number | null;
          rebounds_per_game: number | null;
          receiving_tds_per_game: number | null;
          receiving_yards_per_game: number | null;
          receptions_per_game: number | null;
          runs_per_game: number | null;
          rushing_attempts_per_game: number | null;
          rushing_tds_per_game: number | null;
          rushing_yards_per_game: number | null;
          save_percentage: number | null;
          saves_per_game: number | null;
          season: string;
          shots_per_game: number | null;
          slugging_pct: number | null;
          source: string | null;
          sport: string;
          std_dev_primary_stat: number | null;
          steals_per_game: number | null;
          stolen_bases_per_game: number | null;
          strikeouts_batter_per_game: number | null;
          strikeouts_pitcher_per_game: number | null;
          targets_per_game: number | null;
          team: string | null;
          three_point_pct: number | null;
          threes_per_game: number | null;
          total_bases_per_game: number | null;
          trend_direction: string | null;
          trend_magnitude: number | null;
          turnovers_per_game: number | null;
          walks_allowed_per_game: number | null;
          walks_per_game: number | null;
          whip: number | null;
        };
        Insert: {
          assists_per_game?: number | null;
          batting_average?: number | null;
          blocked_shots_per_game?: number | null;
          blocks_per_game?: number | null;
          completions_per_game?: number | null;
          consistency_score?: number | null;
          data_quality_score?: number | null;
          earned_runs_per_game?: number | null;
          era?: number | null;
          field_goal_pct?: number | null;
          free_throw_pct?: number | null;
          games_played?: number | null;
          goals_against_per_game?: number | null;
          goals_per_game?: number | null;
          hit_rate_primary?: number | null;
          hits_allowed_per_game?: number | null;
          hits_per_game?: number | null;
          hits_per_game_hockey?: number | null;
          hockey_assists_per_game?: number | null;
          hockey_points_per_game?: number | null;
          home_runs_per_game?: number | null;
          id?: string;
          innings_pitched_per_game?: number | null;
          interceptions_per_game?: number | null;
          last_10_avg?: number | null;
          last_5_avg?: number | null;
          last_updated?: string | null;
          minutes_per_game?: number | null;
          on_base_pct?: number | null;
          passing_attempts_per_game?: number | null;
          passing_tds_per_game?: number | null;
          passing_yards_per_game?: number | null;
          player_id?: string | null;
          player_name: string;
          points_per_game?: number | null;
          pra_per_game?: number | null;
          rbis_per_game?: number | null;
          rebounds_per_game?: number | null;
          receiving_tds_per_game?: number | null;
          receiving_yards_per_game?: number | null;
          receptions_per_game?: number | null;
          runs_per_game?: number | null;
          rushing_attempts_per_game?: number | null;
          rushing_tds_per_game?: number | null;
          rushing_yards_per_game?: number | null;
          save_percentage?: number | null;
          saves_per_game?: number | null;
          season: string;
          shots_per_game?: number | null;
          slugging_pct?: number | null;
          source?: string | null;
          sport: string;
          std_dev_primary_stat?: number | null;
          steals_per_game?: number | null;
          stolen_bases_per_game?: number | null;
          strikeouts_batter_per_game?: number | null;
          strikeouts_pitcher_per_game?: number | null;
          targets_per_game?: number | null;
          team?: string | null;
          three_point_pct?: number | null;
          threes_per_game?: number | null;
          total_bases_per_game?: number | null;
          trend_direction?: string | null;
          trend_magnitude?: number | null;
          turnovers_per_game?: number | null;
          walks_allowed_per_game?: number | null;
          walks_per_game?: number | null;
          whip?: number | null;
        };
        Update: {
          assists_per_game?: number | null;
          batting_average?: number | null;
          blocked_shots_per_game?: number | null;
          blocks_per_game?: number | null;
          completions_per_game?: number | null;
          consistency_score?: number | null;
          data_quality_score?: number | null;
          earned_runs_per_game?: number | null;
          era?: number | null;
          field_goal_pct?: number | null;
          free_throw_pct?: number | null;
          games_played?: number | null;
          goals_against_per_game?: number | null;
          goals_per_game?: number | null;
          hit_rate_primary?: number | null;
          hits_allowed_per_game?: number | null;
          hits_per_game?: number | null;
          hits_per_game_hockey?: number | null;
          hockey_assists_per_game?: number | null;
          hockey_points_per_game?: number | null;
          home_runs_per_game?: number | null;
          id?: string;
          innings_pitched_per_game?: number | null;
          interceptions_per_game?: number | null;
          last_10_avg?: number | null;
          last_5_avg?: number | null;
          last_updated?: string | null;
          minutes_per_game?: number | null;
          on_base_pct?: number | null;
          passing_attempts_per_game?: number | null;
          passing_tds_per_game?: number | null;
          passing_yards_per_game?: number | null;
          player_id?: string | null;
          player_name?: string;
          points_per_game?: number | null;
          pra_per_game?: number | null;
          rbis_per_game?: number | null;
          rebounds_per_game?: number | null;
          receiving_tds_per_game?: number | null;
          receiving_yards_per_game?: number | null;
          receptions_per_game?: number | null;
          runs_per_game?: number | null;
          rushing_attempts_per_game?: number | null;
          rushing_tds_per_game?: number | null;
          rushing_yards_per_game?: number | null;
          save_percentage?: number | null;
          saves_per_game?: number | null;
          season?: string;
          shots_per_game?: number | null;
          slugging_pct?: number | null;
          source?: string | null;
          sport?: string;
          std_dev_primary_stat?: number | null;
          steals_per_game?: number | null;
          stolen_bases_per_game?: number | null;
          strikeouts_batter_per_game?: number | null;
          strikeouts_pitcher_per_game?: number | null;
          targets_per_game?: number | null;
          team?: string | null;
          three_point_pct?: number | null;
          threes_per_game?: number | null;
          total_bases_per_game?: number | null;
          trend_direction?: string | null;
          trend_magnitude?: number | null;
          turnovers_per_game?: number | null;
          walks_allowed_per_game?: number | null;
          walks_per_game?: number | null;
          whip?: number | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          active: boolean | null;
          created_at: string;
          full_name: string;
          headshot_url: string | null;
          id: string;
          meta: Json | null;
          normalized_name: string | null;
          photo_url: string | null;
          position: string | null;
          provider_player_id: string | null;
          search_key: string | null;
          sport: string;
          team_abbr: string | null;
          team_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string;
          full_name: string;
          headshot_url?: string | null;
          id?: string;
          meta?: Json | null;
          normalized_name?: string | null;
          photo_url?: string | null;
          position?: string | null;
          provider_player_id?: string | null;
          search_key?: string | null;
          sport: string;
          team_abbr?: string | null;
          team_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean | null;
          created_at?: string;
          full_name?: string;
          headshot_url?: string | null;
          id?: string;
          meta?: Json | null;
          normalized_name?: string | null;
          photo_url?: string | null;
          position?: string | null;
          provider_player_id?: string | null;
          search_key?: string | null;
          sport?: string;
          team_abbr?: string | null;
          team_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      projection_models: {
        Row: {
          backtest_clv_avg: number | null;
          backtest_profit: number | null;
          backtest_roi: number | null;
          backtest_sample_size: number | null;
          backtest_sharpe_ratio: number | null;
          backtest_win_rate: number | null;
          created_at: string | null;
          created_by: string | null;
          deprecated_at: string | null;
          deprecation_reason: string | null;
          feature_columns: string[] | null;
          hit_rate: number | null;
          hyperparameters: Json | null;
          id: string;
          mae: number | null;
          mape: number | null;
          model_artifact_path: string | null;
          model_artifact_size_bytes: number | null;
          model_name: string;
          model_type: string;
          model_version: string;
          promoted_at: string | null;
          r_squared: number | null;
          rmse: number | null;
          sport: string;
          stat_type: string;
          status: string | null;
          trained_at: string | null;
          training_duration_seconds: number | null;
          training_end_date: string | null;
          training_samples: number | null;
          training_start_date: string | null;
          updated_at: string | null;
        };
        Insert: {
          backtest_clv_avg?: number | null;
          backtest_profit?: number | null;
          backtest_roi?: number | null;
          backtest_sample_size?: number | null;
          backtest_sharpe_ratio?: number | null;
          backtest_win_rate?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deprecated_at?: string | null;
          deprecation_reason?: string | null;
          feature_columns?: string[] | null;
          hit_rate?: number | null;
          hyperparameters?: Json | null;
          id?: string;
          mae?: number | null;
          mape?: number | null;
          model_artifact_path?: string | null;
          model_artifact_size_bytes?: number | null;
          model_name: string;
          model_type: string;
          model_version: string;
          promoted_at?: string | null;
          r_squared?: number | null;
          rmse?: number | null;
          sport: string;
          stat_type: string;
          status?: string | null;
          trained_at?: string | null;
          training_duration_seconds?: number | null;
          training_end_date?: string | null;
          training_samples?: number | null;
          training_start_date?: string | null;
          updated_at?: string | null;
        };
        Update: {
          backtest_clv_avg?: number | null;
          backtest_profit?: number | null;
          backtest_roi?: number | null;
          backtest_sample_size?: number | null;
          backtest_sharpe_ratio?: number | null;
          backtest_win_rate?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deprecated_at?: string | null;
          deprecation_reason?: string | null;
          feature_columns?: string[] | null;
          hit_rate?: number | null;
          hyperparameters?: Json | null;
          id?: string;
          mae?: number | null;
          mape?: number | null;
          model_artifact_path?: string | null;
          model_artifact_size_bytes?: number | null;
          model_name?: string;
          model_type?: string;
          model_version?: string;
          promoted_at?: string | null;
          r_squared?: number | null;
          rmse?: number | null;
          sport?: string;
          stat_type?: string;
          status?: string | null;
          trained_at?: string | null;
          training_duration_seconds?: number | null;
          training_end_date?: string | null;
          training_samples?: number | null;
          training_start_date?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      promotion_decisions: {
        Row: {
          approved: boolean;
          confidence: number | null;
          created_at: string;
          decision: string;
          estimated_impact: Json | null;
          gate_results: Json | null;
          id: string;
          pick_id: string;
          prop_id: string | null;
          reasoning: string | null;
          risk_score: number | null;
          scheduled_time: string | null;
        };
        Insert: {
          approved: boolean;
          confidence?: number | null;
          created_at?: string;
          decision: string;
          estimated_impact?: Json | null;
          gate_results?: Json | null;
          id?: string;
          pick_id: string;
          prop_id?: string | null;
          reasoning?: string | null;
          risk_score?: number | null;
          scheduled_time?: string | null;
        };
        Update: {
          approved?: boolean;
          confidence?: number | null;
          created_at?: string;
          decision?: string;
          estimated_impact?: Json | null;
          gate_results?: Json | null;
          id?: string;
          pick_id?: string;
          prop_id?: string | null;
          reasoning?: string | null;
          risk_score?: number | null;
          scheduled_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_decisions_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
        ];
      };
      promotion_events: {
        Row: {
          created_at: string;
          details: Json | null;
          event_type: string;
          id: string;
          occurred_at: string;
          pick_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          event_type: string;
          id?: string;
          occurred_at?: string;
          pick_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          event_type?: string;
          id?: string;
          occurred_at?: string;
          pick_id?: string | null;
        };
        Relationships: [];
      };
      promotion_queue: {
        Row: {
          channel_id: string | null;
          created_at: string;
          denied_reason: string | null;
          id: string;
          metadata: Json | null;
          pick_id: string;
          priority: number;
          prop_ref: string | null;
          publish_at: string | null;
          published_at: string | null;
          reason: string | null;
          source: string | null;
          sport: string | null;
          status: string;
          tier: string | null;
          updated_at: string;
        };
        Insert: {
          channel_id?: string | null;
          created_at?: string;
          denied_reason?: string | null;
          id?: string;
          metadata?: Json | null;
          pick_id: string;
          priority?: number;
          prop_ref?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          reason?: string | null;
          source?: string | null;
          sport?: string | null;
          status?: string;
          tier?: string | null;
          updated_at?: string;
        };
        Update: {
          channel_id?: string | null;
          created_at?: string;
          denied_reason?: string | null;
          id?: string;
          metadata?: Json | null;
          pick_id?: string;
          priority?: number;
          prop_ref?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          reason?: string | null;
          source?: string | null;
          sport?: string | null;
          status?: string;
          tier?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_promotion_queue_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
        ];
      };
      prop_mappings: {
        Row: {
          canonical_game_id: string | null;
          canonical_player_id: string | null;
          confidence_score: number;
          created_at: string;
          external_prop_id: string;
          id: string;
          line: number;
          metadata: Json | null;
          over_odds: number | null;
          source: string;
          stat_type: string;
          under_odds: number | null;
          updated_at: string;
        };
        Insert: {
          canonical_game_id?: string | null;
          canonical_player_id?: string | null;
          confidence_score?: number;
          created_at?: string;
          external_prop_id: string;
          id?: string;
          line: number;
          metadata?: Json | null;
          over_odds?: number | null;
          source: string;
          stat_type: string;
          under_odds?: number | null;
          updated_at?: string;
        };
        Update: {
          canonical_game_id?: string | null;
          canonical_player_id?: string | null;
          confidence_score?: number;
          created_at?: string;
          external_prop_id?: string;
          id?: string;
          line?: number;
          metadata?: Json | null;
          over_odds?: number | null;
          source?: string;
          stat_type?: string;
          under_odds?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prop_mappings_canonical_game_id_fkey';
            columns: ['canonical_game_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_mappings_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_players';
            referencedColumns: ['id'];
          },
        ];
      };
      prop_settlements: {
        Row: {
          actual_value: number | null;
          bet_side: string;
          created_at: string | null;
          data_quality_score: number | null;
          data_source: string;
          dispute_reason: string | null;
          dispute_resolved_at: string | null;
          disputed: boolean | null;
          final_pick_id: string | null;
          game_result_id: string | null;
          id: string;
          line: number;
          player_name: string;
          raw_prop_id: string | null;
          settled_at: string | null;
          settlement_confidence: number | null;
          settlement_method: string | null;
          settlement_result: string | null;
          stat_type: string;
          updated_at: string | null;
          verification_timestamp: string | null;
          verified_by: string | null;
        };
        Insert: {
          actual_value?: number | null;
          bet_side: string;
          created_at?: string | null;
          data_quality_score?: number | null;
          data_source?: string;
          dispute_reason?: string | null;
          dispute_resolved_at?: string | null;
          disputed?: boolean | null;
          final_pick_id?: string | null;
          game_result_id?: string | null;
          id?: string;
          line: number;
          player_name: string;
          raw_prop_id?: string | null;
          settled_at?: string | null;
          settlement_confidence?: number | null;
          settlement_method?: string | null;
          settlement_result?: string | null;
          stat_type: string;
          updated_at?: string | null;
          verification_timestamp?: string | null;
          verified_by?: string | null;
        };
        Update: {
          actual_value?: number | null;
          bet_side?: string;
          created_at?: string | null;
          data_quality_score?: number | null;
          data_source?: string;
          dispute_reason?: string | null;
          dispute_resolved_at?: string | null;
          disputed?: boolean | null;
          final_pick_id?: string | null;
          game_result_id?: string | null;
          id?: string;
          line?: number;
          player_name?: string;
          raw_prop_id?: string | null;
          settled_at?: string | null;
          settlement_confidence?: number | null;
          settlement_method?: string | null;
          settlement_result?: string | null;
          stat_type?: string;
          updated_at?: string | null;
          verification_timestamp?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_final_pick_id_fkey';
            columns: ['final_pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'prop_settlements_game_result_id_fkey';
            columns: ['game_result_id'];
            isOneToOne: false;
            referencedRelation: 'game_results';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_props_for_form_v1';
            referencedColumns: ['prop_id'];
          },
          {
            foreignKeyName: 'prop_settlements_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'mv_props_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prop_settlements_raw_prop_id_fkey';
            columns: ['raw_prop_id'];
            isOneToOne: false;
            referencedRelation: 'raw_props';
            referencedColumns: ['id'];
          },
        ];
      };
      props: {
        Row: {
          bookmaker: string | null;
          created_at: string | null;
          external_game_id: string | null;
          external_prop_id: string | null;
          game_date: string | null;
          game_id: string | null;
          game_time: string | null;
          id: string;
          league: string | null;
          line: number | null;
          metadata: Json | null;
          opponent: string | null;
          over_odds: number | null;
          player_name: string;
          sport: string;
          stat_type: string;
          status: string;
          team: string | null;
          tenant_id: string;
          under_odds: number | null;
          updated_at: string | null;
        };
        Insert: {
          bookmaker?: string | null;
          created_at?: string | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          game_date?: string | null;
          game_id?: string | null;
          game_time?: string | null;
          id?: string;
          league?: string | null;
          line?: number | null;
          metadata?: Json | null;
          opponent?: string | null;
          over_odds?: number | null;
          player_name: string;
          sport: string;
          stat_type: string;
          status?: string;
          team?: string | null;
          tenant_id: string;
          under_odds?: number | null;
          updated_at?: string | null;
        };
        Update: {
          bookmaker?: string | null;
          created_at?: string | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          game_date?: string | null;
          game_id?: string | null;
          game_time?: string | null;
          id?: string;
          league?: string | null;
          line?: number | null;
          metadata?: Json | null;
          opponent?: string | null;
          over_odds?: number | null;
          player_name?: string;
          sport?: string;
          stat_type?: string;
          status?: string;
          team?: string | null;
          tenant_id?: string;
          under_odds?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'props_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_event_map: {
        Row: {
          canonical_event_id: string | null;
          confidence_score: number | null;
          created_at: string | null;
          id: number;
          mapping_version: number;
          meta: Json | null;
          provider_event_id: string;
          provider_id: number;
          source: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          canonical_event_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_event_id: string;
          provider_id: number;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          canonical_event_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_event_id?: string;
          provider_id?: number;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_event_map_canonical_event_id_fkey';
            columns: ['canonical_event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_event_map_canonical_event_id_fkey';
            columns: ['canonical_event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_event_map_canonical_event_id_fkey';
            columns: ['canonical_event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
          {
            foreignKeyName: 'provider_event_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_event_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_market_map: {
        Row: {
          canonical_market_type_id: number | null;
          confidence_score: number | null;
          created_at: string | null;
          id: number;
          mapping_version: number;
          meta: Json | null;
          provider_id: number;
          provider_market_key: string;
          provider_market_name: string | null;
          source: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          canonical_market_type_id?: number | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id: number;
          provider_market_key: string;
          provider_market_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          canonical_market_type_id?: number | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id?: number;
          provider_market_key?: string;
          provider_market_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_market_map_canonical_market_type_id_fkey';
            columns: ['canonical_market_type_id'];
            isOneToOne: false;
            referencedRelation: 'market_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_market_map_canonical_market_type_id_fkey';
            columns: ['canonical_market_type_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_types_for_sport';
            referencedColumns: ['market_type_id'];
          },
          {
            foreignKeyName: 'provider_market_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_market_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_offers: {
        Row: {
          away_odds: number | null;
          created_at: string | null;
          devigged_over: number | null;
          devigged_under: number | null;
          event_id: string;
          home_odds: number | null;
          id: string;
          is_closing: boolean | null;
          is_opening: boolean | null;
          juice: number | null;
          line: number | null;
          mapping_confidence: number | null;
          market_id: string | null;
          market_type_id: number | null;
          meta: Json | null;
          no_odds: number | null;
          over_odds: number | null;
          participant_id: string | null;
          provider: string;
          provider_event_id: string | null;
          provider_id: number | null;
          provider_market_key: string | null;
          provider_participant_id: string | null;
          segment_id: string | null;
          segment_type_id: number | null;
          snapshot_at: string;
          under_odds: number | null;
          yes_odds: number | null;
        };
        Insert: {
          away_odds?: number | null;
          created_at?: string | null;
          devigged_over?: number | null;
          devigged_under?: number | null;
          event_id: string;
          home_odds?: number | null;
          id?: string;
          is_closing?: boolean | null;
          is_opening?: boolean | null;
          juice?: number | null;
          line?: number | null;
          mapping_confidence?: number | null;
          market_id?: string | null;
          market_type_id?: number | null;
          meta?: Json | null;
          no_odds?: number | null;
          over_odds?: number | null;
          participant_id?: string | null;
          provider: string;
          provider_event_id?: string | null;
          provider_id?: number | null;
          provider_market_key?: string | null;
          provider_participant_id?: string | null;
          segment_id?: string | null;
          segment_type_id?: number | null;
          snapshot_at: string;
          under_odds?: number | null;
          yes_odds?: number | null;
        };
        Update: {
          away_odds?: number | null;
          created_at?: string | null;
          devigged_over?: number | null;
          devigged_under?: number | null;
          event_id?: string;
          home_odds?: number | null;
          id?: string;
          is_closing?: boolean | null;
          is_opening?: boolean | null;
          juice?: number | null;
          line?: number | null;
          mapping_confidence?: number | null;
          market_id?: string | null;
          market_type_id?: number | null;
          meta?: Json | null;
          no_odds?: number | null;
          over_odds?: number | null;
          participant_id?: string | null;
          provider?: string;
          provider_event_id?: string | null;
          provider_id?: number | null;
          provider_market_key?: string | null;
          provider_participant_id?: string | null;
          segment_id?: string | null;
          segment_type_id?: number | null;
          snapshot_at?: string;
          under_odds?: number | null;
          yes_odds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
          {
            foreignKeyName: 'provider_offers_market_id_fkey';
            columns: ['market_id'];
            isOneToOne: false;
            referencedRelation: 'markets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'market_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_types_for_sport';
            referencedColumns: ['market_type_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_segment_id_fkey';
            columns: ['segment_id'];
            isOneToOne: false;
            referencedRelation: 'event_segments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_segment_type_id_fkey';
            columns: ['segment_type_id'];
            isOneToOne: false;
            referencedRelation: 'segment_types';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_player_map: {
        Row: {
          canonical_player_id: string | null;
          confidence_score: number | null;
          created_at: string | null;
          id: number;
          mapping_version: number;
          meta: Json | null;
          provider_id: number;
          provider_player_id: string;
          provider_player_name: string | null;
          source: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          canonical_player_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id: number;
          provider_player_id: string;
          provider_player_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          canonical_player_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id?: number;
          provider_player_id?: string;
          provider_player_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_player_map_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_player_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_player_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_registry: {
        Row: {
          active: boolean | null;
          api_source: string | null;
          code: string;
          created_at: string | null;
          display_name: string;
          has_live_odds: boolean | null;
          has_player_props: boolean | null;
          id: number;
          meta: Json | null;
          priority: number | null;
        };
        Insert: {
          active?: boolean | null;
          api_source?: string | null;
          code: string;
          created_at?: string | null;
          display_name: string;
          has_live_odds?: boolean | null;
          has_player_props?: boolean | null;
          id?: number;
          meta?: Json | null;
          priority?: number | null;
        };
        Update: {
          active?: boolean | null;
          api_source?: string | null;
          code?: string;
          created_at?: string | null;
          display_name?: string;
          has_live_odds?: boolean | null;
          has_player_props?: boolean | null;
          id?: number;
          meta?: Json | null;
          priority?: number | null;
        };
        Relationships: [];
      };
      provider_team_map: {
        Row: {
          canonical_team_id: string | null;
          confidence_score: number | null;
          created_at: string | null;
          id: number;
          mapping_version: number;
          meta: Json | null;
          provider_id: number;
          provider_team_id: string;
          provider_team_name: string | null;
          source: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          canonical_team_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id: number;
          provider_team_id: string;
          provider_team_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          canonical_team_id?: string | null;
          confidence_score?: number | null;
          created_at?: string | null;
          id?: number;
          mapping_version?: number;
          meta?: Json | null;
          provider_id?: number;
          provider_team_id?: string;
          provider_team_name?: string | null;
          source?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_team_map_canonical_team_id_fkey';
            columns: ['canonical_team_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_team_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_team_map_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      raw_props: {
        Row: {
          auto_approved: boolean | null;
          away_team: string | null;
          away_team_id: number | null;
          bet_type: string | null;
          book: string | null;
          bookmaker_key: string | null;
          bookmaker_title: string | null;
          canonical_game_id: string | null;
          canonical_player_id: string | null;
          confidence_score: number | null;
          context_flag: boolean | null;
          created_at: string;
          direction: string | null;
          edge_score: number | null;
          error_at: string | null;
          error_message: string | null;
          ev_percent: number | null;
          event_id: string | null;
          event_time: string | null;
          external_game_id: string | null;
          external_id: string | null;
          game_date: string;
          game_id: string | null;
          game_time: string | null;
          home_team: string | null;
          home_team_id: number | null;
          id: string;
          is_alt_line: boolean | null;
          is_primary: boolean | null;
          is_promoted: boolean | null;
          is_valid: boolean;
          kelly_fraction: number | null;
          league: string;
          line: number | null;
          line_score: number | null;
          line_value_score: number | null;
          market: string | null;
          market_open_time: string | null;
          market_type: string | null;
          matchup: string | null;
          matchup_quality: number | null;
          matchup_score: number | null;
          meta: Json | null;
          odds: number | null;
          opening_captured_at: string | null;
          opening_line: number | null;
          opening_over_odds: number | null;
          opening_under_odds: number | null;
          opponent: string | null;
          outcome: string | null;
          over_odds: number | null;
          player_name: string | null;
          pro_attempts: number;
          processed_at: string | null;
          processed_by: string | null;
          professional_score: number | null;
          promoted: boolean | null;
          promoted_at: string | null;
          promoted_to_picks: boolean | null;
          provider: string;
          role_score: number | null;
          role_stability: number | null;
          scraped_at: string | null;
          selection: string | null;
          settled_at: string | null;
          settlement_result: string | null;
          settlement_status: string | null;
          source: string;
          sport: string;
          sport_key: string | null;
          start_time: string | null;
          stat_type: string;
          team: string | null;
          tier: string | null;
          tier_tag: string | null;
          trend_confidence: number | null;
          trend_score: number | null;
          under_odds: number | null;
          unique_key: string | null;
          unit_size: number | null;
          updated_at: string;
        };
        Insert: {
          auto_approved?: boolean | null;
          away_team?: string | null;
          away_team_id?: number | null;
          bet_type?: string | null;
          book?: string | null;
          bookmaker_key?: string | null;
          bookmaker_title?: string | null;
          canonical_game_id?: string | null;
          canonical_player_id?: string | null;
          confidence_score?: number | null;
          context_flag?: boolean | null;
          created_at?: string;
          direction?: string | null;
          edge_score?: number | null;
          error_at?: string | null;
          error_message?: string | null;
          ev_percent?: number | null;
          event_id?: string | null;
          event_time?: string | null;
          external_game_id?: string | null;
          external_id?: string | null;
          game_date: string;
          game_id?: string | null;
          game_time?: string | null;
          home_team?: string | null;
          home_team_id?: number | null;
          id?: string;
          is_alt_line?: boolean | null;
          is_primary?: boolean | null;
          is_promoted?: boolean | null;
          is_valid?: boolean;
          kelly_fraction?: number | null;
          league: string;
          line?: number | null;
          line_score?: number | null;
          line_value_score?: number | null;
          market?: string | null;
          market_open_time?: string | null;
          market_type?: string | null;
          matchup?: string | null;
          matchup_quality?: number | null;
          matchup_score?: number | null;
          meta?: Json | null;
          odds?: number | null;
          opening_captured_at?: string | null;
          opening_line?: number | null;
          opening_over_odds?: number | null;
          opening_under_odds?: number | null;
          opponent?: string | null;
          outcome?: string | null;
          over_odds?: number | null;
          player_name?: string | null;
          pro_attempts?: number;
          processed_at?: string | null;
          processed_by?: string | null;
          professional_score?: number | null;
          promoted?: boolean | null;
          promoted_at?: string | null;
          promoted_to_picks?: boolean | null;
          provider: string;
          role_score?: number | null;
          role_stability?: number | null;
          scraped_at?: string | null;
          selection?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_status?: string | null;
          source: string;
          sport: string;
          sport_key?: string | null;
          start_time?: string | null;
          stat_type: string;
          team?: string | null;
          tier?: string | null;
          tier_tag?: string | null;
          trend_confidence?: number | null;
          trend_score?: number | null;
          under_odds?: number | null;
          unique_key?: string | null;
          unit_size?: number | null;
          updated_at?: string;
        };
        Update: {
          auto_approved?: boolean | null;
          away_team?: string | null;
          away_team_id?: number | null;
          bet_type?: string | null;
          book?: string | null;
          bookmaker_key?: string | null;
          bookmaker_title?: string | null;
          canonical_game_id?: string | null;
          canonical_player_id?: string | null;
          confidence_score?: number | null;
          context_flag?: boolean | null;
          created_at?: string;
          direction?: string | null;
          edge_score?: number | null;
          error_at?: string | null;
          error_message?: string | null;
          ev_percent?: number | null;
          event_id?: string | null;
          event_time?: string | null;
          external_game_id?: string | null;
          external_id?: string | null;
          game_date?: string;
          game_id?: string | null;
          game_time?: string | null;
          home_team?: string | null;
          home_team_id?: number | null;
          id?: string;
          is_alt_line?: boolean | null;
          is_primary?: boolean | null;
          is_promoted?: boolean | null;
          is_valid?: boolean;
          kelly_fraction?: number | null;
          league?: string;
          line?: number | null;
          line_score?: number | null;
          line_value_score?: number | null;
          market?: string | null;
          market_open_time?: string | null;
          market_type?: string | null;
          matchup?: string | null;
          matchup_quality?: number | null;
          matchup_score?: number | null;
          meta?: Json | null;
          odds?: number | null;
          opening_captured_at?: string | null;
          opening_line?: number | null;
          opening_over_odds?: number | null;
          opening_under_odds?: number | null;
          opponent?: string | null;
          outcome?: string | null;
          over_odds?: number | null;
          player_name?: string | null;
          pro_attempts?: number;
          processed_at?: string | null;
          processed_by?: string | null;
          professional_score?: number | null;
          promoted?: boolean | null;
          promoted_at?: string | null;
          promoted_to_picks?: boolean | null;
          provider?: string;
          role_score?: number | null;
          role_stability?: number | null;
          scraped_at?: string | null;
          selection?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_status?: string | null;
          source?: string;
          sport?: string;
          sport_key?: string | null;
          start_time?: string | null;
          stat_type?: string;
          team?: string | null;
          tier?: string | null;
          tier_tag?: string | null;
          trend_confidence?: number | null;
          trend_score?: number | null;
          under_odds?: number | null;
          unique_key?: string | null;
          unit_size?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'raw_props_canonical_game_id_fkey';
            columns: ['canonical_game_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'raw_props_canonical_player_id_fkey';
            columns: ['canonical_player_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_players';
            referencedColumns: ['id'];
          },
        ];
      };
      runtime_config: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      schema_reload_log: {
        Row: {
          error_message: string | null;
          id: string;
          metadata: Json | null;
          reason: string | null;
          reloaded_at: string | null;
          success: boolean | null;
          triggered_by: string;
        };
        Insert: {
          error_message?: string | null;
          id?: string;
          metadata?: Json | null;
          reason?: string | null;
          reloaded_at?: string | null;
          success?: boolean | null;
          triggered_by: string;
        };
        Update: {
          error_message?: string | null;
          id?: string;
          metadata?: Json | null;
          reason?: string | null;
          reloaded_at?: string | null;
          success?: boolean | null;
          triggered_by?: string;
        };
        Relationships: [];
      };
      schema_versions: {
        Row: {
          applied_at: string;
          applied_by: string | null;
          checksum: string | null;
          error_message: string | null;
          execution_time_ms: number | null;
          id: string;
          metadata: Json | null;
          migration_name: string;
          rollback_available: boolean | null;
          status: string;
        };
        Insert: {
          applied_at?: string;
          applied_by?: string | null;
          checksum?: string | null;
          error_message?: string | null;
          execution_time_ms?: number | null;
          id?: string;
          metadata?: Json | null;
          migration_name: string;
          rollback_available?: boolean | null;
          status?: string;
        };
        Update: {
          applied_at?: string;
          applied_by?: string | null;
          checksum?: string | null;
          error_message?: string | null;
          execution_time_ms?: number | null;
          id?: string;
          metadata?: Json | null;
          migration_name?: string;
          rollback_available?: boolean | null;
          status?: string;
        };
        Relationships: [];
      };
      score_audit_log: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          correlation_id: string | null;
          created_at: string | null;
          event_type: string;
          id: string;
          metadata: Json | null;
          new_value: number | null;
          old_value: number | null;
          pick_id: string;
          reason: string | null;
          tenant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type?: string;
          correlation_id?: string | null;
          created_at?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          new_value?: number | null;
          old_value?: number | null;
          pick_id: string;
          reason?: string | null;
          tenant_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          correlation_id?: string | null;
          created_at?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          new_value?: number | null;
          old_value?: number | null;
          pick_id?: string;
          reason?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'score_audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'score_audit_log_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      scored_legs: {
        Row: {
          computed_at: string;
          confidence_score: number | null;
          created_at: string | null;
          edge_score: number | null;
          expected_value: number | null;
          feature_contributions: Json | null;
          feature_snapshot_id: string | null;
          id: string;
          is_latest: boolean | null;
          kelly_fraction: number | null;
          leg_id: string;
          meta: Json | null;
          model_name: string;
          model_version: string;
          promotion_band: string | null;
          tier: string | null;
        };
        Insert: {
          computed_at?: string;
          confidence_score?: number | null;
          created_at?: string | null;
          edge_score?: number | null;
          expected_value?: number | null;
          feature_contributions?: Json | null;
          feature_snapshot_id?: string | null;
          id?: string;
          is_latest?: boolean | null;
          kelly_fraction?: number | null;
          leg_id: string;
          meta?: Json | null;
          model_name: string;
          model_version: string;
          promotion_band?: string | null;
          tier?: string | null;
        };
        Update: {
          computed_at?: string;
          confidence_score?: number | null;
          created_at?: string | null;
          edge_score?: number | null;
          expected_value?: number | null;
          feature_contributions?: Json | null;
          feature_snapshot_id?: string | null;
          id?: string;
          is_latest?: boolean | null;
          kelly_fraction?: number | null;
          leg_id?: string;
          meta?: Json | null;
          model_name?: string;
          model_version?: string;
          promotion_band?: string | null;
          tier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scored_legs_feature_snapshot_id_fkey';
            columns: ['feature_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'feature_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scored_legs_feature_snapshot_id_fkey';
            columns: ['feature_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'view_scoring_audit';
            referencedColumns: ['feature_snapshot_id'];
          },
          {
            foreignKeyName: 'scored_legs_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_legs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scored_legs_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'view_scoring_audit';
            referencedColumns: ['leg_id'];
          },
        ];
      };
      scored_props: {
        Row: {
          clv_pct: number | null;
          confidence: number | null;
          created_at: string;
          edge: number | null;
          explanation: Json | null;
          feature_contributions: Json | null;
          id: string;
          kelly: number | null;
          kelly_fraction: number | null;
          metadata: Json | null;
          prob_win: number | null;
          professional_score: number;
          prop_ref: string;
          score: number | null;
          tier: string;
          updated_at: string;
        };
        Insert: {
          clv_pct?: number | null;
          confidence?: number | null;
          created_at?: string;
          edge?: number | null;
          explanation?: Json | null;
          feature_contributions?: Json | null;
          id?: string;
          kelly?: number | null;
          kelly_fraction?: number | null;
          metadata?: Json | null;
          prob_win?: number | null;
          professional_score: number;
          prop_ref: string;
          score?: number | null;
          tier: string;
          updated_at?: string;
        };
        Update: {
          clv_pct?: number | null;
          confidence?: number | null;
          created_at?: string;
          edge?: number | null;
          explanation?: Json | null;
          feature_contributions?: Json | null;
          id?: string;
          kelly?: number | null;
          kelly_fraction?: number | null;
          metadata?: Json | null;
          prob_win?: number | null;
          professional_score?: number;
          prop_ref?: string;
          score?: number | null;
          tier?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      segment_types: {
        Row: {
          applicable_sports: string[] | null;
          code: string;
          created_at: string | null;
          display_name: string;
          display_short: string | null;
          id: number;
          max_segments: number | null;
          meta: Json | null;
          ordinal_prefix: string | null;
        };
        Insert: {
          applicable_sports?: string[] | null;
          code: string;
          created_at?: string | null;
          display_name: string;
          display_short?: string | null;
          id?: number;
          max_segments?: number | null;
          meta?: Json | null;
          ordinal_prefix?: string | null;
        };
        Update: {
          applicable_sports?: string[] | null;
          code?: string;
          created_at?: string | null;
          display_name?: string;
          display_short?: string | null;
          id?: number;
          max_segments?: number | null;
          meta?: Json | null;
          ordinal_prefix?: string | null;
        };
        Relationships: [];
      };
      settled_outcomes: {
        Row: {
          actual_stat: number | null;
          created_at: string;
          id: string;
          meta: Json | null;
          pick_id: string;
          result: string;
          settled_at: string;
        };
        Insert: {
          actual_stat?: number | null;
          created_at?: string;
          id?: string;
          meta?: Json | null;
          pick_id: string;
          result: string;
          settled_at?: string;
        };
        Update: {
          actual_stat?: number | null;
          created_at?: string;
          id?: string;
          meta?: Json | null;
          pick_id?: string;
          result?: string;
          settled_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'unified_picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_clv_analysis';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_level3_close_intelligence';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_pick_timeline';
            referencedColumns: ['pick_id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_promo_backlog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_recent_promotions_24h';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_settled_outcomes_pick_id';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'v_stuck_picks';
            referencedColumns: ['pick_id'];
          },
        ];
      };
      settlement_log: {
        Row: {
          action_type: string;
          confidence_score: number | null;
          data_source: string;
          game_result_id: string | null;
          id: string;
          new_values: Json | null;
          notes: string | null;
          old_values: Json | null;
          performed_at: string | null;
          processing_agent: string | null;
          prop_settlement_id: string | null;
        };
        Insert: {
          action_type: string;
          confidence_score?: number | null;
          data_source: string;
          game_result_id?: string | null;
          id?: string;
          new_values?: Json | null;
          notes?: string | null;
          old_values?: Json | null;
          performed_at?: string | null;
          processing_agent?: string | null;
          prop_settlement_id?: string | null;
        };
        Update: {
          action_type?: string;
          confidence_score?: number | null;
          data_source?: string;
          game_result_id?: string | null;
          id?: string;
          new_values?: Json | null;
          notes?: string | null;
          old_values?: Json | null;
          performed_at?: string | null;
          processing_agent?: string | null;
          prop_settlement_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'settlement_log_game_result_id_fkey';
            columns: ['game_result_id'];
            isOneToOne: false;
            referencedRelation: 'game_results';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlement_log_prop_settlement_id_fkey';
            columns: ['prop_settlement_id'];
            isOneToOne: false;
            referencedRelation: 'prop_settlements';
            referencedColumns: ['id'];
          },
        ];
      };
      smart_tickets: {
        Row: {
          bet_slip_id: string;
          capper_id: string | null;
          capper_name: string | null;
          created_at: string;
          data_quality_score: number | null;
          form_data: Json;
          game_id: string | null;
          game_selections: Json;
          id: string;
          lane: string | null;
          manual_reason: string | null;
          manual_unscoped: boolean | null;
          needs_review: boolean | null;
          notes: string | null;
          parlay_odds: number | null;
          pick_data: Json;
          processed_at: string | null;
          published_at: string | null;
          selection_count: number | null;
          sport: string | null;
          status: string;
          submitted_at: string;
          ticket_type: string | null;
          total_units: number | null;
          updated_at: string;
          user_id: string | null;
          validation_errors: Json | null;
        };
        Insert: {
          bet_slip_id: string;
          capper_id?: string | null;
          capper_name?: string | null;
          created_at?: string;
          data_quality_score?: number | null;
          form_data?: Json;
          game_id?: string | null;
          game_selections?: Json;
          id?: string;
          lane?: string | null;
          manual_reason?: string | null;
          manual_unscoped?: boolean | null;
          needs_review?: boolean | null;
          notes?: string | null;
          parlay_odds?: number | null;
          pick_data?: Json;
          processed_at?: string | null;
          published_at?: string | null;
          selection_count?: number | null;
          sport?: string | null;
          status?: string;
          submitted_at?: string;
          ticket_type?: string | null;
          total_units?: number | null;
          updated_at?: string;
          user_id?: string | null;
          validation_errors?: Json | null;
        };
        Update: {
          bet_slip_id?: string;
          capper_id?: string | null;
          capper_name?: string | null;
          created_at?: string;
          data_quality_score?: number | null;
          form_data?: Json;
          game_id?: string | null;
          game_selections?: Json;
          id?: string;
          lane?: string | null;
          manual_reason?: string | null;
          manual_unscoped?: boolean | null;
          needs_review?: boolean | null;
          notes?: string | null;
          parlay_odds?: number | null;
          pick_data?: Json;
          processed_at?: string | null;
          published_at?: string | null;
          selection_count?: number | null;
          sport?: string | null;
          status?: string;
          submitted_at?: string;
          ticket_type?: string | null;
          total_units?: number | null;
          updated_at?: string;
          user_id?: string | null;
          validation_errors?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_smart_tickets_user';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'smart_tickets_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'smart_tickets_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'smart_tickets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      sops: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sports_registry: {
        Row: {
          active: boolean | null;
          code: string;
          created_at: string | null;
          default_segment_type: string | null;
          display_name: string;
          has_segments: boolean | null;
          id: number;
          meta: Json | null;
          supports_live: boolean | null;
          supports_player_props: boolean | null;
        };
        Insert: {
          active?: boolean | null;
          code: string;
          created_at?: string | null;
          default_segment_type?: string | null;
          display_name: string;
          has_segments?: boolean | null;
          id?: number;
          meta?: Json | null;
          supports_live?: boolean | null;
          supports_player_props?: boolean | null;
        };
        Update: {
          active?: boolean | null;
          code?: string;
          created_at?: string | null;
          default_segment_type?: string | null;
          display_name?: string;
          has_segments?: boolean | null;
          id?: number;
          meta?: Json | null;
          supports_live?: boolean | null;
          supports_player_props?: boolean | null;
        };
        Relationships: [];
      };
      staff_access_codes: {
        Row: {
          attempts: number;
          code_hash: string;
          created_at: string;
          created_by: string | null;
          discord_id: string | null;
          expires_at: string;
          id: string;
          max_attempts: number;
          metadata: Json | null;
          status: string;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          created_at?: string;
          created_by?: string | null;
          discord_id?: string | null;
          expires_at: string;
          id?: string;
          max_attempts?: number;
          metadata?: Json | null;
          status?: string;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          created_at?: string;
          created_by?: string | null;
          discord_id?: string | null;
          expires_at?: string;
          id?: string;
          max_attempts?: number;
          metadata?: Json | null;
          status?: string;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          key: string;
          updated_at: string | null;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      system_status: {
        Row: {
          emergency_stop: boolean;
          id: number;
          maintenance_message: string | null;
          maintenance_mode: boolean;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          emergency_stop?: boolean;
          id?: number;
          maintenance_message?: string | null;
          maintenance_mode?: boolean;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          emergency_stop?: boolean;
          id?: number;
          maintenance_message?: string | null;
          maintenance_mode?: boolean;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          abbr: string;
          created_at: string;
          id: string;
          logo_url: string | null;
          meta: Json | null;
          name: string;
          sport: string;
          team_uuid: string;
          updated_at: string;
        };
        Insert: {
          abbr: string;
          created_at?: string;
          id: string;
          logo_url?: string | null;
          meta?: Json | null;
          name: string;
          sport: string;
          team_uuid?: string;
          updated_at?: string;
        };
        Update: {
          abbr?: string;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          meta?: Json | null;
          name?: string;
          sport?: string;
          team_uuid?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          domain: string | null;
          features: Json | null;
          id: string;
          limits: Json | null;
          metadata: Json | null;
          name: string;
          settings: Json | null;
          slug: string;
          status: string;
          subscription_expires_at: string | null;
          tier: string;
          trial_ends_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          domain?: string | null;
          features?: Json | null;
          id?: string;
          limits?: Json | null;
          metadata?: Json | null;
          name: string;
          settings?: Json | null;
          slug: string;
          status?: string;
          subscription_expires_at?: string | null;
          tier?: string;
          trial_ends_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          domain?: string | null;
          features?: Json | null;
          id?: string;
          limits?: Json | null;
          metadata?: Json | null;
          name?: string;
          settings?: Json | null;
          slug?: string;
          status?: string;
          subscription_expires_at?: string | null;
          tier?: string;
          trial_ends_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ticket_discord_outbox: {
        Row: {
          bet_slip_id: string;
          created_at: string;
          discord_channel_id: string | null;
          discord_message_id: string | null;
          error: string | null;
          id: string;
          posted_at: string | null;
          retry_count: number;
          status: string;
          ticket_id: string;
          updated_at: string;
        };
        Insert: {
          bet_slip_id: string;
          created_at?: string;
          discord_channel_id?: string | null;
          discord_message_id?: string | null;
          error?: string | null;
          id?: string;
          posted_at?: string | null;
          retry_count?: number;
          status?: string;
          ticket_id: string;
          updated_at?: string;
        };
        Update: {
          bet_slip_id?: string;
          created_at?: string;
          discord_channel_id?: string | null;
          discord_message_id?: string | null;
          error?: string | null;
          id?: string;
          posted_at?: string | null;
          retry_count?: number;
          status?: string;
          ticket_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_discord_outbox_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: true;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_legs: {
        Row: {
          actual_value: number | null;
          created_at: string | null;
          effective_source: string | null;
          effective_value: Json | null;
          event_id: string | null;
          id: string;
          leg_index: number;
          leg_status: string | null;
          market_type_id: number | null;
          meta: Json | null;
          offer_id: string | null;
          override_value: Json | null;
          participant_id: string | null;
          provider: string;
          provider_line: number | null;
          provider_odds: number | null;
          provider_value: Json | null;
          segment_type_id: number | null;
          selection: string;
          settled_at: string | null;
          settlement_source: string | null;
          ticket_id: string;
        };
        Insert: {
          actual_value?: number | null;
          created_at?: string | null;
          effective_source?: string | null;
          effective_value?: Json | null;
          event_id?: string | null;
          id?: string;
          leg_index: number;
          leg_status?: string | null;
          market_type_id?: number | null;
          meta?: Json | null;
          offer_id?: string | null;
          override_value?: Json | null;
          participant_id?: string | null;
          provider: string;
          provider_line?: number | null;
          provider_odds?: number | null;
          provider_value?: Json | null;
          segment_type_id?: number | null;
          selection: string;
          settled_at?: string | null;
          settlement_source?: string | null;
          ticket_id: string;
        };
        Update: {
          actual_value?: number | null;
          created_at?: string | null;
          effective_source?: string | null;
          effective_value?: Json | null;
          event_id?: string | null;
          id?: string;
          leg_index?: number;
          leg_status?: string | null;
          market_type_id?: number | null;
          meta?: Json | null;
          offer_id?: string | null;
          override_value?: Json | null;
          participant_id?: string | null;
          provider?: string;
          provider_line?: number | null;
          provider_odds?: number | null;
          provider_value?: Json | null;
          segment_type_id?: number | null;
          selection?: string;
          settled_at?: string | null;
          settlement_source?: string | null;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_legs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
          {
            foreignKeyName: 'ticket_legs_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'market_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_types_for_sport';
            referencedColumns: ['market_type_id'];
          },
          {
            foreignKeyName: 'ticket_legs_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'provider_offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'view_provider_offers_current_v3';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'ticket_legs_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_segment_type_id_fkey';
            columns: ['segment_type_id'];
            isOneToOne: false;
            referencedRelation: 'segment_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ticket_legs_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      tickets: {
        Row: {
          bet_slip_id: string | null;
          confidence: number | null;
          created_at: string | null;
          discord_message_id: string | null;
          id: string;
          meta: Json | null;
          posted_to_discord: boolean | null;
          potential_payout: number | null;
          professional_score: number | null;
          promotion_band: string | null;
          promotion_posted_at: string | null;
          settled_at: string | null;
          settlement_payout: number | null;
          settlement_result: string | null;
          source: string | null;
          status: string | null;
          ticket_type: string;
          tier: string | null;
          total_odds: number | null;
          total_stake: number;
          updated_at: string | null;
          user_id: string;
          workflow_stage: string | null;
        };
        Insert: {
          bet_slip_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          discord_message_id?: string | null;
          id?: string;
          meta?: Json | null;
          posted_to_discord?: boolean | null;
          potential_payout?: number | null;
          professional_score?: number | null;
          promotion_band?: string | null;
          promotion_posted_at?: string | null;
          settled_at?: string | null;
          settlement_payout?: number | null;
          settlement_result?: string | null;
          source?: string | null;
          status?: string | null;
          ticket_type: string;
          tier?: string | null;
          total_odds?: number | null;
          total_stake?: number;
          updated_at?: string | null;
          user_id: string;
          workflow_stage?: string | null;
        };
        Update: {
          bet_slip_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          discord_message_id?: string | null;
          id?: string;
          meta?: Json | null;
          posted_to_discord?: boolean | null;
          potential_payout?: number | null;
          professional_score?: number | null;
          promotion_band?: string | null;
          promotion_posted_at?: string | null;
          settled_at?: string | null;
          settlement_payout?: number | null;
          settlement_result?: string | null;
          source?: string | null;
          status?: string | null;
          ticket_type?: string;
          tier?: string | null;
          total_odds?: number | null;
          total_stake?: number;
          updated_at?: string | null;
          user_id?: string;
          workflow_stage?: string | null;
        };
        Relationships: [];
      };
      unified_picks: {
        Row: {
          actual_outcome: number | null;
          approved_at: string | null;
          approved_by: string | null;
          away_team_id: string | null;
          bet_line: number | null;
          bet_odds: number | null;
          bet_slip_id: string | null;
          bet_timestamp: string | null;
          bet_type: string | null;
          blocked_at: string | null;
          blocked_reason: string | null;
          capper_id: string | null;
          close_confidence_score: number | null;
          closing_book_count: number | null;
          closing_line: number | null;
          closing_odds: number | null;
          closing_source: string | null;
          clv_pct: number | null;
          clv_tracking_id: string | null;
          confidence: number | null;
          consensus_spread: number | null;
          created_at: string;
          data_quality_reasons: Json | null;
          data_quality_score: number | null;
          devigged_edge: number | null;
          discord_message_id: string | null;
          discord_thread_id: string | null;
          divergence_flag: boolean | null;
          external_game_id: string | null;
          external_prop_id: string | null;
          failed_at: string | null;
          failed_reason: string | null;
          feature_contributions: Json | null;
          form_source: string | null;
          game_date: string;
          game_id: string | null;
          game_start_time: string | null;
          home_team_id: string | null;
          id: string;
          is_live: boolean | null;
          kelly_fraction: number | null;
          lane: string | null;
          leg_index: number;
          legacy_pick_id: string | null;
          line: number | null;
          line_move_abs: number | null;
          line_move_pct: number | null;
          manual_fields_blob: Json | null;
          manual_game_date: string | null;
          manual_matchup_away: string | null;
          manual_matchup_home: string | null;
          manual_reason: string | null;
          manual_unscoped: boolean | null;
          market: string;
          market_reaction: string | null;
          matchup: string | null;
          meta: Json | null;
          needs_review: boolean | null;
          odds: number;
          odds_decimal: number | null;
          parlay_id: string | null;
          payout_amount: number | null;
          pick_type: string | null;
          placed_at: string | null;
          player_id: string | null;
          player_name: string | null;
          posted_to_discord: boolean | null;
          professional_score: number | null;
          promotion_band: string | null;
          promotion_fingerprint: string | null;
          promotion_posted_at: string | null;
          promotion_queued_at: string | null;
          promotion_status: string | null;
          provider: string | null;
          publish_at: string | null;
          queue_status: string | null;
          rejected_at: string | null;
          rejected_by: string | null;
          rejected_reason: string | null;
          selection: string | null;
          selection_team_id: string | null;
          selection_type: string | null;
          settled_at: string | null;
          settlement_result: string | null;
          settlement_source: string | null;
          settlement_status: string | null;
          sharp_fade: boolean | null;
          side: string;
          source: string | null;
          sport: string;
          stake: number | null;
          stat_type: string | null;
          status: string | null;
          steam_velocity: number | null;
          team_id: string | null;
          tenant_id: string | null;
          ticket_type: string | null;
          tier: string | null;
          total_ticket_odds_american: number | null;
          total_ticket_odds_decimal: number | null;
          total_units: number | null;
          trace_id: string;
          units: number | null;
          updated_at: string;
          user_id: string | null;
          weighted_close_line: number | null;
          weighted_close_odds: number | null;
          workflow_stage: string | null;
        };
        Insert: {
          actual_outcome?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          away_team_id?: string | null;
          bet_line?: number | null;
          bet_odds?: number | null;
          bet_slip_id?: string | null;
          bet_timestamp?: string | null;
          bet_type?: string | null;
          blocked_at?: string | null;
          blocked_reason?: string | null;
          capper_id?: string | null;
          close_confidence_score?: number | null;
          closing_book_count?: number | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_source?: string | null;
          clv_pct?: number | null;
          clv_tracking_id?: string | null;
          confidence?: number | null;
          consensus_spread?: number | null;
          created_at?: string;
          data_quality_reasons?: Json | null;
          data_quality_score?: number | null;
          devigged_edge?: number | null;
          discord_message_id?: string | null;
          discord_thread_id?: string | null;
          divergence_flag?: boolean | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          failed_at?: string | null;
          failed_reason?: string | null;
          feature_contributions?: Json | null;
          form_source?: string | null;
          game_date?: string;
          game_id?: string | null;
          game_start_time?: string | null;
          home_team_id?: string | null;
          id?: string;
          is_live?: boolean | null;
          kelly_fraction?: number | null;
          lane?: string | null;
          leg_index?: number;
          legacy_pick_id?: string | null;
          line?: number | null;
          line_move_abs?: number | null;
          line_move_pct?: number | null;
          manual_fields_blob?: Json | null;
          manual_game_date?: string | null;
          manual_matchup_away?: string | null;
          manual_matchup_home?: string | null;
          manual_reason?: string | null;
          manual_unscoped?: boolean | null;
          market?: string;
          market_reaction?: string | null;
          matchup?: string | null;
          meta?: Json | null;
          needs_review?: boolean | null;
          odds: number;
          odds_decimal?: number | null;
          parlay_id?: string | null;
          payout_amount?: number | null;
          pick_type?: string | null;
          placed_at?: string | null;
          player_id?: string | null;
          player_name?: string | null;
          posted_to_discord?: boolean | null;
          professional_score?: number | null;
          promotion_band?: string | null;
          promotion_fingerprint?: string | null;
          promotion_posted_at?: string | null;
          promotion_queued_at?: string | null;
          promotion_status?: string | null;
          provider?: string | null;
          publish_at?: string | null;
          queue_status?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejected_reason?: string | null;
          selection?: string | null;
          selection_team_id?: string | null;
          selection_type?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_source?: string | null;
          settlement_status?: string | null;
          sharp_fade?: boolean | null;
          side?: string;
          source?: string | null;
          sport: string;
          stake?: number | null;
          stat_type?: string | null;
          status?: string | null;
          steam_velocity?: number | null;
          team_id?: string | null;
          tenant_id?: string | null;
          ticket_type?: string | null;
          tier?: string | null;
          total_ticket_odds_american?: number | null;
          total_ticket_odds_decimal?: number | null;
          total_units?: number | null;
          trace_id?: string;
          units?: number | null;
          updated_at?: string;
          user_id?: string | null;
          weighted_close_line?: number | null;
          weighted_close_odds?: number | null;
          workflow_stage?: string | null;
        };
        Update: {
          actual_outcome?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          away_team_id?: string | null;
          bet_line?: number | null;
          bet_odds?: number | null;
          bet_slip_id?: string | null;
          bet_timestamp?: string | null;
          bet_type?: string | null;
          blocked_at?: string | null;
          blocked_reason?: string | null;
          capper_id?: string | null;
          close_confidence_score?: number | null;
          closing_book_count?: number | null;
          closing_line?: number | null;
          closing_odds?: number | null;
          closing_source?: string | null;
          clv_pct?: number | null;
          clv_tracking_id?: string | null;
          confidence?: number | null;
          consensus_spread?: number | null;
          created_at?: string;
          data_quality_reasons?: Json | null;
          data_quality_score?: number | null;
          devigged_edge?: number | null;
          discord_message_id?: string | null;
          discord_thread_id?: string | null;
          divergence_flag?: boolean | null;
          external_game_id?: string | null;
          external_prop_id?: string | null;
          failed_at?: string | null;
          failed_reason?: string | null;
          feature_contributions?: Json | null;
          form_source?: string | null;
          game_date?: string;
          game_id?: string | null;
          game_start_time?: string | null;
          home_team_id?: string | null;
          id?: string;
          is_live?: boolean | null;
          kelly_fraction?: number | null;
          lane?: string | null;
          leg_index?: number;
          legacy_pick_id?: string | null;
          line?: number | null;
          line_move_abs?: number | null;
          line_move_pct?: number | null;
          manual_fields_blob?: Json | null;
          manual_game_date?: string | null;
          manual_matchup_away?: string | null;
          manual_matchup_home?: string | null;
          manual_reason?: string | null;
          manual_unscoped?: boolean | null;
          market?: string;
          market_reaction?: string | null;
          matchup?: string | null;
          meta?: Json | null;
          needs_review?: boolean | null;
          odds?: number;
          odds_decimal?: number | null;
          parlay_id?: string | null;
          payout_amount?: number | null;
          pick_type?: string | null;
          placed_at?: string | null;
          player_id?: string | null;
          player_name?: string | null;
          posted_to_discord?: boolean | null;
          professional_score?: number | null;
          promotion_band?: string | null;
          promotion_fingerprint?: string | null;
          promotion_posted_at?: string | null;
          promotion_queued_at?: string | null;
          promotion_status?: string | null;
          provider?: string | null;
          publish_at?: string | null;
          queue_status?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejected_reason?: string | null;
          selection?: string | null;
          selection_team_id?: string | null;
          selection_type?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_source?: string | null;
          settlement_status?: string | null;
          sharp_fade?: boolean | null;
          side?: string;
          source?: string | null;
          sport?: string;
          stake?: number | null;
          stat_type?: string | null;
          status?: string | null;
          steam_velocity?: number | null;
          team_id?: string | null;
          tenant_id?: string | null;
          ticket_type?: string | null;
          tier?: string | null;
          total_ticket_odds_american?: number | null;
          total_ticket_odds_decimal?: number | null;
          total_units?: number | null;
          trace_id?: string;
          units?: number | null;
          updated_at?: string;
          user_id?: string | null;
          weighted_close_line?: number | null;
          weighted_close_odds?: number | null;
          workflow_stage?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_approved_by';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_players_v1';
            referencedColumns: ['player_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'mv_players_search';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_rejected_by';
            columns: ['rejected_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unified_picks_capper_id_fkey';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      unified_picks_duplicate_archive: {
        Row: {
          archive_id: string;
          archive_reason: string;
          archived_at: string;
          bet_slip_id: string | null;
          canonical_pick_id: string | null;
          capper_id: string | null;
          confidence: number | null;
          created_at: string | null;
          line: number | null;
          odds: number | null;
          original_id: string;
          original_row_data: Json;
          posted_to_discord: boolean | null;
          professional_score: number | null;
          selection: string | null;
          settled_at: string | null;
          settlement_result: string | null;
          settlement_status: string | null;
          sport: string | null;
          stat_type: string | null;
          tier: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          archive_id?: string;
          archive_reason: string;
          archived_at?: string;
          bet_slip_id?: string | null;
          canonical_pick_id?: string | null;
          capper_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          line?: number | null;
          odds?: number | null;
          original_id: string;
          original_row_data: Json;
          posted_to_discord?: boolean | null;
          professional_score?: number | null;
          selection?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_status?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          tier?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          archive_id?: string;
          archive_reason?: string;
          archived_at?: string;
          bet_slip_id?: string | null;
          canonical_pick_id?: string | null;
          capper_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          line?: number | null;
          odds?: number | null;
          original_id?: string;
          original_row_data?: Json;
          posted_to_discord?: boolean | null;
          professional_score?: number | null;
          selection?: string | null;
          settled_at?: string | null;
          settlement_result?: string | null;
          settlement_status?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          tier?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          created_at: string;
          discord_id: string;
          is_active: boolean;
          preferences: Json | null;
          tier: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          discord_id: string;
          is_active?: boolean;
          preferences?: Json | null;
          tier?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          discord_id?: string;
          is_active?: boolean;
          preferences?: Json | null;
          tier?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          active: boolean;
          capper_tier: string | null;
          created_at: string;
          discord_id: string;
          id: string;
          is_active: boolean;
          meta: Json | null;
          role: string;
          tenant_id: string;
          tier: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          active?: boolean;
          capper_tier?: string | null;
          created_at?: string;
          discord_id: string;
          id?: string;
          is_active?: boolean;
          meta?: Json | null;
          role?: string;
          tenant_id: string;
          tier?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          active?: boolean;
          capper_tier?: string | null;
          created_at?: string;
          discord_id?: string;
          id?: string;
          is_active?: boolean;
          meta?: Json | null;
          role?: string;
          tenant_id?: string;
          tier?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      vip_notification_sequences: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          sequence_data: Json | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sequence_data?: Json | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sequence_data?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      catalog_players_v1: {
        Row: {
          aliases: Json | null;
          contract_version: string | null;
          external_player_id: string | null;
          headshot_url: string | null;
          last_updated: string | null;
          player_id: string | null;
          player_name: string | null;
          position: string | null;
          search_text: string | null;
          sport: string | null;
          team_abbr: string | null;
          team_id: string | null;
          team_name: string | null;
        };
        Relationships: [];
      };
      catalog_teams_v1: {
        Row: {
          aliases: Json | null;
          contract_version: string | null;
          external_team_id: string | null;
          last_updated: string | null;
          logo_url: string | null;
          search_text: string | null;
          sport: string | null;
          team_abbr: string | null;
          team_id: string | null;
          team_name: string | null;
        };
        Insert: {
          aliases?: never;
          contract_version?: never;
          external_team_id?: string | null;
          last_updated?: string | null;
          logo_url?: string | null;
          search_text?: never;
          sport?: string | null;
          team_abbr?: string | null;
          team_id?: string | null;
          team_name?: string | null;
        };
        Update: {
          aliases?: never;
          contract_version?: never;
          external_team_id?: string | null;
          last_updated?: string | null;
          logo_url?: string | null;
          search_text?: never;
          sport?: string | null;
          team_abbr?: string | null;
          team_id?: string | null;
          team_name?: string | null;
        };
        Relationships: [];
      };
      inventory_props_for_form_v1: {
        Row: {
          away_team: string | null;
          book: string | null;
          contract_version: string | null;
          display_label: string | null;
          game_date: string | null;
          game_id: string | null;
          home_team: string | null;
          last_updated: string | null;
          line: number | null;
          market_key: string | null;
          matchup: string | null;
          over_odds: number | null;
          player_name: string | null;
          prop_id: string | null;
          prop_key: string | null;
          sport: string | null;
          start_time: string | null;
          team_abbr: string | null;
          under_odds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
        ];
      };
      manual_inventory_for_form_v1: {
        Row: {
          avg_line: number | null;
          avg_odds: number | null;
          contract_version: string | null;
          count_recent: number | null;
          last_seen_at: string | null;
          market_key: string | null;
          max_line: number | null;
          min_line: number | null;
          player_id: string | null;
          player_name: string | null;
          sport: string | null;
          team_abbr: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_players_v1';
            referencedColumns: ['player_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'mv_players_search';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_player_id';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      market_taxonomy_v1: {
        Row: {
          aliases: string[] | null;
          bet_type: string | null;
          category: string | null;
          contract_version: string | null;
          display_name: string | null;
          id: string | null;
          last_updated: string | null;
          market_key: string | null;
          sort_order: number | null;
          sport: string | null;
        };
        Insert: {
          aliases?: string[] | null;
          bet_type?: string | null;
          category?: string | null;
          contract_version?: never;
          display_name?: string | null;
          id?: string | null;
          last_updated?: string | null;
          market_key?: string | null;
          sort_order?: number | null;
          sport?: string | null;
        };
        Update: {
          aliases?: string[] | null;
          bet_type?: string | null;
          category?: string | null;
          contract_version?: never;
          display_name?: string | null;
          id?: string | null;
          last_updated?: string | null;
          market_key?: string | null;
          sort_order?: number | null;
          sport?: string | null;
        };
        Relationships: [];
      };
      market_usage_stats_v1: {
        Row: {
          contract_version: string | null;
          last_used_at: string | null;
          market_key: string | null;
          sport: string | null;
          unique_players: number | null;
          usage_count: number | null;
        };
        Relationships: [];
      };
      mv_capper_daily_rollup: {
        Row: {
          capper_id: string | null;
          capper_name: string | null;
          day: string | null;
          losses: number | null;
          picks: number | null;
          pushes: number | null;
          roi: number | null;
          units_profit: number | null;
          units_wagered: number | null;
          wins: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'unified_picks_capper_id_fkey';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      mv_capper_recent_performance: {
        Row: {
          capper_id: string | null;
          handle: string | null;
          losses: number | null;
          picks_count: number | null;
          win_rate: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
      mv_capper_stats_by_bet_type: {
        Row: {
          bet_type: string | null;
          capper_id: string | null;
          handle: string | null;
          losses: number | null;
          total_picks: number | null;
          win_rate: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
      mv_capper_stats_by_sport: {
        Row: {
          capper_id: string | null;
          handle: string | null;
          losses: number | null;
          sport: string | null;
          total_picks: number | null;
          win_rate: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
      mv_capper_stats_lifetime: {
        Row: {
          capper_id: string | null;
          display_name: string | null;
          handle: string | null;
          losses: number | null;
          net_units: number | null;
          pushes: number | null;
          total_picks: number | null;
          win_rate: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
      mv_current_markets: {
        Row: {
          line: number | null;
          over_odds: number | null;
          player_name: string | null;
          sport: string | null;
          stat_type: string | null;
          under_odds: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      mv_players_search: {
        Row: {
          active: boolean | null;
          full_name: string | null;
          headshot_url: string | null;
          id: string | null;
          normalized_name: string | null;
          position: string | null;
          search_key: string | null;
          sport: string | null;
          team_abbr: string | null;
          team_id: string | null;
        };
        Relationships: [];
      };
      mv_props_for_form: {
        Row: {
          away_team: string | null;
          created_at: string | null;
          display_label: string | null;
          game_date: string | null;
          game_id: string | null;
          game_start_time: string | null;
          home_team: string | null;
          id: string | null;
          line: number | null;
          over_odds: number | null;
          player_name: string | null;
          source: string | null;
          sport: string | null;
          stat_type: string | null;
          team: string | null;
          under_odds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_raw_props_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
        ];
      };
      mv_search_games: {
        Row: {
          away_team: string | null;
          away_team_meta: Json | null;
          created_at: string | null;
          display_label: string | null;
          external_game_id: string | null;
          game_date: string | null;
          home_team: string | null;
          home_team_meta: Json | null;
          id: string | null;
          league: string | null;
          meta: Json | null;
          moneyline_away: number | null;
          moneyline_home: number | null;
          sport: string | null;
          spread: number | null;
          start_time: string | null;
          status: string | null;
          total: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      mv_search_players: {
        Row: {
          aliases: Json | null;
          created_at: string | null;
          headshot_url: string | null;
          id: string | null;
          name: string | null;
          position: string | null;
          search_text: string | null;
          sport: string | null;
          team_abbr: string | null;
          team_id: string | null;
          team_name: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      mv_search_teams: {
        Row: {
          abbr: string | null;
          aliases: Json | null;
          created_at: string | null;
          deprecated: boolean | null;
          id: string | null;
          logo_url: string | null;
          name: string | null;
          search_text: string | null;
          sport: string | null;
          team_uuid: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      mv_teams_search: {
        Row: {
          abbr: string | null;
          id: string | null;
          logo_url: string | null;
          meta: Json | null;
          name: string | null;
          sport: string | null;
        };
        Relationships: [];
      };
      picks: {
        Row: {
          bet_slip_id: string | null;
          confidence: number | null;
          created_at: string | null;
          game_id: string | null;
          id: string | null;
          metadata: Json | null;
          odds: number | null;
          original_pick_id: string | null;
          selection: string | null;
          stake: number | null;
          status: string | null;
          tenant_id: string | null;
          updated_at: string | null;
          user_id: string | null;
          workflow_stage: string | null;
        };
        Insert: {
          bet_slip_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          game_id?: string | null;
          id?: string | null;
          metadata?: Json | null;
          odds?: number | null;
          original_pick_id?: string | null;
          selection?: string | null;
          stake?: number | null;
          status?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          workflow_stage?: string | null;
        };
        Update: {
          bet_slip_id?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          game_id?: string | null;
          id?: string | null;
          metadata?: Json | null;
          odds?: number | null;
          original_pick_id?: string | null;
          selection?: string | null;
          stake?: number | null;
          status?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          workflow_stage?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_game_id';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'mv_search_games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_active_injuries: {
        Row: {
          expected_return: string | null;
          impact_rating: number | null;
          injury_detail: string | null;
          injury_type: string | null;
          pending_prop_count: number | null;
          player_name: string | null;
          roster_impact: string | null;
          sport: string | null;
          status: string | null;
          team: string | null;
          updated_at: string | null;
        };
        Insert: {
          expected_return?: string | null;
          impact_rating?: number | null;
          injury_detail?: string | null;
          injury_type?: string | null;
          pending_prop_count?: never;
          player_name?: string | null;
          roster_impact?: string | null;
          sport?: string | null;
          status?: string | null;
          team?: string | null;
          updated_at?: string | null;
        };
        Update: {
          expected_return?: string | null;
          impact_rating?: number | null;
          injury_detail?: string | null;
          injury_type?: string | null;
          pending_prop_count?: never;
          player_name?: string | null;
          roster_impact?: string | null;
          sport?: string | null;
          status?: string | null;
          team?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      v_attribution_summary_daily: {
        Row: {
          avg_contribution: number | null;
          daily_weighted_profit: number | null;
          feature_name: string | null;
          pick_count: number | null;
          settled_date: string | null;
        };
        Relationships: [];
      };
      v_capper_rolling_rollup: {
        Row: {
          capper_id: string | null;
          capper_name: string | null;
          losses: number | null;
          picks: number | null;
          pushes: number | null;
          roi: number | null;
          units_profit: number | null;
          units_wagered: number | null;
          window_days: number | null;
          wins: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'unified_picks_capper_id_fkey';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_capper_streaks: {
        Row: {
          capper_id: string | null;
          capper_name: string | null;
          current_streak_len: number | null;
          current_streak_type: string | null;
          last_10_losses: number | null;
          last_10_pushes: number | null;
          last_10_summary: string | null;
          last_10_wins: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'unified_picks_capper_id_fkey';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_clv_analysis: {
        Row: {
          beat_closing_line: boolean | null;
          bet_line: number | null;
          bet_odds: number | null;
          bet_timestamp: string | null;
          capper_username: string | null;
          closing_line: number | null;
          closing_odds: number | null;
          clv_line_delta: number | null;
          clv_pct: number | null;
          created_at: string | null;
          pick_id: string | null;
          player_name: string | null;
          settled_at: string | null;
          settlement_status: string | null;
          side: string | null;
          sport: string | null;
          stat_type: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_clv_by_capper: {
        Row: {
          avg_clv_pct: number | null;
          beat_closing_rate: number | null;
          capper_tier: string | null;
          capper_username: string | null;
          picks_with_clv: number | null;
          total_picks: number | null;
          user_id: string | null;
          win_rate: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_user_id';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_clv_dashboard_stats: {
        Row: {
          avg_clv_pct: number | null;
          beat_closing_rate: number | null;
          clv_positive_picks: number | null;
          date: string | null;
          picks_with_clv_data: number | null;
          total_settled_picks: number | null;
        };
        Relationships: [];
      };
      v_daily_board: {
        Row: {
          confidence: number | null;
          created_at: string | null;
          edge: number | null;
          game_date: string | null;
          line: number | null;
          market: string | null;
          odds: number | null;
          opponent: string | null;
          player_name: string | null;
          prob_win: number | null;
          professional_score: number | null;
          prop_ref: string | null;
          selection: string | null;
          sport: string | null;
          team: string | null;
          tier: string | null;
        };
        Relationships: [];
      };
      v_daily_data_health: {
        Row: {
          active_models: number | null;
          hit_rate_7d: number | null;
          line_snapshots_24h: number | null;
          player_stats_updated_7d: number | null;
          predictions_24h: number | null;
          props_with_outcomes: number | null;
          report_date: string | null;
          total_historical_props: number | null;
          unique_props_tracked_24h: number | null;
        };
        Relationships: [];
      };
      v_feature_by_odds_bucket: {
        Row: {
          avg_contribution: number | null;
          avg_profit_per_pick: number | null;
          feature_name: string | null;
          odds_bucket: string | null;
          pick_count: number | null;
          weighted_profit: number | null;
        };
        Relationships: [];
      };
      v_feature_by_tier: {
        Row: {
          avg_contribution: number | null;
          avg_profit_per_pick: number | null;
          feature_name: string | null;
          pick_count: number | null;
          tier: string | null;
          win_rate: number | null;
        };
        Relationships: [];
      };
      v_feature_profit_attribution: {
        Row: {
          avg_contribution: number | null;
          avg_profit_per_pick: number | null;
          feature_name: string | null;
          pick_count: number | null;
          stddev_contribution: number | null;
          weighted_profit: number | null;
          win_rate: number | null;
        };
        Relationships: [];
      };
      v_feature_profit_by_sport: {
        Row: {
          avg_contribution: number | null;
          avg_profit_per_pick: number | null;
          feature_name: string | null;
          pick_count: number | null;
          sport: string | null;
          weighted_profit: number | null;
          win_rate: number | null;
        };
        Relationships: [];
      };
      v_feature_volatility: {
        Row: {
          avg_weighted_profit: number | null;
          feature_name: string | null;
          pick_count: number | null;
          risk_classification: string | null;
          stddev_weighted_profit: number | null;
          volatility_ratio: number | null;
        };
        Relationships: [];
      };
      v_feature_win_loss_distribution: {
        Row: {
          avg_contribution_losses: number | null;
          avg_contribution_wins: number | null;
          feature_name: string | null;
          loss_count: number | null;
          signal_type: string | null;
          win_count: number | null;
          win_loss_diff: number | null;
        };
        Relationships: [];
      };
      v_historical_coverage: {
        Row: {
          avg_clv: number | null;
          beat_closing_rate: number | null;
          earliest_date: string | null;
          latest_date: string | null;
          sport: string | null;
          stat_type: string | null;
          total_props: number | null;
          unique_players: number | null;
          with_closing_comparison: number | null;
          with_clv: number | null;
          with_outcomes: number | null;
        };
        Relationships: [];
      };
      v_historical_data_coverage: {
        Row: {
          earliest_date: string | null;
          latest_date: string | null;
          sport: string | null;
          total_props: number | null;
          unique_players: number | null;
          unique_stat_types: number | null;
          with_closing_line: number | null;
          with_clv: number | null;
          with_grading: number | null;
          with_opening_line: number | null;
          with_outcome: number | null;
        };
        Relationships: [];
      };
      v_injury_prop_impact: {
        Row: {
          affected_stat_types: number | null;
          impact_rating: number | null;
          injury_type: string | null;
          next_game_time: string | null;
          player_name: string | null;
          sport: string | null;
          status: string | null;
          team: string | null;
          total_affected_props: number | null;
        };
        Relationships: [];
      };
      v_level3_close_intelligence: {
        Row: {
          bet_line: number | null;
          close_confidence_score: number | null;
          close_quality: string | null;
          closing_book_count: number | null;
          closing_line: number | null;
          closing_source: string | null;
          clv_pct: number | null;
          consensus_spread: number | null;
          created_at: string | null;
          divergence_flag: boolean | null;
          pick_id: string | null;
          player_name: string | null;
          settlement_status: string | null;
          side: string | null;
          sport: string | null;
          stat_type: string | null;
          steam_velocity: number | null;
          weighted_close_line: number | null;
          weighted_close_odds: number | null;
        };
        Insert: {
          bet_line?: number | null;
          close_confidence_score?: number | null;
          close_quality?: never;
          closing_book_count?: number | null;
          closing_line?: number | null;
          closing_source?: string | null;
          clv_pct?: number | null;
          consensus_spread?: number | null;
          created_at?: string | null;
          divergence_flag?: boolean | null;
          pick_id?: string | null;
          player_name?: string | null;
          settlement_status?: string | null;
          side?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          steam_velocity?: number | null;
          weighted_close_line?: number | null;
          weighted_close_odds?: number | null;
        };
        Update: {
          bet_line?: number | null;
          close_confidence_score?: number | null;
          close_quality?: never;
          closing_book_count?: number | null;
          closing_line?: number | null;
          closing_source?: string | null;
          clv_pct?: number | null;
          consensus_spread?: number | null;
          created_at?: string | null;
          divergence_flag?: boolean | null;
          pick_id?: string | null;
          player_name?: string | null;
          settlement_status?: string | null;
          side?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          steam_velocity?: number | null;
          weighted_close_line?: number | null;
          weighted_close_odds?: number | null;
        };
        Relationships: [];
      };
      v_model_performance: {
        Row: {
          avg_edge_taken: number | null;
          backtest_roi: number | null;
          backtest_win_rate: number | null;
          live_hit_rate: number | null;
          live_mae: number | null;
          model_id: string | null;
          model_name: string | null;
          model_type: string | null;
          model_version: string | null;
          settled_predictions: number | null;
          sport: string | null;
          stat_type: string | null;
          status: string | null;
          total_predictions: number | null;
          validation_hit_rate: number | null;
          validation_mae: number | null;
          validation_rmse: number | null;
        };
        Relationships: [];
      };
      v_pick_timeline: {
        Row: {
          bet_slip_id: string | null;
          capper: string | null;
          is_published: boolean | null;
          lifecycle_sla: string | null;
          odds: number | null;
          outbox_id: string | null;
          pick_id: string | null;
          pick_status: string | null;
          publish_attempts: number | null;
          publish_error: string | null;
          publish_status: string | null;
          run_id: string | null;
          seconds_in_queue: number | null;
          seconds_to_queue: number | null;
          selection: string | null;
          stage_ingested: string | null;
          stage_promoted: string | null;
          stage_publish_completed: string | null;
          stage_publish_queued: string | null;
          stage_settled: string | null;
          stage_workflow_completed: string | null;
          stage_workflow_started: string | null;
          stake: number | null;
          stuck_status: string | null;
          total_lifecycle_seconds: number | null;
          trace_id: string | null;
          workflow_duration_seconds: number | null;
          workflow_error: string | null;
          workflow_id: string | null;
          workflow_stage: string | null;
          workflow_status: string | null;
        };
        Relationships: [];
      };
      v_player_stats_completeness: {
        Row: {
          avg_data_quality: number | null;
          avg_games_played: number | null;
          last_update: string | null;
          players_qualified: number | null;
          players_with_sample: number | null;
          season: string | null;
          sport: string | null;
          total_players: number | null;
        };
        Relationships: [];
      };
      v_promo_backlog: {
        Row: {
          capper_id: string | null;
          created_at: string | null;
          hours_waiting: number | null;
          id: string | null;
          line: number | null;
          origin: string | null;
          player_name: string | null;
          source: string | null;
          sport: string | null;
          stat_type: string | null;
          workflow_stage: string | null;
        };
        Insert: {
          capper_id?: string | null;
          created_at?: string | null;
          hours_waiting?: never;
          id?: string | null;
          line?: number | null;
          origin?: never;
          player_name?: string | null;
          source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          workflow_stage?: string | null;
        };
        Update: {
          capper_id?: string | null;
          created_at?: string | null;
          hours_waiting?: never;
          id?: string | null;
          line?: number | null;
          origin?: never;
          player_name?: string | null;
          source?: string | null;
          sport?: string | null;
          stat_type?: string | null;
          workflow_stage?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: '_deprecated_cappers_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_recent_performance';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_bet_type';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_by_sport';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'fk_unified_picks_capper';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'mv_capper_stats_lifetime';
            referencedColumns: ['capper_id'];
          },
          {
            foreignKeyName: 'unified_picks_capper_id_fkey';
            columns: ['capper_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_prop_read_model: {
        Row: {
          created_at: string | null;
          edge: number | null;
          game_date: string | null;
          line: number | null;
          market: string | null;
          odds: number | null;
          opponent: string | null;
          player_name: string | null;
          prob_win: number | null;
          professional_score: number | null;
          prop_ref: string | null;
          queue_status: string | null;
          selection: string | null;
          source: string | null;
          sport: string | null;
          team: string | null;
          tier: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      v_recent_injury_changes: {
        Row: {
          change_type: string | null;
          new_status: string | null;
          old_status: string | null;
          player_name: string | null;
          source: string | null;
          sport: string | null;
          status_changed_at: string | null;
          team: string | null;
        };
        Insert: {
          change_type?: never;
          new_status?: string | null;
          old_status?: string | null;
          player_name?: string | null;
          source?: string | null;
          sport?: string | null;
          status_changed_at?: string | null;
          team?: string | null;
        };
        Update: {
          change_type?: never;
          new_status?: string | null;
          old_status?: string | null;
          player_name?: string | null;
          source?: string | null;
          sport?: string | null;
          status_changed_at?: string | null;
          team?: string | null;
        };
        Relationships: [];
      };
      v_recent_promotions_24h: {
        Row: {
          id: string | null;
          metadata: Json | null;
          occurred_at: string | null;
          processing_time_ms: number | null;
          raw_prop_id: string | null;
          reason: string | null;
          success: boolean | null;
        };
        Insert: {
          id?: string | null;
          metadata?: never;
          occurred_at?: never;
          processing_time_ms?: never;
          raw_prop_id?: string | null;
          reason?: string | null;
          success?: never;
        };
        Update: {
          id?: string | null;
          metadata?: never;
          occurred_at?: never;
          processing_time_ms?: never;
          raw_prop_id?: string | null;
          reason?: string | null;
          success?: never;
        };
        Relationships: [];
      };
      v_stuck_picks: {
        Row: {
          bet_slip_id: string | null;
          capper: string | null;
          is_published: boolean | null;
          lifecycle_sla: string | null;
          odds: number | null;
          outbox_id: string | null;
          pick_id: string | null;
          pick_status: string | null;
          publish_attempts: number | null;
          publish_error: string | null;
          publish_status: string | null;
          run_id: string | null;
          seconds_in_queue: number | null;
          seconds_to_queue: number | null;
          selection: string | null;
          stage_ingested: string | null;
          stage_promoted: string | null;
          stage_publish_completed: string | null;
          stage_publish_queued: string | null;
          stage_settled: string | null;
          stage_workflow_completed: string | null;
          stage_workflow_started: string | null;
          stake: number | null;
          stuck_status: string | null;
          total_lifecycle_seconds: number | null;
          trace_id: string | null;
          workflow_duration_seconds: number | null;
          workflow_error: string | null;
          workflow_id: string | null;
          workflow_stage: string | null;
          workflow_status: string | null;
        };
        Relationships: [];
      };
      v_trace_spine_health: {
        Row: {
          avg_lifecycle_seconds: number | null;
          avg_seconds_in_queue: number | null;
          avg_seconds_to_queue: number | null;
          avg_workflow_duration: number | null;
          failed_count: number | null;
          max_lifecycle_seconds: number | null;
          max_seconds_in_queue: number | null;
          max_seconds_to_queue: number | null;
          max_workflow_duration: number | null;
          overall_health: string | null;
          sla_fail_count: number | null;
          sla_pass_count: number | null;
          sla_pass_rate: number | null;
          sla_warn_count: number | null;
          stuck_count: number | null;
          stuck_in_queue: number | null;
          stuck_in_workflow: number | null;
          total_picks_24h: number | null;
        };
        Relationships: [];
      };
      v_unified_picks_health_24h: {
        Row: {
          computed_at: string | null;
          duplicate_fingerprints: number | null;
          manual_picks_24h: number | null;
          missing_prop_ids: number | null;
          system_picks_24h: number | null;
          total_picks_24h: number | null;
          writer_audit_percentage: number | null;
        };
        Relationships: [];
      };
      v_unit_talk_aggregate_rollups: {
        Row: {
          active_cappers: number | null;
          losses: number | null;
          picks: number | null;
          pushes: number | null;
          roi: number | null;
          scope: string | null;
          units_profit: number | null;
          units_wagered: number | null;
          window_days: number | null;
          wins: number | null;
        };
        Relationships: [];
      };
      view_best_offer_by_market: {
        Row: {
          best_away_odds: number | null;
          best_away_provider: string | null;
          best_home_odds: number | null;
          best_home_provider: string | null;
          best_over_line: number | null;
          best_over_odds: number | null;
          best_over_provider: string | null;
          best_over_provider_id: number | null;
          best_under_line: number | null;
          best_under_odds: number | null;
          best_under_provider: string | null;
          best_under_provider_id: number | null;
          event_id: string | null;
          market_key: string | null;
          market_name: string | null;
          market_type_id: number | null;
          newest_snapshot: string | null;
          oldest_snapshot: string | null;
          participant_id: string | null;
          participant_name: string | null;
          provider_count: number | null;
          segment_type: string | null;
          segment_type_id: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'market_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_types_for_sport';
            referencedColumns: ['market_type_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_segment_type_id_fkey';
            columns: ['segment_type_id'];
            isOneToOne: false;
            referencedRelation: 'segment_types';
            referencedColumns: ['id'];
          },
        ];
      };
      view_events_for_form: {
        Row: {
          away_display: string | null;
          away_participant_id: string | null;
          away_team: string | null;
          created_at: string | null;
          event_type: string | null;
          external_id: string | null;
          home_display: string | null;
          home_participant_id: string | null;
          home_team: string | null;
          id: string | null;
          league: string | null;
          meta: Json | null;
          scheduled_at: string | null;
          sport: string | null;
          status: string | null;
          venue: string | null;
        };
        Relationships: [];
      };
      view_identity_status_summary: {
        Row: {
          quarantined: number | null;
          quarantined_percent: number | null;
          resolved: number | null;
          resolved_percent: number | null;
          sport: string | null;
          total_players: number | null;
          unlinked: number | null;
        };
        Relationships: [];
      };
      view_market_groups_hierarchy: {
        Row: {
          code: string | null;
          display_name: string | null;
          id: number | null;
          market_count: number | null;
          parent_code: string | null;
          parent_group_id: number | null;
          parent_name: string | null;
          sort_order: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'market_groups_parent_group_id_fkey';
            columns: ['parent_group_id'];
            isOneToOne: false;
            referencedRelation: 'market_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'market_groups_parent_group_id_fkey';
            columns: ['parent_group_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_groups_hierarchy';
            referencedColumns: ['id'];
          },
        ];
      };
      view_market_types_for_sport: {
        Row: {
          display_name: string | null;
          is_derivative: boolean | null;
          is_future: boolean | null;
          league: string | null;
          market_group: string | null;
          market_group_name: string | null;
          market_key: string | null;
          market_type_id: number | null;
          outcome_type: string | null;
          parent_group: string | null;
          participant_scope: string | null;
          requires_line: boolean | null;
          requires_participant: boolean | null;
          segment_type: string | null;
          sport: string | null;
          supports_alt_lines: boolean | null;
          supports_live: boolean | null;
        };
        Relationships: [];
      };
      view_market_universe_players: {
        Row: {
          external_id: string | null;
          in_recent_offers: boolean | null;
          in_upcoming_roster: boolean | null;
          name: string | null;
          participant_id: string | null;
          sport: string | null;
          type: string | null;
        };
        Relationships: [];
      };
      view_market_universe_stats: {
        Row: {
          linked_percent: number | null;
          market_universe_linked: number | null;
          market_universe_players: number | null;
          market_universe_unlinked: number | null;
          sport: string | null;
          total_players: number | null;
        };
        Relationships: [];
      };
      view_market_universe_unlinked: {
        Row: {
          external_id: string | null;
          in_recent_offers: boolean | null;
          in_upcoming_roster: boolean | null;
          last_offer_at: string | null;
          name: string | null;
          participant_id: string | null;
          sport: string | null;
        };
        Relationships: [];
      };
      view_offer_quarantine_pending: {
        Row: {
          captured_at: string | null;
          created_at: string | null;
          id: string | null;
          provider_event_id: string | null;
          provider_id: number | null;
          provider_key: string | null;
          provider_market_key: string | null;
          provider_name: string | null;
          provider_participant_id: string | null;
          raw_payload: Json | null;
          reason_code: string | null;
          reason_detail: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'offer_quarantine_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offer_quarantine_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
        ];
      };
      view_participants_for_event: {
        Row: {
          display_name: string | null;
          event_id: string | null;
          name: string | null;
          participant_id: string | null;
          participant_meta: Json | null;
          participant_type: string | null;
          role: string | null;
          side: string | null;
          sport: string | null;
          team_id: string | null;
          team_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'participant_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
        ];
      };
      view_provider_offers_current_v3: {
        Row: {
          away_odds: number | null;
          created_at: string | null;
          devigged_over: number | null;
          devigged_under: number | null;
          event_id: string | null;
          home_odds: number | null;
          id: string | null;
          is_closing: boolean | null;
          is_opening: boolean | null;
          juice: number | null;
          line: number | null;
          mapping_confidence: number | null;
          market_key: string | null;
          market_name: string | null;
          market_type_id: number | null;
          meta: Json | null;
          no_odds: number | null;
          over_odds: number | null;
          participant_id: string | null;
          participant_name: string | null;
          provider: string | null;
          provider_id: number | null;
          provider_name: string | null;
          segment_type: string | null;
          segment_type_id: number | null;
          snapshot_at: string | null;
          under_odds: number | null;
          yes_odds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['event_id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'market_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_market_type_id_fkey';
            columns: ['market_type_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_types_for_sport';
            referencedColumns: ['market_type_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['away_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_events_for_form';
            referencedColumns: ['home_participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_players';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_market_universe_unlinked';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_participants_for_event';
            referencedColumns: ['participant_id'];
          },
          {
            foreignKeyName: 'provider_offers_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'view_quarantined_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'view_providers_active';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_offers_segment_type_id_fkey';
            columns: ['segment_type_id'];
            isOneToOne: false;
            referencedRelation: 'segment_types';
            referencedColumns: ['id'];
          },
        ];
      };
      view_providers_active: {
        Row: {
          api_source: string | null;
          code: string | null;
          display_name: string | null;
          has_live_odds: boolean | null;
          has_player_props: boolean | null;
          id: number | null;
          meta: Json | null;
          priority: number | null;
        };
        Insert: {
          api_source?: string | null;
          code?: string | null;
          display_name?: string | null;
          has_live_odds?: boolean | null;
          has_player_props?: boolean | null;
          id?: number | null;
          meta?: Json | null;
          priority?: number | null;
        };
        Update: {
          api_source?: string | null;
          code?: string | null;
          display_name?: string | null;
          has_live_odds?: boolean | null;
          has_player_props?: boolean | null;
          id?: number | null;
          meta?: Json | null;
          priority?: number | null;
        };
        Relationships: [];
      };
      view_quarantined_players: {
        Row: {
          external_id: string | null;
          id: string | null;
          identity_status_updated_at: string | null;
          in_recent_offers: boolean | null;
          in_upcoming_roster: boolean | null;
          last_offer_at: string | null;
          name: string | null;
          sport: string | null;
        };
        Relationships: [];
      };
      view_scored_legs_latest: {
        Row: {
          bet_slip_id: string | null;
          computed_at: string | null;
          confidence_score: number | null;
          edge_score: number | null;
          expected_value: number | null;
          feature_snapshot_id: string | null;
          kelly_fraction: number | null;
          leg_id: string | null;
          leg_index: number | null;
          leg_status: string | null;
          model_name: string | null;
          model_version: string | null;
          promotion_band: string | null;
          provider: string | null;
          provider_line: number | null;
          provider_odds: number | null;
          scored_leg_id: string | null;
          selection: string | null;
          ticket_id: string | null;
          ticket_status: string | null;
          ticket_type: string | null;
          tier: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scored_legs_feature_snapshot_id_fkey';
            columns: ['feature_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'feature_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scored_legs_feature_snapshot_id_fkey';
            columns: ['feature_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'view_scoring_audit';
            referencedColumns: ['feature_snapshot_id'];
          },
          {
            foreignKeyName: 'scored_legs_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_legs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scored_legs_leg_id_fkey';
            columns: ['leg_id'];
            isOneToOne: false;
            referencedRelation: 'view_scoring_audit';
            referencedColumns: ['leg_id'];
          },
          {
            foreignKeyName: 'ticket_legs_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      view_scoring_audit: {
        Row: {
          bet_slip_id: string | null;
          clv_at_bet: number | null;
          clv_at_close: number | null;
          confidence_score: number | null;
          edge_score: number | null;
          expected_value: number | null;
          feature_contributions: Json | null;
          feature_snapshot_id: string | null;
          feature_vector: Json | null;
          features_computed_at: string | null;
          fs_model_name: string | null;
          fs_model_version: string | null;
          is_latest: boolean | null;
          kelly_fraction: number | null;
          leg_id: string | null;
          leg_index: number | null;
          leg_status: string | null;
          promotion_band: string | null;
          provider: string | null;
          provider_line: number | null;
          provider_odds: number | null;
          scored_at: string | null;
          scored_leg_id: string | null;
          selection: string | null;
          sl_model_name: string | null;
          sl_model_version: string | null;
          ticket_id: string | null;
          ticket_status: string | null;
          tier: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_legs_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      view_sports_active: {
        Row: {
          code: string | null;
          default_segment_type: string | null;
          display_name: string | null;
          has_segments: boolean | null;
          id: number | null;
          max_segments: number | null;
          meta: Json | null;
          segment_display: string | null;
          supports_live: boolean | null;
          supports_player_props: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_backfill_market_props: {
        Args: { p_days?: number };
        Returns: {
          rows_inserted: number;
          rows_skipped: number;
          total_market_props: number;
        }[];
      };
      admin_refresh_views: {
        Args: never;
        Returns: {
          refresh_duration_ms: number;
          rows_count: number;
          view_name: string;
        }[];
      };
      admin_score_batch: {
        Args: { p_limit?: number };
        Returns: {
          rows_remaining: number;
          rows_scored: number;
        }[];
      };
      approve_pick: {
        Args: { approved_by_user: string; pick_id: string };
        Returns: undefined;
      };
      archive_settled_prop: {
        Args: { p_unified_pick_id: string };
        Returns: string;
      };
      atomic_submit_ticket: {
        Args: {
          p_bet_slip_id: string;
          p_capper_id: string;
          p_capper_username: string;
          p_game_selections: Json;
          p_notes?: string;
          p_parlay_odds?: number;
          p_picks: Json;
          p_sport: string;
          p_ticket_type: string;
          p_total_units?: number;
        };
        Returns: Json;
      };
      atomic_submit_ticket_v2: {
        Args: {
          p_bet_slip_id: string;
          p_legs: Json[];
          p_meta?: Json;
          p_source?: string;
          p_ticket_type: string;
          p_total_stake: number;
          p_user_id: string;
        };
        Returns: {
          out_error_details: Json;
          out_leg_ids: string[];
          out_status: string;
          out_ticket_id: string;
        }[];
      };
      calculate_weighted_close: {
        Args: { p_pick_id: string };
        Returns: {
          book_count: number;
          confidence_score: number;
          consensus_spread: number;
          has_divergence: boolean;
          steam_velocity: number;
          variance: number;
          weighted_line: number;
          weighted_odds: number;
        }[];
      };
      check_command_center_trust: {
        Args: never;
        Returns: {
          exists: boolean;
          freshness_check: string;
          row_count: number;
          view_name: string;
        }[];
      };
      check_market_universe_linkage: {
        Args: { p_min_threshold?: number };
        Returns: {
          linked_percent: number;
          passes_threshold: boolean;
          sport: string;
        }[];
      };
      cleanup_expired_confirmations: { Args: never; Returns: number };
      compute_mra_fields: {
        Args: {
          p_bet_line: number;
          p_closing_line: number;
          p_closing_source: string;
          p_clv_pct: number;
          p_settled_at: string;
          p_side: string;
          p_stat_type: string;
        };
        Returns: {
          line_move_abs: number;
          line_move_pct: number;
          market_reaction: string;
          sharp_fade: boolean;
        }[];
      };
      confirm_agent_kill: {
        Args: { p_confirmation_token: string; p_confirmed_by: string };
        Returns: Json;
      };
      create_kill_confirmation: {
        Args: {
          p_agent_id: string;
          p_reason: string;
          p_requested_by: string;
          p_validity_seconds?: number;
        };
        Returns: Json;
      };
      create_pick_with_event: {
        Args: {
          p_correlation_id: string;
          p_pick_data: Json;
          p_tenant_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      create_unified_pick_idempotent: {
        Args: { p_payload: Json };
        Returns: Json;
      };
      deny_pick: {
        Args: { denied_by_user: string; pick_id: string; reason: string };
        Returns: undefined;
      };
      enqueue_ticket_discord_outbox: {
        Args: { p_bet_slip_id: string; p_ticket_id: string };
        Returns: boolean;
      };
      find_or_create_canonical_game: {
        Args: {
          p_away_team: string;
          p_external_ids?: Json;
          p_game_time: string;
          p_home_team: string;
          p_league: string;
          p_sport: string;
        };
        Returns: string;
      };
      find_or_create_canonical_player: {
        Args: {
          p_current_team?: string;
          p_external_ids?: Json;
          p_full_name: string;
          p_sport: string;
        };
        Returns: string;
      };
      get_active_cappers: {
        Args: never;
        Returns: {
          display_name: string;
          external_id: string;
          id: string;
          username: string;
        }[];
      };
      get_agent_control_status: { Args: { p_agent_id: string }; Returns: Json };
      get_autopilot_timeline: {
        Args: { hours_back?: number };
        Returns: {
          approved_count: number;
          avg_risk_score: number;
          evaluated_count: number;
          hour_bucket: string;
          rejected_count: number;
          would_publish_count: number;
        }[];
      };
      get_credit_usage_summary: {
        Args: never;
        Returns: {
          last_used: string;
          provider: string;
          total_calls: number;
          total_credits: number;
        }[];
      };
      get_daily_autopilot_report: {
        Args: { report_date?: string };
        Returns: {
          approved_count: number;
          avg_execution_time_ms: number;
          avg_risk_score: number;
          rejected_count: number;
          rejection_reasons: Json;
          stale_count: number;
          total_evaluated: number;
          unknown_count: number;
          would_publish_count: number;
        }[];
      };
      get_mapping_conflicts: {
        Args: { p_source?: string };
        Returns: {
          canonical_id: string;
          confidence_score: number;
          conflict_count: number;
          external_id: string;
          mapping_type: string;
          source: string;
        }[];
      };
      get_pending_discord_outbox: {
        Args: { p_limit?: number };
        Returns: {
          bet_slip_id: string;
          created_at: string;
          legs: Json;
          meta: Json;
          outbox_id: string;
          source: string;
          ticket_id: string;
          ticket_type: string;
          total_stake: number;
        }[];
      };
      get_player_injury_status: {
        Args: { p_player_name: string; p_sport: string };
        Returns: {
          expected_return: string;
          impact_rating: number;
          injury_type: string;
          status: string;
          updated_at: string;
        }[];
      };
      get_trace_timeline: {
        Args: { p_trace_id: string };
        Returns: {
          details: Json;
          event_source: string;
          event_time: string;
          event_type: string;
        }[];
      };
      get_training_data: {
        Args: {
          p_end_date: string;
          p_min_sample_size?: number;
          p_sport: string;
          p_start_date: string;
          p_stat_type: string;
        };
        Returns: {
          actual_value: number;
          beat_closing: boolean;
          closing_line: number;
          clv_pct: number;
          game_date: string;
          opening_line: number;
          player_name: string;
          result: string;
        }[];
      };
      get_unscored_market_props: {
        Args: { limit_count?: number };
        Returns: {
          game_date: string;
          id: string;
          line: number;
          market: string;
          metadata: Json;
          odds: number;
          player_name: string;
          selection: string;
          sport: string;
        }[];
      };
      log_credit_usage: {
        Args: { credits?: number; meta?: Json; provider: string };
        Returns: string;
      };
      manual_settle_pick: {
        Args: {
          p_meta?: Json;
          p_pick_id: string;
          p_result: string;
          p_settled_at?: string;
        };
        Returns: Json;
      };
      mark_discord_outbox_failed: {
        Args: { p_error: string; p_outbox_id: string };
        Returns: boolean;
      };
      mark_discord_outbox_posted: {
        Args: {
          p_discord_channel_id?: string;
          p_discord_message_id: string;
          p_outbox_id: string;
        };
        Returns: boolean;
      };
      mark_pick_posted_to_discord: {
        Args: { p_message_id?: string; p_meta?: Json; p_pick_id: string };
        Returns: Json;
      };
      normalize_stat_type: {
        Args: { p_sport: string; p_stat_type: string };
        Returns: string;
      };
      pgrst_reload: {
        Args: { p_reason?: string; p_triggered_by?: string };
        Returns: {
          reload_id: string;
          reloaded_at: string;
          success: boolean;
        }[];
      };
      record_internal_score: {
        Args: {
          p_internal_score: number;
          p_pick_id: string;
          p_scoring_data: Json;
        };
        Returns: string;
      };
      record_self_score: {
        Args: {
          p_notes?: string;
          p_pick_id: string;
          p_self_score: number;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      refresh_all_identity_statuses: {
        Args: never;
        Returns: {
          quarantined_count: number;
          resolved_count: number;
          unlinked_count: number;
          updated_count: number;
        }[];
      };
      refresh_all_mvs: { Args: never; Returns: undefined };
      refresh_capper_rollups: { Args: never; Returns: undefined };
      refresh_capper_stats: { Args: never; Returns: undefined };
      refresh_cc_board_now: { Args: never; Returns: undefined };
      refresh_props_for_form: { Args: never; Returns: undefined };
      refresh_search_mv: { Args: { view_name: string }; Returns: undefined };
      refresh_search_mvs: { Args: never; Returns: undefined };
      request_agent_state_change: {
        Args: {
          p_agent_id: string;
          p_correlation_id?: string;
          p_desired_state: string;
          p_reason?: string;
          p_requested_by: string;
        };
        Returns: Json;
      };
      reset_failed_discord_outbox: {
        Args: { p_max_retries?: number };
        Returns: number;
      };
      resolve_event_mapping: {
        Args: {
          p_min_confidence?: number;
          p_provider_event_id: string;
          p_provider_id: number;
        };
        Returns: {
          canonical_event_id: string;
          confidence: number;
        }[];
      };
      resolve_market_mapping: {
        Args: {
          p_min_confidence?: number;
          p_provider_id: number;
          p_provider_market_key: string;
        };
        Returns: {
          canonical_market_type_id: number;
          confidence: number;
        }[];
      };
      resolve_offer_quarantine: {
        Args: {
          p_quarantine_id: string;
          p_resolution_action: string;
          p_resolved_by: string;
        };
        Returns: boolean;
      };
      resolve_participant_mapping: {
        Args: {
          p_min_confidence?: number;
          p_participant_type: string;
          p_provider_id: number;
          p_provider_participant_id: string;
        };
        Returns: {
          canonical_participant_id: string;
          confidence: number;
        }[];
      };
      resolve_provider_id: { Args: { p_provider_key: string }; Returns: number };
      score_ticket_legs_v3: {
        Args: {
          p_computed_at?: string;
          p_feature_vectors: Json[];
          p_leg_ids: string[];
          p_model_name: string;
          p_model_version: string;
          p_scores: Json[];
        };
        Returns: {
          out_feature_snapshot_id: string;
          out_leg_id: string;
          out_scored_leg_id: string;
          out_status: string;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
      submit_pick:
        | {
            Args: {
              p_org_id?: string;
              p_reason?: string;
              p_unified_pick_id: string;
            };
            Returns: string;
          }
        | { Args: { pick_data: Json }; Returns: string };
      update_agent_heartbeat: {
        Args: { p_agent_id: string; p_current_state?: string; p_metrics?: Json };
        Returns: Json;
      };
      update_identity_status: {
        Args: { p_participant_id: string };
        Returns: Database['public']['Enums']['identity_status_type'];
      };
      update_mra_fields: { Args: never; Returns: number };
      update_player_injury: {
        Args: {
          p_injury_detail?: string;
          p_injury_type?: string;
          p_new_status: string;
          p_player_name: string;
          p_source?: string;
          p_sport: string;
          p_team: string;
        };
        Returns: string;
      };
      update_weighted_close_for_pick: {
        Args: { p_pick_id: string };
        Returns: boolean;
      };
      upsert_provider_offers_v3: {
        Args: {
          p_captured_at: string;
          p_min_confidence?: number;
          p_offers: Json;
          p_provider_key: string;
        };
        Returns: {
          inserted_count: number;
          quarantine_reasons: Json;
          quarantined_count: number;
          updated_count: number;
        }[];
      };
      verify_smartform_contracts: {
        Args: never;
        Returns: {
          missing_columns: string[];
          required_columns: string[];
          row_count: number;
          status: string;
          surface_name: string;
        }[];
      };
    };
    Enums: {
      bet_type:
        | 'moneyline'
        | 'spread'
        | 'total'
        | 'player_prop'
        | 'team_total'
        | 'game_prop'
        | 'first_half'
        | 'second_half'
        | 'quarter'
        | 'period'
        | 'live'
        | 'futures';
      bet_type_enum:
        | 'moneyline'
        | 'spread'
        | 'total'
        | 'team_total'
        | 'player_prop'
        | 'game_prop'
        | 'first_half'
        | 'second_half'
        | 'quarter'
        | 'period'
        | 'live'
        | 'futures';
      capper_status: 'active' | 'paused' | 'banned' | 'pending';
      identity_status_type: 'resolved' | 'unlinked' | 'quarantined';
      lane_type: 'clean' | 'manual';
      participant_scope_type: 'EVENT' | 'TEAM' | 'PLAYER' | 'FIGHTER' | 'PARTICIPANT' | 'NONE';
      routing_status_type:
        | 'pending'
        | 'resolved'
        | 'failed_routing_unresolved'
        | 'posted'
        | 'failed';
      ticket_type:
        | 'single'
        | 'parlay'
        | 'teaser'
        | 'round_robin'
        | 'sgp'
        | 'sgp_plus'
        | 'power_parlay'
        | 'boost';
      ticket_type_enum:
        | 'single'
        | 'parlay'
        | 'teaser'
        | 'round_robin'
        | 'sgp'
        | 'sgp_plus'
        | 'power_parlay'
        | 'boost';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bet_type: [
        'moneyline',
        'spread',
        'total',
        'player_prop',
        'team_total',
        'game_prop',
        'first_half',
        'second_half',
        'quarter',
        'period',
        'live',
        'futures',
      ],
      bet_type_enum: [
        'moneyline',
        'spread',
        'total',
        'team_total',
        'player_prop',
        'game_prop',
        'first_half',
        'second_half',
        'quarter',
        'period',
        'live',
        'futures',
      ],
      capper_status: ['active', 'paused', 'banned', 'pending'],
      identity_status_type: ['resolved', 'unlinked', 'quarantined'],
      lane_type: ['clean', 'manual'],
      participant_scope_type: ['EVENT', 'TEAM', 'PLAYER', 'FIGHTER', 'PARTICIPANT', 'NONE'],
      routing_status_type: ['pending', 'resolved', 'failed_routing_unresolved', 'posted', 'failed'],
      ticket_type: [
        'single',
        'parlay',
        'teaser',
        'round_robin',
        'sgp',
        'sgp_plus',
        'power_parlay',
        'boost',
      ],
      ticket_type_enum: [
        'single',
        'parlay',
        'teaser',
        'round_robin',
        'sgp',
        'sgp_plus',
        'power_parlay',
        'boost',
      ],
    },
  },
} as const;

// SPRINT-RUNTIME-TRUTH-008: Convenience Row type exports for backwards compatibility
export type UnifiedPicksRow = Database['public']['Tables']['unified_picks']['Row'];
export type BridgeOutboxRow = Database['public']['Tables']['bridge_outbox']['Row'];
export type UsersRow = Database['public']['Tables']['users']['Row'];
export type CappersRow = Database['public']['Tables']['cappers']['Row'];
export type TeamsRow = Database['public']['Tables']['teams']['Row'];
export type PlayersRow = Database['public']['Tables']['players']['Row'];
export type GamesRow = Database['public']['Tables']['games']['Row'];
export type RawPropsRow = Database['public']['Tables']['raw_props']['Row'];
export type SmartTicketsRow = Database['public']['Tables']['smart_tickets']['Row'];
export type AgentHealthRow = Database['public']['Tables']['agent_health']['Row'];
export type PropSettlementsRow = Database['public']['Tables']['prop_settlements']['Row'];
export type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
export type ClosingSnapshotsRow = Database['public']['Tables']['closing_snapshots']['Row'];

// SPRINT-RUNTIME-TRUTH-008: Legacy type aliases for backwards compatibility
export type UnifiedPick = UnifiedPicksRow;
export type RawProp = RawPropsRow;
