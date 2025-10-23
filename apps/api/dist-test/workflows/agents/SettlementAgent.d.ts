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
export interface RunIdsOptions extends SettlementConfig {
    ids: string[];
}
export interface SettlementJob {
    jobId: string;
    type: 'backfill' | 'ids' | 'live';
    options: BackfillOptions | RunIdsOptions;
    progress: SettlementProgress;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export interface SettlementProgress {
    scanned: number;
    settled: number;
    skipped: number;
    errors: number;
    failed: string[];
    eta?: Date;
}
export declare function settlementBackfillWorkflow(options: BackfillOptions): Promise<string>;
export declare function settlementIdsWorkflow(options: RunIdsOptions): Promise<string>;
export declare class SettlementAgent {
    store: Map<string, any>;
    constructor();
    initialize(): Promise<void>;
    getJobStatus(jobId: string): any;
}
//# sourceMappingURL=SettlementAgent.d.ts.map