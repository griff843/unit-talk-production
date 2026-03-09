/**
 * Edge Validation Types
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 */

// ── DB Row Types ────────────────────────────────────────────────────────────

export interface ShadowScoreRow {
  id: string;
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  snapshot_at: string;
  book_count: number;
  providers: string[];
  p_market_devig: number | null;
  p_final: number | null;
  edge_final: number | null;
  uncertainty_final: number | null;
  clv_forecast: number | null;
  tier: string | null;
  score: number | null;
  model_version: string;
  devig_mode: string;
}

export interface ShadowCLVRow {
  id: string;
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  model_version: string;
  book_count_open: number | null;
  book_count_close: number | null;
  p_open_devig: number | null;
  p_close_devig: number | null;
  clv_prob: number;
  reason_code: string | null;
  meta: Record<string, unknown> | null;
}

export interface CanonicalEventRow {
  id: string;
  scheduled_at: string;
}

export interface MarketTypeRow {
  id: number;
  market_key: string;
}

// ── Joined Record ───────────────────────────────────────────────────────────

export interface JoinedScoringRecord {
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  snapshot_at: string;
  // From shadow_scores
  p_final: number;
  p_market_devig: number;
  edge_final: number;
  tier: string;
  book_count: number;
  providers: string[];
  // From shadow_clv_results
  p_open_devig: number;
  p_close_devig: number;
  clv_prob: number;
  book_count_close: number;
}

// ── Test Results ────────────────────────────────────────────────────────────

export type TestVerdict = 'PASS' | 'FAIL' | 'WARN';

export interface TestResult {
  test_name: string;
  verdict: TestVerdict;
  summary: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ValidationSuite {
  sprint: string;
  timestamp: string;
  overall_verdict: TestVerdict;
  tests: TestResult[];
  data_summary: {
    shadow_scores_count: number;
    shadow_clv_count: number;
    joined_count: number;
    model_version: string;
  };
}
