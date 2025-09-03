// src/types/propTypes.ts

export interface PropObject {
  id: string;
  market_type: string;
  odds?: number;
  trend_score?: number;
  matchup_score?: number;
  role_score?: number;
  line_value_score?: number;
  source?: string;
  is_rocket?: boolean;
  is_ladder?: boolean;
  play_status?: string;
  edge_score?: number | null;
  tier?: string;
  tags?: string[];
  edge_breakdown?: Record<string, unknown>;
  postable?: boolean;
  solo_lock?: boolean;
  created_at?: string;
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | null | undefined; // Allow additional properties
}