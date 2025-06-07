import { AgentConfig } from '../../types/agentTypes';
import * as z from 'zod';

export const AnalyticsConfigSchema = z.object({
  agentName: z.literal('AnalyticsAgent'),
  enabled: z.boolean(),
  cron: z.string().optional(),
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
  }),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  })
});

export type AnalyticsAgentConfig = z.infer<typeof AnalyticsConfigSchema>;

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

export interface AnalyticsMetrics {
  totalAnalyzed: number;
  capperCount: number;
  avgROI: number;
  profitableCappers: number;
  activeStreaks: number;
  processingTimeMs: number;
  errorCount: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
} // DRAGON PATCH: add missing fields from tests/code
export interface Metrics { profitableCappers?: number; activeStreaks?: number; errorCount?: number; totalAnalyzed?: number; }
