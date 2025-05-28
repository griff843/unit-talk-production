import { Database } from './supabase';

export interface FinalPick {
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
  metadata: Record<string, any> | null;
}

export type FinalPickInsert = Omit<FinalPick, 'id' | 'created_at' | 'updated_at'>;
export type FinalPickUpdate = Partial<FinalPickInsert>;

export type FinalPicksResponse = Database['public']['Tables']['final_picks']['Row'];
export type FinalPicksInsert = Database['public']['Tables']['final_picks']['Insert'];
export type FinalPicksUpdate = Database['public']['Tables']['final_picks']['Update']; 