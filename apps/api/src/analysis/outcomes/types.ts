/**
 * Outcome Foundation Types
 * Sprint: SPRINT-029-OUTCOME-FOUNDATION
 */

// ── DB Row Types ────────────────────────────────────────────────────────────

export interface PlayerGameStatsRow {
  id: string;
  event_id: string;
  participant_id: string;
  game_date: string;
  source: string;
  stats: Record<string, number>;
  fetched_at: string;
}

export interface PropOutcomeRow {
  id: string;
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  line: number;
  actual_value: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  side: string;
  source: string;
  created_at: string;
}

// ── Insert Types ────────────────────────────────────────────────────────────

export interface PlayerGameStatsInsert {
  event_id: string;
  participant_id: string;
  game_date: string;
  source: string;
  stats: Record<string, number>;
}

export interface PropOutcomeInsert {
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  line: number;
  actual_value: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  side: string;
  source: string;
}

// ── Outcome Summary ─────────────────────────────────────────────────────────

export interface OutcomeSummary {
  total_shadow_scores: number;
  total_outcomes_resolved: number;
  join_rate_pct: number;
  unresolved_count: number;
  unresolved_reasons: Record<string, number>;
  player_game_stats_count: number;
  unique_events: number;
  unique_participants: number;
}

// ── Performance Report ──────────────────────────────────────────────────────

export interface PerformanceBucket {
  label: string;
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_rate_pct: number;
  roi_pct: number;
}

export interface PerformanceReport {
  overall: {
    total: number;
    wins: number;
    losses: number;
    pushes: number;
    hit_rate_pct: number;
    directional_accuracy_pct: number;
    flat_bet_roi_pct: number;
  };
  by_market_type: PerformanceBucket[];
  by_p_final_bin: PerformanceBucket[];
  by_edge_quartile: PerformanceBucket[];
}

// ── Joined Record (shadow_score + outcome) ──────────────────────────────────

export interface ScoredOutcome {
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  p_final: number;
  p_market_devig: number;
  edge_final: number;
  score: number;
  tier: string;
  book_count: number;
  line: number;
  actual_value: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  market_type_key?: string;
}
