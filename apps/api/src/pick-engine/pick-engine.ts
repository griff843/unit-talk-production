/**
 * Pick Engine — Types & Config
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Deterministic filter-based pick selection engine.
 * Operates on scored markets to select candidates for promotion.
 */

import type { JoinedScoringRecord } from '../analysis/edge-validation/types';

// ── Input ───────────────────────────────────────────────────────────────────

export interface PickEngineInput extends JoinedScoringRecord {
  score: number;
  uncertainty_final: number;
  clv_forecast: number;
  devig_mode: string;
}

// ── Filter Result ───────────────────────────────────────────────────────────

export interface FilterResult {
  filter_name: string;
  passed: boolean;
  value: number;
  threshold: number;
  reason: string;
}

// ── Promotion Log ───────────────────────────────────────────────────────────

export interface PromotionLogEntry {
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  accepted: boolean;
  filter_results: FilterResult[];
  first_reject_filter: string | null;
  p_final: number;
  edge_final: number;
  score: number;
  book_count: number;
  line_move_pct: number | null;
  kelly_fraction: number | null;
}

// ── Pipeline Result ─────────────────────────────────────────────────────────

export interface FilterCascadeEntry {
  input_count: number;
  pass_count: number;
  reject_count: number;
  pass_rate_pct: number;
}

export interface PromotionPipelineResult {
  promoted: PromotionLogEntry[];
  rejected: PromotionLogEntry[];
  filter_cascade: Record<string, FilterCascadeEntry>;
  total_input: number;
  pass_rate_pct: number;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface PickEngineConfig {
  edge_threshold: number;
  confidence_threshold: number;
  liquidity_threshold: number;
  line_move_reject_pct: number;
  p_final_min: number;
  skip_confidence: boolean;
}

export const DEFAULT_CONFIG: PickEngineConfig = {
  edge_threshold: 0.025,
  confidence_threshold: 70,
  liquidity_threshold: 4,
  line_move_reject_pct: -5,
  p_final_min: 0.52,
  skip_confidence: false,
};
