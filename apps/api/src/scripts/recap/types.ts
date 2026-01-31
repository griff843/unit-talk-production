/**
 * Recap types for daily/weekly settlement reports and decision rules.
 */

export interface SettledPick {
  id: string;
  sport: string;
  promotion_band: string | null;
  settlement_result: string; // 'win' | 'loss' | 'push' | 'void'
  actual_outcome: number | null;
  odds: number | null;
  confidence: number | null;
  professional_score: number | null;
  bet_type: string;
  market: string;
  line: number;
  side: string;
  created_at: string;
  settled_at: string;
  capper_id: string | null;
  payout_amount: number | null;
}

export interface BandStats {
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  win_rate: number;
  avg_score: number | null; // null if no professional_score data
}

export interface ConfidenceBucket {
  label: string;
  range: [number, number];
  count: number;
  wins: number;
  win_rate: number;
}

export interface IntegrityChecks {
  missing_settlements: number; // picks with promotion_band but no prop_settlement
  missing_results: number; // prop_settlements with no game_result
  null_settlement_result: number;
  null_promotion_band: number;
}

export type Decision = 'EXPAND' | 'HOLD' | 'ROLLBACK';

export interface DecisionResult {
  decision: Decision;
  reasons: string[];
  metrics: {
    settled_total: number;
    promoted_total: number;
    promoted_win_rate: number;
    rejected_win_rate: number;
    hard_win_rate: number;
    hard_count: number;
    delta: number;
    integrity_ok: boolean;
  };
}

export interface DailySummary {
  timestamp: string;
  date_range: { start: string; end: string };
  headline: {
    total_settled: number;
    wins: number;
    losses: number;
    pushes: number;
    win_rate: number;
    net_units: number | null;
    net_units_note: string | null;
  };
  by_band: Record<string, BandStats>;
  by_confidence: ConfidenceBucket[];
  promoted_vs_rejected: {
    promoted: { count: number; win_rate: number; avg_score: number | null };
    rejected: { count: number; win_rate: number; avg_score: number | null };
    delta_win_rate: number;
    delta_avg_score: number | null;
  };
  integrity: IntegrityChecks;
  decision: DecisionResult;
}
