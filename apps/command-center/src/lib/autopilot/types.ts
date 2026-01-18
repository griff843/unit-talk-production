/**
 * Phase 4: Autopilot Types
 * Type definitions for autopilot decision logging and evaluation
 */

export type AutopilotMode = 'off' | 'log_only' | 'canary' | 'prod';

export type DecisionOutcome = 'approved' | 'rejected' | 'unknown';

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value?: number;
}

export interface PickData {
  id?: string;
  user_id?: string;
  sport?: string;
  player_name?: string;
  stat_type?: string;
  line?: number;
  over_odds?: number;
  under_odds?: number;
  pick_type?: 'over' | 'under';
  confidence?: number;
  created_at?: string;
  [key: string]: any;
}

export interface SLOSnapshot {
  timestamp: string;
  overall_status: string;
  data_sources: {
    local_postgres: boolean;
    supabase: boolean;
  };
  slo_summary: {
    pass_count: number;
    fail_count: number;
    unknown_count: number;
  };
}

export interface AutopilotDecision {
  id?: string;
  mode: AutopilotMode;
  evaluation_run_id: string;
  evaluated_at?: string;

  // Pick being evaluated
  pick_id?: string | null;
  pick_data: PickData;

  // Decision outcome
  decision: DecisionOutcome;
  decision_reason: string;

  // Risk assessment
  risk_score?: number | null;
  risk_factors?: RiskFactor[];

  // Staleness checks
  data_age_minutes?: number | null;
  odds_staleness_minutes?: number | null;
  is_stale?: boolean;

  // Publishing decision
  would_publish: boolean;
  publish_channel?: string | null;
  publish_blocked_reason?: string | null;

  // SLO context
  slo_snapshot?: SLOSnapshot | null;

  // Execution metadata
  execution_time_ms?: number | null;
  metadata?: Record<string, any>;

  created_at?: string;
}

export interface DailyAutopilotReport {
  report_date: string;
  total_evaluated: number;
  approved_count: number;
  rejected_count: number;
  unknown_count: number;
  would_publish_count: number;
  avg_risk_score: number | null;
  stale_count: number;
  rejection_reasons: Array<{ reason: string; count: number }>;
  avg_execution_time_ms: number | null;
}

export interface AutopilotTimelineBucket {
  hour_bucket: string;
  evaluated_count: number;
  approved_count: number;
  rejected_count: number;
  would_publish_count: number;
  avg_risk_score: number | null;
}

export interface AutopilotEvaluationContext {
  mode: AutopilotMode;
  evaluation_run_id: string;
  slo_snapshot: SLOSnapshot;
  current_time: Date;
}

export interface RiskCheckResult {
  passed: boolean;
  risk_score: number;
  risk_factors: RiskFactor[];
}

export interface StalenessCheckResult {
  is_stale: boolean;
  data_age_minutes: number | null;
  odds_staleness_minutes: number | null;
  reasons: string[];
}

export interface PublishingDecision {
  should_publish: boolean;
  channel: string | null;
  blocked_reason: string | null;
}
