import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../../BaseAgent/types';
import * as z from 'zod';

export const AnalyticsConfigSchema = z.object({
  agentName: z.literal('AnalyticsAgent'),
  analysisConfig: z.object({
    minPicksForAnalysis: z.number().min(1),
    roiTimeframes: z.array(z.number()),
    streakThreshold: z.number().min(2),
    trendWindowDays: z.number().min(1)
  }),
  alertConfig: z.object({
    roiAlertThreshold: z.number(),
    streakAlertThreshold: z.number(),
    volatilityThreshold: z.number()
  })
});

export type AnalyticsAgentConfig = z.infer<typeof AnalyticsConfigSchema>;

// Missing type exports that are referenced in the main file
export interface AnalyticsSummary {
  totalCappers: number;
  avgROI: number;
  topPerformers: CapperPerformance[];
  trends: TrendAnalysis[];
  generatedAt: string;
}

export interface CapperStats {
  capper_id: string;
  total_picks: number;
  win_rate: number;
  roi: number;
  profit_loss: number;
  tier: string;
}

export type PlayType = 'spread' | 'moneyline' | 'total' | 'prop';
export type Tier = 'premium' | 'standard' | 'free';
export type StatType = 'points' | 'rebounds' | 'assists' | 'yards' | 'touchdowns';

export interface ROIAnalysis {
  capper_id: string;
  timeframe_days: number;
  total_picks: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi: number;
  volume: number;
  avg_odds: number;
  profit_loss: number;
  analyzed_at: string;
}

export interface TrendAnalysis {
  player_id: string;
  stat_type: string;
  trend_direction: 'up' | 'down' | 'neutral';
  streak_length: number;
  avg_performance: number;
  edge_volatility: number;
  confidence: number;
  analyzed_at: string;
}

export interface CapperPerformance {
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
  analyzed_at: string;
}

// Fix AnalyticsMetrics to properly extend BaseMetrics with all required properties
export interface AnalyticsMetrics extends BaseMetrics {
  // Additional analytics-specific metrics
  totalAnalyzed: number;
  capperCount: number;
  avgROI: number;
  profitableCappers: number;
  activeStreaks: number;
  totalProcessed: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
}