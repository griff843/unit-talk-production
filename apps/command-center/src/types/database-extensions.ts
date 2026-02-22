/**
 * Database type extensions for tables/views that are referenced in code
 * but not captured by Supabase type generation.
 *
 * NOTE: These types are manually defined based on code usage patterns.
 * They may represent:
 * 1. Tables that exist but weren't captured in type generation
 * 2. Tables that need to be created via migrations
 * 3. Legacy references that should be removed
 *
 * SPRINT-SUPABASE-TYPE-SAFETY-LOCK-106A: This file exists to maintain
 * type safety while the underlying database schema is verified.
 */

import type { Json } from './database';

/**
 * Extension tables - tables referenced in code but not in generated types
 */
export interface DatabaseExtensions {
  public: {
    Tables: {
      // Agent management (code uses 'agents', production has 'agent_registry')
      agents: {
        Row: {
          id: string;
          name: string;
          type: string;
          status: 'healthy' | 'warning' | 'error' | 'inactive';
          last_run: string | null;
          success_rate: number | null;
          avg_response_time: number | null;
          total_operations: number | null;
          configuration: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          status?: 'healthy' | 'warning' | 'error' | 'inactive';
          last_run?: string | null;
          success_rate?: number | null;
          avg_response_time?: number | null;
          total_operations?: number | null;
          configuration?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          status?: 'healthy' | 'warning' | 'error' | 'inactive';
          last_run?: string | null;
          success_rate?: number | null;
          avg_response_time?: number | null;
          total_operations?: number | null;
          configuration?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // Audit logging (code uses 'audit_logs', production has 'audit_log')
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource: string;
          resource_id: string | null;
          status: string | null;
          risk_level: string | null;
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource: string;
          resource_id?: string | null;
          status?: string | null;
          risk_level?: string | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          action?: string;
          resource?: string;
          resource_id?: string | null;
          status?: string | null;
          risk_level?: string | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };

      // Security events
      security_events: {
        Row: {
          id: string;
          type: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          ip_address: string | null;
          user_id: string | null;
          metadata: Json | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          type: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          ip_address?: string | null;
          user_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          type?: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
          severity?: 'low' | 'medium' | 'high' | 'critical';
          description?: string;
          ip_address?: string | null;
          user_id?: string | null;
          metadata?: Json | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };

      // System configuration
      system_config: {
        Row: {
          id: string;
          config_key: string;
          config_value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config_key: string;
          config_value: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          config_key?: string;
          config_value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };

      // System metrics
      system_metrics: {
        Row: {
          id: string;
          metric_name: string;
          metric_value: number;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          metric_name: string;
          metric_value: number;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          metric_name?: string;
          metric_value?: number;
          metadata?: Json | null;
        };
        Relationships: [];
      };

      // Workflow executions
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          workflow_type: string;
          execution_status: string;
          bet_slip_id: string | null;
          input_data: Json | null;
          execution_result: Json | null;
          processing_time_ms: number | null;
          run_id: string | null;
          task_queue: string | null;
          worker_id: string | null;
          error_details: Json | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          workflow_type: string;
          execution_status: string;
          bet_slip_id?: string | null;
          input_data?: Json | null;
          execution_result?: Json | null;
          processing_time_ms?: number | null;
          run_id?: string | null;
          task_queue?: string | null;
          worker_id?: string | null;
          error_details?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          workflow_id?: string;
          workflow_type?: string;
          execution_status?: string;
          bet_slip_id?: string | null;
          input_data?: Json | null;
          execution_result?: Json | null;
          processing_time_ms?: number | null;
          run_id?: string | null;
          task_queue?: string | null;
          worker_id?: string | null;
          error_details?: Json | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };

      // Exposure snapshots
      exposure_snapshots: {
        Row: {
          id: string;
          snapshot_type: string;
          snapshot_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_type: string;
          snapshot_data: Json;
          created_at?: string;
        };
        Update: {
          snapshot_type?: string;
          snapshot_data?: Json;
        };
        Relationships: [];
      };

      // Autopilot tables
      autopilot_gate_snapshots: {
        Row: {
          id: string;
          gate_id: string;
          status: 'PASS' | 'WARN' | 'FAIL';
          window_start: string;
          window_end: string;
          total_picks: number;
          proxy_accuracy_rate: number | null;
          false_positive_rate: number | null;
          required_picks: number;
          required_accuracy: number;
          required_fp_max: number;
          reasons: Json | null;
          current_mode: string;
          target_mode: string;
          evaluated_at: string;
        };
        Insert: {
          id?: string;
          gate_id: string;
          status: 'PASS' | 'WARN' | 'FAIL';
          window_start: string;
          window_end: string;
          total_picks: number;
          proxy_accuracy_rate?: number | null;
          false_positive_rate?: number | null;
          required_picks: number;
          required_accuracy: number;
          required_fp_max: number;
          reasons?: Json | null;
          current_mode: string;
          target_mode: string;
          evaluated_at?: string;
        };
        Update: {
          gate_id?: string;
          status?: 'PASS' | 'WARN' | 'FAIL';
          window_start?: string;
          window_end?: string;
          total_picks?: number;
          proxy_accuracy_rate?: number | null;
          false_positive_rate?: number | null;
          required_picks?: number;
          required_accuracy?: number;
          required_fp_max?: number;
          reasons?: Json | null;
          current_mode?: string;
          target_mode?: string;
          evaluated_at?: string;
        };
        Relationships: [];
      };

      autopilot_demotion_events: {
        Row: {
          id: string;
          from_mode: string;
          to_mode: string;
          trigger_type: string;
          trigger_details: Json | null;
          triggered_by: string;
          demoted_at: string;
        };
        Insert: {
          id?: string;
          from_mode: string;
          to_mode: string;
          trigger_type: string;
          trigger_details?: Json | null;
          triggered_by: string;
          demoted_at?: string;
        };
        Update: {
          from_mode?: string;
          to_mode?: string;
          trigger_type?: string;
          trigger_details?: Json | null;
          triggered_by?: string;
          demoted_at?: string;
        };
        Relationships: [];
      };

      autopilot_metrics_hourly: {
        Row: {
          id: string;
          hour_start: string;
          total_decisions: number;
          approve_count: number;
          reject_count: number;
          unknown_count: number;
          approval_rate: number | null;
          block_reasons: Json | null;
          canary_total: number;
          canary_approved: number;
          proxy_accuracy_rate: number | null;
          mode_at_time: string;
        };
        Insert: {
          id?: string;
          hour_start: string;
          total_decisions: number;
          approve_count: number;
          reject_count: number;
          unknown_count: number;
          approval_rate?: number | null;
          block_reasons?: Json | null;
          canary_total?: number;
          canary_approved?: number;
          proxy_accuracy_rate?: number | null;
          mode_at_time: string;
        };
        Update: {
          hour_start?: string;
          total_decisions?: number;
          approve_count?: number;
          reject_count?: number;
          unknown_count?: number;
          approval_rate?: number | null;
          block_reasons?: Json | null;
          canary_total?: number;
          canary_approved?: number;
          proxy_accuracy_rate?: number | null;
          mode_at_time?: string;
        };
        Relationships: [];
      };

      autopilot_mode_config: {
        Row: {
          id: string;
          mode: string;
          canary_percentage: number;
          pending_mode: string | null;
          pending_mode_expires_at: string | null;
          pending_mode_requested_at: string | null;
          pending_mode_requested_by: string | null;
          gate1_accuracy_threshold: number;
          gate1_false_positive_threshold: number;
          gate1_min_picks: number;
          gate1_window_days: number;
          gate2_accuracy_threshold: number;
          gate2_false_positive_threshold: number;
          gate2_min_picks: number;
          gate2_window_days: number;
          demotion_error_spike_threshold: number;
          demotion_accuracy_threshold: number;
          demotion_window_hours: number;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          mode: string;
          canary_percentage?: number;
          pending_mode?: string | null;
          pending_mode_expires_at?: string | null;
          pending_mode_requested_at?: string | null;
          pending_mode_requested_by?: string | null;
          gate1_accuracy_threshold?: number;
          gate1_false_positive_threshold?: number;
          gate1_min_picks?: number;
          gate1_window_days?: number;
          gate2_accuracy_threshold?: number;
          gate2_false_positive_threshold?: number;
          gate2_min_picks?: number;
          gate2_window_days?: number;
          demotion_error_spike_threshold?: number;
          demotion_accuracy_threshold?: number;
          demotion_window_hours?: number;
          updated_at?: string;
          updated_by?: string;
        };
        Update: {
          mode?: string;
          canary_percentage?: number;
          pending_mode?: string | null;
          pending_mode_expires_at?: string | null;
          pending_mode_requested_at?: string | null;
          pending_mode_requested_by?: string | null;
          gate1_accuracy_threshold?: number;
          gate1_false_positive_threshold?: number;
          gate1_min_picks?: number;
          gate1_window_days?: number;
          gate2_accuracy_threshold?: number;
          gate2_false_positive_threshold?: number;
          gate2_min_picks?: number;
          gate2_window_days?: number;
          demotion_error_spike_threshold?: number;
          demotion_accuracy_threshold?: number;
          demotion_window_hours?: number;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [];
      };

      autopilot_accuracy_daily: {
        Row: {
          id: string;
          date: string;
          total_picks: number;
          correct_predictions: number;
          accuracy_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          total_picks: number;
          correct_predictions: number;
          accuracy_rate: number;
          created_at?: string;
        };
        Update: {
          date?: string;
          total_picks?: number;
          correct_predictions?: number;
          accuracy_rate?: number;
        };
        Relationships: [];
      };

      autopilot_accuracy_by_agent: {
        Row: {
          id: string;
          agent_name: string;
          total_settled: number;
          wins: number;
          losses: number;
          true_accuracy_rate: number | null;
          approved_accuracy_rate: number | null;
          last_updated: string;
        };
        Insert: {
          id?: string;
          agent_name: string;
          total_settled: number;
          wins: number;
          losses: number;
          true_accuracy_rate?: number | null;
          approved_accuracy_rate?: number | null;
          last_updated?: string;
        };
        Update: {
          agent_name?: string;
          total_settled?: number;
          wins?: number;
          losses?: number;
          true_accuracy_rate?: number | null;
          approved_accuracy_rate?: number | null;
          last_updated?: string;
        };
        Relationships: [];
      };

      autopilot_clv_daily: {
        Row: {
          id: string;
          date: string;
          avg_clv: number;
          total_picks: number;
          positive_clv_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          avg_clv: number;
          total_picks: number;
          positive_clv_count: number;
          created_at?: string;
        };
        Update: {
          date?: string;
          avg_clv?: number;
          total_picks?: number;
          positive_clv_count?: number;
        };
        Relationships: [];
      };

      autopilot_confidence_calibration_daily: {
        Row: {
          id: string;
          date: string;
          confidence_bucket: string;
          total_picks: number;
          actual_accuracy: number;
          expected_accuracy: number;
          calibration_error: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          confidence_bucket: string;
          total_picks: number;
          actual_accuracy: number;
          expected_accuracy: number;
          calibration_error: number;
          created_at?: string;
        };
        Update: {
          date?: string;
          confidence_bucket?: string;
          total_picks?: number;
          actual_accuracy?: number;
          expected_accuracy?: number;
          calibration_error?: number;
        };
        Relationships: [];
      };

      autopilot_learning_adjustments: {
        Row: {
          id: string;
          parameter_name: string;
          old_value: number;
          new_value: number;
          adjustment_reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parameter_name: string;
          old_value: number;
          new_value: number;
          adjustment_reason: string;
          created_at?: string;
        };
        Update: {
          parameter_name?: string;
          old_value?: number;
          new_value?: number;
          adjustment_reason?: string;
        };
        Relationships: [];
      };

      // Remediation tables
      remediation_playbooks: {
        Row: {
          id: string;
          playbook_id: string;
          name: string;
          description: string | null;
          execution_type: string;
          required_knobs: Json | null;
          default_action: Json;
          cooldown_seconds: number;
          max_per_hour: number;
          status: string;
          version: number;
          trigger_conditions: Json;
          actions: Json;
          enabled: boolean;
          dry_run_only: boolean;
          requires_approval: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          name: string;
          description?: string | null;
          execution_type?: string;
          required_knobs?: Json | null;
          default_action?: Json;
          cooldown_seconds?: number;
          max_per_hour?: number;
          status?: string;
          version?: number;
          trigger_conditions: Json;
          actions: Json;
          enabled?: boolean;
          dry_run_only?: boolean;
          requires_approval?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          playbook_id?: string;
          name?: string;
          description?: string | null;
          execution_type?: string;
          required_knobs?: Json | null;
          default_action?: Json;
          cooldown_seconds?: number;
          max_per_hour?: number;
          status?: string;
          version?: number;
          trigger_conditions?: Json;
          actions?: Json;
          enabled?: boolean;
          dry_run_only?: boolean;
          requires_approval?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      remediation_executions: {
        Row: {
          id: string;
          playbook_id: string;
          status: string;
          trigger_event: Json | null;
          execution_result: Json | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          status: string;
          trigger_event?: Json | null;
          execution_result?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          playbook_id?: string;
          status?: string;
          trigger_event?: Json | null;
          execution_result?: Json | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };

      // Remediation config
      remediation_config: {
        Row: {
          id: string;
          config_key: string;
          config_value: Json;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config_key: string;
          config_value: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          config_key?: string;
          config_value?: Json;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // LLM Model tracking
      llm_models: {
        Row: {
          id: string;
          name: string;
          provider: string;
          status: string;
          tokens_used: number;
          tokens_limit: number;
          requests_today: number;
          avg_response_time: number;
          cost: number;
          accuracy: number | null;
          last_used: string | null;
          configuration: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          provider: string;
          status?: string;
          tokens_used?: number;
          tokens_limit?: number;
          requests_today?: number;
          avg_response_time?: number;
          cost?: number;
          accuracy?: number | null;
          last_used?: string | null;
          configuration?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          provider?: string;
          status?: string;
          tokens_used?: number;
          tokens_limit?: number;
          requests_today?: number;
          avg_response_time?: number;
          cost?: number;
          accuracy?: number | null;
          last_used?: string | null;
          configuration?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // LLM Request tracking
      llm_requests: {
        Row: {
          id: string;
          model_name: string;
          prompt: string;
          response: string | null;
          tokens_used: number;
          cost: number;
          response_time_ms: number;
          status: string;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          model_name: string;
          prompt: string;
          response?: string | null;
          tokens_used?: number;
          cost?: number;
          response_time_ms?: number;
          status?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          model_name?: string;
          prompt?: string;
          response?: string | null;
          tokens_used?: number;
          cost?: number;
          response_time_ms?: number;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };

      // Autopilot policy configuration
      autopilot_policy_config: {
        Row: {
          id: string;
          version: number;
          default_mode: string;
          canary_percentage: number;
          fail_closed: boolean;
          rules: Json | null;
          operator_overrides: Json | null;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          version?: number;
          default_mode: string;
          canary_percentage?: number;
          fail_closed?: boolean;
          rules?: Json | null;
          operator_overrides?: Json | null;
          updated_at?: string;
          updated_by?: string;
        };
        Update: {
          version?: number;
          default_mode?: string;
          canary_percentage?: number;
          fail_closed?: boolean;
          rules?: Json | null;
          operator_overrides?: Json | null;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [];
      };

      // Emergency operations
      emergency_operations: {
        Row: {
          id: number;
          emergency_stop: boolean;
          maintenance_mode: boolean;
          maintenance_message: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          emergency_stop?: boolean;
          maintenance_mode?: boolean;
          maintenance_message?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          emergency_stop?: boolean;
          maintenance_mode?: boolean;
          maintenance_message?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };

      // SLO tables
      slo_evaluations: {
        Row: {
          id: string;
          slo_name: string;
          evaluated_at: string;
          status: string;
          value: number | null;
          threshold: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slo_name: string;
          evaluated_at?: string;
          status?: string;
          value?: number | null;
          threshold?: number | null;
          created_at?: string;
        };
        Update: {
          slo_name?: string;
          evaluated_at?: string;
          status?: string;
          value?: number | null;
          threshold?: number | null;
        };
        Relationships: [];
      };

      slo_incidents: {
        Row: {
          id: string;
          slo_name: string;
          opened_at: string;
          closed_at: string | null;
          severity: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slo_name: string;
          opened_at?: string;
          closed_at?: string | null;
          severity?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          slo_name?: string;
          opened_at?: string;
          closed_at?: string | null;
          severity?: string;
          description?: string | null;
        };
        Relationships: [];
      };

      incident_notifications: {
        Row: {
          id: string;
          incident_id: string;
          notification_type: string;
          sent_at: string;
          recipient: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          incident_id: string;
          notification_type: string;
          sent_at?: string;
          recipient?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          incident_id?: string;
          notification_type?: string;
          sent_at?: string;
          recipient?: string | null;
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // RPC functions not captured by type generation
      get_autopilot_mode: {
        Args: Record<string, never>;
        Returns: Json;
      };
      set_autopilot_mode: {
        Args: {
          p_mode: string;
          p_actor: string;
          p_confirm?: boolean;
          p_canary_percentage?: number | null;
        };
        Returns: Json;
      };
      compute_autopilot_hourly_metrics: {
        Args: { p_hour_start?: string };
        Returns: string;
      };
      compute_gate_snapshot: {
        Args: { p_gate_id: string };
        Returns: string;
      };
      record_autopilot_demotion: {
        Args: {
          p_from_mode: string;
          p_to_mode: string;
          p_trigger_type: string;
          p_trigger_details?: Json;
          p_triggered_by: string;
        };
        Returns: string;
      };
      get_pending_remediations: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_remediation_stats: {
        Args: { p_hours_back?: number };
        Returns: Json;
      };
      create_remediation_execution: {
        Args: {
          p_playbook_id: string;
          p_trigger_event?: Json;
        };
        Returns: string;
      };
      approve_remediation: {
        Args: {
          p_execution_id: string;
          p_approved_by: string;
        };
        Returns: Json;
      };
      get_autopilot_learning_state: {
        Args: Record<string, never>;
        Returns: Json;
      };
      set_autopilot_learning_enabled: {
        Args: { p_enabled: boolean };
        Returns: Json;
      };
      get_active_signal_weights: {
        Args: Record<string, never>;
        Returns: Json;
      };
      refresh_pipeline_lag_materialized_view: {
        Args: Record<string, never>;
        Returns: void;
      };
      compute_autopilot_accuracy_daily: {
        Args: { p_date?: string };
        Returns: string;
      };
      compute_autopilot_clv_daily: {
        Args: { p_date?: string };
        Returns: string;
      };
      compute_autopilot_confidence_calibration: {
        Args: { p_date?: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
