import { SupabaseClient } from '@supabase/supabase-js';
import { UnifiedPick } from '../../db/types/unified_picks';
interface PerformanceMetrics {
    totalAlerts: number;
    winRate: number;
    avgROI: number;
    profitLoss: number;
    byTier: Record<string, {
        count: number;
        winRate: number;
        roi: number;
    }>;
    byAdvice: Record<string, {
        count: number;
        winRate: number;
        roi: number;
    }>;
}
export declare function logAlertRecord(supabase: SupabaseClient, pick: UnifiedPick, advice: string, processingTimeMs?: number): Promise<void>;
export declare function logAlertOutcome(supabase: SupabaseClient, betId: string, outcome: 'win' | 'loss' | 'push' | 'void', actualValue?: number, profitLoss?: number, closingLine?: number): Promise<void>;
export declare function getAlertPerformanceMetrics(supabase: SupabaseClient, timeframe?: 'day' | 'week' | 'month'): Promise<PerformanceMetrics>;
export declare function getTopPerformingAdvicePatterns(supabase: SupabaseClient, limit?: number): Promise<Array<{
    advicePattern: string;
    count: number;
    winRate: number;
    avgROI: number;
    confidence: number;
}>>;
export {};
//# sourceMappingURL=log.d.ts.map