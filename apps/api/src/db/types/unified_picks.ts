import { Database } from './supabase';

export interface UnifiedPick {
  id: string;
  created_at: string;
  updated_at: string;
  capper_id: string;
  player_id: string;
  game_id: string;
  stat_type: string;
  line: number;
  odds: number;
  stake: number;
  payout: number;
  result: 'win' | 'loss' | 'push' | 'pending';
  actual_value: number;
  tier: string;
  ticket_type: string;
  sport: string;
  league: string;
  confidence: number;
  analysis: string | null;
  metadata: Record<string, unknown> | null;
  
  // v3.0.0 Professional grading columns
  professional_score?: number;
  devigged_win_prob?: number;
  devigged_edge?: number;
  
  // CLV and risk management columns  
  clv_pct?: number;
  kelly_fraction?: number;
  risk?: number;
  clv_tracking_id?: string;
  
  // Status and workflow columns
  grading_status?: string;
  stage?: string;
  published?: boolean;
  is_instant?: boolean;
  
  // Grouping and promotion columns
  group_key?: string;
  promoted_at?: string;
}

export type UnifiedPickInsert = Omit<UnifiedPick, 'id' | 'created_at' | 'updated_at'>;
export type UnifiedPickUpdate = Partial<UnifiedPickInsert>;

export type UnifiedPicksResponse = Database['public']['Tables']['unified_picks']['Row'];
export type UnifiedPicksInsert = Database['public']['Tables']['unified_picks']['Insert'];
export type UnifiedPicksUpdate = Database['public']['Tables']['unified_picks']['Update']; 