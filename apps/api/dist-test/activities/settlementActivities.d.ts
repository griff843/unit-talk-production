export interface SettlementConfig {
    batchSize?: number;
    dryRun?: boolean;
    rateLimit?: number;
    force?: boolean;
    shadow_mode?: boolean;
    freeze_mode?: boolean;
}
export interface BackfillOptions extends SettlementConfig {
    league?: string;
    dateFrom?: string;
    dateTo?: string;
}
export interface RawProp {
    id: string;
    player_name: string;
    sport: string;
    stat_type: string;
    line: number;
    over_odds: number;
    under_odds: number;
    game_date: string;
    external_prop_id?: string;
    external_game_id?: string;
    source: string;
    outcome?: string;
    settled_at?: string;
    settlement_source?: string;
    processed_at?: string;
}
export declare function fetchUnsetlledPicks(options: BackfillOptions): Promise<RawProp[]>;
export declare function fetchPickById(id: string): Promise<RawProp | null>;
export declare function settlePick(pick: RawProp, config: SettlementConfig): Promise<{
    success: boolean;
    outcome?: string;
    actualStat?: number;
    error?: string;
}>;
export declare function rateLimitDelay(rateLimit?: number): Promise<void>;
//# sourceMappingURL=settlementActivities.d.ts.map