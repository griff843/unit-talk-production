/**
 * Platform Validation Types — SPRINT-041A
 *
 * Type definitions for the end-to-end platform operational validation report.
 * Validates the full lifecycle: ingestion → scoring → promotion → Discord → settlement → recap.
 *
 * This module only MEASURES operational health — it does NOT modify any system state.
 */

import type { BandTier } from '../../analysis/promotion/types';

// ── Report Version ──────────────────────────────────────────────────────────

export const PLATFORM_VALIDATION_VERSION = 'platform-validation-v1.0';

// ── Input Snapshots ─────────────────────────────────────────────────────────

/** Snapshot of ingestion pipeline data. */
export interface IngestionSnapshot {
  props_ingested_last_24h: number;
  props_ingested_last_48h: number;
  distinct_games: number;
  distinct_books: number;
  newest_prop_age_minutes: number | null;
}

/** Snapshot of scoring pipeline data. */
export interface ScoringSnapshot {
  total_props_last_24h: number;
  scored_props_last_24h: number;
  props_missing_p_final: number;
  props_missing_edge: number;
  props_missing_tier: number;
  average_edge: number | null;
  average_uncertainty: number | null;
}

/** Snapshot of promotion pipeline data. */
export interface PromotionSnapshot {
  promoted_last_24h: number;
  band_distribution: Record<BandTier, number>;
  total_evaluated: number;
  downgraded_count: number;
  suppressed_count: number;
}

/** Snapshot of Discord outbox/delivery data. */
export interface DiscordSnapshot {
  alerts_sent_last_24h: number;
  pending_messages: number;
  failed_messages: number;
  oldest_pending_age_minutes: number | null;
}

/** Snapshot of settlement pipeline data. */
export interface SettlementSnapshot {
  unsettled_picks: number;
  settlements_last_24h: number;
  avg_settlement_delay_minutes: number | null;
  disputed_count: number;
  oldest_unsettled_age_hours: number | null;
}

/** Snapshot of recap generation data. */
export interface RecapSnapshot {
  daily_recaps_last_7_days: number;
  last_recap_timestamp: string | null;
  last_recap_age_hours: number | null;
}

/** Snapshot of Temporal system health. */
export interface TemporalSnapshot {
  active_schedules: number;
  worker_heartbeat_age_seconds: number | null;
  workflow_backlog: number;
  failed_workflows_last_24h: number;
}

/** A single pick record for model performance evaluation. */
export interface PerformanceRecord {
  finalBand: Exclude<BandTier, 'SUPPRESS'>;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  p_final: number;
  edge_final: number;
  clvPercent?: number | null;
}

// ── Health Check Results ────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'warn' | 'fail';

/** Base health check result. */
interface BaseCheckResult {
  status: CheckStatus;
  issues: string[];
}

/** CHECK 1 — Ingestion health result. */
export interface IngestionHealthResult extends BaseCheckResult {
  props_ingested_last_24h: number;
  props_ingested_last_48h: number;
  distinct_games: number;
  distinct_books: number;
  ingestion_halted: boolean;
  stale_data: boolean;
}

/** CHECK 2 — Scoring health result. */
export interface ScoringHealthResult extends BaseCheckResult {
  scored_props_last_24h: number;
  percent_scored: number;
  average_edge: number | null;
  scoring_failures: boolean;
  missing_probability: boolean;
}

/** CHECK 3 — Promotion health result. */
export interface PromotionHealthResult extends BaseCheckResult {
  promoted_last_24h: number;
  band_distribution: Record<BandTier, number>;
  suppression_rate: number;
  downgrade_rate: number;
  promotion_halted: boolean;
  bands_collapsed: boolean;
}

/** CHECK 4 — Discord delivery health result. */
export interface DiscordHealthResult extends BaseCheckResult {
  alerts_sent_last_24h: number;
  pending_messages: number;
  failed_messages: number;
  stuck_outbox: boolean;
  delivery_failures: boolean;
}

/** CHECK 5 — Settlement health result. */
export interface SettlementHealthResult extends BaseCheckResult {
  unsettled_picks: number;
  avg_settlement_delay_minutes: number | null;
  settlements_last_24h: number;
  settlement_backlog: boolean;
  grading_stalled: boolean;
}

/** CHECK 6 — Recap health result. */
export interface RecapHealthResult extends BaseCheckResult {
  daily_recaps_last_7_days: number;
  last_recap_timestamp: string | null;
  recap_running: boolean;
}

/** CHECK 7 — Temporal system health result. */
export interface TemporalHealthResult extends BaseCheckResult {
  active_schedules: number;
  worker_responsive: boolean;
  workflow_backlog: number;
  worker_stopped: boolean;
  schedule_failures: boolean;
}

/** Band-level performance metrics. */
export interface BandPerformanceMetrics {
  band: Exclude<BandTier, 'SUPPRESS'>;
  sample_size: number;
  win_rate: number;
  roi_pct: number;
  avg_clv_pct: number | null;
}

/** CHECK 8 — Model performance result. */
export interface ModelPerformanceResult extends BaseCheckResult {
  total_picks: number;
  overall_roi_pct: number;
  overall_win_rate: number;
  overall_clv_pct: number | null;
  band_performance: BandPerformanceMetrics[];
  tier_inversion: boolean;
  negative_clv_all_bands: boolean;
}

// ── Full Report ─────────────────────────────────────────────────────────────

/**
 * Complete platform validation report.
 * Deterministic given the same input snapshots.
 */
export interface PlatformValidationReport {
  report_version: string;
  generated_at: string;

  ingestionHealth: IngestionHealthResult;
  scoringHealth: ScoringHealthResult;
  promotionHealth: PromotionHealthResult;
  discordHealth: DiscordHealthResult;
  settlementHealth: SettlementHealthResult;
  recapHealth: RecapHealthResult;
  temporalHealth: TemporalHealthResult;
  modelPerformance: ModelPerformanceResult;

  /** TRUE only if all critical checks pass. */
  productionReady: boolean;
  /** Summary of all failing/warning checks. */
  blockers: string[];
}
