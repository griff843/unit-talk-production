import * as z from 'zod';
import { BaseMetrics } from '../../BaseAgent/types';
export declare const AnalyticsConfigSchema: z.ZodObject<{
    agentName: z.ZodLiteral<"AnalyticsAgent">;
    analysisConfig: z.ZodObject<{
        minPicksForAnalysis: z.ZodNumber;
        roiTimeframes: z.ZodArray<z.ZodNumber, "many">;
        streakThreshold: z.ZodNumber;
        trendWindowDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        minPicksForAnalysis: number;
        roiTimeframes: number[];
        streakThreshold: number;
        trendWindowDays: number;
    }, {
        minPicksForAnalysis: number;
        roiTimeframes: number[];
        streakThreshold: number;
        trendWindowDays: number;
    }>;
    alertConfig: z.ZodObject<{
        roiAlertThreshold: z.ZodNumber;
        streakAlertThreshold: z.ZodNumber;
        volatilityThreshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        roiAlertThreshold: number;
        streakAlertThreshold: number;
        volatilityThreshold: number;
    }, {
        roiAlertThreshold: number;
        streakAlertThreshold: number;
        volatilityThreshold: number;
    }>;
}, "strip", z.ZodTypeAny, {
    agentName: "AnalyticsAgent";
    analysisConfig: {
        minPicksForAnalysis: number;
        roiTimeframes: number[];
        streakThreshold: number;
        trendWindowDays: number;
    };
    alertConfig: {
        roiAlertThreshold: number;
        streakAlertThreshold: number;
        volatilityThreshold: number;
    };
}, {
    agentName: "AnalyticsAgent";
    analysisConfig: {
        minPicksForAnalysis: number;
        roiTimeframes: number[];
        streakThreshold: number;
        trendWindowDays: number;
    };
    alertConfig: {
        roiAlertThreshold: number;
        streakAlertThreshold: number;
        volatilityThreshold: number;
    };
}>;
export type AnalyticsAgentConfig = z.infer<typeof AnalyticsConfigSchema>;
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
export interface AnalyticsMetrics extends BaseMetrics {
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
//# sourceMappingURL=index.d.ts.map