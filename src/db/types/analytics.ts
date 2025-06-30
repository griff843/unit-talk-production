import { Database } from './supabase';

export interface AnalyticsSummary {
  id: string;
  created_at: string;
  updated_at: string;
  capper_id: string;
  tier: string;
  ticket_type: string;
  total_volume: number;
  win_rate: number;
  roi: number;
  best_stat_type: string;
  worst_stat_type: string;
  streak_info: {
    current_streak: number;
    longest_win_streak: number;
    longest_loss_streak: number;
  };
  metadata: Record<string, unknown> | null;
}

export interface ROIByTier {
  id: string;
  created_at: string;
  updated_at: string;
  capper_id: string;
  tier: string;
  timeframe_days: number;
  total_picks: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi: number;
  volume: number;
  avg_odds: number;
  profit_loss: number;
  metadata: Record<string, unknown> | null;
}

export interface TrendAnalysis {
  id: string;
  created_at: string;
  updated_at: string;
  player_id: string;
  stat_type: string;
  trend_direction: 'up' | 'down' | 'neutral';
  streak_length: number;
  avg_performance: number;
  edge_volatility: number;
  confidence: number;
  metadata: Record<string, unknown> | null;
}

export type AnalyticsSummaryInsert = Omit<AnalyticsSummary, 'id' | 'created_at' | 'updated_at'>;
export type AnalyticsSummaryUpdate = Partial<AnalyticsSummaryInsert>;

export type ROIByTierInsert = Omit<ROIByTier, 'id' | 'created_at' | 'updated_at'>;
export type ROIByTierUpdate = Partial<ROIByTierInsert>;

export type TrendAnalysisInsert = Omit<TrendAnalysis, 'id' | 'created_at' | 'updated_at'>;
export type TrendAnalysisUpdate = Partial<TrendAnalysisInsert>;

// Supabase generated types
export type AnalyticsSummaryResponse = Database['public']['Tables']['analytics_summary']['Row'];
export type AnalyticsSummaryInsertResponse = Database['public']['Tables']['analytics_summary']['Insert'];
export type AnalyticsSummaryUpdateResponse = Database['public']['Tables']['analytics_summary']['Update'];

export type ROIByTierResponse = Database['public']['Tables']['roi_by_tier']['Row'];
export type ROIByTierInsertResponse = Database['public']['Tables']['roi_by_tier']['Insert'];
export type ROIByTierUpdateResponse = Database['public']['Tables']['roi_by_tier']['Update'];

export type TrendAnalysisResponse = Database['public']['Tables']['trend_analysis']['Row'];
export type TrendAnalysisInsertResponse = Database['public']['Tables']['trend_analysis']['Insert'];
export type TrendAnalysisUpdateResponse = Database['public']['Tables']['trend_analysis']['Update']; 