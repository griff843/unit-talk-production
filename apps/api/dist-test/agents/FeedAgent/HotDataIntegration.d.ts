import { SupabaseClient } from '@supabase/supabase-js';
export declare class HotDataIntegration {
    private supabase;
    private logger;
    private config;
    constructor(supabase: SupabaseClient, logger: any, config?: Partial<typeof this.config>);
    /**
     * Enhanced prop processing with dual write to raw_props and prop_ticks_hot
     */
    processPropsWithHotStorage(rawProps: any[]): Promise<{
        rawPropsInserted: number;
        hotTicksInserted: number;
        steamMovesDetected: number;
        processingTime: number;
        errors: string[];
    }>;
    /**
     * Process a batch of props with dual write strategy
     */
    private processBatch;
    /**
     * Transform props for raw_props table (existing format)
     */
    private transformForRawProps;
    /**
     * Transform props for prop_ticks_hot table with market intelligence
     */
    private transformForHotStorage;
    /**
     * Insert data into raw_props table
     */
    private insertRawProps;
    /**
     * Insert data into prop_ticks_hot table
     */
    private insertHotTicks;
    /**
     * Compute market intelligence for a prop
     */
    private computeMarketIntelligence;
    /**
     * Get historical movement data for steam detection
     */
    private getHistoricalMovement;
    private oddsToImpliedProbability;
    private probabilityToOdds;
    private detectSteamMove;
    private detectSharpMoney;
    private calculateMarketEfficiency;
    private calculateDataQuality;
    private calculateConfidence;
    private createBatches;
}
//# sourceMappingURL=HotDataIntegration.d.ts.map