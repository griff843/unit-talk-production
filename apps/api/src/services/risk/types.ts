/**
 * Risk Engine Type Definitions
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * FAIL-CLOSED: All decisions default to BLOCK when data is unavailable.
 */

// ─── Exposure ────────────────────────────────────────────────────────────────

export interface ExposureBreach {
  dimension: 'total' | 'event';
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
};

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
  sizing: RiskSizing | null;
  trace_id: string;
}

// ─── Risk Event (DB row) ─────────────────────────────────────────────────────

export type RiskEventType =
  | 'EXPOSURE_CHECK'
  | 'EXPOSURE_BREACH'
  | 'DRIFT_CHECK'
  | 'DRIFT_THROTTLE'
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
