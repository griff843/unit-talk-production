export type UnifiedPick = {
    id?: string;
    userId: string;
    propId?: string | null;
    gameId?: string | null;
    pickSource?: 'manual' | 'promoted' | 'events' | 'bridge_outbox';
    pickType: 'single' | 'parlay' | 'system' | 'teaser';
    outcome: string;
    line?: number | null;
    odds?: number | null;
    stake?: number | null;
    confidence?: number | null;
    workflowStage?: 'ingested' | 'validated' | 'graded' | 'pending_review' | 'promoted' | 'settled';
    status?: 'pending' | 'won' | 'lost' | 'push' | 'void' | 'cancelled';
    published?: boolean;
    tierWhenPlaced?: 'S' | 'A' | 'B' | 'C' | 'D' | null;
    analysis?: string | null;
    groupKey?: string | null;
    clvTrackingId?: string | null;
    isInstant?: boolean;
    placedAt?: string;
    updatedAt?: string;
};
export declare function createUnifiedPick(pick: UnifiedPick): Promise<UnifiedPick>;
export declare function patchUnifiedPick(id: string, patch: Partial<UnifiedPick>): Promise<UnifiedPick>;
export declare function findUnifiedPick(id: string): Promise<UnifiedPick>;
export declare function listUnifiedPicks(params?: {
    status?: string;
    published?: boolean;
    limit?: number;
}): Promise<UnifiedPick[]>;
//# sourceMappingURL=unifiedPicksRepo.d.ts.map