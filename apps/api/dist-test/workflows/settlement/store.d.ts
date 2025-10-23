import { SupabaseClient } from '@supabase/supabase-js';
import { SettlementOutcome } from './engine';
export interface SettlementUpdate {
    pickId: string;
    actualStat: number;
    outcome: SettlementOutcome;
    settlementSource: string;
    settlementNotes?: string;
}
export interface BatchSettlementResult {
    succeeded: string[];
    failed: string[];
    skipped: string[];
}
export declare class SettlementStore {
    private logger;
    private supabase;
    constructor(supabase: SupabaseClient);
    /**
     * Idempotently update a pick's settlement status
     * Only updates if settled_at is NULL (unless force=true)
     */
    updateSettlement(update: SettlementUpdate, force?: boolean): Promise<boolean>;
    /**
     * Batch update multiple settlements
     */
    batchUpdateSettlements(updates: SettlementUpdate[], force?: boolean): Promise<BatchSettlementResult>;
    /**
     * Get unsettled picks for a specific date range
     */
    getUnsettledPicks(options: {
        league?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }): Promise<any[]>;
    /**
     * Mark picks as void (e.g., due to player not playing)
     */
    voidPicks(pickIds: string[], reason: string): Promise<boolean>;
    /**
     * Get settlement statistics
     */
    getSettlementStats(dateFrom?: string, dateTo?: string): Promise<{
        total: number;
        settled: number;
        unsettled: number;
        byOutcome: Record<string, number>;
        byLeague: Record<string, number>;
    }>;
    private mapOutcomeToStatus;
    private triggerPostSettlement;
    private updateUserStats;
    private triggerWinNotification;
    private updateRelatedParlays;
    private calculateParlayOutcome;
}
//# sourceMappingURL=store.d.ts.map