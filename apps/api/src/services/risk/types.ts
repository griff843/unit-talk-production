/**
 * Risk Engine Type Definitions
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * FAIL-CLOSED: All decisions default to BLOCK when data is unavailable.
 */

// ─── Exposure ────────────────────────────────────────────────────────────────

export interface ExposureBreach {
  dimension: 'total' | 'event' | 'sport' | 'market_type';
  key: string;
  current: number;
  limit: number;
  severity: 'high' | 'critical';
}

export interface ExposureState {
  total_kelly_exposure: number;
  total_pending_legs: number;
  total_pending_events: number;
  exposure_by_event: Record<string, number>;
  exposure_by_sport: Record<string, number>;
  exposure_by_market_type: Record<string, number>;
  max_single_event: { event_id: string; exposure: number } | null;
  herfindahl_index: number;
  breaches: ExposureBreach[];
  computed_at: string;
}

// ─── Drift ───────────────────────────────────────────────────────────────────

export interface DriftState {
  global_brier: number | null;
  calibration_gap: number | null;
  win_rate_actual: number | null;
  win_rate_predicted: number | null;
  sample_size: number;
  sufficient_data: boolean;
  blocked: boolean;
  computed_at: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface RiskEngineConfig {
  total_kelly_high: number;
  total_kelly_critical: number;
  event_kelly_limit: number;
  drift_brier_block: number;
  drift_min_settled: number;
  engine_enabled: boolean;
  /** Total bankroll in units for Kelly sizing. 0 or missing = use default. */
  bankroll_total: number;
  /** Fractional Kelly multiplier (0.25 = quarter Kelly). */
  bankroll_kelly_multiplier: number;
  /** Maximum single-bet fraction of bankroll. */
  bankroll_max_bet_fraction: number;
  /** Max Kelly exposure per sport (e.g., 0.4 = 40% of total allowed per sport). */
  sport_kelly_limit: number;
  /** Max Kelly exposure per market category (player_prop, game_line, team_total, etc.). */
  market_type_kelly_limit: number;
  /** Max pending legs on a single event before correlation block. */
  correlation_max_same_event: number;
  /** Max pending legs on a single participant before correlation block. */
  correlation_max_same_participant: number;
  /** Daily drawdown threshold as fraction of bankroll to trigger freeze (e.g., 0.10 = 10%). */
  drawdown_freeze_threshold: number;
  /** Number of days to look back for drawdown calculation. */
  drawdown_lookback_days: number;
}

export const DEFAULT_RISK_CONFIG: RiskEngineConfig = {
  total_kelly_high: 0.6,
  total_kelly_critical: 1.0,
  event_kelly_limit: 0.25,
  drift_brier_block: 0.35,
  drift_min_settled: 30,
  engine_enabled: true,
  bankroll_total: 1000,
  bankroll_kelly_multiplier: 0.25,
  bankroll_max_bet_fraction: 0.05,
  sport_kelly_limit: 0.4,
  market_type_kelly_limit: 0.35,
  correlation_max_same_event: 3,
  correlation_max_same_participant: 2,
  drawdown_freeze_threshold: 0.1,
  drawdown_lookback_days: 1,
};

// ─── Correlation ─────────────────────────────────────────────────────────────

export interface CorrelationCluster {
  type: 'same_event' | 'same_participant';
  key: string;
  count: number;
  limit: number;
  leg_ids: string[];
}

export interface CorrelationState {
  clusters: CorrelationCluster[];
  blocked: boolean;
  blocked_reasons: string[];
  computed_at: string;
}

// ─── Drawdown ────────────────────────────────────────────────────────────────

export interface DrawdownState {
  realized_pnl: number;
  settled_count: number;
  wins: number;
  losses: number;
  pushes: number;
  drawdown_fraction: number;
  frozen: boolean;
  freeze_reason: string | null;
  lookback_days: number;
  computed_at: string;
}

// ─── Risk Decision ───────────────────────────────────────────────────────────

export interface RiskSizing {
  /** Raw Kelly fraction: (bp - q) / b */
  raw_kelly: number;
  /** Fractional Kelly after multiplier */
  fractional_kelly: number;
  /** Recommended bet size in units */
  recommended_units: number;
  /** Recommended bet as fraction of bankroll */
  recommended_fraction: number;
  /** Whether sizing was capped */
  capped: boolean;
  /** Which cap was applied */
  cap_reason: string | null;
  /** Whether the pick has positive edge */
  has_edge: boolean;
}

export interface RiskDecision {
  allowed: boolean;
  decision: 'ALLOW' | 'BLOCK';
  blocked_reasons: string[];
  warnings: string[];
  exposure_state: ExposureState | null;
  drift_state: DriftState | null;
  correlation_state: CorrelationState | null;
  drawdown_state: DrawdownState | null;
  sizing: RiskSizing | null;
  trace_id: string;
}

// ─── Risk Event (DB row) ─────────────────────────────────────────────────────

export type RiskEventType =
  | 'EXPOSURE_CHECK'
  | 'EXPOSURE_BREACH'
  | 'DRIFT_CHECK'
  | 'DRIFT_THROTTLE'
  | 'CORRELATION_BLOCK'
  | 'DRAWDOWN_FREEZE'
  | 'PROMOTION_BLOCKED'
  | 'PROMOTION_ALLOWED'
  | 'ENGINE_ERROR';

export type RiskSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface RiskEventRow {
  event_type: RiskEventType;
  severity: RiskSeverity;
  pick_id?: string;
  sport?: string;
  event_id?: string;
  decision: 'ALLOW' | 'BLOCK' | 'THROTTLE' | 'N/A';
  reason_codes: string[];
  exposure_snapshot?: ExposureState;
  drift_snapshot?: DriftState;
  config_snapshot?: RiskEngineConfig;
  trace_id?: string;
}
